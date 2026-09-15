-- ============================================================
-- NEXUS
-- Migration 002: Storage
-- Supabase Storage + RLS
-- ============================================================


-- ============================================================
-- 1. STORAGE BUCKET
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'nexus-files',
  'nexus-files',
  false
)
on conflict (id)
do update set
  public = false;
-- ============================================================
-- 2. HELPER FUNCTION
-- ============================================================

create or replace function public.user_can_access_file_path(
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.files f
    where f.storage_path = target_path
      and public.is_workspace_member(f.workspace_id)
  );
$$;
-- ============================================================
-- 3. STORAGE OBJECT SELECT
-- ============================================================

create policy "NEXUS members can read files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'nexus-files'
  and public.user_can_access_file_path(name)
);
-- ============================================================
-- 4. STORAGE OBJECT INSERT
-- ============================================================

create policy "NEXUS members can upload files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nexus-files'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.workspace_id::text =
          split_part(name, '/', 1)
  )
);
-- ============================================================
-- 5. STORAGE OBJECT UPDATE
-- ============================================================

create policy "NEXUS members can update files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nexus-files'
  and public.user_can_access_file_path(name)
)
with check (
  bucket_id = 'nexus-files'
  and public.user_can_access_file_path(name)
);
-- ============================================================
-- 6. STORAGE OBJECT DELETE
-- ============================================================

create policy "NEXUS members can delete files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'nexus-files'
  and public.user_can_access_file_path(name)
);
-- ============================================================
-- 7. STORAGE PATH CONVENTION
-- ============================================================

-- Files should follow:
--
-- nexus-files/
--   {workspace_id}/
--       {project_id}/
--           filename.ext
--
-- Example:
--
-- nexus-files/
--   8e7c.../
--       1a2b.../
--           concept-art.png
--
-- This makes workspace isolation explicit.


-- ============================================================
-- 8. VALIDATE FILE RECORDS
-- ============================================================

create or replace function public.validate_file_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_from_path uuid;
begin

  workspace_from_path :=
    split_part(new.storage_path, '/', 1)::uuid;

  if workspace_from_path <> new.workspace_id then
    raise exception
      'Storage path workspace does not match file workspace';
  end if;

  return new;

exception
  when invalid_text_representation then
    raise exception
      'Invalid workspace ID in storage path';
end;
$$;
create trigger validate_file_workspace_before_insert
before insert or update on public.files
for each row
execute function public.validate_file_workspace();
-- ============================================================
-- 9. FILE SIZE LIMIT
-- ============================================================

alter table public.files
add constraint files_max_size
check (
  size_bytes is null
  or size_bytes <= 52428800
);
-- ============================================================
-- 10. FILE MIME TYPE INDEX
-- ============================================================

create index if not exists idx_files_mime_type
on public.files(mime_type);
-- ============================================================
-- END
-- ============================================================;
