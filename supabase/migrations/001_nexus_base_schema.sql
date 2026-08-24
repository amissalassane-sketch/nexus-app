-- ============================================================
-- 001. NEXUS BASE SCHEMA + WORKSPACE-ISOLATED RLS
-- ============================================================
-- This repository previously depended on an unversioned hosted schema.
-- Keeping the complete base here makes a clean deployment reproducible.
-- All tenant-owned rows are protected through active workspace membership.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  bio text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique,
  description text,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active',
  progress numeric not null default 0 check (progress between 0 and 100),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  slug text,
  description text,
  status text not null default 'planning',
  progress numeric not null default 0 check (progress between 0 and 100),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','in_review','blocked','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id uuid,
  action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id, status);
create index if not exists projects_workspace_idx on public.projects(workspace_id);
create index if not exists tasks_workspace_status_idx on public.tasks(workspace_id, status);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists goals_workspace_idx on public.goals(workspace_id);
create index if not exists activities_workspace_created_idx on public.activities(workspace_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, workspace_id) where read_at is null;

-- Security-definer membership helper prevents policy recursion and exposes no rows.
create or replace function public.is_active_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active'
  );
$$;
revoke all on function public.is_active_workspace_member(uuid, uuid) from public;
grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated;

create or replace function public.can_manage_workspace(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
      and status = 'active' and role in ('owner','admin')
  );
$$;
revoke all on function public.can_manage_workspace(uuid, uuid) from public;
grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated;

-- Create the profile row immediately; workspace creation remains migration 006.
create or replace function public.bootstrap_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'username', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.bootstrap_profile();

-- Every workspace owner must also be an active member.
create or replace function public.bootstrap_workspace_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active') on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_workspace_created_owner on public.workspaces;
create trigger on_workspace_created_owner after insert on public.workspaces
for each row execute function public.bootstrap_workspace_owner();

-- Generic timestamps.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.goals enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

create policy "base_profiles_read_self" on public.profiles for select using (id = auth.uid());
create policy "base_profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "base_workspaces_read_members" on public.workspaces for select using (public.is_active_workspace_member(id));
create policy "base_workspaces_create_owner" on public.workspaces for insert with check (owner_id = auth.uid());
create policy "base_workspaces_update_managers" on public.workspaces for update using (public.can_manage_workspace(id)) with check (public.can_manage_workspace(id));
create policy "base_members_read_workspace" on public.workspace_members for select using (user_id = auth.uid() or public.is_active_workspace_member(workspace_id));
create policy "base_members_manage_workspace" on public.workspace_members for all using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id));

create policy "base_projects_read" on public.projects for select using (public.is_active_workspace_member(workspace_id));
create policy "base_projects_insert" on public.projects for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_projects_update" on public.projects for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_projects_delete" on public.projects for delete using (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_read" on public.tasks for select using (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_insert" on public.tasks for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_update" on public.tasks for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_delete" on public.tasks for delete using (public.is_active_workspace_member(workspace_id));
create policy "base_goals_read" on public.goals for select using (public.is_active_workspace_member(workspace_id));
create policy "base_goals_insert" on public.goals for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_goals_update" on public.goals for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_goals_delete" on public.goals for delete using (public.is_active_workspace_member(workspace_id));
create policy "base_activities_read" on public.activities for select using (public.is_active_workspace_member(workspace_id));
create policy "base_notifications_read_own" on public.notifications for select using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));
create policy "base_notifications_update_own" on public.notifications for update using (user_id = auth.uid() and public.is_active_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_active_workspace_member(workspace_id));
