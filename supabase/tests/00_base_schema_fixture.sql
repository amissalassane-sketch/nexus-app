-- ============================================================
-- TEST FIXTURE ONLY — NOT A MIGRATION, NEVER RUN THIS ON PRODUCTION
-- ============================================================
-- Migrations 001-005 (base schema + RLS policies) are NOT versioned in
-- this repository. To be able to execute and verify the logic of the
-- migrations that ARE versioned (006 -> 011), this fixture recreates a
-- minimal approximation of the base schema, limited to the columns the
-- application actually reads/writes.
--
-- It intentionally does NOT recreate RLS policies: those cannot be
-- verified from the repository and must be audited on the real project
-- with supabase/tests/rls_audit.sql.
-- ============================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- auth.uid() stub driven by a session setting, so security-definer
-- functions such as get_workspace_usage() can be exercised.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('test.current_user_id', true), '')::uuid;
$$;

create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text,
  username             text unique,
  bio                  text,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  description text,
  icon        text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id     uuid references auth.users(id) on delete set null,
  name         text not null,
  slug         text,
  description  text,
  status       text not null default 'planning',
  progress     numeric not null default 0,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete set null,
  assignee_id  uuid references auth.users(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'todo',
  priority     text not null default 'medium',
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'active',
  progress     numeric not null default 0,
  target_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null default 'info',
  title        text not null,
  message      text,
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  entity_type  text,
  entity_id    uuid,
  action       text,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- The real project also owns a membership bootstrap (owner becomes an
-- active member of the workspace they create). It lives in the
-- unversioned migrations; recreated here so member-limit behaviour can
-- be exercised the way the application experiences it.
create or replace function public.test_bootstrap_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (NEW.id, NEW.owner_id, 'owner', 'active')
  on conflict do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_test_bootstrap_owner_membership on public.workspaces;
create trigger trg_test_bootstrap_owner_membership
  after insert on public.workspaces
  for each row
  execute function public.test_bootstrap_owner_membership();
