-- Workspace helpers: no anonymous execution.
revoke execute on function public.is_active_workspace_member(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_workspace(uuid, uuid) from public, anon;
revoke execute on function public.is_workspace_owner(uuid, uuid) from public, anon;

grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated, service_role;