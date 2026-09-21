-- READ ONLY. Run against the authorized production project; no customer rows.
-- Complements, never replaces, Supabase migration history and Auth dashboard.
select current_database(), version();
select extname, extversion from pg_extension order by extname;

select p.oid::regprocedure as signature, pg_get_function_result(p.oid) as result,
       p.prosecdef as security_definer, p.proconfig as settings, p.proacl as grants
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'admin_%' or p.proname like '%workspace%'
       or p.proname like '%subscription%' or p.proname = 'platform_admin_context')
order by p.proname;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage') order by tablename, policyname;
select table_name, grantee, privilege_type from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' order by tablename, indexname;
select conrelid::regclass as relation, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace = 'public'::regnamespace order by relation, conname;
select tgrelid::regclass as relation, tgname, tgenabled, pg_get_triggerdef(oid) as definition
from pg_trigger where not tgisinternal and tgrelid in (
  select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth')) order by relation, tgname;
select t.typname, e.enumlabel, e.enumsortorder from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace order by t.typname, e.enumsortorder;
