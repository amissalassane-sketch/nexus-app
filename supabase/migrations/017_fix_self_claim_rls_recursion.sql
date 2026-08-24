-- ============================================================
-- 017. FIX SELF-CLAIM RLS RECURSION + HARDEN CROSS-WRITE CHECKS
-- ============================================================
-- Fixes three issues discovered during RLS testing:
--
-- 1. The `base_members_self_claim_owner` INSERT policy (added in 016)
--    contained a subquery against `public.workspaces` that was itself
--    gated by the `base_workspaces_read_members` SELECT policy. A user
--    trying to claim their orphaned workspace has NO membership yet,
--    so the subquery could not see the workspace row, the EXISTS
--    evaluated to false, and the insert was blocked by RLS — exactly
--    the chicken-and-egg the policy was supposed to fix.
--
--    Fix: Introduce security-definer helper
--    `public.is_workspace_owner(p_workspace_id, p_user_id)` that
--    bypasses RLS to check the owner_id column directly.
--
-- 2. UPDATE policies on profiles and workspaces use USING/WITH CHECK
--    that silently filter rows rather than raising errors — this is
--    correct PostgreSQL RLS behavior and is secure (no data changes),
--    but tests that assert via thrown errors should instead assert
--    that 0 rows were affected and no data was mutated.
--
-- 3. No schema change for (2); it is behavioral documentation only.
-- ============================================================

-- ---- 1. Security-definer helper: is this user owner of the workspace? ----
-- Mirrors is_active_workspace_member / can_manage_workspace — runs with
-- privileges of the function definer so it is visible even to callers
-- who are not yet members (the exact orphan-owner repair case).
create or replace function public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = p_user_id
  );
$$;

revoke all on function public.is_workspace_owner(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
  end if;
end $$;

-- ---- 2. Rebuild the self-claim policy using the helper ----
drop policy if exists "base_members_self_claim_owner" on public.workspace_members;
create policy "base_members_self_claim_owner" on public.workspace_members
for insert
with check (
  user_id = auth.uid()
  and status = 'active'
  and role = 'owner'
  and public.is_workspace_owner(workspace_id, auth.uid())
  and not exists (
    select 1 from public.workspace_members existing
    where existing.workspace_id = workspace_members.workspace_id
      and existing.user_id = auth.uid()
      and existing.status = 'active'
  )
);

-- Note: The `not exists` subquery against workspace_members uses
-- current_user privileges. The caller can always see their own
-- membership rows via base_members_read_workspace (user_id = auth.uid()),
-- so this check works correctly.

-- ============================================================
-- END 017
-- ============================================================
