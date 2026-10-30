create function copilot_private.validate_branch_zone()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger dc_branch_zone before insert or update of time_zone on public.dc_branches
  for each row execute function copilot_private.validate_branch_zone();

create function copilot_private.lock_branch_config()
returns trigger language plpgsql set search_path = '' as $$
declare t uuid; b uuid;
begin
  if tg_op = 'UPDATE' and (new.tenant_id, new.branch_id) is distinct from (old.tenant_id, old.branch_id) then
    raise exception 'scope_is_immutable' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then t := old.tenant_id; b := old.branch_id;
  else t := new.tenant_id; b := new.branch_id; end if;
  perform 1 from public.dc_branches where tenant_id = t and id = b for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger dc_hours_lock before insert or update or delete on public.dc_demo_business_hours
  for each row execute function copilot_private.lock_branch_config();
create trigger dc_closures_lock before insert or update or delete on public.dc_demo_closures
  for each row execute function copilot_private.lock_branch_config();
create trigger dc_offerings_lock before insert or update or delete on public.dc_demo_offerings
  for each row execute function copilot_private.lock_branch_config();

create function copilot_private.appointment_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id, new.tenant_id, new.branch_id) is distinct from (old.id, old.tenant_id, old.branch_id) then
    raise exception 'scope_is_immutable' using errcode = '22023';
  end if;
  new.version := old.version + 1;
  return new;
end $$;
create trigger dc_appointment_version before update on public.dc_demo_appointments
  for each row execute function copilot_private.appointment_version();

create function copilot_private.protect_proposal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'status' - 'published_at' - 'expires_at')
    is distinct from (to_jsonb(old) - 'status' - 'published_at' - 'expires_at') then
    raise exception 'proposal_is_immutable' using errcode = '22023';
  end if;
  if old.status <> 'draft' and (new.published_at, new.expires_at) is distinct from (old.published_at, old.expires_at) then
    raise exception 'proposal_expiry_is_immutable' using errcode = '22023';
  end if;
  if new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('pending', 'discarded')) or
    (old.status = 'pending' and new.status in ('confirmed', 'rejected', 'expired'))
  ) then raise exception 'invalid_proposal_transition' using errcode = '22023'; end if;
  return new;
end $$;
create trigger dc_proposal_immutable before update on public.dc_proposals
  for each row execute function copilot_private.protect_proposal();

create function copilot_private.append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Preserve receipts while allowing Auth user deletion to anonymize the decision actor.
  if tg_table_name = 'dc_decisions' and tg_op = 'UPDATE' then
    if new.actor_id is null and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then return new; end if;
  end if;
  raise exception 'append_only_record' using errcode = '22023';
end $$;
create trigger dc_receipt_immutable before update or delete on public.dc_receipts
  for each row execute function copilot_private.append_only();
create trigger dc_decision_immutable before update or delete on public.dc_decisions
  for each row execute function copilot_private.append_only();
create trigger dc_event_immutable before update or delete on public.dc_run_events
  for each row execute function copilot_private.append_only();
create trigger dc_message_immutable before update or delete on public.dc_messages
  for each row execute function copilot_private.append_only();
create trigger dc_source_immutable before update or delete on public.dc_sources
  for each row execute function copilot_private.append_only();

create function copilot_private.source_hash()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.content_hash := encode(sha256(convert_to(new.title || chr(10) || new.content, 'UTF8')), 'hex');
  return new;
end $$;
create trigger dc_source_hash before insert on public.dc_sources
  for each row execute function copilot_private.source_hash();
