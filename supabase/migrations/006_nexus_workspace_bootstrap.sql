-- ============================================================
-- 006. AUTOMATIC PERSONAL WORKSPACE
-- ============================================================

create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  workspace_name text;
begin

  workspace_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email,
    'My Workspace'
  );

  insert into public.workspaces (
    owner_id,
    name
  )
  values (
    new.id,
    workspace_name
  )
  returning id into new_workspace_id;

  return new;

exception
  when others then
    raise warning 'Could not create default workspace for user %: %',
      new.id,
      sqlerrm;

    return new;
end;
$$;


create trigger on_auth_user_created_workspace
after insert on auth.users
for each row
execute function public.create_default_workspace();


-- ============================================================
-- END
-- ============================================================
