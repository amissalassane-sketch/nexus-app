-- ============================================================
-- 014. ENSURE profiles.onboarding_intent
-- ============================================================
-- 013 already adds this column, but hosted projects that never
-- applied 013 break the onboarding screen:
--   "column profiles.onboarding_intent does not exist"
-- and leave "Skip & enter NEXUS" stuck on "Finishing…".
-- Idempotent: safe to run on databases that already have it.
-- ============================================================

alter table public.profiles
  add column if exists onboarding_intent text;

-- ============================================================
-- END 014
-- ============================================================
