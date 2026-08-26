-- ============================================================
-- 025. INTELLIGENCE MISSIONS (Phase 4)
-- ============================================================
-- A mission is a persistent operational objective decomposed into
-- verifiable steps (statuses: planned/ready/in_progress/blocked/
-- waiting/completed/failed/cancelled).
--
-- Steps, context and next-best-action are stored as structured JSON
-- (never raw model text as truth). The server is the only writer;
-- a step becomes "completed" only after a deterministic rule is
-- satisfied against real data or a verified server read-back.
--
-- RLS: one mission per (user_id, workspace_id) — each member keeps
-- their own missions; strict isolation by active workspace.
-- ============================================================

create table if not exists public.intelligence_missions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  objective text not null default '',
  kind text not null default 'general',
  status text not null default 'active' check (status in ('active','blocked','completed','failed','cancelled')),
  progress numeric not null default 0,
  current_step_id text,
  steps jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  next_best_action jsonb,
  last_evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_missions_workspace_idx
  on public.intelligence_missions (workspace_id);

create index if not exists intelligence_missions_user_status_idx
  on public.intelligence_missions (user_id, status);

alter table public.intelligence_missions enable row level security;

create policy "intelligence_missions_read_own"
  on public.intelligence_missions for select
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_missions_insert_own"
  on public.intelligence_missions for insert
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_missions_update_own"
  on public.intelligence_missions for update
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_missions_delete_own"
  on public.intelligence_missions for delete
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));
