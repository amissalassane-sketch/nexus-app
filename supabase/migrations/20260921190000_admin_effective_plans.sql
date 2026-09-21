-- Effective plans for the admin directory and subscription reports.
-- Additive replacement of read RPC bodies only. No subscription data changes.
-- get_workspace_plan is the sole entitlement resolver; expired active records
-- are reported as expired without requiring a background sweep.
-- Safe to apply repeatedly. Existing signatures and authorization retained.
begin;
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
                     on s0.workspace_id = w0.id and s0.status = 'active' and (s0.current_period_end is null or s0.current_period_end >= now())
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
                              and public.get_workspace_plan(w0.id) = v_view))
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
            'plan',             public.get_workspace_plan(w.id),
            'has_subscription', s.plan is not null,
            'subscription_status', s.status,
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
          on s.workspace_id = w.id and s.status = 'active' and (s.current_period_end is null or s.current_period_end >= now())
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
                   and public.get_workspace_plan(w.id) = v_view))
      ) as entry
      where entry.rn > v_offset and entry.rn <= v_offset + v_size
    ), '[]'::jsonb)
  );
end;
$$;
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
                     else 'all'
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
    'summary', (
      select jsonb_build_object(
        'workspaces',   count(*),
        'plans', jsonb_build_object(
          'free', count(*) filter (where public.get_workspace_plan(w0.id) = 'FREE'),
          'pro',  count(*) filter (where public.get_workspace_plan(w0.id) = 'PRO'),
          'team', count(*) filter (where public.get_workspace_plan(w0.id) = 'TEAM')
        ),
        'statuses', jsonb_build_object(
          'active',        count(*) filter (where (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = 'active'),
          'trialing',      count(*) filter (where (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = 'trialing'),
          'past_due',      count(*) filter (where (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = 'past_due'),
          'cancelled',     count(*) filter (where (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = 'cancelled'),
          'expired',       count(*) filter (where (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = 'expired'),
          'implicit_free', count(*) filter (where live0.id is null)
        ),
        'attention', count(*) filter (where
          (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) in ('past_due', 'cancelled', 'expired')
          or not exists (
            select 1 from public.workspace_members m0
            where m0.workspace_id = w0.id
              and m0.role = 'owner' and m0.status = 'active'
          )
        )
      )
      from public.workspaces w0
      left join public.workspace_subscriptions s0
        on s0.workspace_id = w0.id and s0.status = 'active' and (s0.current_period_end is null or s0.current_period_end >= now())
      left join lateral (
        select l0.id, l0.status, l0.current_period_end
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
        and (v_plan = 'all' or public.get_workspace_plan(w0.id) = v_plan)
        and (v_status = 'all'
             or (v_status = 'implicit_free' and live0.id is null)
             or (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = v_status)
    ),
    'total', coalesce((select total_count from (
                select count(*) over () as total_count
                from public.workspaces w0
                left join public.workspace_subscriptions s0
                  on s0.workspace_id = w0.id and s0.status = 'active' and (s0.current_period_end is null or s0.current_period_end >= now())
                left join lateral (
                  select l0.id, l0.status, l0.current_period_end
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
                  and (v_plan = 'all' or public.get_workspace_plan(w0.id) = v_plan)
                  and (v_status = 'all'
                       or (v_status = 'implicit_free' and live0.id is null)
                       or (case when live0.status = 'active' and live0.current_period_end < now() then 'expired' else live0.status end) = v_status)
              ) t limit 1), 0),
    'items', coalesce((
      select jsonb_agg(entry.item order by entry.rn)
      from (
        select
          jsonb_build_object(
            'workspace_id',  w.id::text,
            'name',          w.name,
            'slug',          w.slug,
            'plan',             public.get_workspace_plan(w.id),
            'has_subscription', s.id is not null,
            'subscription_status', (case when live.status = 'active' and live.current_period_end < now() then 'expired' else live.status end),
            'current_period_end', to_char(live.current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'trial_ends_at',      to_char(live.trial_ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'subscription_updated_at', to_char(live.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'billing_wired', (live.billing_customer_id is not null
                              or live.billing_subscription_id is not null),
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
              case when v_sort = 'plan'       and v_asc     then case public.get_workspace_plan(w.id)
                                                                     when 'FREE' then 0
                                                                     when 'PRO'  then 1
                                                                     else 2 end end asc nulls first,
              case when v_sort = 'plan'       and not v_asc then case public.get_workspace_plan(w.id)
                                                                     when 'FREE' then 0
                                                                     when 'PRO'  then 1
                                                                     else 2 end end desc nulls last,
              case when v_sort = 'status'     and v_asc     then coalesce((case when live.status = 'active' and live.current_period_end < now() then 'expired' else live.status end), 'implicit_free') end asc nulls first,
              case when v_sort = 'status'     and not v_asc then coalesce((case when live.status = 'active' and live.current_period_end < now() then 'expired' else live.status end), 'implicit_free') end desc nulls last,
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
          on s.workspace_id = w.id and s.status = 'active' and (s.current_period_end is null or s.current_period_end >= now())
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
          and (v_plan = 'all' or public.get_workspace_plan(w.id) = v_plan)
          and (v_status = 'all'
               or (v_status = 'implicit_free' and live.id is null)
               or (case when live.status = 'active' and live.current_period_end < now() then 'expired' else live.status end) = v_status)
        limit v_size offset v_offset
      ) entry
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_workspaces_list(text,text,text,text,int,int) from public, anon, service_role;
grant execute on function public.admin_workspaces_list(text,text,text,text,int,int) to authenticated;
revoke all on function public.admin_subscriptions_list(text,text,text,text,text,int,int) from public, anon, service_role;
grant execute on function public.admin_subscriptions_list(text,text,text,text,text,int,int) to authenticated;
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_users_total     bigint;
  v_users_confirmed bigint;
  v_users_new_7d    bigint;
  v_users_new_30d   bigint;
  v_users_active_30 bigint;
  v_users_orphans   bigint;
  v_ws_total        bigint;
  v_ws_new_7d       bigint;
  v_ws_new_30d      bigint;
  v_ws_no_owner     bigint;
  v_mem_total       bigint;
  v_mem_active      bigint;
  v_plan_free       bigint;
  v_plan_pro        bigint;
  v_plan_team       bigint;
  v_sub_active      bigint;
  v_sub_past_due    bigint;
  v_sub_trialing    bigint;
  v_tasks           bigint;
  v_tasks_open      bigint;
  v_tasks_blocked   bigint;
  v_tasks_done      bigint;
  v_goals           bigint;
  v_projects        bigint;
  v_notifications   bigint;
  v_act_total       bigint;
  v_act_7d          bigint;
  v_act_actors_30d  bigint;
  v_int_signals     bigint;
  v_int_missions    bigint;
  v_int_memory      bigint;
  v_result          jsonb;
begin
  perform public.admin_assert_access('viewer');
  select count(*) into v_users_total from auth.users;
  select count(*) into v_users_confirmed
  from auth.users where email_confirmed_at is not null;
  select count(*) into v_users_new_7d
  from auth.users where created_at >= now() - interval '7 days';
  select count(*) into v_users_new_30d
  from auth.users where created_at >= now() - interval '30 days';
  select count(*) into v_users_active_30
  from auth.users where last_sign_in_at >= now() - interval '30 days';
  select count(*) into v_users_orphans
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
  select count(*) into v_ws_total from public.workspaces;
  select count(*) into v_ws_new_7d
  from public.workspaces where created_at >= now() - interval '7 days';
  select count(*) into v_ws_new_30d
  from public.workspaces where created_at >= now() - interval '30 days';
  select count(*) into v_ws_no_owner
  from public.workspaces w
  where not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
  );
  select count(*) into v_mem_total from public.workspace_members;
  select count(*) into v_mem_active
  from public.workspace_members where status = 'active';
  select count(*) filter (where public.get_workspace_plan(w.id) = 'FREE'),
         count(*) filter (where public.get_workspace_plan(w.id) = 'PRO'),
         count(*) filter (where public.get_workspace_plan(w.id) = 'TEAM')
    into v_plan_free, v_plan_pro, v_plan_team
    from public.workspaces w;
  select count(*) into v_sub_active
  from public.workspace_subscriptions where status = 'active';
  select count(*) into v_sub_past_due
  from public.workspace_subscriptions where status = 'past_due';
  select count(*) into v_sub_trialing
  from public.workspace_subscriptions where status = 'trialing';
  select count(*) into v_tasks from public.tasks;
  select count(*) into v_tasks_open
  from public.tasks where status in ('todo','in_progress','in_review','blocked');
  select count(*) into v_tasks_blocked
  from public.tasks where status = 'blocked';
  select count(*) into v_tasks_done
  from public.tasks where status = 'done';
  select count(*) into v_goals   from public.goals;
  select count(*) into v_projects from public.projects;
  select count(*) into v_notifications
  from public.notifications where read_at is null;
  select count(*) into v_act_total from public.activities;
  select count(*) into v_act_7d
  from public.activities where created_at >= now() - interval '7 days';
  select count(distinct actor_id) into v_act_actors_30d
  from public.activities
  where created_at >= now() - interval '30 days' and actor_id is not null;
  select count(*) into v_int_signals  from public.intelligence_signals;
  select count(*) into v_int_missions from public.intelligence_missions;
  select count(*) into v_int_memory   from public.intelligence_memory;
  v_result := jsonb_build_object(
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'users', jsonb_build_object(
      'total',           v_users_total,
      'email_confirmed', v_users_confirmed,
      'new_7d',          v_users_new_7d,
      'new_30d',         v_users_new_30d,
      'active_30d',      v_users_active_30,
      'without_profile', v_users_orphans
    ),
    'workspaces', jsonb_build_object(
      'total',                v_ws_total,
      'new_7d',               v_ws_new_7d,
      'new_30d',              v_ws_new_30d,
      'without_active_owner', v_ws_no_owner
    ),
    'memberships', jsonb_build_object(
      'total',  v_mem_total,
      'active', v_mem_active
    ),
    'plans', jsonb_build_object(
      'free',            v_plan_free,
      'pro',             v_plan_pro,
      'team',            v_plan_team,
      'active',          v_sub_active,
      'past_due',        v_sub_past_due,
      'trialing',        v_sub_trialing,
      'mrr',             null,
      'currency',        null,
      'provider',        null
    ),
    'usage', jsonb_build_object(
      'projects',            v_projects,
      'goals',               v_goals,
      'tasks',               v_tasks,
      'tasks_open',          v_tasks_open,
      'tasks_blocked',       v_tasks_blocked,
      'tasks_done',          v_tasks_done,
      'notifications_unread', v_notifications,
      'intelligence_signals',  v_int_signals,
      'intelligence_missions', v_int_missions,
      'intelligence_memory',   v_int_memory
    ),
    'activity', jsonb_build_object(
      'events_total',        v_act_total,
      'events_7d',           v_act_7d,
      'distinct_actors_30d', v_act_actors_30d,
      'instrumented',        v_act_total > 0
    ),
    'needs_attention', (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', 'workspaces_without_owner',
          'severity', 'danger',
          'title', 'Workspaces without an active owner',
          'detail', 'Nobody can open these workspaces. Usually a failed bootstrap.',
          'count', count(*)
        ) as item
        from public.workspaces w
        where not exists (
          select 1 from public.workspace_members m
          where m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
        )
        having count(*) > 0
        union all
        select jsonb_build_object(
          'id', 'users_without_profile',
          'severity', 'warning',
          'title', 'Accounts without a profile row',
          'detail', 'The signup trigger did not create a profile. The app self-repairs on next load.',
          'count', count(*)
        )
        from auth.users u
        where not exists (select 1 from public.profiles p where p.id = u.id)
        having count(*) > 0
        union all
        select jsonb_build_object(
          'id', 'subscriptions_past_due',
          'severity', 'warning',
          'title', 'Subscriptions past due',
          'detail', 'Billing could not collect. No provider is connected yet, so this is normally empty.',
          'count', count(*)
        )
        from public.workspace_subscriptions where status = 'past_due'
        having count(*) > 0
        union all
        select jsonb_build_object(
          'id', 'activity_not_instrumented',
          'severity', 'info',
          'title', 'Activity stream is not instrumented',
          'detail', 'public.activities is empty. It is filled by the 015 triggers on task/project/goal changes, so an empty stream means no workspace has changed anything yet.',
          'count', 0
        )
        from public.activities
        having count(*) = 0
      ) as signals
    )
  );
  return v_result;
end;
$$;
revoke all on function public.admin_overview() from public, anon, service_role;
grant execute on function public.admin_overview() to authenticated;
commit;
