-- ============================================================
-- 015. TASK DEPENDENCIES + AUDIT ACTIVITY
-- ============================================================
-- Adds the relationship NEXUS needs to reason about downstream work and
-- records real workspace mutations. No generated or illustrative AI rows.

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);
create index if not exists task_dependencies_workspace_idx on public.task_dependencies(workspace_id);
create index if not exists task_dependencies_parent_idx on public.task_dependencies(depends_on_task_id);

create or replace function public.validate_task_dependency()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks
    where id = new.task_id and workspace_id = new.workspace_id
  ) or not exists (
    select 1 from public.tasks
    where id = new.depends_on_task_id and workspace_id = new.workspace_id
  ) then
    raise exception 'WORKSPACE_ACCESS_DENIED: dependency tasks must belong to the same workspace'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'WORKSPACE_ACCESS_DENIED: created_by must be the authenticated user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger task_dependencies_validate before insert or update on public.task_dependencies
for each row execute function public.validate_task_dependency();

alter table public.task_dependencies enable row level security;
create policy "dependencies_read_members" on public.task_dependencies for select
using (public.is_active_workspace_member(workspace_id));
create policy "dependencies_insert_members" on public.task_dependencies for insert
with check (public.is_active_workspace_member(workspace_id));
create policy "dependencies_delete_members" on public.task_dependencies for delete
using (public.is_active_workspace_member(workspace_id));

-- Record mutations from real product rows. The trigger is security definer so
-- clients never receive permission to forge the audit stream directly.
create or replace function public.record_workspace_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  source_row record;
  label text;
begin
  if tg_op = 'DELETE' then
    source_row := old;
  else
    source_row := new;
  end if;
  label := coalesce(to_jsonb(source_row) ->> 'title', to_jsonb(source_row) ->> 'name', 'Item');

  insert into public.activities (workspace_id, actor_id, entity_type, entity_id, action, metadata)
  values (
    source_row.workspace_id,
    auth.uid(),
    case tg_table_name when 'projects' then 'project' when 'tasks' then 'task' else 'goal' end,
    source_row.id,
    case when tg_op = 'INSERT' then 'created' when tg_op = 'DELETE' then 'deleted' else 'updated' end,
    jsonb_build_object('title', label)
  );
  return source_row;
end;
$$;

create trigger projects_record_activity after insert or update or delete on public.projects
for each row execute function public.record_workspace_activity();
create trigger tasks_record_activity after insert or update or delete on public.tasks
for each row execute function public.record_workspace_activity();
create trigger goals_record_activity after insert or update or delete on public.goals
for each row execute function public.record_workspace_activity();
