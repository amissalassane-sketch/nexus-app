-- ============================================================
-- 014. PROJECT → GOAL LINK (P7 — §15/§16)
-- projects.goal_id uuid NULLABLE, references goals, set null on
-- goal deletion. Makes the GOAL → PROJECT → TASK hierarchy real.
-- Idempotent: guarded by information_schema column check.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'goal_id'
  ) then
    alter table public.projects
      add column goal_id uuid references public.goals(id) on delete set null;
  end if;
end
$$;

-- Backfill: nothing to backfill — the link is optional by design.
-- tasks.project_id already exists (added in the initial schema);
-- the application probes for it and hides the UI when absent.

-- ============================================================
-- END 014
-- ============================================================
