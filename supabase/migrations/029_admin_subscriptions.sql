-- ============================================================
-- 029. ADMIN CONTROL PLANE — SUBSCRIPTIONS (PR 6)
-- ============================================================
-- The Overview (026) answers "how big is the platform?" and the
-- directory (027) answers "who is on it?". This migration answers
-- "who pays for what?" — the reads behind:
--
--   /admin/subscriptions
--
-- One row per WORKSPACE (subscriptions are workspace-scoped, never
-- user-scoped), carrying the effective plan, the raw subscription
-- row when one exists, the owner, live usage counts and the limits
-- the effective plan grants. No detail function: a row links to the
-- workspace inspector (/admin/workspaces/[id]), which already shows
-- the plan row — a second inspector would be a duplicate surface.
--
-- It is strictly read-only, under the same rules as 027:
--
--   * opens with `perform public.admin_assert_access('viewer')`;
--   * `security definer` with `search_path = public, pg_temp`
--     (the pg_temp entry blocks temp-schema shadowing);
--   * every relation fully qualified;
--   * NO dynamic SQL: sort keys and filters are whitelisted with
--     CASE expressions, so a caller-supplied string can never become
--     an identifier;
--   * EXECUTE revoked from PUBLIC / anon / service_role and granted
--     to `authenticated` ONLY — and because the definer re-checks
--     the caller via the JWT, holding that grant buys a non-admin
--     nothing.
--
-- ------------------------------------------------------------
-- WHAT "PLAN" AND "STATUS" MEAN HERE (honesty contract)
-- ------------------------------------------------------------
-- PLAN is the active row's plan, with the IDENTICAL predicate the
-- workspaces directory (027) uses: `s.status = 'active'`, falling
-- back to the documented default FREE. has_subscription is "an
-- active row exists". The two screens can never disagree about a
-- workspace's plan: a cancelled-only tenant reads FREE + implicit
-- on both. The subscription contract (20260915220000) additionally
-- fails closed on a lapsed period inside get_workspace_plan() —
-- that enforcement-time rule is the LIMITS' business, not the
-- plan badge's, and period_end is shown so a lapse is visible.
--
-- STATUS is the LIVE row: the active row when one exists, else the
-- most recently updated row, else NULL. A cancelled subscription
-- stays visible as cancelled until a new row replaces it; a
-- workspace that never had a row reads NULL ("implicit free").
-- Vocabulary (007 + the contract's 'expired'): active | trialing |
-- past_due | cancelled | expired. Only 'active' with a live period
-- grants capacity — the rest are commercial states, shown so the
-- operator can see dunning, churn and lapse instead of guessing.
--
-- previous_rows counts every row EXCEPT the displayed live row.
--
-- Limits come from get_plan_limit() for get_workspace_plan() — the
-- period-aware resolution the write guards enforce with. A lapsed
-- paid row therefore shows its paid plan with FREE limits until
-- renewed or swept by expire_lapsed_subscriptions(): that mismatch
-- IS the signal, not a bug. Usage counts are live COUNT(*)s, so
-- "used / limit" is the same comparison the database makes on
-- write, including the fail-closed lapse rule.
--
-- What is deliberately NOT here:
--   * Money. /api/billing/upgrade returns PAYMENT_PROVIDER_NOT_
--     CONFIGURED — no provider writes to billing_customer_id, so
--     there is no revenue to report. billing_wired states the fact
--     per row (either billing id present) instead of implying MRR.
--   * Per-user plans. Attributing a workspace subscription to an
--     account would be a guess; the owner is shown as a contact,
--     not as a payer.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SUBSCRIPTIONS — THE LIST
-- ------------------------------------------------------------
create or replace function public.admin_subscriptions_list(
  p_search     text default null,
  p_plan       text default 'all',
  p_status     text default 'all',
  p_sort       text default 'plan',
  p_direction  text default 'desc',
  p_page       int  default 1,
  p_page_size  int  default 25
)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_q      text := nullif(trim(coalesce(p_search, '')), '');
  v_like   text;
  v_plan   text := case upper(nullif(trim(coalesce(p_plan, '')), ''))
                     when 'FREE' then 'FREE'
                     when 'PRO'  then 'PRO'
                     when 'TEAM' then 'TEAM'
                     else 'all'  -- unknown filter → no filter, never an error page
                   end;
  v_status text := case lower(nullif(trim(coalesce(p_status, '')), ''))
                     when 'active'       then 'active'
                     when 'trialing'     then 'trialing'
                     when 'past_due'     then 'past_due'
                     when 'cancelled'    then 'cancelled'
                     when 'expired'      then 'expired'
                     when 'implicit_free' then 'implicit_free'
                     else 'all'
                   end;
  v_sort   text := case lower(nullif(trim(coalesce(p_sort, '')), ''))
                     when 'name'       then 'name'
                     when 'plan'       then 'plan'
                     when 'status'     then 'status'
                     when 'period_end' then 'period_end'
                     when 'projects'   then 'projects'
                     when 'tasks'      then 'tasks'
                     when 'updated_at' then 'updated_at'
                     else 'plan'
                   end;
  v_asc    boolean := coalesce(lower(nullif(p_direction, '')), 'desc') = 'asc';
  v_size   int := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_page   int := greatest(1, coalesce(p_page, 1));
  v_offset bigint := (v_page - 1)::bigint * v_size;
begin
  perform public.admin_assert_access('viewer');

  -- Pattern escaping for ILIKE (same as 027: backslash is LIKE's
  -- default escape; caller %, _ and \ become literals).
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
    'plan',      v_plan,
    'status',    v_status,
    -- Summary over the FILTERED set (not the page): the strip above
    -- the table always describes the query, never just ten rows.
    'summary', (
      select jsonb_build_object(
        'workspaces',   count(*),
        'plans', jsonb_build_object(
          'free', count(*) filter (where coalesce(s0.plan, 'FREE') = 'FREE'),
          'pro',  count(*) filter (where s0.plan = 'PRO'),
          'team', count(*) filter (where s0.plan = 'TEAM')
        ),
        -- Live statuses: the active row when one exists, else the most
        -- recently updated row. A cancelled-only tenant counts as
        -- cancelled (visible churn), not as implicit free.
        'statuses', jsonb_build_object(
          'active',        count(*) filter (where live0.status = 'active'),
          'trialing',      count(*) filter (where live0.status = 'trialing'),
          'past_due',      count(*) filter (where live0.status = 'past_due'),
          'cancelled',     count(*) filter (where live0.status = 'cancelled'),
          'expired',       count(*) filter (where live0.status = 'expired'),
          'implicit_free', count(*) filter (where live0.id is null)
        ),
        -- Needs a decision: money at risk (dunning, churn, lapse), or
        -- nobody left to own it. Same owner predicate the workspaces
        -- directory uses.
        'attention', count(*) filter (where
          live0.status in ('past_due', 'cancelled', 'expired')
          or not exists (
            select 1 from public.workspace_members m0
            where m0.workspace_id = w0.id
              and m0.role = 'owner' and m0.status = 'active'
          )
        )
      )
      from public.workspaces w0
      left join public.workspace_subscriptions s0
        on s0.workspace_id = w0.id and s0.status = 'active'
      left join lateral (
        select l0.id, l0.status
        from public.workspace_subscriptions l0
        where l0.workspace_id = w0.id
        order by case when l0.status = 'active' then 0 else 1 end,
                 l0.updated_at desc, l0.created_at desc
        limit 1
      ) live0 on true
      where (v_like is null or (
               w0.name ilike v_like
               or w0.slug ilike v_like
               or w0.id::text = v_q
             ))
        and (v_plan = 'all' or coalesce(s0.plan, 'FREE') = v_plan)
        and (v_status = 'all'
             or (v_status = 'implicit_free' and live0.id is null)
             or live0.status = v_status)
    ),
    'total', coalesce((select total_count from (
                select count(*) over () as total_count
                from public.workspaces w0
                left join public.workspace_subscriptions s0
                  on s0.workspace_id = w0.id and s0.status = 'active'
                left join lateral (
                  select l0.id, l0.status
                  from public.workspace_subscriptions l0
                  where l0.workspace_id = w0.id
                  order by case when l0.status = 'active' then 0 else 1 end,
                           l0.updated_at desc, l0.created_at desc
                  limit 1
                ) live0 on true
                where (v_like is null or (
                         w0.name ilike v_like
                         or w0.slug ilike v_like
                         or w0.id::text = v_q
                       ))
                  and (v_plan = 'all' or coalesce(s0.plan, 'FREE') = v_plan)
                  and (v_status = 'all'
                       or (v_status = 'implicit_free' and live0.id is null)
                       or live0.status = v_status)
              ) t limit 1), 0),
    'items', coalesce((
      select jsonb_agg(entry.item order by entry.rn)
      from (
        select
          jsonb_build_object(
            'workspace_id',  w.id::text,
            'name',          w.name,
            'slug',          w.slug,
            -- Plan and has_subscription use the 027 predicate verbatim so
            -- the two screens cannot disagree about a workspace.
            'plan',             coalesce(s.plan, 'FREE'),
            'has_subscription', s.id is not null,
            -- The LIVE row's state: active when a plan-granting row
            -- exists, else the latest commercial state (a cancelled
            -- subscription stays visible as cancelled), else NULL.
            'subscription_status', live.status,
            'current_period_end', to_char(live.current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'trial_ends_at',      to_char(live.trial_ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'subscription_updated_at', to_char(live.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            -- Either billing id present = a provider wrote here.
            -- Normally false everywhere: no provider is connected.
            'billing_wired', (live.billing_customer_id is not null
                              or live.billing_subscription_id is not null),
            -- Every row except the displayed live one: the history the
            -- live row does not show.
            'previous_rows', coalesce(hist.total, 0),
            'owner', jsonb_build_object(
              'user_id',      o.id::text,
              'email',        o.email,
              'display_name', op.display_name
            ),
            'usage', jsonb_build_object(
              'projects',     coalesce(pr.total, 0),
              'active_tasks', coalesce(tk.total, 0),
              'goals',        coalesce(gl.total, 0),
              'members',      coalesce(mb.active, 0)
            ),
            -- The enforced limits for the EFFECTIVE plan, resolved by
            -- get_workspace_plan(): the same period-aware resolution the
            -- write guards enforce with. A lapsed paid row therefore
            -- shows its paid plan with FREE limits until renewed or
            -- swept — the mismatch is the signal, not a bug.
            'limits', jsonb_build_object(
              'projects',     public.get_plan_limit(public.get_workspace_plan(w.id), 'projects'),
              'active_tasks', public.get_plan_limit(public.get_workspace_plan(w.id), 'active_tasks'),
              'goals',        public.get_plan_limit(public.get_workspace_plan(w.id), 'goals')
            ),
            'has_active_owner', exists (
              select 1 from public.workspace_members m1
              where m1.workspace_id = w.id
                and m1.role = 'owner' and m1.status = 'active'
            )
          ) as item,

          row_number() over (
            order by
              case when v_sort = 'name'       and v_asc     then lower(w.name) end asc nulls first,
              case when v_sort = 'name'       and not v_asc then lower(w.name) end desc nulls last,
              case when v_sort = 'plan'       and v_asc     then case coalesce(s.plan, 'FREE')
                                                                     when 'FREE' then 0
                                                                     when 'PRO'  then 1
                                                                     else 2 end end asc nulls first,
              case when v_sort = 'plan'       and not v_asc then case coalesce(s.plan, 'FREE')
                                                                     when 'FREE' then 0
                                                                     when 'PRO'  then 1
                                                                     else 2 end end desc nulls last,
              case when v_sort = 'status'     and v_asc     then coalesce(live.status, 'implicit_free') end asc nulls first,
              case when v_sort = 'status'     and not v_asc then coalesce(live.status, 'implicit_free') end desc nulls last,
              case when v_sort = 'period_end' and v_asc     then live.current_period_end end asc nulls first,
              case when v_sort = 'period_end' and not v_asc then live.current_period_end end desc nulls last,
              case when v_sort = 'projects'   and v_asc     then coalesce(pr.total, 0) end asc nulls first,
              case when v_sort = 'projects'   and not v_asc then coalesce(pr.total, 0) end desc nulls last,
              case when v_sort = 'tasks'      and v_asc     then coalesce(tk.total, 0) end asc nulls first,
              case when v_sort = 'tasks'      and not v_asc then coalesce(tk.total, 0) end desc nulls last,
              case when v_sort = 'updated_at' and v_asc     then live.updated_at end asc nulls first,
              case when v_sort = 'updated_at' and not v_asc then live.updated_at end desc nulls last,
              w.id asc
          ) as rn
        from public.workspaces w
        join auth.users o on o.id = w.owner_id
        left join public.profiles op on op.id = o.id
        left join public.workspace_subscriptions s
          on s.workspace_id = w.id and s.status = 'active'
        -- The live row: the active row when one exists, else the most
        -- recently updated row. A lateral (rather than a second plain
        -- join) because "latest" needs ORDER BY + LIMIT per workspace.
        left join lateral (
          select l.id, l.status, l.current_period_end, l.trial_ends_at,
                 l.updated_at, l.billing_customer_id, l.billing_subscription_id
          from public.workspace_subscriptions l
          where l.workspace_id = w.id
          order by case when l.status = 'active' then 0 else 1 end,
                   l.updated_at desc, l.created_at desc
          limit 1
        ) live on true
        left join lateral (
          select count(*)::int as total
          from public.workspace_subscriptions h0
          where h0.workspace_id = w.id
            and (live.id is null or h0.id <> live.id)
        ) hist on true
        left join lateral (
          select count(*) filter (where m.status = 'active')::int as active
          from public.workspace_members m
          where m.workspace_id = w.id
        ) mb on true
        left join lateral (
          select count(*)::int as total
          from public.projects pr0
          where pr0.workspace_id = w.id
        ) pr on true
        left join lateral (
          -- Active tasks: the enforced definition (plan-limits.ts) —
          -- anything neither done nor cancelled.
          select count(*)::int as total
          from public.tasks tk0
          where tk0.workspace_id = w.id
            and tk0.status not in ('done', 'cancelled')
        ) tk on true
        left join lateral (
          select count(*)::int as total
          from public.goals g0
          where g0.workspace_id = w.id
        ) gl on true
        where (v_like is null or (
                 w.name ilike v_like
                 or w.slug ilike v_like
                 or w.id::text = v_q
               ))
          and (v_plan = 'all' or coalesce(s.plan, 'FREE') = v_plan)
          and (v_status = 'all'
               or (v_status = 'implicit_free' and live.id is null)
               or live.status = v_status)
        limit v_size offset v_offset
      ) entry
    ), '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- 2. GRANTS — THE NARROW DOOR, SAME AS 026 AND 027
-- ============================================================
-- Revoked from everyone outside `authenticated`, which gets exactly
-- the reader above. anon and service_role get nothing: an anonymous
-- visitor must not learn the surface exists, and the app holds no
-- service key. The definer gate re-checks the caller anyway, so the
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
      'public.admin_subscriptions_list(text,text,text,text,text,int,int)'
    ] loop
      execute format('revoke all on function %s from %s', fn, target);
    end loop;
  end loop;
end $$;

grant execute on function public.admin_subscriptions_list(text, text, text, text, text, int, int) to authenticated;

-- ============================================================
-- END 029
-- ============================================================

