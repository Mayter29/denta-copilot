-- Controlled, reproducible demo seed. Target exclusively: lyphdzeazqnaepyzzisi.
-- NEVER run fixtures from supabase/tests against a hosted project; this seed is the only
-- file meant for the remote demo, applied manually from the SQL editor in this order:
--   1. supabase/seeds/demo-secretaria.sql (this file: tenant, branch, catalog, hours, sources, appointments)
--   2. supabase/seeds/grant-membership.sql (membership for the real Auth test user)
-- No users, passwords, emails, patients or clinical records are created here. All labels are fictitious.
-- Appointments use relative times so they stay in the future whenever the seed runs.
-- Rerunning this file duplicates rows: it is meant to run once per demo tenant. Use a fresh
-- tenant slug per reset instead of reapplying.

-- Tenant + branch ---------------------------------------------------------
insert into public.dc_tenants(id, slug, name) values
  ('90000000-0000-4000-8000-000000000001', 'brisa-demo', 'Clínica Brisa Demo');

insert into public.dc_branches(id, tenant_id, code, name, time_zone, active) values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    'central', 'Sede Central (demo)', 'America/Costa_Rica', true);

-- Catalog: two professionals, two services, full offering -----------------
insert into public.dc_demo_professionals(id, tenant_id, name) values
  ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'Dra. Valeria Demo'),
  ('92000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'Dr. Andrés Demo');

insert into public.dc_demo_services(id, tenant_id, code, name, duration_minutes, price_minor, currency) values
  ('93000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    'evaluation', 'Valoración demo', 30, 1500000, 'CRC'),
  ('93000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    'cleaning', 'Limpieza demo', 60, 3000000, 'CRC');

insert into public.dc_demo_offerings(tenant_id, branch_id, professional_id, service_id)
  select '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', p.id, s.id
  from public.dc_demo_professionals p cross join public.dc_demo_services s
  where p.tenant_id = '90000000-0000-4000-8000-000000000001'
    and s.tenant_id = '90000000-0000-4000-8000-000000000001';

-- Business hours mirror the local demo grid --------------------------------
insert into public.dc_demo_business_hours(tenant_id, branch_id, weekday, opens_at, closes_at)
  select '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', day, '08:00'::time, '17:00'::time
  from generate_series(1, 5) day;

insert into public.dc_demo_business_hours(tenant_id, branch_id, weekday, opens_at, closes_at)
  values ('90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 6, '08:00'::time, '12:00'::time);

-- Versioned sources mirror the local static knowledge ----------------------
insert into public.dc_sources(id, tenant_id, branch_id, source_key, title, content) values
  ('94000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    'hours', 'Horario y profesionales',
    'Atendemos de lunes a viernes de 08:00 a 17:00. Los sábados de 08:00 a 12:00. Domingos cerrado. Dra. Valeria Demo y Dr. Andrés Demo atienden valoración y limpieza. La cita completa debe caber en horario. No se permiten citas simultáneas con el mismo profesional.'),
  ('94000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    'services', 'Servicios y tarifas de demostración',
    'Valoración: 30 minutos, ₡15.000. Limpieza dental: 60 minutos, ₡30.000. Precios ficticios para demostración. El agente no diagnostica, prescribe ni recomienda tratamientos.'),
  ('94000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    'booking', 'Reservas, cancelaciones y cambios',
    'Para reservar se necesita nombre ficticio del paciente, servicio, profesional, fecha y hora. Consultar disponibilidad real antes de proponer. Cancelar y reagendar requieren identificar la cita sin ambigüedad. Toda escritura requiere confirmar la tarjeta. Una propuesta no reserva el espacio. Su vigencia es de 10 minutos; al confirmar se verifica otra vez la disponibilidad.');

-- Appointments: tomorrow and the day after, always in the future ------------
insert into public.dc_demo_appointments(tenant_id, branch_id, professional_id, service_id, patient_label, starts_at, duration_minutes, status)
  select '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002',
    'Ana Mora (demo)',
    ((date_trunc('day', now() at time zone 'America/Costa_Rica') + interval '1 day 09:00') at time zone 'America/Costa_Rica'),
    60, 'scheduled'
  union all
  select '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000001',
    'Luis Solís (demo)',
    ((date_trunc('day', now() at time zone 'America/Costa_Rica') + interval '1 day 10:30') at time zone 'America/Costa_Rica'),
    30, 'scheduled'
  union all
  select '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001',
    'Sofía Rojas (demo)',
    ((date_trunc('day', now() at time zone 'America/Costa_Rica') + interval '2 days 14:00') at time zone 'America/Costa_Rica'),
    30, 'scheduled';
