-- ============================================================
-- NEXUS
-- Migration 001: Core Database
-- PostgreSQL / Supabase
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";
-- ============================================================
-- 2. ENUMS
-- ============================================================

create type public.workspace_member_role as enum (
  'owner',
  'admin',
  'member',
  'viewer'
);
create type public.workspace_member_status as enum (
  'active',
  'invited',
  'suspended'
);
create type public.project_status as enum (
  'planning',
  'active',
  'paused',
  'completed',
  'archived'
);
create type public.priority_level as enum (
  'low',
  'medium',
  'high',
  'urgent'
);
create type public.task_status as enum (
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled'
);
create type public.task_relation_type as enum (
  'blocks',
  'blocked_by',
  'relates_to',
  'duplicates'
);
create type public.note_type as enum (
  'standard',
  'idea',
  'meeting',
  'research',
  'decision',
  'reference'
);
create type public.activity_action as enum (
  'created',
  'updated',
  'deleted',
  'completed',
  'archived',
  'restored',
  'moved',
  'uploaded'
);
-- ============================================================
-- 3. GENERIC UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
-- ============================================================
-- 4. PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  display_name text,
  username text unique,
  avatar_url text,
  bio text,

  timezone text default 'UTC',
  locale text default 'en',

  onboarding_completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ============================================================
-- 5. WORKSPACES
-- ============================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,
  description text,

  icon text,
  color text,

  owner_id uuid not null
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ============================================================
-- 6. WORKSPACE MEMBERS
-- ============================================================

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  role public.workspace_member_role not null default 'member',

  status public.workspace_member_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(workspace_id, user_id)
);
-- ============================================================
-- 7. SPACES
-- ============================================================

create table public.spaces (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  slug text not null,
  description text,

  icon text,
  color text,

  position integer not null default 0,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(workspace_id, slug)
);
-- ============================================================
-- 8. PROJECTS
-- ============================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  space_id uuid
    references public.spaces(id)
    on delete set null,

  name text not null,
  slug text not null,
  description text,

  status public.project_status not null default 'planning',

  priority public.priority_level not null default 'medium',

  start_date date,
  due_date date,

  owner_id uuid
    references public.profiles(id)
    on delete set null,

  progress numeric(5,2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  archived_at timestamptz,

  unique(workspace_id, slug),

  constraint projects_progress_valid
    check (progress >= 0 and progress <= 100),

  constraint projects_dates_valid
    check (
      due_date is null
      or start_date is null
      or due_date >= start_date
    )
);
-- ============================================================
-- 9. TASKS
-- ============================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  space_id uuid
    references public.spaces(id)
    on delete set null,

  parent_task_id uuid
    references public.tasks(id)
    on delete cascade,

  title text not null,
  description text,

  status public.task_status not null default 'todo',

  priority public.priority_level not null default 'medium',

  assignee_id uuid
    references public.profiles(id)
    on delete set null,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  start_at timestamptz,
  due_at timestamptz,

  estimated_minutes integer,

  completed_at timestamptz,

  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_estimated_minutes_valid
    check (
      estimated_minutes is null
      or estimated_minutes >= 0
    )
);
-- ============================================================
-- 10. TASK RELATIONS
-- ============================================================

create table public.task_relations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  source_task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  target_task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  relation_type public.task_relation_type not null,

  created_at timestamptz not null default now(),

  constraint task_relations_not_self
    check (source_task_id <> target_task_id),

  unique(source_task_id, target_task_id, relation_type)
);
-- ============================================================
-- 11. NOTES
-- ============================================================

create table public.notes (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  space_id uuid
    references public.spaces(id)
    on delete set null,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  task_id uuid
    references public.tasks(id)
    on delete cascade,

  title text not null,

  content text,

  note_type public.note_type not null default 'standard',

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  archived_at timestamptz
);
-- ============================================================
-- 12. NOTE RELATIONS
-- ============================================================

create table public.note_relations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  source_note_id uuid not null
    references public.notes(id)
    on delete cascade,

  target_note_id uuid not null
    references public.notes(id)
    on delete cascade,

  relation_type text not null default 'related_to',

  created_at timestamptz not null default now(),

  constraint note_relations_not_self
    check (source_note_id <> target_note_id),

  unique(source_note_id, target_note_id, relation_type)
);
-- ============================================================
-- 13. FILES METADATA
-- ============================================================

create table public.files (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  space_id uuid
    references public.spaces(id)
    on delete set null,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  task_id uuid
    references public.tasks(id)
    on delete cascade,

  note_id uuid
    references public.notes(id)
    on delete cascade,

  name text not null,

  storage_path text not null,

  mime_type text,

  size_bytes bigint,

  uploaded_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint files_size_valid
    check (
      size_bytes is null
      or size_bytes >= 0
    )
);
-- ============================================================
-- 14. EVENTS
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  task_id uuid
    references public.tasks(id)
    on delete cascade,

  title text not null,

  description text,

  start_at timestamptz not null,
  end_at timestamptz,

  location text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_dates_valid
    check (
      end_at is null
      or end_at >= start_at
    )
);
-- ============================================================
-- 15. REMINDERS
-- ============================================================

create table public.reminders (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  task_id uuid
    references public.tasks(id)
    on delete cascade,

  event_id uuid
    references public.events(id)
    on delete cascade,

  remind_at timestamptz not null,

  type text not null default 'notification',

  status text not null default 'pending',

  created_at timestamptz not null default now()
);
-- ============================================================
-- 16. GOALS
-- ============================================================

create table public.goals (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  space_id uuid
    references public.spaces(id)
    on delete set null,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  title text not null,

  description text,

  status text not null default 'active',

  target_date date,

  progress numeric(5,2) not null default 0,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goals_progress_valid
    check (progress >= 0 and progress <= 100)
);
-- ============================================================
-- 17. ACTIVITIES
-- ============================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid
    references public.profiles(id)
    on delete set null,

  entity_type text not null,

  entity_id uuid not null,

  action public.activity_action not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
-- ============================================================
-- 18. NOTIFICATIONS
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  type text not null,

  title text not null,

  message text,

  entity_type text,

  entity_id uuid,

  read_at timestamptz,

  created_at timestamptz not null default now()
);
-- ============================================================
-- 19. UPDATED_AT TRIGGERS
-- ============================================================

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();
create trigger workspaces_updated_at
before update on public.workspaces
for each row execute function public.handle_updated_at();
create trigger workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.handle_updated_at();
create trigger spaces_updated_at
before update on public.spaces
for each row execute function public.handle_updated_at();
create trigger projects_updated_at
before update on public.projects
for each row execute function public.handle_updated_at();
create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.handle_updated_at();
create trigger notes_updated_at
before update on public.notes
for each row execute function public.handle_updated_at();
create trigger files_updated_at
before update on public.files
for each row execute function public.handle_updated_at();
create trigger events_updated_at
before update on public.events
for each row execute function public.handle_updated_at();
create trigger goals_updated_at
before update on public.goals
for each row execute function public.handle_updated_at();
-- ============================================================
-- 20. INDEXES
-- ============================================================

create index idx_workspace_members_user
on public.workspace_members(user_id);
create index idx_workspace_members_workspace
on public.workspace_members(workspace_id);
create index idx_spaces_workspace
on public.spaces(workspace_id);
create index idx_projects_workspace
on public.projects(workspace_id);
create index idx_projects_space
on public.projects(space_id);
create index idx_projects_owner
on public.projects(owner_id);
create index idx_projects_status
on public.projects(workspace_id, status);
create index idx_tasks_workspace
on public.tasks(workspace_id);
create index idx_tasks_project
on public.tasks(project_id);
create index idx_tasks_space
on public.tasks(space_id);
create index idx_tasks_assignee
on public.tasks(assignee_id);
create index idx_tasks_parent
on public.tasks(parent_task_id);
create index idx_tasks_status
on public.tasks(workspace_id, status);
create index idx_tasks_due
on public.tasks(workspace_id, due_at);
create index idx_task_relations_source
on public.task_relations(source_task_id);
create index idx_task_relations_target
on public.task_relations(target_task_id);
create index idx_notes_workspace
on public.notes(workspace_id);
create index idx_notes_project
on public.notes(project_id);
create index idx_notes_task
on public.notes(task_id);
create index idx_files_workspace
on public.files(workspace_id);
create index idx_files_project
on public.files(project_id);
create index idx_events_workspace
on public.events(workspace_id);
create index idx_events_start
on public.events(workspace_id, start_at);
create index idx_reminders_user
on public.reminders(user_id, remind_at);
create index idx_goals_workspace
on public.goals(workspace_id);
create index idx_activities_workspace
on public.activities(workspace_id, created_at desc);
create index idx_activities_entity
on public.activities(entity_type, entity_id);
create index idx_notifications_user
on public.notifications(user_id, read_at, created_at desc);
-- ============================================================
-- 21. HELPER FUNCTION
-- ============================================================

create or replace function public.is_workspace_member(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;
-- ============================================================
-- 22. HELPER FUNCTION: ROLE CHECK
-- ============================================================

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles public.workspace_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;
-- ============================================================
-- 23. ENABLE RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.spaces enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_relations enable row level security;
alter table public.notes enable row level security;
alter table public.note_relations enable row level security;
alter table public.files enable row level security;
alter table public.events enable row level security;
alter table public.reminders enable row level security;
alter table public.goals enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
-- ============================================================
-- 24. PROFILE POLICIES
-- ============================================================

create policy "Users can view own profile"
on public.profiles
for select
using (
  auth.uid() = id
);
create policy "Users can update own profile"
on public.profiles
for update
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);
-- ============================================================
-- 25. WORKSPACE POLICIES
-- ============================================================

create policy "Members can view workspace"
on public.workspaces
for select
using (
  public.is_workspace_member(id)
);
create policy "Users can create workspace"
on public.workspaces
for insert
with check (
  auth.uid() = owner_id
);
create policy "Workspace admins can update"
on public.workspaces
for update
using (
  public.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
)
with check (
  public.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
);
-- ============================================================
-- 26. WORKSPACE MEMBERS POLICIES
-- ============================================================

create policy "Members can view workspace members"
on public.workspace_members
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Admins can manage members"
on public.workspace_members
for insert
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
);
create policy "Admins can update members"
on public.workspace_members
for update
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
)
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
);
create policy "Admins can remove members"
on public.workspace_members
for delete
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
);
-- ============================================================
-- 27. SPACES POLICIES
-- ============================================================

create policy "Members can view spaces"
on public.spaces
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create spaces"
on public.spaces
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update spaces"
on public.spaces
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Admins can delete spaces"
on public.spaces
for delete
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_member_role[]
  )
);
-- ============================================================
-- 28. PROJECT POLICIES
-- ============================================================

create policy "Members can view projects"
on public.projects
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create projects"
on public.projects
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update projects"
on public.projects
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete projects"
on public.projects
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 29. TASK POLICIES
-- ============================================================

create policy "Members can view tasks"
on public.tasks
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create tasks"
on public.tasks
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update tasks"
on public.tasks
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete tasks"
on public.tasks
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 30. TASK RELATIONS POLICIES
-- ============================================================

create policy "Members can view task relations"
on public.task_relations
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create task relations"
on public.task_relations
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete task relations"
on public.task_relations
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 31. NOTES POLICIES
-- ============================================================

create policy "Members can view notes"
on public.notes
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create notes"
on public.notes
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update notes"
on public.notes
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete notes"
on public.notes
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 32. NOTE RELATIONS POLICIES
-- ============================================================

create policy "Members can view note relations"
on public.note_relations
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create note relations"
on public.note_relations
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete note relations"
on public.note_relations
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 33. FILE POLICIES
-- ============================================================

create policy "Members can view files"
on public.files
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create file records"
on public.files
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update files"
on public.files
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete files"
on public.files
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 34. EVENTS POLICIES
-- ============================================================

create policy "Members can view events"
on public.events
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create events"
on public.events
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update events"
on public.events
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete events"
on public.events
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 35. REMINDER POLICIES
-- ============================================================

create policy "Users can view own reminders"
on public.reminders
for select
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can create own reminders"
on public.reminders
for insert
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can update own reminders"
on public.reminders
for update
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can delete own reminders"
on public.reminders
for delete
using (
  auth.uid() = user_id
);
-- ============================================================
-- 36. GOALS POLICIES
-- ============================================================

create policy "Members can view goals"
on public.goals
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create goals"
on public.goals
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update goals"
on public.goals
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete goals"
on public.goals
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 37. ACTIVITY POLICIES
-- ============================================================

create policy "Members can view activities"
on public.activities
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create activities"
on public.activities
for insert
with check (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 38. NOTIFICATION POLICIES
-- ============================================================

create policy "Users can view own notifications"
on public.notifications
for select
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can update own notifications"
on public.notifications
for update
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 39. PROFILE AUTO-CREATION
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    display_name,
    username
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'username'
  );

  return new;

exception
  when unique_violation then
    return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
-- ============================================================
-- 40. AUTOMATIC WORKSPACE MEMBERSHIP
-- ============================================================

create or replace function public.create_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
  )
  values (
    new.id,
    new.owner_id,
    'owner',
    'active'
  );

  return new;
end;
$$;
create trigger workspace_owner_membership
after insert on public.workspaces
for each row
execute function public.create_workspace_owner_membership();
-- ============================================================
-- 41. PROJECT PROGRESS CALCULATION
-- ============================================================

create or replace function public.update_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_tasks integer;
  completed_tasks integer;
  calculated_progress numeric(5,2);
begin

  if new.project_id is null then
    return new;
  end if;

  select count(*)
  into total_tasks
  from public.tasks
  where project_id = new.project_id
    and status <> 'cancelled';

  select count(*)
  into completed_tasks
  from public.tasks
  where project_id = new.project_id
    and status = 'done';

  if total_tasks = 0 then
    calculated_progress := 0;
  else
    calculated_progress :=
      round(
        (completed_tasks::numeric / total_tasks::numeric) * 100,
        2
      );
  end if;

  update public.projects
  set
    progress = calculated_progress,
    updated_at = now()
  where id = new.project_id;

  return new;
end;
$$;
create trigger update_project_progress_after_task
after insert or update of status, project_id on public.tasks
for each row
execute function public.update_project_progress();
-- ============================================================
-- 42. AUTOMATIC TASK COMPLETION DATE
-- ============================================================

create or replace function public.handle_task_completion()
returns trigger
language plpgsql
as $$
begin

  if new.status = 'done'
     and old.status <> 'done' then

    new.completed_at = now();

  elsif new.status <> 'done'
     and old.status = 'done' then

    new.completed_at = null;

  end if;

  return new;
end;
$$;
create trigger task_completion_handler
before update on public.tasks
for each row
execute function public.handle_task_completion();
-- ============================================================
-- END OF MIGRATION
-- ============================================================;
