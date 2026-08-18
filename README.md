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

## Scripts

```bash
npm run dev     # development server
npm run build   # production build (type-checked)
npm run lint    # eslint
```
