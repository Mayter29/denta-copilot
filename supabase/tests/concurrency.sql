-- Local fixtures only; helper is absent from the candidate schema.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000005');
insert into public.dc_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','scheduler');
insert into public.dc_branch_memberships(tenant_id,branch_id,user_id) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005');
create function public.test_prepare_booking(p_actor uuid, p_branch uuid, p_start timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare c uuid; r uuid; p uuid;
begin
  c := public.dc_open_conversation(p_actor, '10000000-0000-4000-8000-000000000001', p_branch);
  r := public.dc_begin_run(p_actor, c, gen_random_uuid(), 'concurrency-test', 'fake', 'Reserva concurrente ficticia');
  p := public.dc_propose_demo_appointment(p_actor, r, gen_random_uuid(), 'book', 'Persona concurrente demo',
    '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', p_start);
  perform public.dc_publish_run(p_actor, r, 'proposal', 'Pendiente', array[p], array[]::uuid[]);
  return p;
end $$;
