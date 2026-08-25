-- ============================================================
-- 020. ACCESS FIRST — INCOMPLETE PROFILES ARE FIRST-CLASS
-- ============================================================
-- The access-first journey (signup -> auth -> workspace -> dashboard)
-- deliberately decouples AUTHENTICATION IDENTITY from NEXUS PROFILE
-- IDENTITY. Nothing about profile completeness may gate access, so the
-- schema and the signup trigger must stop manufacturing profile data.
--
-- Concretely, this migration:
--
--   1. Adds `profiles.job_title` (nullable) so the optional profile
--      completion form has a home for the field. Purely additive.
--
--   2. Replaces the 019 `bootstrap_profile()` trigger. 019 derived a
--      display name from the email local part and auto-generated a
--      username for every new user. That stored invented identity data.
--      The new trigger inserts the MINIMUM profile record:
--          * id            (always)
--          * display_name  (only when the auth provider actually
--                          asserted a name: Google `name`/`full_name`,
--                          or explicit signup metadata)
--          * username      (always NULL — a NEXUS profile identity the
--                          user chooses later, never auto-generated)
--      When nothing was asserted, the profile row exists with NULL
--      identity fields and the UI shows a fallback ("New member" /
--      "Complete profile") instead of fabricating data.
--
--   3. Changes NOTHING about RLS, workspace bootstrap, membership or
--      authorization. Profile completeness is a UI-guidance signal only.
--
-- Existing rows are untouched: users who already have a display name or
-- an auto-generated username keep them.
-- ============================================================

-- 1. Optional identity field for the profile completion form.
alter table public.profiles
  add column if not exists job_title text;

-- 2. Minimal profile bootstrap.
create or replace function public.bootstrap_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  -- Identity the provider actually asserted. `name` is what Google
  -- OAuth stores; `full_name` is what explicit signup metadata may carry.
  -- If neither exists the profile stays intentionally incomplete — the
  -- application never stores fake identity to satisfy a display slot.
  v_display_name := nullif(
    btrim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name'
      )
    ),
    ''
  );

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    v_display_name,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Re-assert the signup trigger. Idempotent on projects where it already
-- exists (migration 001); also keeps the function and the trigger in one
-- place so a deployment can never drift between them.
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.bootstrap_profile();

-- Refresh PostgREST's schema cache so the new column is visible to a live
-- deployment immediately (same pattern as migration 018).
notify pgrst, 'reload schema';

-- ============================================================
-- END 020
-- ============================================================
