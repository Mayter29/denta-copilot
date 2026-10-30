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
