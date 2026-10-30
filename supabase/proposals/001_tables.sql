-- Candidate only. Apply the complete proposal in ONE transaction, after review.
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
