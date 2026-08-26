-- ============================================================
-- 024. INTELLIGENCE PROACTIVE SIGNALS (Phase 3)
-- ============================================================
-- Persists the signals detected by the deterministic Signal Engine
-- so INTELLIGENCE can deduplicate (fingerprint), apply cooldowns and
-- track a lifecycle: new → seen → dismissed / acted → resolved.
--
-- One row per signal per (user_id, workspace_id): each member keeps
-- their own view (seen/dismissed) of the workspace signals.
--
-- Stored data is structured and traceable (evidence, score breakdown,
-- suggested actions) — never raw model text as truth.
--
-- RLS: only the owner inside an active workspace can read or write.
-- The client never writes this table directly; only the server
-- signal routes do.
-- ============================================================

create table if not exists public.intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fingerprint text not null,
  type text not null,
  severity text not null default 'info',
  status text not null default 'new' check (status in ('new','seen','dismissed','acted','resolved')),
  title text not null default '',
  summary text not null default '',
  entity_type text,
  entity_id uuid,
  entity_label text,
  score numeric not null default 0,
  confidence numeric not null default 0,
  affected_count int not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  score_breakdown jsonb not null default '[]'::jsonb,
  suggested_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  unique (user_id, workspace_id, fingerprint)
);

create index if not exists intelligence_signals_workspace_idx
  on public.intelligence_signals (workspace_id);

create index if not exists intelligence_signals_user_workspace_status_idx
  on public.intelligence_signals (user_id, workspace_id, status);

alter table public.intelligence_signals enable row level security;

create policy "intelligence_signals_read_own"
  on public.intelligence_signals for select
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_signals_insert_own"
  on public.intelligence_signals for insert
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_signals_update_own"
  on public.intelligence_signals for update
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));

create policy "intelligence_signals_delete_own"
  on public.intelligence_signals for delete
  using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));
