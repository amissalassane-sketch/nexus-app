-- ============================================================
-- 023. INTELLIGENCE WORKING MEMORY (Phase 2)
-- ============================================================
-- A compact, structured working memory for NEXUS Intelligence,
-- scoped to one row per (user_id, workspace_id):
--
--   state       jsonb  — short-term memory: conversation id, last
--                        intent/query/target, last displayed entities
--                        (ordered ids, the ordinal base for "la
--                        deuxième"), last plan, last action
--                        (proposed/executed+verified/failed), pending
--                        human confirmation, deleted entity ids.
--   preferences jsonb  — durable, EXPLICITLY requested preferences
--                        ("souviens-toi que…"). Casual sentences are
--                        never converted into preferences.
--
-- Rules enforced by the application layer (src/lib/intelligence/memory.ts):
--   - memory never creates entities (every id comes from a real read
--     or a verified mutation)
--   - "executed" requires a verified server read-back
--   - a proposed action is never recorded as executed
--
-- RLS: the row is only visible/editable by its owner inside an active
-- workspace. The client never touches this table directly — only the
-- server routes read/write it.
-- ============================================================

create table if not exists public.intelligence_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create index if not exists intelligence_memory_workspace_idx
  on public.intelligence_memory (workspace_id);

alter table public.intelligence_memory enable row level security;

create policy "intelligence_memory_read_own"
  on public.intelligence_memory for select
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_memory_insert_own"
  on public.intelligence_memory for insert
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_memory_update_own"
  on public.intelligence_memory for update
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_memory_delete_own"
  on public.intelligence_memory for delete
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));
