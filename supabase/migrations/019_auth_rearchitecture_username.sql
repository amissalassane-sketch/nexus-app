-- ============================================================
-- 019. AUTH REARCHITECTURE — USERNAME AUTO-GENERATION
-- ============================================================
-- The authentication rearchitecture removes the username requirement
-- from onboarding. Usernames are now auto-generated from the user's
-- email address when not explicitly provided.
--
-- This migration:
--   1. Ensures profiles.username remains nullable (already the case)
--   2. Adds an index to speed up username uniqueness checks during
--      auto-generation
--   3. Documents the new default username generation pattern
--
-- No schema changes required — username is already nullable in 001.
-- ============================================================

-- Ensure the index exists for fast username lookups
create index if not exists profiles_username_idx on public.profiles(username) where username is not null;

-- Update the bootstrap_profile trigger to generate a default username
-- from the email address when no username is provided in metadata.
create or replace function public.bootstrap_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_display_name text;
  v_username text;
  v_email_local text;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  -- Generate a deterministic default username from email + user ID suffix
  v_email_local := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if v_email_local is null or length(v_email_local) < 3 then
    v_email_local := 'user';
  end if;
  v_username := v_email_local || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    v_display_name,
    v_username
  ) on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- END 019
-- ============================================================
