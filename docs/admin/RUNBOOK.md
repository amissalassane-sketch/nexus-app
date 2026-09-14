# NEXUS Admin — Control Plane Runbook

The internal operator surface of NEXUS. It lives at `/admin` and answers
three questions in order: **what is happening → why → what can I safely
do about it.**

Status: **PR 1 — foundation.** Security, routing, shell and Overview are
live. Everything else is visible in the navigation as a disabled entry
with the reason it is not ready, rather than being a link to a 404.

---

## 1. The three authorities

NEXUS has three distinct notions of "admin". They do not overlap.

| Authority | Where it lives | Grants |
| --- | --- | --- |
| NEXUS user | `auth.users` + `public.profiles` | their own data |
| Workspace admin | `public.workspace_members.role` ∈ (`owner`, `admin`) | one workspace |
| **NEXUS platform admin** | `public.platform_admins` | the whole platform |

A workspace owner is a customer. Nothing in `workspace_members` can open
`/admin`.

Platform roles:

| Role | Can |
| --- | --- |
| `owner` | everything, including granting and revoking platform access |
| `operator` | every operational read, plus audited actions |
| `viewer` | read only |

---

## 2. How access actually works

```
request /admin/*
  └─ proxy.ts            → anonymous visitors are sent to /login
  └─ src/app/admin/layout.tsx
       └─ getPlatformAdminState()
            └─ supabase.rpc("platform_admin_context")
                 └─ reads public.platform_admins for auth.uid()
```

`public.platform_admins` and `public.admin_audit_log` have **RLS enabled
with zero policies** and **no table grants** for `anon`, `authenticated`
or `service_role`. The only way in is a `SECURITY DEFINER` function that
re-checks the caller first.

Consequences worth knowing before you change anything here:

- Knowing the URL grants nothing. The gate is the database.
- There is **no `service_role` key anywhere in this application.** The
  admin surface runs on the ordinary SSR client with the operator's own
  session, which is what makes every action attributable to a person.
- The check **fails closed.** No Supabase, migration missing, timeout,
  malformed response → access refused.
- A revoked admin (`status = 'revoked'`) loses access on their next
  request. There is no cache to invalidate.

---

## 3. Granting the first admin

There is deliberately **no self-service path** into `platform_admins` —
a forgeable bootstrap would make the whole model decorative. Run this
once, with the operator's user id from **Supabase → Authentication →
Users**:

```sql
insert into public.platform_admins (user_id, role, note)
values ('<operator-user-uuid>', 'owner', 'bootstrap operator')
on conflict (user_id) do update
  set role = 'owner', status = 'active', updated_at = now();
```

Verify:

```sql
select user_id, role, status, created_at
from public.platform_admins
order by created_at;
```

Later admins should be granted from `/admin/settings` (PR 5), which writes
an audit entry. Until then, use SQL and say so in the note.

To revoke:

```sql
update public.platform_admins
set status = 'revoked', updated_at = now()
where user_id = '<user-uuid>';
```

---

## 4. The audit log

`public.admin_audit_log` is append-only **at the storage engine level**,
not by convention: `UPDATE`, `DELETE` and `TRUNCATE` are blocked by
trigger, so no admin — including an `owner` — can rewrite history.

| Situation | What is written |
| --- | --- |
| An admin performs an action (PR 3+) | `admin_audit_record()` — action, outcome, target, actor from the JWT, IP, user agent |
| A signed-in customer hits `/admin` | `admin_audit_record_denied()` — fixed action `admin.access.denied`, at most one row per actor per 5 minutes |
| Anyone not signed in | nothing (there is no attributable actor) |

The refusal writer is boxed in on purpose: the action and outcome are
hard-coded in SQL, the actor always comes from the JWT, and the rate limit
stops an authenticated user from flooding the table by reloading the URL.

Read the log (SQL editor, as the table owner):

```sql
select created_at, actor_email, actor_role, action, outcome, target_type, metadata
from public.admin_audit_log
order by created_at desc
limit 50;
```

---

## 5. What the Overview shows — and what it refuses to show

Every figure comes from `admin_overview()`, one aggregate over real
tables. Two absences are intentional:

- **MRR is "Not available."** No payment provider is connected
  (`/api/billing/upgrade` returns `PAYMENT_PROVIDER_NOT_CONFIGURED`), so
  there is no revenue to report. The field is `NULL`, not `0`, and the UI
  renders `NULL` as "Not available" — a zero would be a lie in a
  different direction.
- **"Active Users" counts GoTrue sign-ins** in the last 30 days, not
  in-product activity. The tile states its own definition so the number
  cannot be over-read.

`NULL` and `0` stay different all the way to the pixel. `formatCount(null)`
returns `"Not available"`; only a measured zero renders as `0`.

Platform health is either **measured** (a real probe was timed),
**declared** (the environment says whether the subsystem is wired up) or
**Unknown**. There is no uptime percentage anywhere: the application keeps
no time-series history to compute one from, and inventing one would
poison every decision made from this screen.

---

## 6. Tests

```bash
npm run test:admin            # all three suites
npm run test:admin:unit       # access reasons, role vocabulary, NULL ≠ 0
npm run test:admin:sql        # PostgreSQL (PGlite): access, aggregate, audit
npm run test:admin:structure  # routing, responsive, a11y, no-fake-data
```

| ID | Covered by |
| --- | --- |
| ADMIN-01 standard user refused | `sql` + `unit` (a workspace `admin` is not a platform admin) |
| ADMIN-02 admin allowed | `sql` |
| ADMIN-03 server-side protection | `sql` (grants, RLS, revocation, role ladder) + `structure` (gate wiring, fail-closed, no client route) + `unit` (refusal reasons) |
| ADMIN-04 overview | `sql` + `structure` |
| ADMIN-08 audit log | `sql` |
| ADMIN-09 system health | `structure` |
| ADMIN-10 responsive | `structure` |
| ADMIN-11 accessibility | `structure` |
| ADMIN-12 no fake metrics | `sql` + `unit` (formatters) + `structure` |

ADMIN-05 (users), ADMIN-06 (workspace inspector) and ADMIN-07 (activity)
have no tests yet because those screens do not exist yet. They land with
PR 2 and PR 3.

The "migration not applied" refusal is covered by `test:admin:unit`, not
at runtime: the local Supabase stub answers every RPC, so it cannot
produce PostgREST's "unknown function" error. The classifier that maps
that error to the actionable message is a pure function precisely so it
can be tested.

---

## 7. Design contract

The control plane has its **own** token ramp, declared in
`src/app/globals.css` under `--color-admin-*`:

- base `#0C0C0E`, sidebar `#111114`, surfaces `#17171A` / `#1E1E22` / `#27272C`
- text `#F2F1ED` / `#9F9FA6` / `#6E6E76`
- success `#6EFF8E`, warning `#FFC857`, danger `#FF5A5F`, info `#8AA8FF`
- accent `#D2FF4D` (Volt Lime)

The product ramp ("Pill Atelier Noir", pure `#000000` with a white accent)
is **untouched** — no existing token value changed. The admin ramp is
namespaced and, by contract, only used inside `src/app/admin` and
`src/components/admin`. `test:admin:structure` fails if an `*-admin-*`
utility leaks into the product surface.

**Volt Lime is reserved** for active state, live indicators, progress and
focus. Today it appears in exactly one place: the active navigation
marker. It is never a background and never body text.

**Icons are `@tabler/icons-react` only** — no Lucide, no Heroicons, no
downloaded SVG. Everything goes through `<AdminIcon />`, which fixes
stroke `1.75` and the size scale (navigation 18, toolbar 18, compact
actions 16, empty states 24–32), and makes the accessibility default
correct: decorative unless the caller supplies a label.

Note: the rest of the application still uses `lucide-react` (78 files).
Migrating it is a separate, deliberate piece of work — this PR does not
touch a single existing screen.
