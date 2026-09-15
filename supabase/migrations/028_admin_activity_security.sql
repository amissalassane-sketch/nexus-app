-- ============================================================
-- 028. ADMIN ACTIVITY, AUDIT LOG & SECURITY READS (PR 3)
-- ============================================================
-- Read-only control-plane functions. Every function is SECURITY DEFINER,
-- starts with the platform viewer gate, uses a fixed search_path and keeps
-- sort/filter vocabularies in CASE expressions (never dynamic SQL).

create or replace function public.admin_activity_list(
  p_search text default null,
  p_action text default null,
  p_page int default 1,
  p_page_size int default 25
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_q text := nullif(left(trim(coalesce(p_search, '')), 200), '');
  v_action text := nullif(left(trim(coalesce(p_action, '')), 80), '');
  v_size int := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_page int := greatest(1, coalesce(p_page, 1));
  v_offset bigint := (v_page - 1)::bigint * v_size;
  v_total bigint;
  v_items jsonb;
begin
  perform public.admin_assert_access('viewer');
  select count(*) into v_total
    from public.activities a
    left join public.workspaces w on w.id = a.workspace_id
    where (v_q is null or coalesce(a.action,'') ilike '%' || v_q || '%'
      or coalesce(a.entity_type,'') ilike '%' || v_q || '%'
      or coalesce(w.name,'') ilike '%' || v_q || '%')
      and (v_action is null or a.action = v_action);
  select coalesce(jsonb_agg(x.row order by x.occurred_at desc), '[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
        'id', a.id, 'workspace_id', a.workspace_id, 'workspace_name', w.name,
        'actor_id', a.actor_id, 'action', a.action, 'entity_type', a.entity_type,
        'entity_id', a.entity_id, 'metadata', a.metadata, 'occurred_at', a.created_at
      ) as row, a.created_at as occurred_at
      from public.activities a
      left join public.workspaces w on w.id = a.workspace_id
      where (v_q is null or coalesce(a.action,'') ilike '%' || v_q || '%'
        or coalesce(a.entity_type,'') ilike '%' || v_q || '%'
        or coalesce(w.name,'') ilike '%' || v_q || '%')
        and (v_action is null or a.action = v_action)
      order by a.created_at desc, a.id desc
      limit v_size offset ((v_page - 1)::bigint * v_size)
    ) x;
  return jsonb_build_object('generated_at', now(), 'page', v_page,
    'page_size', v_size, 'search', v_q, 'action', v_action,
    'total', v_total, 'items', v_items);
end;
$$;

create or replace function public.admin_audit_log_list(
  p_search text default null,
  p_outcome text default null,
  p_page int default 1,
  p_page_size int default 25
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_q text := nullif(left(trim(coalesce(p_search, '')), 200), '');
  v_outcome text := case p_outcome when 'success' then 'success'
    when 'denied' then 'denied' when 'failed' then 'failed' else null end;
  v_size int := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_page int := greatest(1, coalesce(p_page, 1));
  v_total bigint;
  v_items jsonb;
begin
  perform public.admin_assert_access('viewer');
  select count(*) into v_total from public.admin_audit_log a
    where (v_q is null or a.action ilike '%' || v_q || '%'
      or coalesce(a.actor_email,'') ilike '%' || v_q || '%'
      or coalesce(a.target_type,'') ilike '%' || v_q || '%')
      and (v_outcome is null or a.outcome = v_outcome);
  select coalesce(jsonb_agg(x.row order by x.created_at desc), '[]'::jsonb)
    into v_items from (
      select jsonb_build_object('id', a.id, 'actor_id', a.actor_id,
        'actor_email', a.actor_email, 'actor_role', a.actor_role,
        'action', a.action, 'outcome', a.outcome, 'target_type', a.target_type,
        'target_id', a.target_id, 'metadata', a.metadata, 'created_at', a.created_at
      ) as row, a.created_at
      from public.admin_audit_log a
      where (v_q is null or a.action ilike '%' || v_q || '%'
        or coalesce(a.actor_email,'') ilike '%' || v_q || '%'
        or coalesce(a.target_type,'') ilike '%' || v_q || '%')
        and (v_outcome is null or a.outcome = v_outcome)
      order by a.created_at desc, a.id desc
      limit v_size offset ((v_page - 1)::bigint * v_size)
    ) x;
  return jsonb_build_object('generated_at', now(), 'page', v_page,
    'page_size', v_size, 'search', v_q, 'outcome', v_outcome,
    'total', v_total, 'items', v_items);
end;
$$;

create or replace function public.admin_security_overview()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_context jsonb; v_events bigint; v_denied bigint;
begin
  perform public.admin_assert_access('viewer');
  select to_jsonb(x) into v_context from (
    select pa.role, pa.status, pa.created_at as since
    from public.platform_admins pa where pa.user_id = auth.uid() and pa.status = 'active'
    limit 1
  ) x;
  select count(*) into v_events from public.admin_audit_log;
  select count(*) into v_denied from public.admin_audit_log where outcome = 'denied';
  return jsonb_build_object(
    'generated_at', now(),
    'platform_admin', coalesce(v_context, '{}'::jsonb),
    'audit', jsonb_build_object('events_total', v_events, 'denied_total', v_denied),
    'sessions', jsonb_build_object('state','unavailable',
      'reason','GoTrue session rows are not readable without the service role key')
  );
end;
$$;

revoke all on function public.admin_activity_list(text,text,int,int) from public, anon, service_role;
revoke all on function public.admin_audit_log_list(text,text,int,int) from public, anon, service_role;
revoke all on function public.admin_security_overview() from public, anon, service_role;
grant execute on function public.admin_activity_list(text,text,int,int) to authenticated;
grant execute on function public.admin_audit_log_list(text,text,int,int) to authenticated;
grant execute on function public.admin_security_overview() to authenticated;
