create function copilot_private.open_conversation(p_actor uuid, p_tenant uuid, p_branch uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform copilot_private.require_scheduler(p_actor, p_tenant, p_branch);
  perform 1 from public.dc_branches where tenant_id = p_tenant and id = p_branch and active for share;
  if not found then raise exception 'access_denied' using errcode = '42501'; end if;
  insert into public.dc_conversations(tenant_id, branch_id, created_by)
    values (p_tenant, p_branch, p_actor) returning id into v_id;
  return v_id;
end $$;

create function copilot_private.begin_run(
  p_actor uuid, p_conversation uuid, p_request uuid, p_prompt_version text, p_model text, p_text text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.dc_conversations; r public.dc_runs; fingerprint bytea;
begin
  c := copilot_private.require_conversation(p_actor, p_conversation);
  -- Serialize turn creation; reject a second active run instead of merging histories.
  perform 1 from public.dc_conversations where id = c.id for update;
  if p_request is null or length(btrim(p_text)) not between 1 and 2000
    or length(p_prompt_version) not between 1 and 100 or length(p_model) not between 1 and 100
    or p_text is null or p_model is null or p_prompt_version is null then
    raise exception 'invalid_run_input' using errcode = '22023';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array(p_prompt_version, p_model, btrim(p_text))::text, 'UTF8'));
  select * into r from public.dc_runs where tenant_id = c.tenant_id and branch_id = c.branch_id
    and conversation_id = c.id and request_id = p_request;
  if found then
    if r.request_fingerprint <> fingerprint then raise exception 'idempotency_mismatch' using errcode = '22023'; end if;
    return r.id;
  end if;
  if exists (select 1 from public.dc_runs where conversation_id = c.id and status = 'running') then
    raise exception 'run_already_active' using errcode = '55000';
  end if;
  insert into public.dc_runs(tenant_id, branch_id, conversation_id, request_id, request_fingerprint, prompt_version, model)
    values (c.tenant_id, c.branch_id, c.id, p_request, fingerprint, p_prompt_version, p_model) returning * into r;
  insert into public.dc_messages(tenant_id, branch_id, conversation_id, run_id, role, content)
    values (c.tenant_id, c.branch_id, c.id, r.id, 'user', btrim(p_text));
  return r.id;
end $$;

create function copilot_private.lock_run(p_actor uuid, p_run uuid)
returns public.dc_runs language plpgsql security definer set search_path = '' as $$
declare r public.dc_runs;
begin
  select * into r from public.dc_runs where id = p_run;
  if not found then raise exception 'access_denied' using errcode = '42501'; end if;
  perform copilot_private.require_conversation(p_actor, r.conversation_id);
  select * into r from public.dc_runs where id = p_run for update;
  return r;
end $$;

create function copilot_private.record_tool_event(p_actor uuid, p_run uuid, p_call text, p_tool text, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.dc_runs;
begin
  r := copilot_private.lock_run(p_actor, p_run);
  if r.status <> 'running' then raise exception 'run_is_terminal' using errcode = '55000'; end if;
  if (select count(*) from public.dc_run_events where run_id = r.id) >= 100 then
    raise exception 'event_limit' using errcode = '54000';
  end if;
  insert into public.dc_run_events(tenant_id, branch_id, run_id, tool_call_id, tool_name, kind)
    values (r.tenant_id, r.branch_id, r.id, p_call, p_tool, p_kind)
    on conflict (run_id, tool_call_id, kind) do nothing;
end $$;

create function copilot_private.record_source(p_actor uuid, p_run uuid, p_source uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.dc_runs;
begin
  r := copilot_private.lock_run(p_actor, p_run);
  if r.status <> 'running' then raise exception 'run_is_terminal' using errcode = '55000'; end if;
  if not exists (select 1 from public.dc_sources where id = p_source and tenant_id = r.tenant_id and branch_id = r.branch_id) then
    raise exception 'source_not_available' using errcode = '42501';
  end if;
  insert into public.dc_run_sources(tenant_id, branch_id, run_id, source_id)
    values (r.tenant_id, r.branch_id, r.id, p_source) on conflict do nothing;
end $$;

create function copilot_private.publish_run(
  p_actor uuid, p_run uuid, p_kind text, p_text text, p_proposals uuid[], p_sources uuid[]
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare r public.dc_runs; n integer; v_now timestamptz; text_result text; message_id uuid;
begin
  r := copilot_private.lock_run(p_actor, p_run);
  if r.status <> 'running' then raise exception 'run_is_terminal' using errcode = '55000'; end if;
  if p_kind is null or p_kind not in ('answer', 'needs_input', 'proposal')
    or p_text is null or length(btrim(p_text)) not between 1 and 2000
    or p_proposals is null or p_sources is null
    or cardinality(p_proposals) > 20 or cardinality(p_sources) > 5
    or array_position(p_proposals, null) is not null or array_position(p_sources, null) is not null
    or cardinality(p_proposals) <> (select count(distinct x) from unnest(p_proposals) x)
    or cardinality(p_sources) <> (select count(distinct x) from unnest(p_sources) x) then
    raise exception 'invalid_result' using errcode = '22023';
  end if;
  select count(*) into n from public.dc_proposals where run_id = r.id and status = 'draft';
  if n <> cardinality(p_proposals) or (p_kind = 'proposal') <> (n > 0)
    or exists (select 1 from unnest(p_proposals) x where not exists (
      select 1 from public.dc_proposals p where p.id = x and p.run_id = r.id and p.status = 'draft'))
    or exists (select 1 from unnest(p_sources) x where not exists (
      select 1 from public.dc_run_sources s where s.run_id = r.id and s.source_id = x)) then
    raise exception 'unverified_references' using errcode = '22023';
  end if;
  v_now := clock_timestamp();
  text_result := case when p_kind = 'proposal'
    then 'Propuesta pendiente. Revisá la tarjeta y confirmá con un clic para aplicar el cambio.'
    else btrim(p_text) end;
  update public.dc_proposals set status = 'pending', published_at = v_now, expires_at = v_now + interval '10 minutes'
    where run_id = r.id and status = 'draft';
  insert into public.dc_messages(tenant_id, branch_id, conversation_id, run_id, role, content, result_kind)
    values (r.tenant_id, r.branch_id, r.conversation_id, r.id, 'assistant', text_result, p_kind) returning id into message_id;
  insert into public.dc_message_sources(tenant_id, branch_id, run_id, message_id, source_id)
    select r.tenant_id, r.branch_id, r.id, message_id, x from unnest(p_sources) x;
  update public.dc_runs set status = case p_kind when 'proposal' then 'awaiting_confirmation'
    when 'needs_input' then 'needs_input' else 'completed' end, finished_at = v_now where id = r.id;
  return jsonb_build_object('kind', p_kind, 'text', text_result, 'execution', 'none',
    'proposal_ids', p_proposals, 'source_ids', p_sources);
end $$;

create function copilot_private.abort_run(p_actor uuid, p_run uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.dc_runs;
begin
  r := copilot_private.lock_run(p_actor, p_run);
  if p_status is null or p_status not in ('failed', 'paused', 'cancelled') then
    raise exception 'invalid_run_status' using errcode = '22023';
  end if;
  -- A cancellation cannot erase a published result or undo an execution.
  if r.status <> 'running' then return; end if;
  update public.dc_proposals set status = 'discarded' where run_id = r.id and status = 'draft';
  update public.dc_runs set status = p_status, finished_at = clock_timestamp() where id = r.id;
  insert into public.dc_messages(tenant_id, branch_id, conversation_id, run_id, role, content, result_kind)
    values (r.tenant_id, r.branch_id, r.conversation_id, r.id, 'assistant',
      'El turno terminó sin publicar propuestas ni aplicar cambios de agenda.',
      case when p_status = 'failed' then 'failed' else 'paused' end);
end $$;
