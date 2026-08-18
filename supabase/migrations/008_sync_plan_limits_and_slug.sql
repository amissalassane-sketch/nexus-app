-- ============================================================
-- 008. SYNC PLAN LIMITS + FIX WORKSPACE BOOTSTRAP SLUG
-- Mirrors PLAN_LIMITS in src/lib/plan-limits.ts
-- Fixes create_default_workspace to set required slug column.
-- ============================================================

-- Fix workspace bootstrap: slug is NOT NULL in 001
create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  workspace_name text;
  workspace_slug text;
begin
  workspace_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'My Workspace'
  );

  workspace_slug := lower(
    regexp_replace(
      coalesce(
        new.raw_user_meta_data ->> 'username',
        split_part(new.email, '@', 1),
        'workspace'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

  -- Ensure slug uniqueness by appending user id prefix
  workspace_slug := workspace_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.workspaces (owner_id, name, slug)
  values (new.id, workspace_name, workspace_slug)
  returning id into new_workspace_id;

  return new;

exception
  when others then
    raise warning 'Could not create default workspace for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Sync plan limits with application code
create or replace function public.get_plan_limit(p_plan text, p_resource text)
returns integer
language plpgsql
immutable
security definer
set search_path = public
as $$
begin
  case p_plan
    when 'FREE' then
      case p_resource
        when 'projects'     then return 2;
        when 'active_tasks' then return 100;
        when 'goals'        then return 3;
        when 'members'      then return 1;
        when 'workspaces'   then return 1;
        else return 0;
      end case;
    when 'PRO' then
      case p_resource
        when 'projects'     then return 10;
        when 'active_tasks' then return 1000;
        when 'goals'        then return 20;
        when 'members'      then return 5;
        when 'workspaces'   then return 5;
        else return 0;
      end case;
    when 'TEAM' then
      case p_resource
        when 'projects'     then return 50;
        when 'active_tasks' then return 5000;
        when 'goals'        then return 100;
        when 'members'      then return 20;
        when 'workspaces'   then return 20;
        else return 0;
      end case;
    else
      return 0;
  end case;
end;
$$;

-- ============================================================
-- END 008
-- ============================================================
