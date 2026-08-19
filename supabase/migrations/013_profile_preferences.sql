-- ============================================================
-- 013. PROFILE PREFERENCES (P5)
-- profiles.preferences jsonb — one column for all preference
-- keys (density, week start, date format). Nullable, no RLS
-- change (profiles policies already restrict to own row).
-- Idempotent: guarded by information_schema column check.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'preferences'
  ) then
    alter table public.profiles
      add column preferences jsonb;
  end if;
end
$$;

-- ============================================================
-- END 013
-- ============================================================
