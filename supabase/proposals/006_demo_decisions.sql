create function copilot_private.settle_run(p_run uuid)
returns void language sql security definer set search_path = '' as $$
  update public.dc_runs set status = 'completed' where id = p_run and status = 'awaiting_confirmation'
    and not exists (select 1 from public.dc_proposals where run_id = p_run and status = 'pending')
$$;

create function copilot_private.decide_demo_proposal(p_actor uuid, p_proposal uuid, p_approved boolean)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare p public.dc_proposals; a public.dc_demo_appointments; v_now timestamptz;
  slot jsonb; receipt public.dc_receipts; prior public.dc_decisions;
begin
  if p_approved is null then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into p from public.dc_proposals where id = p_proposal;
  if not found then raise exception 'access_denied' using errcode = '42501'; end if;
  -- Authorize even a replay. Revoked users must not obtain old receipts.
  perform copilot_private.require_conversation(p_actor, p.conversation_id);
  -- Consistent order: branch, proposal, appointment. Cross-site races use GiST exclusion.
  perform 1 from public.dc_branches where tenant_id = p.tenant_id and id = p.branch_id and active for update;
  if not found then raise exception 'access_denied' using errcode = '42501'; end if;
  select * into p from public.dc_proposals where id = p_proposal for update;
  if p.backend <> 'demo' or p.command_version <> 1 then
    raise exception 'unsupported_backend' using errcode = '22023';
  end if;
  select * into prior from public.dc_decisions where proposal_id = p.id;
  if found then
    if prior.approved <> p_approved then raise exception 'decision_already_taken' using errcode = '55000'; end if;
    select * into receipt from public.dc_receipts where proposal_id = p.id;
    return jsonb_build_object('status', p.status, 'receipt', case when receipt.id is null then null else to_jsonb(receipt) end);
  end if;
  if p.status = 'expired' then return jsonb_build_object('status', 'expired', 'receipt', null); end if;
  if p.status <> 'pending' then raise exception 'proposal_not_published' using errcode = '55000'; end if;
  v_now := clock_timestamp(); -- AFTER waiting for locks; transaction start time is insufficient.
  if p.expires_at <= v_now then
    update public.dc_proposals set status = 'expired' where id = p.id;
    perform copilot_private.settle_run(p.run_id);
    return jsonb_build_object('status', 'expired', 'receipt', null);
  end if;
  if not p_approved then
    insert into public.dc_decisions(tenant_id, branch_id, proposal_id, actor_id, approved)
      values (p.tenant_id, p.branch_id, p.id, p_actor, false);
    update public.dc_proposals set status = 'rejected' where id = p.id;
    perform copilot_private.settle_run(p.run_id);
    return jsonb_build_object('status', 'rejected', 'receipt', null);
  end if;
  if p.operation <> 'book' then
    select * into a from public.dc_demo_appointments
      where tenant_id = p.tenant_id and branch_id = p.branch_id and id = (p.command->>'appointment_id')::uuid for update;
    if not found or a.status <> 'scheduled' or a.version <> (p.command->>'expected_version')::integer then
      raise exception 'stale_appointment' using errcode = '40001';
    end if;
  end if;
  if p.operation <> 'cancel' then
    slot := copilot_private.demo_slot(p.tenant_id, p.branch_id,
      (p.command->>'professional_id')::uuid, (p.command->>'service_id')::uuid,
      (p.command->>'starts_at')::timestamptz, a.id);
    if not p.command @> slot then raise exception 'catalog_changed' using errcode = '40001'; end if;
    if p.operation = 'book' then
      insert into public.dc_demo_appointments(tenant_id, branch_id, professional_id, service_id, patient_label,
        starts_at, ends_at, duration_minutes)
        values (p.tenant_id, p.branch_id, (p.command->>'professional_id')::uuid,
          (p.command->>'service_id')::uuid, p.command->>'patient_label',
          (slot->>'starts_at')::timestamptz, (slot->>'ends_at')::timestamptz,
          (slot->>'duration_minutes')::integer) returning * into a;
    else
      update public.dc_demo_appointments set starts_at = (slot->>'starts_at')::timestamptz,
        ends_at = (slot->>'ends_at')::timestamptz, duration_minutes = (slot->>'duration_minutes')::integer
        where id = a.id returning * into a;
    end if;
    if a.starts_at <= clock_timestamp() then raise exception 'start_time_passed' using errcode = '22023'; end if;
  else
    update public.dc_demo_appointments set status = 'cancelled' where id = a.id returning * into a;
  end if;
  insert into public.dc_decisions(tenant_id, branch_id, proposal_id, actor_id, approved)
    values (p.tenant_id, p.branch_id, p.id, p_actor, true);
  insert into public.dc_receipts(tenant_id, branch_id, conversation_id, proposal_id, backend, effect_reference, resource_snapshot)
    values (p.tenant_id, p.branch_id, p.conversation_id, p.id, 'demo', a.id::text, to_jsonb(a)) returning * into receipt;
  update public.dc_proposals set status = 'confirmed' where id = p.id;
  perform copilot_private.settle_run(p.run_id);
  return jsonb_build_object('status', 'confirmed', 'receipt', to_jsonb(receipt));
end $$;
