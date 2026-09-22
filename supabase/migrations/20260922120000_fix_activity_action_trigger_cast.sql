-- ============================================================
-- 20260922120000. RECONCILE THE activity_action ENUM DRIFT
-- ============================================================
-- WHY THIS FILE EXISTS
-- ------------------------------------------------------------
-- 001_nexus_core.sql defines:
--
--   public.activities.action public.activity_action not null
--
-- (enum: 'created','updated','deleted','completed','archived',
-- 'restored','moved','uploaded'). Three pieces of code predate or
-- ignore that contract and treat the column as plain text:
--
--   1. The audit trigger installed by
--      015_dependencies_and_activity.sql writes a bare CASE of
--      string literals into the column:
--
--        case when tg_op = 'INSERT' then 'created'
--             when tg_op = 'DELETE' then 'deleted'
--             else 'updated' end
--
--      PostgreSQL types an all-unknown-literal CASE as TEXT, and
--      there is no implicit text -> enum cast, so every row the
--      trigger recorded failed with
--
--        42804: column "action" is of type activity_action
--               but expression is of type text
--
--      Because the trigger fires AFTER ROW on projects, tasks and
--      goals, the caller's statement rolled back with it. In the
--      product, creating a project (and every task/goal write)
--      failed, and the UI showed "This workspace is temporarily
--      unavailable while its data structure is updated. Try again
--      shortly." (the humanizeDataError "column" bucket that 42804
--      falls into). THIS IS THE BUG THIS MIGRATION FIXES FIRST.
--
--   2. public.admin_activity_list() (028) compares the column to
--      text: coalesce(a.action,'') and a.action = v_action. With an
--      enum column the unknown literal '' is typed to the enum and
--      constant-folded at plan time (22P02: invalid input value for
--      enum activity_action: ""), and a.action = v_action has no
--      operator (enum = text). The admin activity feed, its search
--      and its action filter all fail.
--
--   3. public.admin_recent_activity() (026) has the same pattern:
--      coalesce(a.action, 'activity') / coalesce(a.action, '') —
--      and 'activity' is not even a valid label, so it fails at
--      plan time the same way. The workspace/user "recent activity"
--      reads that mix in the activities stream fail.
--
-- Why the suites never caught it: the PGlite fixture
-- (00_base_schema_fixture.sql) approximates activities.action as
-- plain text, where all three patterns are legal. The real 001
-- contract is the enum, so all three failures are
-- real-schema-only.
--
-- WHAT THIS FILE DOES — strictly additive, idempotent, no data risk
-- ------------------------------------------------------------
--   1. Ensures the enum type exists (no-op on the versioned
--      lineage; keeps this file applicable to minimal test worlds).
--   2. Reconciles activities.action to the enum ONLY when the column
--      is not already the enum (hosted-drift worlds where the column
--      is plain text — the same drift class as
--      20260920160000). The 015 trigger only ever writes the three
--      valid labels created/updated/deleted, so the cast is
--      lossless; a row with an unexpected value fails the cast
--      loudly instead of being silently rewritten.
--   3. Replaces public.record_workspace_activity() with the
--      identical body plus the explicit ::public.activity_action
--      cast on the action expression. 015's three trigger
--      definitions are unchanged and keep pointing at the replaced
--      function.
--   4. Replaces public.admin_activity_list() with the 028 body
--      verbatim plus the two text comparisons made enum-safe
--      (a.action::text). Filter/search/output semantics unchanged.
--   5. Replaces public.admin_recent_activity() with the 026 body
--      verbatim plus the same a.action::text treatment in the two
--      coalesce fallbacks.
--   6. Reloads the PostgREST schema cache (the column type may have
--      changed, same practice as 20260920160000).
--
-- Verification: supabase/tests/activity-action-trigger.test.mjs
-- applies the full lineage and proves a project insert succeeds and
-- records the right activity rows (create / update / delete); the
-- admin suites now exercise these functions against the real enum
-- column.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The enum type (exact labels from 001_nexus_core.sql)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typname = 'activity_action'
  ) then
    execute 'create type public.activity_action as enum (
      ''created'', ''updated'', ''deleted'', ''completed'',
      ''archived'', ''restored'', ''moved'', ''uploaded'')';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. Column drift: convert to the enum only when it is not already
--    the enum. A lineage-of-record database (001) and a live project
--    built from the hosted schema both already carry the enum, so on
--    those this block is a no-op.
-- ------------------------------------------------------------
do $$
declare
  column_type text;
begin
  if to_regclass('public.activities') is null then
    return;
  end if;

  select udt_name into column_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'activities'
     and column_name = 'action';

  if column_type is not null and column_type <> 'activity_action' then
    execute 'alter table public.activities
              alter column action type public.activity_action
              using action::text::public.activity_action';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 3. The audit trigger, with the action expression explicitly typed.
--    Body otherwise byte-identical to 015's.
-- ------------------------------------------------------------
create or replace function public.record_workspace_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  source_row record;
  label text;
begin
  if tg_op = 'DELETE' then
    source_row := old;
  else
    source_row := new;
  end if;
  label := coalesce(to_jsonb(source_row) ->> 'title', to_jsonb(source_row) ->> 'name', 'Item');

  insert into public.activities (workspace_id, actor_id, entity_type, entity_id, action, metadata)
  values (
    source_row.workspace_id,
    auth.uid(),
    case tg_table_name when 'projects' then 'project' when 'tasks' then 'task' else 'goal' end,
    source_row.id,
    (case when tg_op = 'INSERT' then 'created'
          when tg_op = 'DELETE' then 'deleted'
          else 'updated' end)::public.activity_action,
    jsonb_build_object('title', label)
  );
  return source_row;
end;
$$;

-- ------------------------------------------------------------
-- 4. public.admin_activity_list() — 028's body verbatim, with the
--    two text comparisons on activities.action made enum-safe.
-- ------------------------------------------------------------
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
    where (v_q is null or coalesce(a.action::text,'') ilike '%' || v_q || '%'
      or coalesce(a.entity_type,'') ilike '%' || v_q || '%'
      or coalesce(w.name,'') ilike '%' || v_q || '%')
      and (v_action is null or a.action::text = v_action);
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
      where (v_q is null or coalesce(a.action::text,'') ilike '%' || v_q || '%'
        or coalesce(a.entity_type,'') ilike '%' || v_q || '%'
        or coalesce(w.name,'') ilike '%' || v_q || '%')
        and (v_action is null or a.action::text = v_action)
      order by a.created_at desc, a.id desc
      limit v_size offset ((v_page - 1)::bigint * v_size)
    ) x;
  return jsonb_build_object('generated_at', now(), 'page', v_page,
    'page_size', v_size, 'search', v_q, 'action', v_action,
    'total', v_total, 'items', v_items);
end;
$$;

-- ------------------------------------------------------------
-- 5. public.admin_recent_activity() — 026's body verbatim, with the
--    two coalesce fallbacks on activities.action made enum-safe.
-- ------------------------------------------------------------
create or replace function public.admin_recent_activity(p_limit int default 12)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 12), 50));
  v_items jsonb;
begin
  perform public.admin_assert_access('viewer');

  select coalesce(jsonb_agg(entry order by occurred_at desc), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
             'id', 'user:' || u.id,
             'source', 'auth.users',
             'kind', 'account_created',
             'title', 'Account created',
             'subject', coalesce(u.email, u.id::text),
             'occurred_at', to_char(u.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ) as entry,
           u.created_at as occurred_at
    from auth.users u
    union all
    select jsonb_build_object(
             'id', 'workspace:' || w.id,
             'source', 'workspaces',
             'kind', 'workspace_created',
             'title', 'Workspace created',
             'subject', w.name,
             'occurred_at', to_char(w.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           w.created_at
    from public.workspaces w
    union all
    select jsonb_build_object(
             'id', 'subscription:' || s.id,
             'source', 'workspace_subscriptions',
             'kind', 'subscription_changed',
             'title', 'Subscription ' || s.status,
             'subject', s.plan,
             'occurred_at', to_char(s.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           s.updated_at
    from public.workspace_subscriptions s
    union all
    select jsonb_build_object(
             'id', 'activity:' || a.id,
             'source', 'activities',
             'kind', coalesce(a.action::text, 'activity'),
             'title', coalesce(a.entity_type, 'Workspace activity'),
             'subject', coalesce(a.action::text, ''),
             'occurred_at', to_char(a.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           a.created_at
    from public.activities a
  ) as stream
  limit v_limit;

  return v_items;
end;
$$;

-- ------------------------------------------------------------
-- 6. PostgREST schema cache reload
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================
-- END 20260922120000 — RECONCILE THE activity_action ENUM DRIFT
-- ============================================================
