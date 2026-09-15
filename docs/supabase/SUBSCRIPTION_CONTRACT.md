# NEXUS — Subscription & Billing Contract

Status: established by PR #71 —
`supabase/migrations/20260915220000_nexus_subscription_contract.sql`.
No payment provider is integrated. No remote Supabase operation was
performed. This document is the reference for every consumer of
`public.workspace_subscriptions`.

## 1. Source of truth

There is exactly one interpretation of "the plan of a workspace", defined
in PostgreSQL and mirrored (never enforced) by the frontend:

```text
workspace_subscriptions row
        ↓
public.get_workspace_plan(workspace_id)   ← single definition
public.get_owner_plan(owner_id)           ← same predicate, owner scope
        ↓
public.get_plan_limit(plan, resource)     ← values mirrored from
        ↓                                    src/lib/plan-limits.ts
PR #70 write-guard triggers (projects, goals, tasks, members, workspaces)
```

The frontend mirror lives in `src/lib/billing/subscription-state.ts`
(pure functions) and is consumed by `src/lib/entitlements.ts`,
`/settings/billing` and `/upgrade`. It exists so the UI never displays a
plan the database would not grant. The database remains the only security
boundary for mutations.

Plans: `FREE | PRO | TEAM` (007 check constraint, unchanged — no other
plan value can be stored, and the resolvers fail closed to `FREE` on any
incoherent value).

## 2. Current subscription (the single definition)

A row is the **current subscription** of its workspace when:

```sql
status = 'active'
AND plan IN ('FREE','PRO','TEAM')
AND (current_period_end IS NULL OR current_period_end >= now())
```

- The unique partial index `workspace_subscriptions_active_workspace_idx`
  on `(workspace_id) WHERE status = 'active'` (007, re-asserted by the
  contract migration) guarantees **at most one active row per workspace**,
  so the resolution never needs a "take the latest row" heuristic.
- Absent, cancelled, expired, past_due, trialing, lapsed-period or
  malformed rows all resolve to `FREE` (fail-closed rule kept from
  PR #70).
- `current_period_end IS NULL` means *indefinite*: every legacy row and
  every FREE subscription carries NULL and never lapses. A paid
  subscription activated through the helpers always carries a period end
  strictly in the future, so an active paid plan can never become
  "eternal" through a missing or incoherent period.

### Period columns — audit finding

The table has `current_period_end` (007). **There is no
`current_period_start` column anywhere in the repository**, and none was
invented for this contract. The `start <= end` guarantee therefore
degenerates to the rule above: paid activations require
`current_period_end > now()`, and a lapsed period deterministically stops
granting the plan everywhere (resolvers, entitlements, write guards,
billing display) — without waiting for any record to be written.

## 3. Status vocabulary

Check constraint (007, extended additively by the contract migration —
superset, no row can become invalid, nothing renamed):

```text
active | cancelled | expired | past_due | trialing
```

- `active` — the only status that can be current (with a valid plan and a
  non-lapsed period).
- `cancelled` — terminated by cancel; `cancelled != active`, grants
  nothing.
- `expired` — period ran out; materialized by the expiry helpers.
  `expired != active`, grants nothing. Even before the status is
  materialized, a lapsed `active` row already resolves to FREE, so
  expiry never depends on a sweeper having run.
- `past_due` / `trialing` — provider dunning states kept from 007; they
  are not `active` and grant nothing.

## 4. Invariants

1. **At most one active subscription per workspace** — enforced by the
   unique partial index (hard guarantee, holds under concurrency), not by
   application logic.
2. **Deterministic current subscription** — section 2 selects at most one
   row; identical predicate in `get_workspace_plan`, `get_owner_plan`,
   the PR #70 guards and the frontend mirror.
3. **Plans strictly controlled** — only FREE/PRO/TEAM; helpers refuse
   anything else (`BILLING_PLAN_INVALID`), resolvers fail closed.
4. **Bootstrap idempotence** — `bootstrap_personal_workspace()` (and the
   whole signup chain `bootstrap_auth_user()` from PR #69) inserts
   `(FREE, active) ON CONFLICT DO NOTHING`; repeated bootstraps converge
   on 1 workspace / 1 active subscription / the same row id.
5. **History preserved** — closed rows (cancelled/expired) are never
   deleted; several historical rows plus at most one active row is the
   normal shape (e.g. `FREE expired, PRO cancelled, PRO active`).

## 5. `trg_default_subscription` — kept

Audited, not removed. The 007 trigger (`AFTER INSERT ON workspaces →
create_default_subscription()`) is the reason every workspace receives a
FREE row at creation, including workspaces inserted outside the bootstrap
path. It writes `ON CONFLICT DO NOTHING` against the unique partial
index, so it cannot produce two active rows and cannot conflict with the
bootstrap repair insert (same pattern). It remains coherent after PR #69
and stays exactly as it is.

## 6. Transitions (business helpers, no payment logic)

All helpers are transactional, serialized per workspace by a
transaction-scoped advisory lock
(`hashtextextended('nexus:subscriptions:' || workspace_id, 0)`), and
structurally incapable of creating a second active row: the plan change
is a single-statement upsert whose conflict target **is** the unique
partial index.

| Function | Purpose | Result |
| --- | --- | --- |
| `set_workspace_plan(ws, plan, period_end?)` | core transition / renewal: FREE→PRO, PRO→TEAM, TEAM→PRO, PRO→FREE, PRO→PRO (new period) | one active row on `plan`; returns its id |
| `upgrade_workspace_plan(ws, plan, period_end)` | direction-checked upgrade (rank must increase vs `get_workspace_plan`) | same as above, else `BILLING_TRANSITION_INVALID` |
| `downgrade_workspace_plan(ws, plan='FREE', period_end?)` | direction-checked downgrade (rank must decrease) | same as above, else `BILLING_TRANSITION_INVALID` |
| `cancel_workspace_subscription(ws)` | active → `cancelled` | plan resolves FREE; NULL when nothing active (idempotent) |
| `expire_workspace_subscription(ws)` | lapsed active → `expired` | NULL unless the period actually lapsed (idempotent) |
| `expire_lapsed_subscriptions()` | maintenance sweep, one transaction | count expired; 0 on re-run |

Plan-period rules enforced by the helpers:

- paid plan activation requires `current_period_end` **strictly in the
  future** (`BILLING_PERIOD_INVALID` otherwise) — never activate a plan
  already lapsed, never make it eternal;
- FREE activation normalizes the period to NULL (FREE never lapses).

After `cancel`, the bootstrap repair (or any later helper call) inserts
the next FREE/PRO active row; the cancelled row stays as history. There
is never a moment with two active rows.

## 7. Concurrency

- Two racing inserts of an active row for the same workspace cannot both
  commit: the unique partial index is the hard guarantee.
- Helper calls are serialized per workspace by the advisory lock, so a
  transition observes the previous transition's committed state (e.g.
  the direction checks of upgrade/downgrade can't race a concurrent plan
  change into an inconsistent read).
- The sweep is a single atomic UPDATE; row locks order it against
  concurrent helper calls.
- Honest scope note: the local PGlite suite runs on ONE PostgreSQL
  backend. It proves the lock primitive, its release at commit, the
  upsert/index behaviour and helper idempotence — it does **not** claim
  to have reproduced a true multi-session race; that belongs to a
  deployment-level integration test.

## 8. Security

- Every function in this contract is `SECURITY DEFINER` with
  `SET search_path = public, pg_temp`. Justification: 007 grants clients
  **no** write policy on `workspace_subscriptions`, so legitimate billing
  mutations must run through definer bodies owned by `postgres`; each
  body's scope is limited to `workspace_subscriptions` (plus a
  `workspaces` existence check). RLS on the table itself is unchanged and
  is not bypassed for any client read.
- EXECUTE: revoked from `public`, `anon`, `authenticated` (explicit
  per-role revokes, because Supabase default privileges add explicit ACL
  entries that `revoke from public` does not clear); granted to
  `service_role` only for the six transition helpers — the single trusted
  backend caller a future payment provider will use.
- Defense in depth: every helper also refuses to run inside a user JWT
  context (`auth.uid() IS NOT NULL → BILLING_ACCESS_DENIED`), so even a
  mis-granted EXECUTE cannot let a signed-in user drive billing rows.
- The resolvers (`get_workspace_plan`, `get_owner_plan`) stay
  non-client-executable exactly as PR #70 pinned them; guard/trigger
  invocation never consults caller EXECUTE. `get_workspace_usage`
  remains the one client-facing RPC (membership-checked).

## 9. Frontend mirror

- `src/lib/billing/subscription-state.ts` — pure functions implementing
  section 2 verbatim (`isPeriodCurrent`, `isSubscriptionCurrent`,
  `effectivePlanOf`, `displayStatusOf`) and the status vocabulary.
- `src/lib/entitlements.ts` — `getWorkspacePlan` / `getOwnerPlan` filter
  lapsed rows before resolving, mirroring the SQL predicate; unknown
  plans still fail closed via `highestPlan` / `DEFAULT_PLAN`.
- `/settings/billing` and `/upgrade` display `effectivePlanOf(...)` and
  show a lapsed active row as `expired`, so the UI never claims a plan
  the write guards would deny.
- `src/lib/billing/types.ts` — `SubscriptionStatus` includes `expired`.

The frontend is UX only; the DB decides.

## 10. Tests

`npm run test:subscription` (`supabase/tests/subscription-contract.test.mjs`,
also wired into `npm test`): contract objects installed, bootstrap
creation/repetition/repair, FREE/PRO/TEAM, every transition and its
direction guards, cancel, expire (single + sweep), period rules, absent /
inactive / cancelled / expired / incoherent / historical-row cases, the
second-active attempt, DB↔frontend coherence for every state, the
concurrency primitives available locally, and the security boundary
(JWT-context refusal, role ACLs, definer posture).

`npm run test:freemium` keeps passing unchanged: the PR #70 guards now
consume the period-aware resolvers, and the freemium assertions
(fail-closed fallbacks, limits, single active row after bootstrap retry)
all still hold.

## 11. Out of scope / documented uncertainties

- **No payment provider**: no Stripe/Kkiapay/FedaPay/Apple Pay/Google
  Pay code, no checkout, no webhooks, no invoicing.
  `/api/billing/upgrade` still answers 501
  `PAYMENT_PROVIDER_NOT_CONFIGURED` and is untouched.
- **No remote Supabase operation** was performed for this contract; it is
  developed and validated locally only. The historical uncertainty about
  the remote migration history (001–005) is untouched and out of scope.
- **Admin metrics** (026/027) read raw `status` values; an `expired` row
  simply does not count toward `past_due`/`trialing` metrics and the
  directory keeps joining on `status = 'active'`. No admin object was
  modified.
- If the remote database ever contains a row whose status is outside the
  vocabulary (only possible where the 007 constraint is absent), the
  constraint replacement in the migration fails loudly instead of
  silently rewriting data — the intended non-destructive behaviour.
