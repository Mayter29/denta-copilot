-- Membership for the real Auth test user. Target exclusively: lyphdzeazqnaepyzzisi.
-- Apply AFTER supabase/seeds/demo-secretaria.sql, from the SQL editor. Never commit a real user UUID.
-- Replace <AUTH_USER_UUID> with the test user's id (Auth > Users in the dashboard, or
-- `select id from auth.users where email = '<test email>'`). The placeholder below fails
-- closed with an invalid-uuid error instead of granting anything.
-- This file is never loaded by pnpm db:check.

-- Scheduler at the demo tenant + access to the Central branch.
do $demo_membership$
begin
insert into public.dc_memberships(tenant_id, user_id, role) values
  ('90000000-0000-4000-8000-000000000001', '<AUTH_USER_UUID>', 'scheduler');

insert into public.dc_branch_memberships(tenant_id, branch_id, user_id) values
  ('90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '<AUTH_USER_UUID>');
end
$demo_membership$;
