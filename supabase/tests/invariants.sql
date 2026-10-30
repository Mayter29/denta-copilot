begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare code text;
begin
  begin execute command; exception when others then get stacked diagnostics code = returned_sqlstate; end;
  if code is distinct from expected then raise exception 'Expected SQLSTATE %, got % for %', expected, code, command; end if;
end $$;

select pg_temp.assert_true((select count(*) = 20 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname like 'dc_%' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity), 'RLS on all tables');
select pg_temp.assert_true(not has_function_privilege('authenticated','copilot_private.decide_demo_proposal(uuid,uuid,boolean)','execute'), 'no private decision capability for user');
select pg_temp.assert_true(not has_function_privilege('anon','public.dc_decide_demo_proposal(uuid,uuid,boolean)','execute'), 'no anonymous decision');
select pg_temp.assert_true((select bool_and(prosecdef is false) from pg_proc where pronamespace='public'::regnamespace and proname like 'dc_%'), 'public wrappers are invoker');
select pg_temp.assert_true((select count(*)=0 from pg_proc where pronamespace='public'::regnamespace and proname like 'dc_%'
 and has_function_privilege('authenticated', oid, 'execute')), 'all public mutations denied to user role');
select pg_temp.expect_error($q$insert into public.dc_demo_appointments(tenant_id,branch_id,professional_id,service_id,patient_label,starts_at,ends_at,duration_minutes)
  values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Cruce demo','2099-01-05 15:00+00','2099-01-05 15:30+00',30)$q$, '23503');
select pg_temp.expect_error($q$insert into public.dc_branches(tenant_id,code,name,time_zone)
  values ('10000000-0000-4000-8000-000000000001','invalid','Demo','Invented/Zone')$q$, '22023');

set local role anon;
select pg_temp.expect_error('select * from public.dc_demo_appointments','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=1 from public.dc_tenants),'no tenant B visibility');
select pg_temp.assert_true((select count(*)=1 from public.dc_branches),'no unassigned branch visibility');
select pg_temp.assert_true((select count(*)=1 from public.dc_demo_professionals),'no foreign professional visibility');
select pg_temp.expect_error($q$insert into public.dc_conversations(tenant_id,branch_id,created_by)
 values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001')$q$, '42501');
select pg_temp.expect_error($q$select public.dc_open_conversation('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001')$q$, '42501');
reset role;

set local role service_role;
select pg_temp.expect_error($q$select public.dc_open_conversation('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001')$q$, '42501');
select pg_temp.expect_error($q$select public.dc_open_conversation('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001')$q$, '42501');
select pg_temp.expect_error($q$select public.dc_open_conversation('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003')$q$, '42501');
select public.dc_open_conversation('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001') as convo \gset
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo', '60000000-0000-4000-8000-000000000001','secretary-test','fake','Reservar cita ficticia') as run \gset
select pg_temp.assert_true(public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo', '60000000-0000-4000-8000-000000000001','secretary-test','fake','Reservar cita ficticia') = :'run'::uuid, 'run retry idempotent');
select pg_temp.expect_error(format($q$select public.dc_begin_run('00000000-0000-4000-8000-000000000001',%L,'60000000-0000-4000-8000-000000000001','secretary-test','fake','Different')$q$, :'convo'),'22023');
select (date_trunc('week',clock_timestamp()) + interval '14 days 15 hours')::text as slot \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run',gen_random_uuid(),'book','Persona ficticia',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',:'slot') as proposal \gset
select pg_temp.expect_error(format($q$select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',%L,gen_random_uuid(),'book','Cruce ficticio',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',%L)$q$, :'run', :'slot'),'22023');
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'proposal'),'55000');
select public.dc_record_tool_event('00000000-0000-4000-8000-000000000001',:'run','call-1','findAvailability','tool_started');
select public.dc_record_source('00000000-0000-4000-8000-000000000001',:'run','50000000-0000-4000-8000-000000000001');
select pg_temp.expect_error(format($q$select public.dc_publish_run('00000000-0000-4000-8000-000000000001',%L,'proposal','Listo',array[%L::uuid],array['50000000-0000-4000-8000-000000000099'::uuid])$q$,:'run',:'proposal'),'22023');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.dc_demo_appointments),'proposal never writes agenda');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=0 from public.dc_proposals),'draft invisible before result verification');
reset role;
set local role service_role;
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run','proposal','Ya ejecuté el cambio',
 array[:'proposal'::uuid],array['50000000-0000-4000-8000-000000000001'::uuid]) as result \gset
select pg_temp.assert_true((:'result'::jsonb->>'execution')='none' and (:'result'::jsonb->>'text') like 'Propuesta pendiente%', 'server owns result state');
reset role;
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.dc_proposals),'published proposal visible to owner');
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'proposal'),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.dc_conversations),'other site cannot read conversation');
select pg_temp.assert_true((select count(*)=0 from public.dc_proposals),'other site cannot read proposal');
reset role;
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000002',%L,true)$q$,:'proposal'),'42501');
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'proposal',true) as decision \gset
select pg_temp.assert_true(public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'proposal',true)=:'decision'::jsonb,'receipt stable on retry');
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,false)$q$,:'proposal'),'55000');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.dc_demo_appointments),'one booking');
select pg_temp.assert_true((select count(*)=1 from public.dc_decisions),'one decision');
select pg_temp.assert_true((select count(*)=1 from public.dc_receipts),'one receipt');
select pg_temp.assert_true((select count(*)=1 from public.dc_message_sources),'chosen citations persist across reload');
select pg_temp.expect_error(format('update public.dc_proposals set command=''{}'' where id=%L',:'proposal'),'22023');
select pg_temp.expect_error('update public.dc_receipts set resource_snapshot=''{}''','22023');
update public.dc_memberships set active=false where user_id='00000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'proposal'),'42501');
reset role;
rollback;
select 'isolation_and_publication_ok';
