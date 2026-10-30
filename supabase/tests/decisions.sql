begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare code text;
begin
  begin execute command; exception when others then get stacked diagnostics code = returned_sqlstate; end;
  if code is distinct from expected then raise exception 'Expected SQLSTATE %, got % for %', expected, code, command; end if;
end $$;
set local role service_role;
select public.dc_open_conversation('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001') as convo \gset
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Reserva demo') as run \gset
select (date_trunc('week',clock_timestamp()) + interval '14 days 15 hours')::text as slot \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run',gen_random_uuid(),'book','Persona demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',:'slot') as proposal \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run','proposal','Pendiente',array[:'proposal'::uuid],array[]::uuid[]);
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'proposal',true) as decision \gset
select (:'decision'::jsonb#>>'{receipt,effect_reference}') as appointment \gset

-- Reschedule gets the canonical patient/professional/service from the saved appointment.
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Cambiar demo') as run2 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run2',gen_random_uuid(),'reschedule',
 'Nombre manipulado','30000000-0000-4000-8000-000000000002',null,
 (:'slot'::timestamptz+interval '1 hour'),:'appointment',1) as move \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run2','proposal','Pendiente',array[:'move'::uuid],array[]::uuid[]);
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'move',true) as moved \gset
select pg_temp.assert_true((:'moved'::jsonb#>>'{receipt,resource_snapshot,version}')='2','reschedule increments version');
select pg_temp.assert_true((:'moved'::jsonb#>>'{receipt,resource_snapshot,patient_label}')='Persona demo','canonical patient is preserved');
select pg_temp.assert_true(public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'proposal',true)=:'decision'::jsonb,'old receipt remains a snapshot');
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Cancelar demo') as run3 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run3',gen_random_uuid(),'cancel',
 null,null,null,null,:'appointment',2) as cancel \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run3','proposal','Pendiente',array[:'cancel'::uuid],array[]::uuid[]);
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'cancel',true) as cancelled \gset
select pg_temp.assert_true((:'cancelled'::jsonb#>>'{receipt,resource_snapshot,status}')='cancelled','cancellation recorded');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.dc_demo_appointments),'reschedule/cancel do not duplicate appointments');
select pg_temp.assert_true((select count(*)=3 from public.dc_receipts),'one receipt per executed action');

-- Rollback of a failed validation: catalog change cannot silently change an approved quote.
set local role service_role;
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Reserva catálogo') as run4 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run4',gen_random_uuid(),'book','Persona catálogo demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',:'slot') as catalog \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run4','proposal','Pendiente',array[:'catalog'::uuid],array[]::uuid[]);
reset role;
update public.dc_demo_services set price_minor=price_minor+100 where id='40000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'catalog'),'40001');
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'catalog',false);
reset role;
select pg_temp.assert_true((select count(*)=3 from public.dc_receipts),'rejection has no execution receipt');
select pg_temp.assert_true((select status='completed' from public.dc_runs where id=:'run4'),'rejection settles the run');
update public.dc_demo_services set price_minor=1500000 where id='40000000-0000-4000-8000-000000000001';

-- A source that exists but was not retrieved is still invalid; cancelled turns cannot publish late.
set local role service_role;
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Turno cancelable') as run5 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run5',gen_random_uuid(),'book','Borrador demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',:'slot') as draft \gset
select pg_temp.expect_error(format($q$select public.dc_publish_run('00000000-0000-4000-8000-000000000001',%L,'proposal','Pendiente',array[%L::uuid],
 array['50000000-0000-4000-8000-000000000001'::uuid])$q$,:'run5',:'draft'),'22023');
select public.dc_abort_run('00000000-0000-4000-8000-000000000001',:'run5','cancelled');
select pg_temp.expect_error(format($q$select public.dc_publish_run('00000000-0000-4000-8000-000000000001',%L,'proposal','Pendiente',array[%L::uuid],array[]::uuid[])$q$,:'run5',:'draft'),'55000');
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'draft'),'55000');
reset role;
select pg_temp.assert_true((select status='discarded' from public.dc_proposals where id=:'draft'),'cancel discards drafts');

-- Expiry fixture represents a proposal published 20 minutes ago, without modifying immutable fields.
insert into public.dc_proposals(tenant_id,branch_id,conversation_id,run_id,request_id,request_fingerprint,backend,operation,command,status,published_at,expires_at)
 select tenant_id,branch_id,conversation_id,run_id,gen_random_uuid(),request_fingerprint,backend,operation,command,'pending',
 clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '10 minutes' from public.dc_proposals where id=:'catalog'
 returning id as expired \gset
set local role service_role;
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'expired',true) as expiry \gset
select pg_temp.assert_true((:'expiry'::jsonb->>'status')='expired' and (:'expiry'::jsonb->'receipt')='null'::jsonb,'expired never executes');
reset role;

-- Existing appointment changed after proposal creation.
set local role service_role;
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Versión demo') as run6 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run6',gen_random_uuid(),'book','Versión demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',:'slot') as book2 \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run6','proposal','Pendiente',array[:'book2'::uuid],array[]::uuid[]);
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'book2',true) as booking2 \gset
select (:'booking2'::jsonb#>>'{receipt,effect_reference}') as appointment2 \gset
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Cancelar versión demo') as run7 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run7',gen_random_uuid(),'cancel',null,null,null,null,:'appointment2',1) as stale \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run7','proposal','Pendiente',array[:'stale'::uuid],array[]::uuid[]);
reset role;
update public.dc_demo_appointments set patient_label='Cambio concurrente demo' where id=:'appointment2';
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'stale'),'40001');
reset role;
select pg_temp.assert_true((select status='scheduled' from public.dc_demo_appointments where id=:'appointment2'),'failed stale cancel leaves appointment intact');

-- New closure between proposal and click is rechecked.
set local role service_role;
select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',:'stale',false);
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Horario demo') as run8 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run8',gen_random_uuid(),'book','Cierre demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',(:'slot'::timestamptz+interval '3 hours')) as closed \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run8','proposal','Pendiente',array[:'closed'::uuid],array[]::uuid[]);
reset role;
insert into public.dc_demo_closures(tenant_id,branch_id,starts_at,ends_at) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',(:'slot'::timestamptz+interval '3 hours'),(:'slot'::timestamptz+interval '4 hours'));
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'closed'),'22023');
reset role;
select pg_temp.assert_true((select count(*)=4 from public.dc_receipts),'failed closure validation adds no receipt');

-- Inject a failure AFTER changing the appointment, at receipt persistence.
set local role service_role;
select public.dc_begin_run('00000000-0000-4000-8000-000000000001',:'convo',gen_random_uuid(),'test','fake','Rollback demo') as run9 \gset
select public.dc_propose_demo_appointment('00000000-0000-4000-8000-000000000001',:'run9',gen_random_uuid(),'book','Fallo demo',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',(:'slot'::timestamptz+interval '4 hours')) as fault \gset
select public.dc_publish_run('00000000-0000-4000-8000-000000000001',:'run9','proposal','Pendiente',array[:'fault'::uuid],array[]::uuid[]);
reset role;
select count(*) as before_appointments from public.dc_demo_appointments \gset
select count(*) as before_decisions from public.dc_decisions \gset
create function pg_temp.fail_receipt() returns trigger language plpgsql as $$
begin raise exception 'injected_local_test_failure'; end $$;
create trigger local_test_receipt_failure before insert on public.dc_receipts for each row execute function pg_temp.fail_receipt();
set local role service_role;
select pg_temp.expect_error(format($q$select public.dc_decide_demo_proposal('00000000-0000-4000-8000-000000000001',%L,true)$q$,:'fault'),'P0001');
reset role;
select pg_temp.assert_true((select count(*)=:'before_appointments'::integer from public.dc_demo_appointments),'receipt failure rolls back appointment');
select pg_temp.assert_true((select count(*)=:'before_decisions'::integer from public.dc_decisions),'receipt failure rolls back decision');
select pg_temp.assert_true((select status='pending' from public.dc_proposals where id=:'fault'),'receipt failure leaves proposal retryable');
drop trigger local_test_receipt_failure on public.dc_receipts;

-- Auth deletion anonymizes actor links without rewriting historical execution evidence.
delete from auth.users where id='00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.dc_decisions where actor_id is not null),'actor anonymized');
select pg_temp.assert_true((select count(*)=4 from public.dc_receipts),'receipts survive actor deletion');
rollback;
select 'decisions_and_recovery_ok';
