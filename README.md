# NEXUS

NEXUS is a personal operating system built with Next.js (App Router), React, TypeScript,
Tailwind CSS v4 and Supabase (Auth + Postgres + RLS).

## Getting started

```bash
npm install
npm run dev
```

Environment variables (`.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Open [http://localhost:3000](http://localhost:3000).

## Design system — NEXUS V3 "Pill Atelier Noir"

The visual language is monochrome, dense and hardware-like: `#0A0A0A` base with a subtle
dot grid, white pill CTAs, lavender (`#E9E4FF`) used only as a rare accent, mono type for
every number, date, counter and identifier.

- **Tokens** live in `src/app/globals.css` inside the Tailwind v4 `@theme` block
  (colors, typography scale, radius hierarchy, shadows, motion). There is no
  `tailwind.config.*`: Tailwind v4 reads the CSS theme directly.
- **Fonts** are self-hosted in `src/fonts/` (Inter Variable + Geist Mono Variable) and
  wired through `next/font/local` in `src/app/layout.tsx` — no external font CDN.
- **Shared components** live in `src/components/ui/`:
  `button`, `create-button`, `dropdown`, `input` (Input/Textarea/Select/Field/Checkbox),
  `card`, `badge`, `feedback` (EmptyState/ListRow/Progress/Alert/Skeleton),
  `page-header` (PageHeader/StatLine) and `tabs`.
- **Shell** components live in `src/components/layout/` (`top-bar`, `sidebar`) and are
  composed by `src/components/nexus-shell.tsx`.
- **Logo**: the interlaced white "N" is a locked asset (`public/logo/nexus.png`,
  `src/app/icon.png`). It is never redrawn, recolored beyond the black/white variants,
  or geometrically modified. Use `NexusLogo` / `NexusWordmark`.

Radius hierarchy: pill buttons `9999px`, inputs/nav/rows `10px`, cards/dropdowns `16px`,
empty states `20px`, auth and pricing cards `24px`.

## Navigation architecture

Two-level shell, composed in `src/app/(app)/layout.tsx` (one server layout that
resolves the user, the workspace, the live counters and the plan usage once):

- `src/components/layout/app-rail.tsx` — 56px icon rail, global destinations.
- `src/components/layout/workspace-sidebar.tsx` — 244px workspace sidebar:
  account menu, Create action, grouped navigation with real counters, plan usage.
- `src/components/layout/app-shell.tsx` — composition + mobile drawer + content surface.

Below `lg`, both levels collapse into a single drawer opened from a compact header.

## Routing & session

`src/proxy.ts` (Next.js 16 file convention — formerly `middleware.ts`) refreshes the
Supabase session cookies on every request and redirects unauthenticated users to
`/login`. It must live inside `src/`, next to `app/`: a root-level `middleware.ts` is
**not** executed when the project uses a `src` directory.

API routes under `/api/**` are never redirected — they answer with their own status
codes (`401`, `403`, `400`) so clients get JSON instead of an HTML login page.

## Freemium

Plans are `FREE`, `PRO`, `TEAM`.

- Limits are declared once in `src/lib/plan-limits.ts` and mirrored in SQL
  (`supabase/migrations/008_sync_plan_limits_and_slug.sql`).
- Enforcement is **server-side**: Postgres triggers on `projects`, `tasks`, `goals`,
  `workspace_members` and `workspaces` raise `PLAN_LIMIT_EXCEEDED`, and
  `get_workspace_usage()` exposes usage through an RPC guarded by membership checks.
- The UI (`useFeatureGate`, `FeatureGate`, `UpgradePrompt`, `/upgrade`) explains what is
  limited and what the next plan unlocks — it never acts as the security boundary.
- No payment provider is connected yet: `/api/billing/upgrade` validates auth, workspace
  and role, then returns `501 PAYMENT_PROVIDER_NOT_CONFIGURED`. No transaction is faked.

## Database verification

```bash
# End-to-end auth pipeline (sign-in -> SSR cookies -> proxy -> pages -> sign-out)
# against a stubbed Supabase service (test double, never used at runtime):
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run dev -- --port 3000 &
node supabase/tests/auth-flow.test.mjs

# Executes migrations 006-012 against a real Postgres engine (WASM) on top of a
# minimal schema fixture and asserts the freemium/security behaviour.
npm install --no-save @electric-sql/pglite
node supabase/tests/migration-logic.test.mjs
```

`supabase/tests/rls_audit.sql` is a read-only script to run in the Supabase SQL editor:
it lists RLS status, policies, enforcement triggers and the plan limits actually
installed in the database. Migrations 001-005 (base schema + RLS policies) are not
versioned in this repository, so the live policies can only be audited that way.

## Scripts

```bash
npm run dev     # development server
npm run build   # production build (type-checked)
npm run lint    # eslint
```
