-- ============================================================
-- 014. ENSURE profiles.onboarding_intent
-- ============================================================
-- 013 already adds this column, but hosted projects that never
-- applied 013 break the onboarding screen:
--   "column profiles.onboarding_intent does not exist"
-- and leave finalisation stuck.
-- Idempotent: safe to run on databases that already have it.
-- The information_schema guard also works on Postgres-compatible migration
-- runners that do not parse ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_intent'
  ) then
    alter table public.profiles add column onboarding_intent text;
  end if;
end
$$;

-- ============================================================
-- END 014
-- ============================================================
