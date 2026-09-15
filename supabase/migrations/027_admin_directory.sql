-- ============================================================
-- 027. ADMIN CONTROL PLANE — USERS & WORKSPACES (PR 2)
-- ============================================================
-- The Overview (026) answers "how big is the platform?". This migration
-- answers "who is on it, and what do their workspaces contain?" — the
-- directory and inspector reads behind:
--
--   /admin/users            /admin/users/[userId]
--   /admin/workspaces       /admin/workspaces/[workspaceId]
--
-- It is strictly read-only. No mutation of a user, membership, workspace
-- or subscription is possible through anything in this file. The moment a
-- write surface is added it must come with its own permission check and
-- an admin_audit_record() entry; reads do not pollute the audit trail
-- (026 established that principle: only refusals and actions are logged).
--
-- ------------------------------------------------------------
-- WHY THESE FUNCTIONS EXIST (SECURITY DEFINER justification)
-- ------------------------------------------------------------
-- A platform admin must see across tenants. Ordinary RLS on profiles /
-- workspaces / workspace_members / tasks is membership-scoped and gives
-- even an operator zero rows. 026 solved this with admin_overview(), one
-- aggregate behind one gate. This file follows the same rules, one
-- function per question:
--
--   * every function opens with `perform public.admin_assert_access(...)`
--     — the same gate the Overview uses; fail closed, always;
--   * `security definer` with an explicit `search_path = public, pg_temp`
--     (the pg_temp entry blocks temp-schema shadowing);
--   * every relation is fully qualified;
--   * there is NO dynamic SQL: sort keys and filters are whitelisted with
--     CASE expressions, so a caller-supplied string can never become an
--     identifier. (SECURITY-ADMIN-03 in the test suite enforces this.)
--   * EXECUTE is revoked from PUBLIC / anon / service_role and granted to
--     `authenticated` ONLY — and because the definer re-checks the caller
--     via the JWT, holding that grant buys a non-admin nothing.
--
-- ------------------------------------------------------------
-- WHAT "STATUS" MEANS HERE (honesty contract)
-- ------------------------------------------------------------
-- auth.users has no status column in this product's schema. Rather than
-- invent one, account_status is DERIVED from real GoTrue columns:
--
--   'banned'  — banned_until is a future timestamp. GoTrue sets it when
--               an operator bans a user; this app never does, so it is
--               normally NULL. It is still worth surfacing because it can
--               be set out-of-band and silently locks a customer out.
--   'pending' — email_confirmed_at IS NULL: the signup flow has a real
--               /verify-email route, so unconfirmed accounts exist.
--   'active'  — everything else.
--
-- "Last activity" is greatest(last_sign_in_at, newest row this account
-- caused in public.activities) — two real signals, never a guess, and
-- NULL (rendered "Not available") when neither exists.
--
-- A workspace has no status either. Its health is reported as a boolean
-- the Overview already computes — has_active_owner — plus the plan row
-- from workspace_subscriptions. Absent row means the default FREE plan
-- (get_workspace_plan() says so), and has_subscription=false distinguishes
-- "default" from "measured" in the UI.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS — THE DIRECTORY
-- ------------------------------------------------------------
create or replace function public.admin_users_list(
  p_search     text default null,
  p_status     text default 'all',
  p_sort       text default 'created_at',
  p_direction  text default 'desc',
  p_page       int  default 1,
  p_page_size  int  default 25
)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_q      text := nullif(trim(coalesce(p_search, '')), '');
  v_like   text;
  v_status text := case p_status
                     when 'active'     then 'active'
                     when 'pending'    then 'pending'
                     when 'banned'     then 'banned'
                     when 'no_profile' then 'no_profile'
                     else 'all'   -- unknown filter → no filter, never an error page
                   end;
  v_sort   text := case p_sort
                     when 'email'        then 'email'
                     when 'name'         then 'name'
                     when 'last_activity' then 'last_activity'
                     when 'workspaces'   then 'workspaces'
                     else 'created_at'
                   end;
  v_asc    boolean := coalesce(lower(nullif(p_direction, '')), 'desc') = 'asc';
  v_size   int := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_page   int := greatest(1, coalesce(p_page, 1));
  v_offset bigint := (v_page - 1)::bigint * v_size;
begin
  perform public.admin_assert_access('viewer');

  -- Pattern escaping for ILIKE. With standard_conforming_strings the
  -- backslash is LIKE's default escape character; % _ \ from the caller
  -- must become literals rather than wildcards.
  if v_q is not null then
    v_like := '%' ||
      replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  end if;

  return jsonb_build_object(
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'page',      v_page,
    'page_size', v_size,
    'sort',      v_sort,
    'direction', case when v_asc then 'asc' else 'desc' end,
    'search',    v_q,
    'status',    v_status,
    'total',     coalesce((select total_count from (
                   select count(*) over () as total_count
                   from auth.users u0
                   left join public.profiles p0 on p0.id = u0.id
                   where (v_like is null or (
                            u0.email ilike v_like
                            or p0.username ilike v_like
                            or p0.display_name ilike v_like
                            or u0.id::text = v_q
                          ))
                     and (v_status = 'all'
                          or (v_status = 'active'     and u0.banned_until is null
                              and u0.email_confirmed_at is not null)
                          or (v_status = 'pending'    and u0.banned_until is null
                              and u0.email_confirmed_at is null)
                          or (v_status = 'banned'     and u0.banned_until is not null
                              and u0.banned_until > now())
                          or (v_status = 'no_profile' and p0.id is null))
                 ) t limit 1), 0),

    'items', coalesce((
      select jsonb_agg(entry.item order by entry.rn)
      from (
        select
          jsonb_build_object(
            'user_id',          u.id::text,
            'email',            u.email,
            'display_name',     p.display_name,
            'username',         p.username,
            'has_profile',      p.id is not null,
            'created_at',       to_char(u.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'last_sign_in_at',  to_char(u.last_sign_in_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'last_activity_at', to_char(greatest(u.last_sign_in_at, act.last_activity) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'email_confirmed',  u.email_confirmed_at is not null,
            'banned_until',     to_char(u.banned_until at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'account_status',   case
                                  when u.banned_until is not null and u.banned_until > now() then 'banned'
                                  when u.email_confirmed_at is null then 'pending'
                                  else 'active'
                                end,
            'memberships',      jsonb_build_object(
                                  'total',  coalesce(mem.total, 0),
                                  'active', coalesce(mem.active, 0),
                                  'owned',  coalesce(mem.owned, 0)
                                ),
            'platform_role',    adm.role
          ) as item,
          row_number() over (
            order by
              -- One branch per (sort, direction) pair. Only the selected
              -- branch is ever non-constant; the rest collapse to NULL and
              -- sort as ties. Static SQL, no identifiers from the caller.
              case when v_sort = 'created_at'    and v_asc     then u.created_at end asc nulls first,
              case when v_sort = 'created_at'    and not v_asc then u.created_at end desc nulls last,
              case when v_sort = 'email'         and v_asc     then lower(u.email) end asc nulls first,
              case when v_sort = 'email'         and not v_asc then lower(u.email) end desc nulls last,
              case when v_sort = 'name'          and v_asc     then lower(coalesce(p.display_name, p.username, u.email)) end asc nulls first,
              case when v_sort = 'name'          and not v_asc then lower(coalesce(p.display_name, p.username, u.email)) end desc nulls last,
              case when v_sort = 'last_activity' and v_asc     then greatest(u.last_sign_in_at, act.last_activity) end asc nulls first,
              case when v_sort = 'last_activity' and not v_asc then greatest(u.last_sign_in_at, act.last_activity) end desc nulls last,
              case when v_sort = 'workspaces'    and v_asc     then coalesce(mem.total, 0) end asc nulls first,
              case when v_sort = 'workspaces'    and not v_asc then coalesce(mem.total, 0) end desc nulls last,
              -- Deterministic tiebreak so two pages never skip or repeat a row.
              u.id asc
          ) as rn
        from auth.users u
        left join public.profiles p on p.id = u.id
        -- One aggregate per user, resolved inside this single statement —
        -- the app never loops per row, so there is no N+1 above the SQL.
        left join lateral (
          select count(*)::int as total,
                 count(*) filter (where m.status = 'active')::int as active,
                 count(*) filter (where m.role = 'owner')::int as owned
          from public.workspace_members m
          where m.user_id = u.id
        ) mem on true
        left join lateral (
          select max(a.created_at) as last_activity
          from public.activities a
          where a.actor_id = u.id
        ) act on true
        left join public.platform_admins adm
          on adm.user_id = u.id and adm.status = 'active'
        where (v_like is null or (
                 u.email ilike v_like
                 or p.username ilike v_like
                 or p.display_name ilike v_like
                 or u.id::text = v_q
               ))
          and (v_status = 'all'
               or (v_status = 'active'     and u.banned_until is null
                   and u.email_confirmed_at is not null)
               or (v_status = 'pending'    and u.banned_until is null
                   and u.email_confirmed_at is null)
               or (v_status = 'banned'     and u.banned_until is not null
                   and u.banned_until > now())
               or (v_status = 'no_profile' and p.id is null))
      ) as entry
      where entry.rn > v_offset and entry.rn <= v_offset + v_size
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 2. USER INSPECTOR
-- ------------------------------------------------------------
-- Returns NULL for an id that does not exist. The page renders a real
-- "not found" state from that; an error response never reaches here.
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := p_user_id;
  v_found boolean;
begin
  perform public.admin_assert_access('viewer');

  if v_uid is null then
    return null;
  end if;

  select exists (select 1 from auth.users u where u.id = v_uid) into v_found;
  if not v_found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'identity', jsonb_build_object(
        'user_id',          u.id::text,
        'email',            u.email,
        'display_name',     p.display_name,
        'username',         p.username,
        'job_title',        p.job_title,
        'bio',              p.bio,
        'avatar_url',       p.avatar_url,
        'created_at',       to_char(u.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'profile_created_at', to_char(p.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'profile_updated_at', to_char(p.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      -- Only columns GoTrue actually maintains. No fabricated fields.
      'account', jsonb_build_object(
        'has_profile',       p.id is not null,
        'email_confirmed',   u.email_confirmed_at is not null,
        'email_confirmed_at', to_char(u.email_confirmed_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'last_sign_in_at',   to_char(u.last_sign_in_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'banned_until',      to_char(u.banned_until at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'onboarding_completed', coalesce(p.onboarding_completed, false),
        'account_status',    case
                               when u.banned_until is not null and u.banned_until > now() then 'banned'
                               when u.email_confirmed_at is null then 'pending'
                               else 'active'
                             end,
        'last_activity_at',  to_char(greatest(u.last_sign_in_at, ua.last_activity) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      'platform_admin', jsonb_build_object(
        -- 'is_admin' means an ACTIVE seat: the join above deliberately
        -- omits a status filter so a revoked row stays visible in the
        -- inspector (status='revoked'), but it must never read as access.
        'is_admin', coalesce(adm.status = 'active', false),
        'role',     adm.role,
        'status',   adm.status,
        'since',    to_char(adm.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'note',     adm.note
      ),
      'usage', jsonb_build_object(
        'memberships_total',    coalesce(mb.total, 0),
        'memberships_active',   coalesce(mb.active, 0),
        'workspaces_owned',     coalesce(mb.owned, 0),
        'tasks_created',        coalesce(tk.created, 0),
        'tasks_assigned',       coalesce(tk.assigned, 0),
        'tasks_open',           coalesce(tk.assigned_open, 0),
        'tasks_done',           coalesce(tk.assigned_done, 0),
        'projects_owned',       coalesce(pr.total, 0),
        'goals_created',        coalesce(go.total, 0),
        'notifications_unread', coalesce(nt.unread, 0),
        'activity_events',      coalesce(ua.event_count, 0)
      ),
      'workspaces', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'workspace_id',   w.id::text,
                 'name',           w.name,
                 'slug',           w.slug,
                 'role',           m.role,
                 'membership_status', m.status,
                 'joined_at',      to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'is_creator',     w.owner_id = u.id
               ) order by m.created_at desc), '[]'::jsonb)
        from public.workspace_members m
        join public.workspaces w on w.id = m.workspace_id
        where m.user_id = u.id
      ),
      'recent_activity', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'activity_id',    a.id::text,
                 'workspace_id',   a.workspace_id::text,
                 'workspace_name', w.name,
                 'action',         a.action,
                 'entity_type',    a.entity_type,
                 'occurred_at',    to_char(a.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ) order by a.created_at desc), '[]'::jsonb)
        from (
          select a0.id, a0.workspace_id, a0.action, a0.entity_type, a0.created_at
          from public.activities a0
          where a0.actor_id = u.id
          order by a0.created_at desc
          limit 12
        ) a
        join public.workspaces w on w.id = a.workspace_id
      )
    )
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.platform_admins adm on adm.user_id = u.id
    left join lateral (
      select count(*)::int as total,
             count(*) filter (where m0.status = 'active')::int as active,
             count(*) filter (where m0.role = 'owner')::int as owned
      from public.workspace_members m0
      where m0.user_id = u.id
    ) mb on true
    left join lateral (
      select count(*) filter (where t0.created_by = u.id)::int as created,
             count(*) filter (where t0.assignee_id = u.id)::int as assigned,
             count(*) filter (where t0.assignee_id = u.id
                              and t0.status not in ('done','cancelled'))::int as assigned_open,
             count(*) filter (where t0.assignee_id = u.id
                              and t0.status = 'done')::int as assigned_done
      from public.tasks t0
    ) tk on true
    left join lateral (
      select count(*)::int as total
      from public.projects pr0
      where pr0.owner_id = u.id
    ) pr on true
    left join lateral (
      select count(*)::int as total
      from public.goals g0
      where g0.created_by = u.id
    ) go on true
    left join lateral (
      select count(*)::int as unread
      from public.notifications n0
      where n0.user_id = u.id and n0.read_at is null
    ) nt on true
    left join lateral (
      select max(a0.created_at) as last_activity, count(*)::int as event_count
      from public.activities a0
      where a0.actor_id = u.id
    ) ua on true
    where u.id = v_uid
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. WORKSPACES — THE DIRECTORY
-- ------------------------------------------------------------
create or replace function public.admin_workspaces_list(
  p_search     text default null,
  p_view       text default 'all',
  p_sort       text default 'created_at',
  p_direction  text default 'desc',
  p_page       int  default 1,
  p_page_size  int  default 25
)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_q    text := nullif(trim(coalesce(p_search, '')), '');
  v_like text;
  v_view text := case p_view
                   when 'attention' then 'attention'
                   when 'FREE'      then 'FREE'
                   when 'PRO'       then 'PRO'
                   when 'TEAM'      then 'TEAM'
                   else 'all'
                 end;
  v_sort text := case p_sort
                   when 'name'          then 'name'
                   when 'members'       then 'members'
                   when 'projects'      then 'projects'
                   when 'last_activity' then 'last_activity'
                   else 'created_at'
                 end;
  v_asc    boolean := coalesce(lower(nullif(p_direction, '')), 'desc') = 'asc';
  v_size   int := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_page   int := greatest(1, coalesce(p_page, 1));
  v_offset bigint := (v_page - 1)::bigint * v_size;
begin
  perform public.admin_assert_access('viewer');

  if v_q is not null then
    v_like := '%' ||
      replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  end if;

  return jsonb_build_object(
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'page',      v_page,
    'page_size', v_size,
    'sort',      v_sort,
    'direction', case when v_asc then 'asc' else 'desc' end,
    'search',    v_q,
    'view',      v_view,
    'total',     coalesce((select total_count from (
                   select count(*) over () as total_count
                   from public.workspaces w0
                   left join public.workspace_subscriptions s0
                     on s0.workspace_id = w0.id and s0.status = 'active'
                   where (v_like is null or (
                            w0.name ilike v_like
                            or w0.slug ilike v_like
                            or w0.description ilike v_like
                            or w0.id::text = v_q
                          ))
                     and (v_view = 'all'
                          or (v_view = 'attention' and not exists (
                               select 1 from public.workspace_members m0
                               where m0.workspace_id = w0.id
                                 and m0.role = 'owner' and m0.status = 'active'))
                          or (v_view <> 'attention'
                              and coalesce(s0.plan, 'FREE') = v_view))
                 ) t limit 1), 0),
    'items', coalesce((
      select jsonb_agg(entry.item order by entry.rn)
      from (
        select
          jsonb_build_object(
            'workspace_id',  w.id::text,
            'name',          w.name,
            'slug',          w.slug,
            'created_at',    to_char(w.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'updated_at',    to_char(w.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'last_activity_at', to_char(act.last_activity at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'owner', jsonb_build_object(
              'user_id',      o.id::text,
              'email',        o.email,
              'display_name', op.display_name,
              'username',     op.username
            ),
            'members',  jsonb_build_object('total', coalesce(mb.total, 0),
                                           'active', coalesce(mb.active, 0)),
            'projects', coalesce(pr.total, 0),
            'tasks',    coalesce(tk.total, 0),
            -- has_subscription=false means "no active row; plan shown is
            -- the documented default FREE", not a measurement.
            'plan',             coalesce(s.plan, 'FREE'),
            'has_subscription', s.plan is not null,
            'subscription_status', s.status,
            -- The identical predicate to admin_overview()'s
            -- workspaces_without_active_owner, written inline rather than
            -- shared so the two screens cannot drift apart silently: if
            -- one changes, the counts stop agreeing and the suite notices.
            'has_active_owner', exists (
              select 1 from public.workspace_members m1
              where m1.workspace_id = w.id
                and m1.role = 'owner' and m1.status = 'active'
            )
          ) as item,

          row_number() over (
            order by
              case when v_sort = 'created_at'    and v_asc     then w.created_at end asc nulls first,
              case when v_sort = 'created_at'    and not v_asc then w.created_at end desc nulls last,
              case when v_sort = 'name'          and v_asc     then lower(w.name) end asc nulls first,
              case when v_sort = 'name'          and not v_asc then lower(w.name) end desc nulls last,
              case when v_sort = 'members'       and v_asc     then coalesce(mb.total, 0) end asc nulls first,
              case when v_sort = 'members'       and not v_asc then coalesce(mb.total, 0) end desc nulls last,
              case when v_sort = 'projects'      and v_asc     then coalesce(pr.total, 0) end asc nulls first,
              case when v_sort = 'projects'      and not v_asc then coalesce(pr.total, 0) end desc nulls last,
              case when v_sort = 'last_activity' and v_asc     then act.last_activity end asc nulls first,
              case when v_sort = 'last_activity' and not v_asc then act.last_activity end desc nulls last,
              w.id asc
          ) as rn
        from public.workspaces w
        join auth.users o on o.id = w.owner_id
        left join public.profiles op on op.id = o.id
        left join lateral (
          select count(*)::int as total,
                 count(*) filter (where m.status = 'active')::int as active
          from public.workspace_members m
          where m.workspace_id = w.id
        ) mb on true
        left join lateral (
          select count(*)::int as total
          from public.projects pr0
          where pr0.workspace_id = w.id
        ) pr on true
        left join lateral (
          select count(*)::int as total
          from public.tasks t0
          where t0.workspace_id = w.id
        ) tk on true
        left join lateral (
          select max(a.created_at) as last_activity
          from public.activities a
          where a.workspace_id = w.id
        ) act on true
        left join public.workspace_subscriptions s
          on s.workspace_id = w.id and s.status = 'active'
        where (v_like is null or (
                 w.name ilike v_like
                 or w.slug ilike v_like
                 or w.description ilike v_like
                 or w.id::text = v_q
               ))
          and (v_view = 'all'
               or (v_view = 'attention' and not exists (
                    select 1 from public.workspace_members m2
                    where m2.workspace_id = w.id
                      and m2.role = 'owner' and m2.status = 'active'
                  ))
               or (v_view <> 'attention'
                   and coalesce(s.plan, 'FREE') = v_view))
      ) as entry
      where entry.rn > v_offset and entry.rn <= v_offset + v_size
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. WORKSPACE INSPECTOR
-- ------------------------------------------------------------
create or replace function public.admin_workspace_detail(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_wid   uuid := p_workspace_id;
  v_found boolean;
begin
  perform public.admin_assert_access('viewer');

  if v_wid is null then
    return null;
  end if;

  select exists (select 1 from public.workspaces w where w.id = v_wid) into v_found;
  if not v_found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'overview', jsonb_build_object(
        'workspace_id',  w.id::text,
        'name',          w.name,
        'slug',          w.slug,
        'description',   w.description,
        'icon',          w.icon,
        'color',         w.color,
        'created_at',    to_char(w.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'updated_at',    to_char(w.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'last_activity_at', to_char(act.last_activity at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      'owner', (
        select jsonb_build_object(
          'user_id',      u.id::text,
          'email',        u.email,
          'display_name', p.display_name,
          'username',     p.username,
          'account_status', case
                              when u.banned_until is not null and u.banned_until > now() then 'banned'
                              when u.email_confirmed_at is null then 'pending'
                              else 'active'
                            end,
          'last_sign_in_at', to_char(u.last_sign_in_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )
        from auth.users u
        left join public.profiles p on p.id = u.id
        where u.id = w.owner_id
      ),
      'health', jsonb_build_object(
        'has_active_owner',    coalesce(hb.active_owner, 0) > 0,
        'member_count_active', coalesce(hb.active_members, 0)
      ),
      'subscription', (
        select coalesce(
          jsonb_agg(jsonb_build_object(
            'subscription_id',       s.id::text,
            'plan',                  s.plan,
            'status',                s.status,
            'trial_ends_at',         to_char(s.trial_ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'current_period_end',    to_char(s.current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'has_billing_ids',       s.billing_customer_id is not null
                                     or s.billing_subscription_id is not null,
            'updated_at',            to_char(s.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ) order by s.updated_at desc),
          '[]'::jsonb
        )
        from public.workspace_subscriptions s
        where s.workspace_id = w.id
      ),
      'members', (
        select coalesce(jsonb_agg(member.entry order by member.joined_at), '[]'::jsonb)
        from (
          select jsonb_build_object(
                   'user_id',           u.id::text,
                   'email',             u.email,
                   'display_name',      p.display_name,
                   'username',          p.username,
                   'role',              m.role,
                   'membership_status', m.status,
                   'joined_at',         to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                   'account_status',    case
                                          when u.banned_until is not null and u.banned_until > now() then 'banned'
                                          when u.email_confirmed_at is null then 'pending'
                                          else 'active'
                                        end,
                   'is_creator',        w.owner_id = u.id
                 ) as entry,
                 m.created_at as joined_at
          from public.workspace_members m
          join auth.users u on u.id = m.user_id
          left join public.profiles p on p.id = u.id
          where m.workspace_id = w.id
          order by m.created_at
          limit 200
        ) member
      ),
      'usage', jsonb_build_object(
        'projects',  coalesce(pr.total, 0),
        'tasks',     coalesce(tk.total, 0),
        'goals',     coalesce(gl.total, 0),
        'events',    coalesce(act.event_count, 0),
        'notifications', coalesce(nt.total, 0),
        'signals',   coalesce(ig.signals, 0),
        'missions',  coalesce(ig.missions, 0)
      ),
      'tasks_by_status', (
        select coalesce(
          jsonb_object_agg(bucket.status, bucket.n),
          '{}'::jsonb
        )
        from (
          select t.status as status, count(*)::int as n
          from public.tasks t
          where t.workspace_id = w.id
          group by t.status
        ) bucket
      ),
      'recent_projects', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'project_id', pj.id::text,
                 'name',       pj.name,
                 'status',     pj.status,
                 'progress',   pj.progress,
                 'due_date',   pj.due_date,
                 'updated_at', to_char(pj.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'tasks_total', coalesce(pt.total, 0),
                 'tasks_done',  coalesce(pt.done, 0)
               ) order by pj.updated_at desc), '[]'::jsonb)
        from (
          select p0.* from public.projects p0
          where p0.workspace_id = w.id
          order by p0.updated_at desc
          limit 10
        ) pj
        left join lateral (
          select count(*)::int as total,
                 count(*) filter (where t.status = 'done')::int as done
          from public.tasks t
          where t.project_id = pj.id
        ) pt on true
      ),
      'recent_tasks', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'task_id',       t.id::text,
                 'title',         t.title,
                 'status',        t.status,
                 'priority',      t.priority,
                 'due_at',        to_char(t.due_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'completed_at',  to_char(t.completed_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'updated_at',    to_char(t.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'project_id',    t.project_id::text,
                 'assignee_id',   t.assignee_id::text
               ) order by t.updated_at desc), '[]'::jsonb)
        from (
          select t0.* from public.tasks t0
          where t0.workspace_id = w.id
          order by t0.updated_at desc
          limit 10
        ) t
      ),
      -- Real rows from public.activities only — the same table the 015
      -- triggers fill. An empty list means "nothing recorded for this
      -- workspace", which the UI renders as a measured empty state.
      'recent_activity', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'activity_id',  a.id::text,
                 'actor_id',     a.actor_id::text,
                 'actor_email',  au.email,
                 'action',       a.action,
                 'entity_type',  a.entity_type,
                 'occurred_at',  to_char(a.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ) order by a.created_at desc), '[]'::jsonb)
        from (
          select a0.* from public.activities a0
          where a0.workspace_id = w.id
          order by a0.created_at desc
          limit 12
        ) a
        left join auth.users au on au.id = a.actor_id
      )
    )
    from public.workspaces w
    left join lateral (
      select count(*) filter (where m.role = 'owner' and m.status = 'active')::int as active_owner,
             count(*) filter (where m.status = 'active')::int as active_members
      from public.workspace_members m
      where m.workspace_id = w.id
    ) hb on true
    left join lateral (
      select count(*)::int as total
      from public.projects p0 where p0.workspace_id = w.id
    ) pr on true
    left join lateral (
      select count(*)::int as total
      from public.tasks t0 where t0.workspace_id = w.id
    ) tk on true
    left join lateral (
      select count(*)::int as total
      from public.goals g0 where g0.workspace_id = w.id
    ) gl on true
    left join lateral (
      select count(*)::int as total
      from public.notifications n0 where n0.workspace_id = w.id
    ) nt on true
    left join lateral (
      select (select count(*)::int
              from public.intelligence_signals s0
              where s0.workspace_id = w.id) as signals,
             (select count(*)::int
              from public.intelligence_missions mi0
              where mi0.workspace_id = w.id) as missions
    ) ig on true
    left join lateral (
      select max(a.created_at) as last_activity, count(*)::int as event_count
      from public.activities a
      where a.workspace_id = w.id
    ) act on true
    where w.id = v_wid
  );
end;
$$;

-- ============================================================
-- 5. GRANTS — THE NARROW DOOR, SAME AS 026
-- ============================================================
-- Everything revoked from everyone outside `authenticated`, which gets
-- exactly the four readers above. anon and service_role get nothing: an
-- anonymous visitor must not learn the surface exists, and the app holds
-- no service key. The definer gate re-checks the caller anyway, so the
-- authenticated grant is a route, not a privilege.
do $$
declare
  r      text;
  fn     text;
  target text;
begin
  foreach r in array array['public','anon','authenticated','service_role'] loop
    if r <> 'public' and not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    target := case when r = 'public' then 'PUBLIC' else quote_ident(r) end;
    foreach fn in array array[
      'public.admin_users_list(text,text,text,text,int,int)',
      'public.admin_user_detail(uuid)',
      'public.admin_workspaces_list(text,text,text,text,int,int)',
      'public.admin_workspace_detail(uuid)'
    ] loop
      execute format('revoke all on function %s from %s', fn, target);
    end loop;
  end loop;
end $$;

grant execute on function public.admin_users_list(text, text, text, text, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid)                              to authenticated;
grant execute on function public.admin_workspaces_list(text, text, text, text, int, int) to authenticated;
grant execute on function public.admin_workspace_detail(uuid)                         to authenticated;

-- ============================================================
-- END 027
-- ============================================================
