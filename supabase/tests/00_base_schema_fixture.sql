-- ============================================================
-- TEST FIXTURE ONLY — NOT A MIGRATION, NEVER RUN THIS ON PRODUCTION
-- ============================================================
-- Migrations 001-005 (base schema + RLS policies) are NOT versioned in
-- this repository. To be able to execute and verify the logic of the
-- migrations that ARE versioned (006 -> 018), this fixture recreates a
-- minimal approximation of the base schema, limited to the columns the
-- application actually reads/writes.
--
-- It intentionally does NOT recreate RLS policies: those cannot be
-- verified from the repository and must be audited on the real project
-- with supabase/tests/rls_audit.sql.
-- ============================================================

create schema if not exists auth;

-- GoTrue columns the application actually reads. email_confirmed_at and
-- last_sign_in_at are used by the admin control plane (026) for
-- "email confirmed" and "signed in during the last 30 days"; created_at
-- drives the growth numbers. banned_until mirrors the real Supabase
-- auth.users column maintained by GoTrue (set out-of-band via the admin
-- API); the admin users directory (027) reports it as the 'banned'
-- account status. The product itself never writes it — hence normally
-- NULL, exactly like the fixture default.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  banned_until       timestamptz,
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
  avatar_url           text,
  onboarding_completed boolean not null default false,
  onboarding_intent    text,
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

create table if not exists public.workspace_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces(id) on delete cascade,
  plan                   text not null default 'FREE',
  status                 text not null default 'active',
  billing_customer_id    text,
  billing_subscription_id text,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists workspace_subscriptions_active_workspace_idx
  on public.workspace_subscriptions (workspace_id) where status = 'active';

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

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id     uuid references auth.users(id) on delete set null,
  goal_id      uuid references public.goals(id) on delete set null,
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

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null default 'info',
  title        text not null,
  message      text,
  entity_type  text,
  entity_id    uuid,
  severity     text not null default 'info',
  action       text,
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

create table if not exists public.task_dependencies (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  task_id           uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);
create index if not exists task_dependencies_workspace_idx on public.task_dependencies(workspace_id);
create index if not exists task_dependencies_parent_idx on public.task_dependencies(depends_on_task_id);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id, status);
create index if not exists projects_workspace_idx on public.projects(workspace_id);
create index if not exists tasks_workspace_status_idx on public.tasks(workspace_id, status);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists goals_workspace_idx on public.goals(workspace_id);
create index if not exists activities_workspace_created_idx on public.activities(workspace_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, workspace_id) where read_at is null;

-- Membership policy helper from the production base migration. The fixture
-- keeps policies out, but post-base tables may reference this function.
create or replace function public.is_active_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active'
  );
$$;

create or replace function public.can_manage_workspace(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
      and status = 'active' and role in ('owner','admin')
  );
$$;

-- Owner-membership bootstrap used by test harness for workspace inserts.
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

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- Event relation from 001, previously omitted by this minimal fixture. Needed
-- by the additive input-timezone migration; actual lineage is separately tested.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz
);
