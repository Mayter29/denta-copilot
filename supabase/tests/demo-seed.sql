-- Runs only in the isolated harness transaction; all demo seed rows are rolled back.
do $$
begin
  if (select count(*) from public.dc_demo_appointments where tenant_id = '90000000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'Demo seed must create three complete appointments';
  end if;
  if exists (
    select 1 from public.dc_demo_appointments a
    join public.dc_branches b on b.tenant_id = a.tenant_id and b.id = a.branch_id
    where a.tenant_id = '90000000-0000-4000-8000-000000000001' and (
      a.starts_at <= clock_timestamp() or a.ends_at <> a.starts_at + make_interval(mins => a.duration_minutes)
      or not exists (
        select 1 from public.dc_demo_business_hours h
        where h.tenant_id = a.tenant_id and h.branch_id = a.branch_id
          and h.weekday = extract(dow from a.starts_at at time zone b.time_zone)
          and (a.starts_at at time zone b.time_zone)::date = (a.ends_at at time zone b.time_zone)::date
          and (a.starts_at at time zone b.time_zone)::time >= h.opens_at
          and (a.ends_at at time zone b.time_zone)::time <= h.closes_at
      )
    )
  ) then raise exception 'Demo appointments must be future, complete and inside branch opening hours'; end if;
  if not exists (
    select 1 from public.dc_memberships m join public.dc_branch_memberships bm
      on bm.tenant_id = m.tenant_id and bm.user_id = m.user_id
    where m.tenant_id = '90000000-0000-4000-8000-000000000001'
      and m.user_id = '00000000-0000-4000-8000-000000000001' and m.role = 'scheduler'
      and bm.branch_id = '91000000-0000-4000-8000-000000000001'
  ) then raise exception 'Demo membership must grant the fixture actor only its demo branch'; end if;
end $$;
select 'controlled_demo_seed_ok';
