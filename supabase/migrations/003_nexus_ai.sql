-- ============================================================
-- NEXUS
-- Migration 003: AI Layer
-- Conversations / Messages / Memories / Embeddings / Usage
-- ============================================================


-- ============================================================
-- 1. VECTOR EXTENSION
-- ============================================================

create extension if not exists vector;
-- ============================================================
-- 2. ENUMS
-- ============================================================

create type public.ai_message_role as enum (
  'system',
  'user',
  'assistant',
  'tool'
);
create type public.ai_memory_type as enum (
  'preference',
  'fact',
  'project_context',
  'decision',
  'instruction',
  'goal',
  'insight'
);
create type public.ai_conversation_context as enum (
  'global',
  'workspace',
  'space',
  'project',
  'task',
  'note'
);
-- ============================================================
-- 3. AI CONVERSATIONS
-- ============================================================

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  title text,

  context_type public.ai_conversation_context
    not null default 'global',

  context_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ============================================================
-- 4. AI MESSAGES
-- ============================================================

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.ai_conversations(id)
    on delete cascade,

  role public.ai_message_role not null,

  content text not null,

  model text,

  tokens_input integer,
  tokens_output integer,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
-- ============================================================
-- 5. AI MEMORIES
-- ============================================================

create table public.ai_memories (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  memory_type public.ai_memory_type not null,

  content text not null,

  source_type text,
  source_id uuid,

  importance numeric(4,3) not null default 0.500,

  embedding vector(1536),

  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_memory_importance_valid
    check (
      importance >= 0
      and importance <= 1
    )
);
-- ============================================================
-- 6. AI USAGE
-- ============================================================

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid
    references public.profiles(id)
    on delete set null,

  provider text not null,

  model text not null,

  tokens_input integer not null default 0,

  tokens_output integer not null default 0,

  estimated_cost numeric(12,6),

  request_type text,

  created_at timestamptz not null default now(),

  constraint ai_usage_tokens_input_valid
    check (tokens_input >= 0),

  constraint ai_usage_tokens_output_valid
    check (tokens_output >= 0)
);
-- ============================================================
-- 7. AI CONTEXT SNAPSHOTS
-- ============================================================

create table public.ai_context_snapshots (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  conversation_id uuid
    references public.ai_conversations(id)
    on delete cascade,

  context_type text not null,

  context_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
-- ============================================================
-- 8. INDEXES
-- ============================================================

create index idx_ai_conversations_workspace
on public.ai_conversations(workspace_id);
create index idx_ai_conversations_user
on public.ai_conversations(user_id);
create index idx_ai_conversations_updated
on public.ai_conversations(
  workspace_id,
  updated_at desc
);
create index idx_ai_messages_conversation
on public.ai_messages(
  conversation_id,
  created_at
);
create index idx_ai_memories_workspace
on public.ai_memories(workspace_id);
create index idx_ai_memories_user
on public.ai_memories(user_id);
create index idx_ai_memories_type
on public.ai_memories(
  workspace_id,
  memory_type
);
create index idx_ai_usage_workspace
on public.ai_usage(
  workspace_id,
  created_at desc
);
create index idx_ai_context_workspace
on public.ai_context_snapshots(workspace_id);
-- ============================================================
-- 9. VECTOR INDEX
-- ============================================================

create index idx_ai_memories_embedding
on public.ai_memories
using hnsw (embedding vector_cosine_ops);
-- ============================================================
-- 10. UPDATED_AT
-- ============================================================

create trigger ai_conversations_updated_at
before update on public.ai_conversations
for each row
execute function public.handle_updated_at();
create trigger ai_memories_updated_at
before update on public.ai_memories
for each row
execute function public.handle_updated_at();
-- ============================================================
-- 11. ENABLE RLS
-- ============================================================

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_memories enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_context_snapshots enable row level security;
-- ============================================================
-- 12. CONVERSATION POLICIES
-- ============================================================

create policy "Members can view AI conversations"
on public.ai_conversations
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Users can create AI conversations"
on public.ai_conversations
for insert
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can update own AI conversations"
on public.ai_conversations
for update
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can delete own AI conversations"
on public.ai_conversations
for delete
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 13. MESSAGE POLICIES
-- ============================================================

create policy "Members can view AI messages"
on public.ai_messages
for select
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and public.is_workspace_member(c.workspace_id)
  )
);
create policy "Users can create AI messages"
on public.ai_messages
for insert
with check (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
      and public.is_workspace_member(c.workspace_id)
  )
);
create policy "Users can delete AI messages"
on public.ai_messages
for delete
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
      and public.is_workspace_member(c.workspace_id)
  )
);
-- ============================================================
-- 14. MEMORY POLICIES
-- ============================================================

create policy "Members can view AI memories"
on public.ai_memories
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Users can create AI memories"
on public.ai_memories
for insert
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can update AI memories"
on public.ai_memories
for update
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
create policy "Users can delete AI memories"
on public.ai_memories
for delete
using (
  auth.uid() = user_id
  and public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 15. AI USAGE POLICIES
-- ============================================================

create policy "Members can view AI usage"
on public.ai_usage
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Authenticated users can record AI usage"
on public.ai_usage
for insert
with check (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 16. CONTEXT SNAPSHOT POLICIES
-- ============================================================

create policy "Members can view AI context"
on public.ai_context_snapshots
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create AI context"
on public.ai_context_snapshots
for insert
with check (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 17. SEMANTIC MEMORY SEARCH
-- ============================================================

create or replace function public.search_ai_memories(
  query_embedding vector(1536),
  target_workspace_id uuid,
  match_threshold float default 0.70,
  match_count integer default 8
)
returns table (
  id uuid,
  memory_type public.ai_memory_type,
  content text,
  importance numeric,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.memory_type,
    m.content,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.ai_memories m
  where m.workspace_id = target_workspace_id
    and public.is_workspace_member(target_workspace_id)
    and m.embedding is not null
    and (
      m.expires_at is null
      or m.expires_at > now()
    )
    and 1 - (m.embedding <=> query_embedding)
        >= match_threshold
  order by
    m.embedding <=> query_embedding
  limit match_count;
$$;
-- ============================================================
-- 18. PROJECT CONTEXT FUNCTION
-- ============================================================

create or replace function public.get_project_ai_context(
  target_project_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  result jsonb;
begin

  select workspace_id
  into target_workspace_id
  from public.projects
  where id = target_project_id;

  if target_workspace_id is null then
    return '{}'::jsonb;
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(

    'project',
    (
      select to_jsonb(p)
      from public.projects p
      where p.id = target_project_id
    ),

    'tasks',
    (
      select coalesce(
        jsonb_agg(to_jsonb(t)),
        '[]'::jsonb
      )
      from public.tasks t
      where t.project_id = target_project_id
    ),

    'notes',
    (
      select coalesce(
        jsonb_agg(to_jsonb(n)),
        '[]'::jsonb
      )
      from public.notes n
      where n.project_id = target_project_id
    ),

    'goals',
    (
      select coalesce(
        jsonb_agg(to_jsonb(g)),
        '[]'::jsonb
      )
      from public.goals g
      where g.project_id = target_project_id
    )

  )
  into result;

  return result;

end;
$$;
-- ============================================================
-- 19. WORKSPACE AI OVERVIEW
-- ============================================================

create or replace function public.get_workspace_ai_overview(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(

    'projects',
    (
      select count(*)
      from public.projects
      where workspace_id = target_workspace_id
        and status <> 'archived'
    ),

    'active_projects',
    (
      select count(*)
      from public.projects
      where workspace_id = target_workspace_id
        and status = 'active'
    ),

    'tasks',
    (
      select count(*)
      from public.tasks
      where workspace_id = target_workspace_id
        and status <> 'cancelled'
    ),

    'completed_tasks',
    (
      select count(*)
      from public.tasks
      where workspace_id = target_workspace_id
        and status = 'done'
    ),

    'overdue_tasks',
    (
      select count(*)
      from public.tasks
      where workspace_id = target_workspace_id
        and due_at < now()
        and status not in ('done', 'cancelled')
    ),

    'goals',
    (
      select count(*)
      from public.goals
      where workspace_id = target_workspace_id
    )

  )
  into result;

  return result;

end;
$$;
-- ============================================================
-- 20. MEMORY CLEANUP
-- ============================================================

create or replace function public.cleanup_expired_ai_memories()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin

  delete from public.ai_memories
  where expires_at is not null
    and expires_at <= now();

  get diagnostics deleted_count = row_count;

  return deleted_count;

end;
$$;
-- ============================================================
-- 21. END
-- ============================================================;
