-- ============================================================
-- 012. ONBOARDING INTENT (P1 — §8 intent routing)
-- profiles.onboarding_intent: nullable text, no RLS change needed
-- (profiles update policy already restricts to own row).
-- Idempotent: guarded by information_schema column check.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_intent'
  ) then
    alter table public.profiles
      add column onboarding_intent text;
  end if;
end
$$;

-- Backfill: nothing to backfill — column is optional by design.
-- Application code MUST tolerate a missing column (it keeps the
-- answer in local state and degrades cleanly).

-- ============================================================
-- END 012
-- ============================================================
