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
