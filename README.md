# NEXUS

NEXUS is an **AI operational intelligence platform** built with Next.js (App Router),
React, TypeScript, Tailwind CSS v4 and Supabase (Auth + Postgres + RLS).

It is not a chatbot. NEXUS reads the work already happening in a workspace — projects,
tasks, goals, deadlines and the activity log — and turns it into **signals**: what is
blocked, what is drifting, what is at risk, and what deserves attention next. Every
signal carries the evidence it was derived from, so a recommendation is always
explainable from the workspace itself.

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

## Design system — "Quiet intelligence"

The visual language is monochrome, dense and precise: a pure black (`#000000`) base with
a subtle dot grid, near-black surfaces, borders that are discovered rather than
announced, and lavender (`#E9E4FF`) reserved for the intelligence layer alone. Numbers,
dates, counters and identifiers are always mono.

- **Tokens** live in `src/app/globals.css` inside the Tailwind v4 `@theme` block
  (colors, typography scale, radius hierarchy, shadows, motion). There is no
  `tailwind.config.*`: Tailwind v4 reads the CSS theme directly.
- **Surface ramp**: `#000000` → `#080808` → `#0F0F0F` → `#151515` → `#1C1C1C`.
- **Borders**: `rgba(255,255,255,0.06 / 0.08 / 0.14 / 0.22)`. Never thick, never white.
- **Radius**: micro `4–6px`, controls/inputs/nav `8px`, cards/dropdowns `12px`,
  panels `14px`, auth `16px`, pills `9999px` (badges and progress only).
- **Contrast**: every text token clears WCAG AA against the darkest app surface —
  primary 16.3:1, secondary 6.6:1, tertiary 4.8:1. `text-quaternary` (3.4:1) is
  restricted to metadata that is never the only carrier of meaning.
- **Motion**: `cubic-bezier(0.22, 1, 0.36, 1)`; micro 120–180ms, UI 200–300ms,
  panels 300–450ms, page entrance ~420ms. Everything is gated by
  `prefers-reduced-motion`.
- **Fonts** are self-hosted in `src/fonts/` (Inter Variable + Geist Mono Variable) and
  wired through `next/font/local` in `src/app/layout.tsx` — no external font CDN.
- **Logo**: the interlaced white "N" is a locked asset (`public/logo/nexus.png`,
  `src/app/icon.png`). It is never redrawn, recolored beyond the black/white variants,
  or geometrically modified. Use `NexusLogo` / `NexusWordmark`.

### Shared components

`src/components/ui/` — `button` (Button/ButtonLink/IconButton, with loading state),
`create-button`, `dropdown`, `input` (Input/Textarea/Select/Field/Checkbox), `card`
(Card/Panel/Metric/SectionHeader), `badge` (Badge/CountBadge/StatusDot), `feedback`
(EmptyState/ErrorState/ListRow/Progress/Alert/Skeleton/SkeletonRows/RefreshingDot),
`page-header` (PageHeader/StatLine), `page-skeleton`, `tabs`, `modal`, `toast`,
`navigation` (SectionLabel/NavItem/MobileNavItem).

`src/components/intelligence/` — `signal-icons` (the shared signal vocabulary),
`signal-card`, `signal-detail`, `intelligence-canvas`, `intelligence-view`,
`intelligence-network` (the canvas engine).

Every data-driven surface implements **loading · success · empty · error · refreshing**.
Empty states always answer three questions: what is missing, why it matters, what to do.

## Landing motion

- **Launch signature** — `src/components/landing/launch-experience.tsx` (+ CSS in
  `globals.css`): on first load the locked N builds at the centre of a dark frame, the
  lavender signal line fires, and the mark shrinks into its real nav position while the
  hero rises in behind the fade (~1.4s total, once per tab, skipped under
  `prefers-reduced-motion`). The landing is rendered underneath from the first frame —
  nothing waits on JavaScript or the network.
- **Pointer depth** — `src/components/landing/landing-atmosphere.tsx` (landing-wide
  ambient light) and `src/components/landing/hero-atmosphere.tsx` (hero grid, light,
  orbits). Transform-only, lerped via `requestAnimationFrame`, disabled on touch
  devices and reduced motion. Content and controls never move.

## NEXUS Intelligence landing (`/intelligence`)

A dedicated public product page for the intelligence layer — not a section of the
main landing, and not a replacement for it. `/` is untouched.

- **Page**: `src/app/intelligence/page.tsx`, with sections in
  `src/components/intelligence/` (context, signals, next best action,
  explainability, workspace → action, closing CTA).
- **Clear public/product separation**: `/intelligence` is public for everyone.
  Authenticated workspace Intelligence lives at `/app/intelligence`; no marketing
  navigation can accidentally enter onboarding.
- **Navbar / footer**: the existing `LandingNav` and `LandingFooter` take a
  `context` prop (`"landing" | "intelligence"`); section anchors resolve back to
  `/#…` and the Intelligence item is marked `aria-current="page"`.
- **Hero visual**: a real-time 3D intelligence core rendered with Three.js —
  see *NEXUS Intelligence 3D hero* below. Everything above the canvas is still
  HTML: the lockup, the copy and both CTAs are server-rendered and readable
  before a single WebGL frame exists.
- **Copy discipline**: every claim maps to `src/lib/intelligence/engine.ts`, and
  every example signal is labelled as a product visualisation.

## NEXUS Intelligence 3D hero

`src/components/nexus-intelligence/` — the visual identity of the intelligence
layer. A monochrome, near-static computational structure: a faceted core, a shell
of bound nodes, three orbital pathways and a sparse network around it.

**Composition.** The world is centred on the core at the origin and the *camera*
is offset, which is what puts the core centre-right on desktop, slightly off
centre on tablet and below the copy on mobile. No important geometry ever lands
behind the headline.

**Architecture.**

| Module | Role |
| --- | --- |
| `nexus-intelligence-hero.tsx` | Server component: lockup, copy, CTAs, scrim |
| `nexus-intelligence-stage.tsx` | Chooses scene or static fallback |
| `nexus-intelligence-scene.tsx` | Mounts the engine, loads Three.js on idle |
| `nexus-intelligence-fallback.tsx` | SVG core for browsers with no WebGL |
| `scene/intelligence-engine.ts` | WebGL context, rAF loop, DOM observers |
| `scene/intelligence-world.ts` | Everything that simulates — DOM-free, GPU-free |
| `scene/intelligence-core.ts` | Inner mass, cages, struts, mid nodes, pathways |
| `scene/intelligence-network.ts` | k-NN node graph, instanced, 3 draw calls |
| `scene/data-signal.ts` | Fixed pool of travelling information particles |
| `scene/reasoning-cycle.ts` | The autonomous 8-step cycle plus ambient activity |
| `scene/intelligence-camera.ts` · `intelligence-lighting.ts` | Composition, depth |
| `scene/state.ts` | INTRO / IDLE / CURSOR_NEAR / CURSOR_OVER_CORE / REASONING |

The engine/world split is deliberate: the world takes a delta time and normalised
pointer coordinates and returns a scene graph, so the whole behaviour of the hero
is testable without a GPU (`npm run verify:scene`).

**Behaviour.**

- *Entrance* — 2.5s, from a single point of light to a settled system. Line
  formation uses `drawRange`, node appearance uses instance scale.
- *Idle* — slow rotation, a 0.8% breath, drifting internals, occasional ambient
  link activation.
- *Reasoning* — every 5–9s (period measured between cycle *starts*): a distant
  node wakes, a signal hops to a neighbour, that neighbour wakes, a second signal
  carries the result to the core, the core pulses, a neighbourhood lights, and the
  system fades back to idle. Phase-driven, so the rhythm follows the geometry.
- *Cursor* — proximity and hover are computed by projecting the core to screen
  space. Movement is capped at 0.11 world units of camera parallax; channels ease
  toward their targets, so nothing ever snaps.
- *Palette* — strictly the NEXUS greyscale ramp. One 4-unit-cool key light is the
  only non-neutral value in the scene.

**Performance and access.**

- Three.js is fetched by a real `import()` inside an effect, so it is a chunk the
  bundler cannot merge into the eager graph — the hero copy paints first.
- ~18 draw calls total; every node, strut and particle is instanced or merged.
  No post-processing, no shadows, no physics.
- The loop is *parked*, not throttled, when the hero scrolls out of view or the
  tab is hidden.
- The canvas and every wrapper are `pointer-events: none`.
- `prefers-reduced-motion` renders one settled frame and never starts the loop;
  the preference is watched live.
- No WebGL → the static SVG core, which is also what renders if context creation
  fails at runtime.

## Route map

| Audience | Routes |
| --- | --- |
| Public product | `/`, `/intelligence`, `/how-it-works`, `/pricing` |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/check-email`, `/auth/confirm`, `/auth/confirm-error`, `/auth/callback` |
| Onboarding | `/onboarding` (authenticated, incomplete accounts only) |
| Workspace | `/app` → `/dashboard`, `/app/intelligence`, `/projects`, `/tasks`, `/goals`, `/activity`, `/notifications`, `/integrations` |
| Account | `/settings`, `/settings/billing`, `/upgrade` |

The Next.js 16 proxy refreshes Supabase cookies and protects every non-public route.
Authenticated visitors may still read public product pages; opening an auth form takes
them directly into `/app`.

## Database and tenant isolation

`supabase/migrations/001_nexus_base_schema.sql` is the reproducible base schema.
Every tenant-owned table uses RLS based on active workspace membership; IDs supplied in
a URL or PostgREST request do not bypass workspace isolation. Post-base migrations add
atomic plan enforcement, write-time membership checks, task dependencies and a
trigger-owned activity audit stream. Public clients use only Supabase publishable/anon
keys—no service-role secret is read by the application.

## Application shell

One server layout (`src/app/(app)/layout.tsx`) resolves the user, the workspace, the
live counters and the plan usage once for every product route. Nothing is hardcoded.

- `src/components/layout/nav-config.ts` — **the single declaration of the information
  architecture**. The sidebar, the mobile navigation, the breadcrumb and the command
  palette all read from it, so a destination is added in exactly one place.
- `src/components/layout/workspace-sidebar.tsx` — 248px sidebar: brand, workspace
  switcher, search, Create, grouped navigation with real counters, plan usage.
- `src/components/layout/topbar.tsx` — breadcrumb, command interface, workspace status,
  notifications, account menu.
- `src/components/layout/app-shell.tsx` — composition, mobile drawer, bottom navigation,
  toast provider and keyboard shortcuts.

Below `lg` the sidebar becomes a drawer and a compact bottom navigation carries
Overview · Intelligence · Tasks · Activity · More — the hierarchy is redesigned for
small screens rather than shrunk.

### Keyboard

`⌘K` / `/` command palette · `G` then `O I P T G A N S` to navigate · `C` to create ·
`?` for the shortcut reference · `Esc` closes any overlay. Shortcuts are ignored while
typing in a field. See `src/components/keyboard-shortcuts.tsx`.

## Intelligence

`src/lib/intelligence/engine.ts` is a pure, deterministic, dependency-free engine. The
same snapshot always produces the same signals — no external service, no invented data.

Signal kinds: `blocked · at-risk · deadline · drifting · inactive · dependency ·
opportunity · momentum`, each with a severity, a one-sentence reason, an `evidence[]`
array of verifiable facts, the affected entity, and a recommended action that is always
a verb. `describeWorkspace()` produces the factual context read shown on the canvas, and
`summarizeForLLM()` is the only shape that may ever leave the server to a model provider
(aggregated signals — never raw rows, never secrets).

Recommended actions deep-link into real saved views (`/tasks?filter=overdue|blocked|
today`), so acting on a signal lands on exactly the work it described.

## Authentication

Authentication is performed **server-side**, so the session and the SSR cookies are
created by the same client — there is no token relay that can silently fail:

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signin` | email + password, writes the SSR cookies, returns `redirectTo` |
| `POST /api/auth/signup` | account creation; reports `requiresConfirmation`, emails `/auth/confirm` |
| `POST /api/auth/signout` | ends the session and clears the cookies |
| `POST /api/auth/forgot-password` | sends a recovery email (same success copy whether the address exists) |
| `POST /api/auth/resend-confirmation` | resends the sign-up verification email |
| `POST /api/auth/update-password` | completes recovery after `/auth/confirm?type=recovery` |
| `GET  /auth/confirm` | exchanges `token_hash` via `verifyOtp`, writes the SSR session and routes by account state (`/onboarding` until complete, then `/app`) |
| `GET  /auth/callback` | exchanges an email `code` or the OAuth `code` (`?source=oauth`) for an SSR session; recovery goes to `/reset-password`, everything else routes by account state |
| `GET  /auth/confirm-error` | branded NEXUS state for expired/invalid/used/missing verification links |
| `GET  /api/health` | public liveness probe |

The NEXUS-branded email templates live in `supabase/email-templates/` and must be
pasted into Supabase → Authentication → Email Templates (see the README there).
They point at `/auth/confirm?token_hash=...&type=email|recovery`, so confirmation
never depends on a PKCE code or exposes a raw Supabase page.

The cookies are not `HttpOnly` (Supabase default), so the browser client keeps working
for client-side CRUD under RLS. `src/lib/auth-errors.ts` turns Supabase errors into
messages a user can act on. The product routes sit behind an onboarding gate: until
`profiles.onboarding_completed` is true, `(app)` redirects to `/onboarding`.

**Sign-in methods.** Email/password (server-side, above) **and** "Continue with Google"
on both `/login` and `/signup`. Google keeps using the **same** Supabase PKCE flow and
the **same** `/auth/callback?source=oauth` route — email verification uses its own
server-side `/auth/confirm` token-hash route, so the two flows stay independent and
Google OAuth is not modified. To enable it, turn on the Google provider under Supabase →
Authentication → Providers and add `<site URL>/auth/callback` to the allowed Redirect
URLs. No client secret is ever shipped to the browser (PKCE); OAuth errors and
cancellations surface as a clear NEXUS message on `/login`, never a raw server error.

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

# Executes migrations 006-014 against a real Postgres engine (WASM) on top of a
# minimal schema fixture and asserts the freemium/security behaviour.
npm install --no-save @electric-sql/pglite
node supabase/tests/migration-logic.test.mjs

# Onboarding must tolerate a missing profiles.onboarding_intent column:
node supabase/tests/schema-errors.test.mjs

# 3D hero: builds the real IntelligenceWorld and steps it headlessly —
# entrance timing, idle convergence, reasoning cycles, cursor states,
# camera composition, numerical stability and resource disposal.
npm run verify:scene
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
npm run verify:scene   # headless simulation of the 3D hero (no GPU needed)
```
