-- ============================================================
-- NEXUS
-- Migration 20260915220000
-- Subscription & Billing Contract
-- ============================================================
-- Makes the workspace subscription model coherent, deterministic,
-- idempotent and safe, WITHOUT touching any payment provider and
-- WITHOUT any remote Supabase operation. This file is additive and
-- non-destructive: no row is rewritten, no historical subscription is
-- deleted, no previously applied migration is edited.
--
-- ------------------------------------------------------------
-- WHAT THE AUDIT FOUND (baseline, no guessing)
-- ------------------------------------------------------------
-- public.workspace_subscriptions (007)
--   id, workspace_id (fk -> workspaces, cascade),
--   plan   text check (FREE|PRO|TEAM)            default 'FREE',
--   status text check (active|cancelled|past_due|trialing)
--                                                 default 'active',
--   billing_customer_id, billing_subscription_id  (provider stubs),
--   trial_ends_at, current_period_end, created_at, updated_at.
--   There is NO current_period_start column anywhere in the
--   repository; none is invented here. The period invariant this
--   contract can therefore guarantee is: an active PAID subscription
--   created through the helpers always carries a current_period_end
--   strictly in the future, and a lapsed period deterministically
--   stops granting the plan (section 3 below).
--   Unique partial index workspace_subscriptions_active_workspace_idx
--   on (workspace_id) WHERE status = 'active'  -> at most one ACTIVE
--   row per workspace is already enforced by the database. Kept as
--   the hard invariant; re-asserted below so the contract does not
--   depend on which environment created it.
--   RLS: members read their own workspace row (007 policy); there is
--   deliberately NO client insert/update/delete policy - billing
--   mutations are backend-only.
-- trg_default_subscription (007)
--   AFTER INSERT on workspaces -> create_default_subscription()
--   inserts (workspace_id, 'FREE', 'active') ON CONFLICT DO NOTHING.
--   This is the reason every workspace gets a FREE row at creation.
--   It is idempotent against the unique partial index, it cannot
--   produce two active rows, and it does not conflict with
--   bootstrap_personal_workspace() (018/021/20260915131000), whose
--   subscription insert uses the same ON CONFLICT DO NOTHING repair
--   pattern. Both are kept exactly as they are.
-- get_workspace_plan / get_owner_plan (007/011, redefined by the
--   PR #70 write guards 20260915140000)
--   Resolve the plan from `status = 'active'` rows only, fail closed
--   to FREE, and feed get_plan_limit() inside every write guard.
--   Real defect found: neither looks at current_period_end, so an
--   'active' PRO row whose period lapsed still grants PRO capacity
--   forever, merely because no new record was written. That is the
--   "expired subscription considered active" hole this migration
--   closes, in the single place every consumer already reads from.
-- Status vocabulary
--   'expired' did not exist. active/cancelled/past_due/trialing
--   cannot represent a subscription whose period ran out ('past_due'
--   is a dunning state, not an expiry). Section 1 adds 'expired' to
--   the existing check constraint - additive superset, no row can
--   become invalid, nothing is renamed.
--
-- ------------------------------------------------------------
-- THE CONTRACT ESTABLISHED HERE
-- ------------------------------------------------------------
-- 1. Plans: FREE | PRO | TEAM (unchanged 007 check constraint).
-- 2. Statuses: active | cancelled | expired | past_due | trialing.
--    Only 'active' can ever be the current subscription; cancelled,
--    expired, past_due and trialing never grant capacity.
-- 3. Current subscription of a workspace (single definition, used by
--    get_workspace_plan, get_owner_plan, the PR #70 write guards and
--    mirrored by src/lib/billing/subscription-state.ts):
--      status = 'active'
--      AND plan IN ('FREE','PRO','TEAM')
--      AND (current_period_end IS NULL OR current_period_end >= now())
--    The unique partial index guarantees this selects at most ONE
--    row, so the resolution needs no "take the latest row" heuristic.
--    NULL period end = indefinite (all legacy rows and FREE); a
--    lapsed period fails closed to FREE instead of granting a plan.
-- 4. Absent/incoherent subscription => FREE (PR #70 rule, unchanged).
-- 5. Transitions (upgrade, downgrade, cancel, expire) go through the
--    helper functions in section 4: transactional, serialized by a
--    workspace-scoped advisory lock, and structurally incapable of
--    producing a second active row (single-statement upsert against
--    the unique partial index).
-- 6. NO payment provider is integrated. The helpers only move the
--    business model; /api/billing/upgrade still answers 501
--    PAYMENT_PROVIDER_NOT_CONFIGURED and stays untouched.
--
-- SECURITY DEFINER justification (applies to every function below):
--   007 grants clients no write policy on workspace_subscriptions,
--   so any legitimate billing mutation must run through a definer
--   body owned by postgres. The definer scope of each function is
--   limited to workspace_subscriptions (plus a workspaces existence
--   check); each pins search_path = public, pg_temp; each refuses to
--   run inside a user JWT context (auth.uid() IS NOT NULL); and
--   EXECUTE is granted to service_role only - never to public, anon
--   or authenticated. The plan resolvers stay non client-executable
--   exactly as PR #70 pinned them.
-- ============================================================

-- ============================================================
-- 1. STATUS VOCABULARY — ADD 'expired' (ADDITIVE, GUARDED)
-- ============================================================
-- The existing check constraint (007, auto-named
-- workspace_subscriptions_status_check on a real project) is replaced
-- by a superset of itself. Test fixtures that never created the
-- constraint receive the canonical one. Re-running is inert: the
-- block detects that 'expired' is already allowed and returns.
do $$
declare
  v_table    regclass := to_regclass('public.workspace_subscriptions');
  v_con_name text;
  v_con_def  text;
begin
  if v_table is null then
    return;
  end if;

  select c.conname, pg_get_constraintdef(c.oid)
    into v_con_name, v_con_def
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
   where c.conrelid = v_table
     and c.contype = 'c'
     and a.attname = 'status'
   order by c.conname
   limit 1;

  if v_con_name is not null then
    if position('''expired''' in v_con_def) > 0 then
      -- Already the contract vocabulary; nothing to do.
      return;
    end if;
    execute format(
      'alter table public.workspace_subscriptions drop constraint %I',
      v_con_name
    );
  end if;

  -- Superset of the 007 vocabulary: every existing row stays valid.
  alter table public.workspace_subscriptions
    add constraint workspace_subscriptions_status_check
    check (status in ('active', 'cancelled', 'expired', 'past_due', 'trialing'));
end
$$;

-- ============================================================
-- 2. THE ONE-ACTIVE-SUBSCRIPTION INVARIANT (RE-ASSERTED)
-- ============================================================
-- 007 already creates this index; the fixture-based test environments
-- create it too. Re-asserting it here makes the invariant owned by
-- this contract as well and is a no-op wherever it already exists.
-- This index is the hard concurrency guarantee: two racing inserts of
-- an active row for the same workspace cannot both commit.
do $$
begin
  if to_regclass('public.workspace_subscriptions') is null then
    return;
  end if;

  create unique index if not exists workspace_subscriptions_active_workspace_idx
    on public.workspace_subscriptions (workspace_id)
    where status = 'active';
end
$$;

-- ============================================================
-- 3. DETERMINISTIC PLAN RESOLUTION (PERIOD-AWARE)
-- ============================================================
-- Same signatures, same fail-closed rules, same security posture as
-- 20260915140000; the ONLY change is the period predicate that stops
-- a lapsed 'active' row from granting its plan. Every write guard of
-- PR #70 calls these two functions, so guards, RPC reads and the
-- frontend mirror all inherit one identical interpretation.

create or replace function public.get_workspace_plan(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select s.plan
        from public.workspace_subscriptions s
       where s.workspace_id = p_workspace_id
         and s.status = 'active'
         and s.plan in ('FREE', 'PRO', 'TEAM')
         and (s.current_period_end is null or s.current_period_end >= now())
       limit 1
    ),
    'FREE'
  );
$$;

create or replace function public.get_owner_plan(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select s.plan
        from public.workspace_subscriptions s
        join public.workspaces w on w.id = s.workspace_id
       where w.owner_id = p_owner_id
         and s.status = 'active'
         and s.plan in ('FREE', 'PRO', 'TEAM')
         and (s.current_period_end is null or s.current_period_end >= now())
       order by case s.plan
                  when 'TEAM' then 3
                  when 'PRO' then 2
                  else 1
                end desc
       limit 1
    ),
    'FREE'
  );
$$;

-- ============================================================
-- 4. BUSINESS TRANSITION HELPERS (NO PAYMENT LOGIC)
-- ============================================================
-- These prepare upgrade / downgrade / cancel / expire for the future
-- payment provider integration. They move the subscription model
-- only; no checkout, no webhook, no invoice.
--
-- Shared guarantees:
--   * refuse to run inside a user JWT context (auth.uid() NOT NULL):
--     billing state is backend-managed, exactly like the 007 write
--     policy model - even a mis-granted EXECUTE cannot let a signed-in
--     user drive their own billing rows;
--   * serialize per workspace with a transaction-scoped advisory lock
--     (same primitive the PR #70 guards use), so concurrent calls
--     observe each other's committed rows;
--   * never create a second active row: the plan transition is a
--     single-statement upsert whose conflict target IS the unique
--     partial index;
--   * idempotent: repeating a call converges on the same state
--     (one active row with the requested plan; cancel/expire of an
--     already closed subscription is a no-op returning NULL).

-- 4a. Core transition: FREE->PRO, PRO->TEAM, TEAM->PRO, PRO->FREE,
--     renewals (same plan, new period). Returns the subscription id.
create or replace function public.set_workspace_plan(
  p_workspace_id uuid,
  p_plan         text,
  p_period_end   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_end      timestamptz;
  v_subscription_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
     or not exists (select 1 from public.workspaces w where w.id = p_workspace_id) then
    raise exception 'WORKSPACE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_plan is null or p_plan not in ('FREE', 'PRO', 'TEAM') then
    raise exception 'BILLING_PLAN_INVALID: %', coalesce(p_plan, 'NULL')
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:subscriptions:' || p_workspace_id::text, 0)
  );

  if p_plan = 'FREE' then
    -- FREE is indefinite: it never carries a billing period, so an
    -- active FREE subscription can never lapse by accident.
    v_period_end := null;
  else
    -- A paid plan must never become "eternal" through a missing or
    -- incoherent period, and must never be activated already lapsed.
    v_period_end := p_period_end;
    if v_period_end is null or v_period_end <= now() then
      raise exception 'BILLING_PERIOD_INVALID: an active % subscription requires current_period_end in the future', p_plan
        using errcode = '22023';
    end if;
  end if;

  -- One statement, one active row. The conflict target is the unique
  -- partial index on (workspace_id) WHERE status = 'active': if an
  -- active row exists (even a lapsed one) it is updated in place,
  -- otherwise it is inserted. Two concurrent transactions cannot both
  -- insert - the second blocks on the index and lands on the update
  -- path, or was already serialized by the advisory lock above.
  insert into public.workspace_subscriptions as s
         (workspace_id, plan, status, current_period_end, updated_at)
  values (p_workspace_id, p_plan, 'active', v_period_end, now())
  on conflict (workspace_id) where status = 'active'
  do update
     set plan               = excluded.plan,
         current_period_end = excluded.current_period_end,
         updated_at         = now()
  returning s.id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- 4b. Upgrade with a direction check against the SAME resolution the
--     write guards use (get_workspace_plan), so "upgrade" can never
--     mean a lateral or downward move.
create or replace function public.upgrade_workspace_plan(
  p_workspace_id uuid,
  p_plan         text,
  p_period_end   timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_plan text;
  v_current_rank integer;
  v_target_rank  integer;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  v_current_plan := public.get_workspace_plan(p_workspace_id);
  v_current_rank := case v_current_plan
                      when 'TEAM' then 3
                      when 'PRO'  then 2
                      else 1
                    end;
  v_target_rank  := case p_plan
                      when 'TEAM' then 3
                      when 'PRO'  then 2
                      when 'FREE' then 1
                      else null
                    end;

  if v_target_rank is null then
    raise exception 'BILLING_PLAN_INVALID: %', coalesce(p_plan, 'NULL')
      using errcode = '22023';
  end if;

  if v_target_rank <= v_current_rank then
    raise exception 'BILLING_TRANSITION_INVALID: % is not an upgrade from %', p_plan, v_current_plan
      using errcode = '22023';
  end if;

  return public.set_workspace_plan(p_workspace_id, p_plan, p_period_end);
end;
$$;

-- 4c. Downgrade with the mirrored direction check. TEAM->PRO and
--     PRO->FREE are the supported paths; FREE is indefinite so no
--     period is accepted for it.
create or replace function public.downgrade_workspace_plan(
  p_workspace_id uuid,
  p_plan         text default 'FREE',
  p_period_end   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_plan text;
  v_current_rank integer;
  v_target_rank  integer;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  v_current_plan := public.get_workspace_plan(p_workspace_id);
  v_current_rank := case v_current_plan
                      when 'TEAM' then 3
                      when 'PRO'  then 2
                      else 1
                    end;
  v_target_rank  := case p_plan
                      when 'TEAM' then 3
                      when 'PRO'  then 2
                      when 'FREE' then 1
                      else null
                    end;

  if v_target_rank is null then
    raise exception 'BILLING_PLAN_INVALID: %', coalesce(p_plan, 'NULL')
      using errcode = '22023';
  end if;

  if v_target_rank >= v_current_rank then
    raise exception 'BILLING_TRANSITION_INVALID: % is not a downgrade from %', p_plan, v_current_plan
      using errcode = '22023';
  end if;

  return public.set_workspace_plan(p_workspace_id, p_plan, p_period_end);
end;
$$;

-- 4d. Cancel: the active row becomes 'cancelled' and stops being the
--     current subscription immediately (get_workspace_plan -> FREE).
--     cancelled != active, so the unique partial index frees the slot
--     and the bootstrap repair (or a later set_workspace_plan) can
--     insert the next FREE row without ever stacking two actives.
--     Idempotent: returns NULL when there is nothing active to cancel.
create or replace function public.cancel_workspace_subscription(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  if p_workspace_id is null then
    raise exception 'WORKSPACE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:subscriptions:' || p_workspace_id::text, 0)
  );

  update public.workspace_subscriptions
     set status     = 'cancelled',
         updated_at = now()
   where workspace_id = p_workspace_id
     and status = 'active'
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- 4e. Expire (one workspace): materializes status = 'expired' for an
--     active row whose current_period_end has passed. The plan
--     resolution of section 3 already treats such a row as FREE
--     BEFORE this runs, so expiry never depends on a sweeper having
--     run; this function only makes the stored status match reality.
--     Idempotent: returns NULL when the row is absent, already
--     closed, or still inside its period (that is a cancellation,
--     not an expiry, and stays a different operation).
create or replace function public.expire_workspace_subscription(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  if p_workspace_id is null then
    raise exception 'WORKSPACE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:subscriptions:' || p_workspace_id::text, 0)
  );

  update public.workspace_subscriptions
     set status     = 'expired',
         updated_at = now()
   where workspace_id = p_workspace_id
     and status = 'active'
     and current_period_end is not null
     and current_period_end < now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- 4f. Expire (maintenance sweep): closes every lapsed active row in
--     one transaction and reports how many. Idempotent: a second run
--     returns 0. Intended for the backend scheduler; the resolution
--     of section 3 does not rely on it.
create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired integer;
begin
  if auth.uid() is not null then
    raise exception 'BILLING_ACCESS_DENIED: subscription changes are backend-only'
      using errcode = '42501';
  end if;

  update public.workspace_subscriptions
     set status     = 'expired',
         updated_at = now()
   where status = 'active'
     and current_period_end is not null
     and current_period_end < now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

-- ============================================================
-- 5. LEAST PRIVILEGE
-- ============================================================
-- Same trap and same pattern as 20260915140000: on Supabase the
-- platform default privileges hand every NEW public function explicit
-- EXECUTE entries for anon / authenticated / service_role that
-- `revoke ... from public` does not clear. Each client role is
-- therefore revoked explicitly, and only service_role - the trusted
-- backend - keeps EXECUTE on the transition helpers. The resolvers
-- stay internal exactly as PR #70 pinned them (the guards call them
-- server-side; trigger and definer invocation never consults the
-- caller's EXECUTE privilege).
revoke all on function public.get_workspace_plan(uuid) from public;
revoke all on function public.get_owner_plan(uuid) from public;
revoke all on function public.set_workspace_plan(uuid, text, timestamptz) from public;
revoke all on function public.upgrade_workspace_plan(uuid, text, timestamptz) from public;
revoke all on function public.downgrade_workspace_plan(uuid, text, timestamptz) from public;
revoke all on function public.cancel_workspace_subscription(uuid) from public;
revoke all on function public.expire_workspace_subscription(uuid) from public;
revoke all on function public.expire_lapsed_subscriptions() from public;

do $$
declare
  v_has_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  v_has_auth boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
  v_has_svc  boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  if v_has_anon then
    revoke all on function public.get_workspace_plan(uuid) from anon;
    revoke all on function public.get_owner_plan(uuid) from anon;
    revoke all on function public.set_workspace_plan(uuid, text, timestamptz) from anon;
    revoke all on function public.upgrade_workspace_plan(uuid, text, timestamptz) from anon;
    revoke all on function public.downgrade_workspace_plan(uuid, text, timestamptz) from anon;
    revoke all on function public.cancel_workspace_subscription(uuid) from anon;
    revoke all on function public.expire_workspace_subscription(uuid) from anon;
    revoke all on function public.expire_lapsed_subscriptions() from anon;
  end if;

  if v_has_auth then
    revoke all on function public.get_workspace_plan(uuid) from authenticated;
    revoke all on function public.get_owner_plan(uuid) from authenticated;
    revoke all on function public.set_workspace_plan(uuid, text, timestamptz) from authenticated;
    revoke all on function public.upgrade_workspace_plan(uuid, text, timestamptz) from authenticated;
    revoke all on function public.downgrade_workspace_plan(uuid, text, timestamptz) from authenticated;
    revoke all on function public.cancel_workspace_subscription(uuid) from authenticated;
    revoke all on function public.expire_workspace_subscription(uuid) from authenticated;
    revoke all on function public.expire_lapsed_subscriptions() from authenticated;
  end if;

  -- The single trusted backend caller. When a payment provider is
  -- wired later, its server-side handlers (service key) are the
  -- intended callers of exactly these six functions and nothing else.
  if v_has_svc then
    grant execute on function public.set_workspace_plan(uuid, text, timestamptz) to service_role;
    grant execute on function public.upgrade_workspace_plan(uuid, text, timestamptz) to service_role;
    grant execute on function public.downgrade_workspace_plan(uuid, text, timestamptz) to service_role;
    grant execute on function public.cancel_workspace_subscription(uuid) to service_role;
    grant execute on function public.expire_workspace_subscription(uuid) to service_role;
    grant execute on function public.expire_lapsed_subscriptions() to service_role;
  end if;
end
$$;

-- New functions + changed bodies: refresh PostgREST's schema cache so
-- a live deployment cannot serve a stale definition (018/021/131000
-- pattern).
notify pgrst, 'reload schema';

-- ============================================================
-- END 20260915220000 — SUBSCRIPTION & BILLING CONTRACT
-- ============================================================
