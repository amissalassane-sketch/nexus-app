# NEXUS — Production drift diagnostic (read-only SQL)

**Context.** The remote Supabase project predates the versioned lineage: it was
built from an unversioned hosted schema, and `001_nexus_base_schema.sql` is a
*reconstruction* of it. `create table if not exists` migrations therefore never
fix **column-level drift** on tables that already existed before the migrations
started. The 33 applied migrations (001–028 + five `20260915*`) all use
guarded/`if not exists` DDL, so they succeed even on a drifted table and leave
the drift invisible to `supabase db status`.

**Symptoms explained below:**

1. `/admin/overview`, `/admin/activity`, `/admin/workspaces/<id>` →
   "Platform data unavailable / The aggregate could not be read", while
   `/admin/workspaces` (list) and the Authentication / Database health probes
   work.
2. `/projects` → "This workspace is temporarily unavailable while its data
   structure is updated. Try again shortly." on load **and** on project
   creation, while the "0/2 projects" shell bar works.

---

## Which errors trigger which message

### "This workspace is temporarily unavailable while its data structure is updated…"

Produced by `src/lib/data-errors.ts` (`humanizeDataError`), last branch:

```
message.includes("column") || message.includes("schema cache") || code.startsWith("PGRST")
```

So it fires on:

| Source | Code | Typical message | Why it matches |
|---|---|---|---|
| PostgREST schema cache | `PGRST204` | `Could not find the column 'due_date' in the schema cache` | `PGRST*` + "column" |
| PostgREST schema cache | `PGRST202` | `Could not find the table 'public.x' in the schema cache` | `PGRST*` + "schema cache" |
| PostgREST schema cache | `PGRST203` | `Could not find the schema '…' in the schema cache` | "schema cache" |
| Any other PostgREST error | `PGRST102`, `PGRST201`, `PGRST301`, … | — | `PGRST*` prefix |
| Postgres (via trigger or query) | `42703` | `column "actor_id" does not exist` | "column" in message |
| Postgres | `42P01` | `relation "public.activities" does not exist` | **does NOT match** — no "column"/"schema cache" in the message; falls through to the generic fallback message |
| Postgres | `42883` | `function … does not exist` | **does NOT match** — generic fallback |
| Postgres | `42501` | `permission denied …` | caught earlier → the permission message |

### "The platform aggregate could not be read. No data is shown rather than guessed."

Produced by `classify()` in `src/lib/admin/data.ts` as the `UNAVAILABLE` bucket:
any error that is **not** `NEXUS_ADMIN_FORBIDDEN` / `NEXUS_ADMIN_INSUFFICIENT_ROLE`
(in message), **not** `404` / `PGRST202` / "could not find the function"
(`NOT_INSTALLED`), and **not** a timeout. Concretely: `42703`, `42P01`, `42883`,
`PGRST102`, `PGRST203`, `PGRST204`, `PGRST301`, `08006`, …

---

## Hypotheses, ranked

### H1 — HIGH — `public.projects` is missing `due_date`

The project manager loads with
`.from("projects").select("*").eq("workspace_id", …).order("due_date", …)`.
PostgREST resolves the ORDER BY column against the schema cache: a missing
`due_date` answers **PGRST204** ("Could not find the column 'due_date' in the
schema cache") → the banner. Creation sends `due_date` in the JSON payload —
same PGRST204, same banner. The shell's "0/2 projects" bar only references
`id` + `workspace_id`, so it keeps working. `admin_workspace_detail` (027)
reads `pj.due_date` in `recent_projects`, while `admin_workspaces_list` does
not — matching "detail fails, list works".

**Confirm / rule out (read-only):**

```sql
-- Q1. Full column list of projects.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;
```

```sql
-- Q2. Direct probe of the two columns the drift story depends on.
select 'projects.due_date' as reference, exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'projects'
           and column_name = 'due_date') as exists_on_db
union all
select 'activities.actor_id', exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'activities'
           and column_name = 'actor_id');
```

If `due_date` is **absent** → H1 confirmed (the new migration
`20260920160000_reconcile_core_column_drift.sql` adds it and reloads the
PostgREST cache). If it is **present** and the symptom persists → see H4
(stale PostgREST schema cache).

### H2 — HIGH — `public.activities` is missing `actor_id`

All three failing admin RPCs read `activities.actor_id`:

* `admin_overview()` — `select count(distinct actor_id) from public.activities`
* `admin_activity_list()` — emits `a.actor_id` in every row
* `admin_workspace_detail()` — emits `a.actor_id` in `recent_activity`

The one admin RPC that works, `admin_workspaces_list()`, only reads
`workspace_id` + `created_at` from `activities`. The health probe reads
`profiles` only — unaffected.

Bonus effect: migration 015's trigger `record_workspace_activity()` INSERTs
into `activities (workspace_id, actor_id, entity_type, entity_id, action,
metadata)` after every project/task/goal change. Without `actor_id`, **every
write** on those tables fails inside the trigger with
`42703: column "actor_id" does not exist` — message contains "column" → the
same "temporarily unavailable" banner. That alone explains the failed project
creation, with or without H1.

**Confirm / rule out (read-only):**

```sql
-- Q3. Full column list of activities (look for actor_id vs user_id).
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'activities'
order by ordinal_position;
```

```sql
-- Q4. The 015 audit triggers must exist and be enabled.
select tgrelid::regclass as on_table, tgname, tgenabled
from pg_trigger
where not tgisinternal
  and tgname like '%record_activity%'
order by tgrelid::regclass::text, tgname;
```

If `actor_id` is **absent** (perhaps `user_id` exists instead) → H2 confirmed;
the new migration adds `actor_id` and backfills it from `user_id` into NULL
rows only.

### H3 — NEAR CERTAIN (no app impact) — `20260920150000` is not in the remote history

The reported count is 33 = 28 (001–028) + five `20260915*`; the 34th file,
`20260920150000_revoke_anon_execute_workspace_helpers.sql`, is not among them.
No legitimate app path depends on `anon` executing the helpers (public pages
are static; every DB call happens with an authenticated session; GoTrue
endpoints never evaluate RLS), so this is a missing hardening step, not a
symptom cause.

**Confirm (read-only):**

```sql
-- Q5. Full migration history (is 20260920150000 recorded?).
select version from supabase_migrations.schema_migrations order by version;
```

```sql
-- Q6. Actual EXECUTE ACLs on the three canonical helpers.
select p.proname as helper,
       has_function_privilege('anon', p.oid, 'EXECUTE')            as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')   as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE')    as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_active_workspace_member', 'can_manage_workspace', 'is_workspace_owner');
```

Decision afterwards: apply the migration (it is idempotent) — or explicitly
keep the `anon` grant (the contract recorded by `20260915130500`) and document
why.

### H4 — LOW–MEDIUM — PostgREST schema cache is stale

PostgREST resolves ORDER BY / payload columns against its own cache. If the
column exists in Postgres but was added after PostgREST last cached the
schema, reads fail with PGRST204 until the cache reloads.

**Confirm:** Q1 shows the column **present** and the symptom persists.
Fix (NOT read-only): `notify pgrst, 'reload schema';` in the SQL Editor, or
restart PostgREST.

### H5 — LOW — the `intelligence_*` tables are missing

`admin_overview()` counts `public.intelligence_signals`,
`public.intelligence_missions`, `public.intelligence_memory` (created by
023–025, which are inside the applied 33 — so unlikely). A missing table would
answer `42P01` and would not match the "temporarily unavailable" branch in the
app, but in the admin it lands in `UNAVAILABLE` — the message you see.

**Confirm (read-only):**

```sql
-- Q7. Control-plane + intelligence objects present?
select to_regclass('public.intelligence_signals')  is not null as intelligence_signals,
       to_regclass('public.intelligence_missions') is not null as intelligence_missions,
       to_regclass('public.intelligence_memory')   is not null as intelligence_memory,
       to_regclass('public.platform_admins')       is not null as platform_admins,
       to_regclass('public.admin_audit_log')       is not null as admin_audit_log;
```

### H6 — VERY LOW — helper ACLs blocking `authenticated`

Ruled out by observation: the "0/2 projects" bar and workspace resolution both
depend on RLS policies calling `is_active_workspace_member()` under the
authenticated role, and they work. Q6 above shows the live ACLs anyway.

### Other tables (no reported symptom — completeness probe)

```sql
-- Q8. Column lists for the remaining tables the code reads/writes.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tasks', 'goals', 'notifications', 'workspace_members', 'workspaces')
order by table_name, ordinal_position;
```

Expected (lineage of record): `tasks` has `project_id`, `due_at`,
`completed_at`, `priority`, `assignee_id`, `created_by`; `goals` has
`target_date`, `progress`; `notifications` has `read_at`, `severity`, `action`;
`workspace_members` has `role`, `status`, `created_at` (no `updated_at` in the
base — the app never reads one); `workspaces` has `slug`, `owner_id`,
`created_at`, `updated_at`.

---

## Reading the results

* **Q2 returns `false` for one/both** → run
  `supabase/migrations/20260920160000_reconcile_core_column_drift.sql` (already
  committed; strictly additive, idempotent, ends with `notify pgrst,
  'reload schema'`). Expectation afterwards: `/projects` loads and creates;
  all three admin pages read; the 015 activity trigger writes again.
* **Q2 returns `true` for both, symptoms persist** → H4: reload the PostgREST
  schema cache (not read-only).
* **Q5 missing a version / Q6 `authenticated_execute = false`** → apply the
  missing migration(s); check `Vercel Runtime Logs` — the admin data layer now
  logs `code`, `message` and `hint` for every failed read, which removes the
  guesswork for the next incident.
