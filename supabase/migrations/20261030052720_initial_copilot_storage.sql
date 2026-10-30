-- Initial Denta Copilot storage. Target exclusively: lyphdzeazqnaepyzzisi.
-- Apply as ONE atomic migration; never include supabase/tests fixtures.
-- Section: 001_tables.sql
-- Tables, access policies and RPC grants form one atomic migration.
-- Target: lyphdzeazqnaepyzzisi. This file never selects or connects to a project.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema copilot_private;
revoke all on schema copilot_private from public, anon, authenticated, service_role;
alter default privileges in schema copilot_private revoke execute on functions from public;

create table public.dc_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default clock_timestamp()
);
create table public.dc_branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.dc_tenants(id),
  code text not null check (length(code) between 1 and 50),
  name text not null check (length(name) between 1 and 120),
  time_zone text not null default 'America/Costa_Rica',
  active boolean not null default true,
  unique (tenant_id, id), unique (tenant_id, code)
);
create table public.dc_memberships (
  tenant_id uuid not null references public.dc_tenants(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'scheduler', 'viewer')),
  active boolean not null default true,
  primary key (tenant_id, user_id)
);
create index dc_memberships_user on public.dc_memberships(user_id, tenant_id);
create table public.dc_branch_memberships (
  tenant_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  primary key (tenant_id, branch_id, user_id),
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id),
  foreign key (tenant_id, user_id) references public.dc_memberships(tenant_id, user_id) on delete cascade
);
create index dc_branch_memberships_user on public.dc_branch_memberships(user_id, tenant_id, branch_id);

-- Demo scheduling backend. No patients, records, prescriptions or billing ledger.
create table public.dc_demo_professionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.dc_tenants(id),
  name text not null check (length(name) between 1 and 120),
  active boolean not null default true,
  unique (tenant_id, id)
);
create table public.dc_demo_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.dc_tenants(id),
  code text not null,
  name text not null check (length(name) between 1 and 120),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_minor bigint not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  unique (tenant_id, id), unique (tenant_id, code)
);
create table public.dc_demo_offerings (
  tenant_id uuid not null,
  branch_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  active boolean not null default true,
  primary key (tenant_id, branch_id, professional_id, service_id),
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id),
  foreign key (tenant_id, professional_id) references public.dc_demo_professionals(tenant_id, id),
  foreign key (tenant_id, service_id) references public.dc_demo_services(tenant_id, id)
);
create index dc_offerings_professional on public.dc_demo_offerings(tenant_id, professional_id);
create index dc_offerings_service on public.dc_demo_offerings(tenant_id, service_id);
create table public.dc_demo_business_hours (
  tenant_id uuid not null,
  branch_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  primary key (tenant_id, branch_id, weekday, opens_at),
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id),
  check (opens_at < closes_at)
);
create table public.dc_demo_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id),
  check (starts_at < ends_at)
);
create index dc_closures_branch on public.dc_demo_closures(tenant_id, branch_id, starts_at);
create table public.dc_demo_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  patient_label text not null check (length(btrim(patient_label)) between 2 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  version integer not null default 1 check (version > 0),
  unique (tenant_id, branch_id, id),
  foreign key (tenant_id, branch_id, professional_id, service_id)
    references public.dc_demo_offerings(tenant_id, branch_id, professional_id, service_id),
  check (ends_at = starts_at + make_interval(mins => duration_minutes)),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  check (date_trunc('minute', starts_at) = starts_at),
  -- Deliberately NOT branch-scoped: one professional cannot attend two sites at once.
  exclude using gist (
    tenant_id extensions.gist_uuid_ops with =,
    professional_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled')
);
create index dc_appointments_agenda on public.dc_demo_appointments(tenant_id, branch_id, starts_at);
create index dc_appointments_offering on public.dc_demo_appointments(tenant_id, branch_id, professional_id, service_id);

-- Reusable copilot core. Clinical resource IDs live in versioned adapter commands.
create table public.dc_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  retention_until timestamptz not null default (clock_timestamp() + interval '30 days'),
  status text not null default 'open' check (status in ('open', 'closed')),
  unique (tenant_id, branch_id, id),
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id),
  check (isfinite(retention_until) and retention_until > created_at),
  foreign key (tenant_id, created_by) references public.dc_memberships(tenant_id, user_id)
    on delete set null (created_by)
);
create index dc_conversations_owner on public.dc_conversations(created_by, tenant_id, branch_id);
create table public.dc_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  conversation_id uuid not null,
  request_id uuid not null,
  request_fingerprint bytea not null check (octet_length(request_fingerprint) = 32),
  prompt_version text not null check (length(prompt_version) between 1 and 100),
  model text not null check (length(model) between 1 and 100),
  status text not null default 'running' check (status in
    ('running', 'needs_input', 'awaiting_confirmation', 'completed', 'failed', 'paused', 'cancelled')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  unique (tenant_id, branch_id, conversation_id, id),
  unique (tenant_id, branch_id, id),
  unique (tenant_id, branch_id, conversation_id, request_id),
  foreign key (tenant_id, branch_id, conversation_id) references public.dc_conversations(tenant_id, branch_id, id),
  check ((status = 'running') = (finished_at is null))
);
create table public.dc_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  conversation_id uuid not null,
  run_id uuid not null,
  sequence bigint generated always as identity,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(btrim(content)) between 1 and 2000),
  result_kind text check (result_kind in ('answer', 'needs_input', 'proposal', 'failed', 'paused')),
  created_at timestamptz not null default clock_timestamp(),
  unique (run_id, role),
  unique (tenant_id, branch_id, run_id, id),
  foreign key (tenant_id, branch_id, conversation_id, run_id) references public.dc_runs(tenant_id, branch_id, conversation_id, id),
  check ((role = 'assistant') = (result_kind is not null))
);
create index dc_messages_context on public.dc_messages(tenant_id, branch_id, conversation_id, sequence);
create table public.dc_run_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  run_id uuid not null,
  sequence bigint generated always as identity,
  kind text not null check (kind in ('tool_started', 'tool_completed')),
  tool_call_id text not null check (length(tool_call_id) between 1 and 100),
  tool_name text not null check (tool_name in
    ('listAppointments', 'findAvailability', 'searchKnowledge', 'proposeBooking', 'proposeCancellation', 'proposeReschedule')),
  created_at timestamptz not null default clock_timestamp(),
  unique (run_id, tool_call_id, kind),
  foreign key (tenant_id, branch_id, run_id) references public.dc_runs(tenant_id, branch_id, id)
);
create index dc_events_run on public.dc_run_events(tenant_id, branch_id, run_id, sequence);
create table public.dc_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  source_key text not null check (length(source_key) between 1 and 100),
  title text not null check (length(title) between 1 and 200),
  content text not null check (length(content) between 1 and 20000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  search_vector tsvector generated always as (to_tsvector('spanish'::regconfig, title || ' ' || content)) stored,
  created_at timestamptz not null default clock_timestamp(),
  unique (tenant_id, branch_id, id),
  unique (tenant_id, branch_id, source_key, content_hash),
  foreign key (tenant_id, branch_id) references public.dc_branches(tenant_id, id)
);
create index dc_sources_search on public.dc_sources using gin(search_vector);
create table public.dc_run_sources (
  tenant_id uuid not null,
  branch_id uuid not null,
  run_id uuid not null,
  source_id uuid not null,
  primary key (tenant_id, branch_id, run_id, source_id),
  foreign key (tenant_id, branch_id, run_id) references public.dc_runs(tenant_id, branch_id, id),
  foreign key (tenant_id, branch_id, source_id) references public.dc_sources(tenant_id, branch_id, id)
);
create index dc_run_sources_source on public.dc_run_sources(tenant_id, branch_id, source_id);
create table public.dc_message_sources (
  tenant_id uuid not null,
  branch_id uuid not null,
  run_id uuid not null,
  message_id uuid not null,
  source_id uuid not null,
  primary key (tenant_id, branch_id, run_id, message_id, source_id),
  foreign key (tenant_id, branch_id, run_id, message_id) references public.dc_messages(tenant_id, branch_id, run_id, id),
  foreign key (tenant_id, branch_id, run_id, source_id) references public.dc_run_sources(tenant_id, branch_id, run_id, source_id)
);
create index dc_message_sources_source on public.dc_message_sources(tenant_id, branch_id, run_id, source_id);
create table public.dc_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  conversation_id uuid not null,
  run_id uuid not null,
  request_id uuid not null,
  request_fingerprint bytea not null check (octet_length(request_fingerprint) = 32),
  backend text not null check (backend in ('demo', 'dentary')),
  operation text not null check (operation in ('book', 'cancel', 'reschedule')),
  command_version smallint not null default 1 check (command_version = 1),
  command jsonb not null check (jsonb_typeof(command) = 'object' and octet_length(command::text) <= 4096),
  status text not null default 'draft' check (status in ('draft', 'pending', 'confirmed', 'rejected', 'expired', 'discarded')),
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  expires_at timestamptz,
  unique (tenant_id, branch_id, id),
  unique (tenant_id, branch_id, conversation_id, id),
  unique (tenant_id, branch_id, run_id, request_id),
  foreign key (tenant_id, branch_id, conversation_id, run_id) references public.dc_runs(tenant_id, branch_id, conversation_id, id),
  check ((published_at is null and expires_at is null and status in ('draft', 'discarded'))
    or (published_at is not null and expires_at > published_at and status in ('pending', 'confirmed', 'rejected', 'expired')))
);
create index dc_proposals_run on public.dc_proposals(tenant_id, branch_id, conversation_id, run_id);
create index dc_proposals_pending on public.dc_proposals(tenant_id, branch_id, expires_at) where status = 'pending';
create table public.dc_decisions (
  proposal_id uuid primary key,
  tenant_id uuid not null,
  branch_id uuid not null,
  actor_id uuid,
  approved boolean not null,
  protocol text not null default 'human_endpoint' check (protocol = 'human_endpoint'),
  decided_at timestamptz not null default clock_timestamp(),
  unique (tenant_id, branch_id, proposal_id, approved),
  foreign key (tenant_id, branch_id, proposal_id) references public.dc_proposals(tenant_id, branch_id, id),
  foreign key (tenant_id, actor_id) references public.dc_memberships(tenant_id, user_id) on delete set null (actor_id)
);
create index dc_decisions_actor on public.dc_decisions(tenant_id, actor_id);
create table public.dc_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  conversation_id uuid not null,
  proposal_id uuid not null unique,
  approved boolean not null default true check (approved),
  backend text not null check (backend in ('demo', 'dentary')),
  effect_reference text not null check (length(effect_reference) between 1 and 200),
  resource_snapshot jsonb not null check (jsonb_typeof(resource_snapshot) = 'object' and octet_length(resource_snapshot::text) <= 8192),
  completed_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, branch_id, conversation_id, proposal_id) references public.dc_proposals(tenant_id, branch_id, conversation_id, id),
  foreign key (tenant_id, branch_id, proposal_id, approved) references public.dc_decisions(tenant_id, branch_id, proposal_id, approved)
);
create index dc_receipts_conversation on public.dc_receipts(tenant_id, branch_id, conversation_id, proposal_id);


-- Section: 002_access.sql
-- Definers are private, fixed-search-path and explicitly granted. No client writes.
create function copilot_private.has_branch(p_tenant uuid, p_branch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.dc_memberships m
    join public.dc_branch_memberships bm on bm.tenant_id = m.tenant_id and bm.user_id = m.user_id
    join public.dc_branches b on b.tenant_id = bm.tenant_id and b.id = bm.branch_id
    where m.tenant_id = p_tenant and bm.branch_id = p_branch
      and m.user_id = (select auth.uid()) and m.active and b.active
  )
$$;
create function copilot_private.owns_conversation(p_tenant uuid, p_branch uuid, p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select copilot_private.has_branch(p_tenant, p_branch) and exists (
    select 1 from public.dc_conversations c where c.tenant_id = p_tenant and c.branch_id = p_branch
      and c.id = p_conversation and c.created_by = (select auth.uid())
      and c.retention_until > now()
  )
$$;
create function copilot_private.owns_run(p_tenant uuid, p_branch uuid, p_run uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dc_runs r where r.tenant_id = p_tenant
    and r.branch_id = p_branch and r.id = p_run
    and copilot_private.owns_conversation(p_tenant, p_branch, r.conversation_id))
$$;

-- Trusted endpoint identity, not an actor ID supplied by the model/browser.
-- Lock permission rows so revocation and a decision serialize.
create function copilot_private.require_scheduler(p_actor uuid, p_tenant uuid, p_branch uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null then raise exception 'access_denied' using errcode = '42501'; end if;
  perform 1 from public.dc_memberships m
    join public.dc_branch_memberships bm on bm.tenant_id = m.tenant_id and bm.user_id = m.user_id
    where m.tenant_id = p_tenant and bm.branch_id = p_branch and m.user_id = p_actor
      and m.active and m.role in ('admin', 'scheduler')
    for share of m, bm;
  if not found then raise exception 'access_denied' using errcode = '42501'; end if;
end
$$;
create function copilot_private.require_conversation(p_actor uuid, p_conversation uuid)
returns public.dc_conversations language plpgsql security definer set search_path = '' as $$
declare c public.dc_conversations;
begin
  select * into c from public.dc_conversations where id = p_conversation;
  if not found or c.created_by is distinct from p_actor or c.status <> 'open'
    or c.retention_until <= clock_timestamp() then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  perform copilot_private.require_scheduler(p_actor, c.tenant_id, c.branch_id);
  if not exists (select 1 from public.dc_branches where id = c.branch_id and tenant_id = c.tenant_id and active) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return c;
end
$$;

do $$
declare name text;
begin
  foreach name in array array[
    'dc_tenants','dc_branches','dc_memberships','dc_branch_memberships',
    'dc_demo_professionals','dc_demo_services','dc_demo_offerings','dc_demo_business_hours',
    'dc_demo_closures','dc_demo_appointments','dc_conversations','dc_runs','dc_messages',
    'dc_run_events','dc_sources','dc_run_sources','dc_message_sources','dc_proposals','dc_decisions','dc_receipts'
  ] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('alter table public.%I force row level security', name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', name);
    execute format('grant select on table public.%I to authenticated', name);
  end loop;
end $$;
grant usage on schema copilot_private to authenticated, service_role;
grant execute on function copilot_private.has_branch(uuid, uuid),
  copilot_private.owns_conversation(uuid, uuid, uuid), copilot_private.owns_run(uuid, uuid, uuid)
  to authenticated;

create policy tenant_read on public.dc_tenants for select to authenticated using (
  exists (select 1 from public.dc_memberships m where m.tenant_id = dc_tenants.id and m.user_id = (select auth.uid()) and m.active)
);
create policy membership_read on public.dc_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy branch_membership_read on public.dc_branch_memberships for select to authenticated
  using (user_id = (select auth.uid()) and copilot_private.has_branch(tenant_id, branch_id));
create policy branch_read on public.dc_branches for select to authenticated
  using (copilot_private.has_branch(tenant_id, id));
create policy offering_read on public.dc_demo_offerings for select to authenticated
  using (copilot_private.has_branch(tenant_id, branch_id));
create policy professional_read on public.dc_demo_professionals for select to authenticated using (
  exists (select 1 from public.dc_demo_offerings o where o.tenant_id = dc_demo_professionals.tenant_id
    and o.professional_id = dc_demo_professionals.id)
);
create policy service_read on public.dc_demo_services for select to authenticated using (
  exists (select 1 from public.dc_demo_offerings o where o.tenant_id = dc_demo_services.tenant_id
    and o.service_id = dc_demo_services.id)
);
create policy hours_read on public.dc_demo_business_hours for select to authenticated
  using (copilot_private.has_branch(tenant_id, branch_id));
create policy closures_read on public.dc_demo_closures for select to authenticated
  using (copilot_private.has_branch(tenant_id, branch_id));
create policy appointments_read on public.dc_demo_appointments for select to authenticated
  using (copilot_private.has_branch(tenant_id, branch_id));
create policy conversation_read on public.dc_conversations for select to authenticated
  using (copilot_private.owns_conversation(tenant_id, branch_id, id));
create policy runs_read on public.dc_runs for select to authenticated
  using (copilot_private.owns_conversation(tenant_id, branch_id, conversation_id));
create policy messages_read on public.dc_messages for select to authenticated
  using (copilot_private.owns_conversation(tenant_id, branch_id, conversation_id));
create policy events_read on public.dc_run_events for select to authenticated
  using (copilot_private.owns_run(tenant_id, branch_id, run_id));
create policy sources_read on public.dc_sources for select to authenticated
  using (copilot_private.has_branch(tenant_id, branch_id));
create policy run_sources_read on public.dc_run_sources for select to authenticated
  using (copilot_private.owns_run(tenant_id, branch_id, run_id));
create policy message_sources_read on public.dc_message_sources for select to authenticated
  using (copilot_private.owns_run(tenant_id, branch_id, run_id));
create policy proposals_read on public.dc_proposals for select to authenticated
  using (status not in ('draft', 'discarded')
    and copilot_private.owns_conversation(tenant_id, branch_id, conversation_id));
create policy decisions_read on public.dc_decisions for select to authenticated using (
  exists (select 1 from public.dc_proposals p where p.tenant_id = dc_decisions.tenant_id
    and p.branch_id = dc_decisions.branch_id and p.id = dc_decisions.proposal_id)
);
create policy receipts_read on public.dc_receipts for select to authenticated
  using (copilot_private.owns_conversation(tenant_id, branch_id, conversation_id));


-- Section: 003_integrity.sql
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


-- Section: 004_runs.sql
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


-- Section: 005_demo_proposals.sql
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


-- Section: 006_demo_decisions.sql
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


-- Section: 007_rpc.sql
-- Revoke explicitly: schema default privileges alone do not override global defaults.
revoke all on all functions in schema copilot_private from public, anon, authenticated, service_role;
grant execute on function copilot_private.has_branch(uuid, uuid),
  copilot_private.owns_conversation(uuid, uuid, uuid), copilot_private.owns_run(uuid, uuid, uuid) to authenticated;

-- Public wrappers are INVOKER; privileged implementations stay in the unexposed schema.
-- Only the trusted endpoint role may submit an actor assertion or make a decision.
create function public.dc_open_conversation(p_actor uuid, p_tenant uuid, p_branch uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select copilot_private.open_conversation($1, $2, $3)
$$;
revoke all on function public.dc_open_conversation(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.dc_open_conversation(uuid, uuid, uuid), copilot_private.open_conversation(uuid, uuid, uuid) to service_role;

create function public.dc_begin_run(p_actor uuid, p_conversation uuid, p_request uuid, p_prompt_version text, p_model text, p_text text)
returns uuid language sql security invoker set search_path = '' as $$
  select copilot_private.begin_run($1, $2, $3, $4, $5, $6)
$$;
revoke all on function public.dc_begin_run(uuid, uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.dc_begin_run(uuid, uuid, uuid, text, text, text), copilot_private.begin_run(uuid, uuid, uuid, text, text, text) to service_role;

create function public.dc_record_tool_event(p_actor uuid, p_run uuid, p_call text, p_tool text, p_kind text)
returns void language sql security invoker set search_path = '' as $$
  select copilot_private.record_tool_event($1, $2, $3, $4, $5)
$$;
revoke all on function public.dc_record_tool_event(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.dc_record_tool_event(uuid, uuid, text, text, text), copilot_private.record_tool_event(uuid, uuid, text, text, text) to service_role;

create function public.dc_record_source(p_actor uuid, p_run uuid, p_source uuid)
returns void language sql security invoker set search_path = '' as $$
  select copilot_private.record_source($1, $2, $3)
$$;
revoke all on function public.dc_record_source(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.dc_record_source(uuid, uuid, uuid), copilot_private.record_source(uuid, uuid, uuid) to service_role;

create function public.dc_publish_run(p_actor uuid, p_run uuid, p_kind text, p_text text, p_proposals uuid[], p_sources uuid[])
returns jsonb language sql security invoker set search_path = '' as $$
  select copilot_private.publish_run($1, $2, $3, $4, $5, $6)
$$;
revoke all on function public.dc_publish_run(uuid, uuid, text, text, uuid[], uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.dc_publish_run(uuid, uuid, text, text, uuid[], uuid[]), copilot_private.publish_run(uuid, uuid, text, text, uuid[], uuid[]) to service_role;

create function public.dc_abort_run(p_actor uuid, p_run uuid, p_status text)
returns void language sql security invoker set search_path = '' as $$
  select copilot_private.abort_run($1, $2, $3)
$$;
revoke all on function public.dc_abort_run(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.dc_abort_run(uuid, uuid, text), copilot_private.abort_run(uuid, uuid, text) to service_role;

create function public.dc_propose_demo_appointment(p_actor uuid, p_run uuid, p_request uuid, p_operation text, p_patient text default null, p_professional uuid default null, p_service uuid default null, p_start timestamptz default null, p_appointment uuid default null, p_expected_version integer default null)
returns uuid language sql security invoker set search_path = '' as $$
  select copilot_private.propose_demo_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
$$;
revoke all on function public.dc_propose_demo_appointment(uuid, uuid, uuid, text, text, uuid, uuid, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.dc_propose_demo_appointment(uuid, uuid, uuid, text, text, uuid, uuid, timestamptz, uuid, integer), copilot_private.propose_demo_appointment(uuid, uuid, uuid, text, text, uuid, uuid, timestamptz, uuid, integer) to service_role;

create function public.dc_decide_demo_proposal(p_actor uuid, p_proposal uuid, p_approved boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select copilot_private.decide_demo_proposal($1, $2, $3)
$$;
revoke all on function public.dc_decide_demo_proposal(uuid, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.dc_decide_demo_proposal(uuid, uuid, boolean), copilot_private.decide_demo_proposal(uuid, uuid, boolean) to service_role;
