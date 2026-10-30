create function copilot_private.demo_slot(
  p_tenant uuid, p_branch uuid, p_professional uuid, p_service uuid, p_start timestamptz, p_ignore uuid
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare b public.dc_branches; s public.dc_demo_services; d public.dc_demo_professionals;
  v_end timestamptz; local_start timestamp; local_end timestamp;
begin
  -- Also serializes confirmations against hours/closures/offering configuration triggers.
  select * into b from public.dc_branches where tenant_id = p_tenant and id = p_branch and active for update;
  if not found then raise exception 'branch_not_available' using errcode = '42501'; end if;
  select * into s from public.dc_demo_services where tenant_id = p_tenant and id = p_service and active for share;
  if not found then raise exception 'service_not_available' using errcode = '22023'; end if;
  select * into d from public.dc_demo_professionals where tenant_id = p_tenant and id = p_professional and active for share;
  if not found or not exists (select 1 from public.dc_demo_offerings
    where tenant_id = p_tenant and branch_id = p_branch and professional_id = p_professional
      and service_id = p_service and active) then
    raise exception 'offering_not_available' using errcode = '22023';
  end if;
  if p_start is null or not isfinite(p_start) or p_start <= clock_timestamp() or date_trunc('minute', p_start) <> p_start then
    raise exception 'invalid_start_time' using errcode = '22023';
  end if;
  v_end := p_start + make_interval(mins => s.duration_minutes);
  local_start := p_start at time zone b.time_zone;
  local_end := v_end at time zone b.time_zone;
  if local_start::date <> local_end::date or local_end <= local_start or not exists (
    select 1 from public.dc_demo_business_hours h where h.tenant_id = p_tenant and h.branch_id = p_branch
      and h.weekday = extract(dow from local_start)::integer
      and local_start::time >= h.opens_at and local_end::time <= h.closes_at
  ) then raise exception 'outside_business_hours' using errcode = '22023'; end if;
  if exists (select 1 from public.dc_demo_closures c where c.tenant_id = p_tenant and c.branch_id = p_branch
    and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_start, v_end, '[)')) then
    raise exception 'branch_closed' using errcode = '22023';
  end if;
  if exists (select 1 from public.dc_demo_appointments a where a.tenant_id = p_tenant
    and a.professional_id = p_professional and a.status = 'scheduled'
    and a.id is distinct from p_ignore
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_start, v_end, '[)')) then
    raise exception 'slot_conflict' using errcode = '23P01';
  end if;
  return jsonb_build_object('professional_id', d.id, 'professional_name', d.name,
    'service_id', s.id, 'service_name', s.name, 'duration_minutes', s.duration_minutes,
    'quoted_price_minor', s.price_minor, 'currency', s.currency,
    'starts_at', p_start, 'ends_at', v_end);
end $$;

create function copilot_private.propose_demo_appointment(
  p_actor uuid, p_run uuid, p_request uuid, p_operation text,
  p_patient text default null, p_professional uuid default null, p_service uuid default null,
  p_start timestamptz default null, p_appointment uuid default null, p_expected_version integer default null
) returns uuid language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare r public.dc_runs; a public.dc_demo_appointments; p public.dc_proposals;
  command jsonb; fingerprint bytea;
begin
  r := copilot_private.lock_run(p_actor, p_run);
  if p_request is null or p_operation is null or p_operation not in ('book','cancel','reschedule') then
    raise exception 'invalid_operation' using errcode = '22023';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array(
    p_operation, btrim(p_patient), p_professional, p_service, p_start, p_appointment, p_expected_version
  )::text, 'UTF8'));
  select * into p from public.dc_proposals where tenant_id = r.tenant_id and branch_id = r.branch_id
    and run_id = r.id and request_id = p_request;
  if found then
    if p.request_fingerprint <> fingerprint then raise exception 'idempotency_mismatch' using errcode = '22023'; end if;
    return p.id;
  end if;
  if r.status <> 'running' then raise exception 'run_is_terminal' using errcode = '55000'; end if;
  if (select count(*) from public.dc_proposals where run_id = r.id) >= 20 then
    raise exception 'proposal_limit' using errcode = '54000';
  end if;
  if p_operation = 'book' then
    if p_appointment is not null or p_expected_version is not null or p_patient is null
      or length(btrim(p_patient)) not between 2 and 120 then
      raise exception 'invalid_booking' using errcode = '22023';
    end if;
    command := copilot_private.demo_slot(r.tenant_id, r.branch_id, p_professional, p_service, p_start, null)
      || jsonb_build_object('patient_label', btrim(p_patient));
  else
    -- Match execution lock order: branch before appointment. Otherwise a reschedule
    -- proposal could hold the appointment while a confirmation holds the branch.
    perform 1 from public.dc_branches where tenant_id = r.tenant_id and id = r.branch_id and active for update;
    if not found then raise exception 'branch_not_available' using errcode = '42501'; end if;
    select * into a from public.dc_demo_appointments where id = p_appointment
      and tenant_id = r.tenant_id and branch_id = r.branch_id and status = 'scheduled' for share;
    if not found then raise exception 'appointment_not_available' using errcode = '42501'; end if;
    if p_expected_version is null or a.version <> p_expected_version then
      raise exception 'stale_appointment' using errcode = '40001';
    end if;
    if p_operation = 'reschedule' then
      command := copilot_private.demo_slot(r.tenant_id, r.branch_id, a.professional_id, a.service_id, p_start, a.id);
    else
      command := jsonb_build_object('professional_id', a.professional_id, 'service_id', a.service_id,
        'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes);
    end if;
    command := command || jsonb_build_object('patient_label', a.patient_label,
      'appointment_id', a.id, 'expected_version', a.version);
  end if;
  insert into public.dc_proposals(tenant_id, branch_id, conversation_id, run_id, request_id,
    request_fingerprint, backend, operation, command)
    values (r.tenant_id, r.branch_id, r.conversation_id, r.id, p_request, fingerprint, 'demo', p_operation, command)
    returning id into p.id;
  return p.id;
end $$;
