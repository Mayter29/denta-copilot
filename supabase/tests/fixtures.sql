-- Synthetic IDs, labels and users. Never run this fixture against a hosted project.
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'), -- tenant A, branch A1 scheduler
 ('00000000-0000-4000-8000-000000000002'), -- tenant B scheduler
 ('00000000-0000-4000-8000-000000000003'), -- tenant A viewer
 ('00000000-0000-4000-8000-000000000004'); -- tenant A, branch A2 scheduler
insert into public.dc_tenants(id,slug,name) values
 ('10000000-0000-4000-8000-000000000001','brisa-demo','Clínica Brisa Demo'),
 ('10000000-0000-4000-8000-000000000002','luna-demo','Clínica Luna Demo');
insert into public.dc_branches(id,tenant_id,code,name) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','central','Central ficticia'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','central','Central Luna ficticia'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','norte','Norte ficticia');
insert into public.dc_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','scheduler'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','scheduler'),
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','viewer'),
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','scheduler');
insert into public.dc_branch_memberships(tenant_id,branch_id,user_id)
  select m.tenant_id, b.id, m.user_id from public.dc_memberships m join public.dc_branches b on b.tenant_id=m.tenant_id
  where (m.user_id <> '00000000-0000-4000-8000-000000000004' and b.code='central')
    or (m.user_id = '00000000-0000-4000-8000-000000000004' and b.code='norte');
insert into public.dc_demo_professionals(id,tenant_id,name) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Dra. Valeria Demo'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Dr. Luna Demo');
insert into public.dc_demo_services(id,tenant_id,code,name,duration_minutes,price_minor,currency) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','evaluation','Valoración demo',30,1500000,'CRC'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','evaluation','Valoración Luna demo',30,1500000,'CRC');
insert into public.dc_demo_offerings(tenant_id,branch_id,professional_id,service_id)
  select b.tenant_id,b.id,d.id,s.id from public.dc_branches b
    join public.dc_demo_professionals d on d.tenant_id=b.tenant_id
    join public.dc_demo_services s on s.tenant_id=b.tenant_id;
insert into public.dc_demo_business_hours(tenant_id,branch_id,weekday,opens_at,closes_at)
  select b.tenant_id,b.id,day,'08:00'::time,'17:00'::time
  from public.dc_branches b cross join generate_series(1,5) day;
insert into public.dc_demo_business_hours(tenant_id,branch_id,weekday,opens_at,closes_at)
  select tenant_id,id,6,'08:00'::time,'12:00'::time from public.dc_branches;
insert into public.dc_sources(id,tenant_id,branch_id,source_key,title,content) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','hours','Horario demo','Lunes a viernes de 08:00 a 17:00.');
