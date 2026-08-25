-- ============================================================
-- 022. Progressive onboarding progress (non-blocking)
-- Stored on the user's own profile. RLS already restricts
-- read/update to auth.uid() — no new public access.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_progress'
  ) then
    alter table public.profiles
      add column onboarding_progress jsonb not null default '{}'::jsonb;
  end if;
end $$;

comment on column public.profiles.onboarding_progress is
  'Client-owned first-run progress. Never used for authorization.';
