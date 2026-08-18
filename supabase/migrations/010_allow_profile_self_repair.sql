-- ============================================================
-- 010. ALLOW AUTHENTICATED USERS TO REPAIR THEIR OWN PROFILE
-- Needed when auth trigger execution failed or was added after a user existed.
-- ============================================================

create policy "Users can insert own profile"
on public.profiles
for insert
with check (
  auth.uid() = id
);

-- ============================================================
-- END 010
-- ============================================================
