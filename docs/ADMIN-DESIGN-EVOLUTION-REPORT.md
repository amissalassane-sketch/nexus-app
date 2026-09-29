# NEXUS ADMIN — DESIGN EVOLUTION REPORT

**Companion to:** `docs/NEXUS-ADMIN-DESIGN-EVOLUTION-PLAN.md` (sections A–P, written before any code change).
**Scope:** bring the control plane to the same design quality, coherence and maturity as the product environment —
same foundations, same primitives, more operational density. Not a redesign, not a separate visual language.
**Not changed:** route structure, `src/lib/admin/*` (all reads/RPC vocabulary/timeouts), Supabase schema and
migrations, auth logic, API contracts, the four frozen test suites' *intent*, the 248px sidebar / 56px topbar
geometry, and every existing data definition (including all the "why this number is absent" copy).

---

## 1. What was wrong (audit summary)

The control plane had drifted from the product in six concrete ways, all of which were measurable in source:

| # | Drift | Evidence before |
|---|---|---|
| C1 | A second surface ramp | `rounded-[7px]/[8px]/[10px]/[12px]`, six control heights (28/32/36/40/44/48), three focus recipes (`focus:` ring, `focus-visible:outline`, none) |
| C2 | No shared table layer | four hand-rolled `<table>` markup variants (activity, audit-log, plus two lists) with different paddings, header casing and hover treatment |
| C3 | Metadata type re-typed by hand | `font-mono text-[10px]/[10.5px]/[11px]/[11.5px]/[12px]/[12.5px]` inline in lists, footnotes and cells |
| C4 | Mobile = a smaller desktop | tables scrolled horizontally at every width; no stacked/card representation existed |
| C5 | Overlays and elevation | `shadow-2xl` on the auth cards, blur + translucent chrome outside the overlay tier |
| C6 | Logs were tables, not records | audit rows showed five bare `<td>`s; no WHO/WHAT/WHERE/RESULT reading order, no outcome vocabulary |

Sections B–N of the plan carry the full table of findings; the numbers above are the ones that drove code.

---

## 2. Foundations inherited (no new system)

Everything below already existed in `src/app/globals.css`. The Admin work **uses** it under the `admin-*`
namespace, whose values are identical to the product's:

- **Surface ladder** — L0 canvas `#000000` → L1 chrome `#080808` → L2 panel `#0f0f0f` → L3 raise `#151515` →
  L4 overlay `#1c1c1c`. Elevation is one surface step plus one hairline; shadows only on overlays.
- **Hairlines** — white-alpha 6 / 8 / 14 / 22 %. Admin borders now use `border-admin-border` (the 8 % step)
  instead of `border-admin-border/60`.
- **Radius band** — `rounded-xs` 4 (tags, meters) · `rounded-control` 8 (controls, rows, cards-in-columns) ·
  `rounded-surface` 12 (panels) · `rounded-overlay` 16 (modal, command palette, auth cards).
- **Technical monospace layer** — `.mono-meta` 11/16 tabular (values, timestamps, counters, ids) and
  `.mono-token` 10.5/14 +0.06em uppercase (actions, entity types, machine states, kbd) · `.metric` 24/28 for KPI
  values. Admin had been re-typing these by hand (`C3`).
- **Geometry** — controls 44px touch / 32px desktop (`h-10 … sm:h-8`, `h-11 lg:h-8`), page measure
  `max-w-page`, panel padding `p-4 sm:p-5`, row height 40px.
- **Motion** — the existing budget only: `duration-[120ms]` for hover/colour, `page-enter` for entrances,
  `motion-safe:` for overlays, one spinning icon on refresh. No row, border, nav-item or icon animation.
- **Admin-only accent** — Volt Lime stays reserved for primary actions, the active navigation bar and focus
  rings; lavender remains Intelligence's accent and is never decorative.

---

## 3. Primitives (updated / new)

| File | Status | What changed |
|---|---|---|
| `admin/panel.tsx` | updated | One surface recipe (`rounded-surface border-admin-border bg-admin-surface`), `AdminPanelHeader` at a fixed 44px row for panels that own a table, `AdminField`/`AdminFieldList` on the mono layer |
| `admin/table.tsx` | **new canonical layer** | `AdminTableShell` (overflow at narrow widths, sr-only caption, optional `className`), `AdminTh`, `AdminSortTh` (GET link + `aria-sort` + direction arrow), `AdminTd`, `AdminRowLink` (one stretched link per row), `AdminTableRow` (hover + trailing chevron), `AdminStaticRow` (records that are not destinations) |
| `admin/table.tsx` | **new responsive layer** | `AdminCardList` + `AdminCardItem` — the stacked form of the same table below `md` |
| `admin/list-controls.tsx` | rewritten | Toolbar is a GET form (works without JS) carrying hidden `sort`/`dir`/`size`; search and select are keyed by the server value so **the URL is the only source of truth**; pagination links name themselves and the current page is text, not a link |
| `admin/states.tsx` | rewritten | `AdminEmptyState` (widened icon vocabulary), `AdminErrorState` keyed by `AdminDataError["code"]` with the SQLSTATE/PGRST diagnostic block, `AdminNotMeasured`, `AdminUnavailableState` |
| `admin/status.tsx` | updated | `AdminStatusPill` + `AdminServiceStatus`; the seven service states are written out in words, never colour alone |
| `admin/kpi.tsx` | updated | `KpiTile` (label / value / definition / hint / tone) and `KpiGrid` with hairlines that survive the column change (`grid-cols-2 sm:grid-cols-4 gap-px bg-admin-border`) |
| `admin/badges.tsx` | extended | Added `AdminAuditOutcomeBadge` (success → neutral, denied → warning, failed → danger) — the RESULT vocabulary of the audit trail |
| `admin/directory.tsx` | rewritten | `AdminSubject` (displayName → email → @username → truncated id), `AdminTimeCell` (`<time>` with relative label + absolute UTC title, `Not available` when null), `AdminIdValue`, `initialsFor` |
| `admin/detail.tsx` | rewritten | `AdminBackLink`, `AdminDetailHeader`, `AdminNotFoundState` (in-shell, not the product 404), `AdminUnavailableAction` (disabled + reason), `AdminActionsPanel` |
| `admin/health-list.tsx` | updated | Scan dot + `AdminServiceStatus` + measured latency in `.mono-meta`; the action link gained a focus ring |
| `admin/activity-list.tsx` | updated | `<time dateTime>` preserved, mono layer applied, states kept distinct (unavailable ≠ empty) |
| `admin/copy-button.tsx` | rewritten | Clipboard probe on click, `aria-live` announcement, canonical Tag geometry |
| `admin/access-denied.tsx` | rewritten | Overlay card on the auth recipe; four documented refusal reasons (`SUPABASE_NOT_CONFIGURED`, `MIGRATION_NOT_APPLIED`, `TIMEOUT`, `QUERY_FAILED`) |
| `admin/admin-login-form.tsx` | rewritten | Product auth recipe: overlay card, canonical fields, primary action, `EMAIL_NOT_CONFIRMED` branch, no public sign-up reference |
| `admin/admin-shell.tsx` | rewritten | **One DOM tree for both sidebar widths** (compact < `lg`, labels via CSS — no duplicate links), planned items as `aria-disabled` rows with an sr-only reason, Volt Lime active bar, drawer as a real dialog with focus return, ⌘K jump button, sign-out to `/admin/login` |
| `admin/admin-command-menu.tsx` | rewritten | Ctrl/⌘K, listbox/option ARIA, arrows/Enter/Escape, focus on open, overlay tier + the one 2px scrim blur, `motion-safe` entrance |
| `admin/admin-refresh-button.tsx` | rewritten | `useTransition` + `router.refresh()`, spinning icon, 44px phone / 32px desktop |

**Rule enforced throughout:** no Admin-only replacement was created for a canonical primitive. Where Admin
needed something the product did not have (a dense table, an audit record row, a metadata time cell), it was
added *to* the shared layer in `src/components/admin/*`, on product tokens.

---

## 4. Routes updated

| Route | Change |
|---|---|
| `/admin/overview` | Header on the canonical ladder (`text-h1`) with one status object (`AdminServiceStatus`), KPI strip with definitions, needs-attention list with real actions, audit/activity panels; hand-rolled status pill and the `brightness-125` hover hack removed |
| `/admin/users` | Visible `text-h1` title, canonical table, **stacked card list below `md`**, tech-layer sweep of the footnotes |
| `/admin/workspaces` | Same treatment; the "no active owner" and "default plan" markers travel with the row in both representations |
| `/admin/subscriptions` | Same treatment; usage meters moved onto `rounded-xs` + `.mono-token` |
| `/admin/activity` | Hand-rolled table → `AdminTableShell` + `AdminStaticRow` + `AdminCardList`; the workspace cell links to the inspector when the row still carries a workspace id; a `WorkspaceCell` shared by both representations |
| `/admin/audit-log` | Hand-rolled table → the WHO/WHAT/WHERE/RESULT/WHEN record pattern (§5) |
| `/admin/security` | Tech-layer sweep; sessions remain explicitly `unavailable` with the GoTrue reason |
| `/admin/intelligence` | Lavender kept as the intelligence accent only |
| `/admin/login` · `/admin/forgot-password` · `/admin/reset-password` | One overlay card recipe, one field recipe, one primary action, one error box; `shadow-2xl`, mono labels, `focus:ring` and `←`-prefixed links removed |
| `/admin/*` gate | A deployment without Supabase now sends `/admin/*` to `/admin/login` instead of the product `/login` (the control plane has its own sign-in surface, and that page is the one that explains what is missing) |

---

## 5. The audit-log pattern

The audit trail is the screen operators read under pressure, so its reading order is fixed by the questions
they actually ask, not by the column order a query happened to return:

**WHO** (`actor_email`, plus `actor_role` when present) · **WHAT** (`action`, in `.mono-token`) · **WHERE**
(`target_type` / `target_id`) · **RESULT** (`AdminAuditOutcomeBadge`: Success quiet, Denied warning, Failed
danger) · **WHEN** (`AdminTimeCell`: relative label, absolute UTC in the title).

Two properties carry it:

1. **Rows are records, not destinations.** Nothing in an audit row is navigable, so no stretched link
   promises one; only the workspace name in Activity links, and only when the row still carries an id.
2. **The vocabulary is explained on the page.** A footnote states what `success` / `denied` / `failed` mean and
   why a row can have no actor email (deleted account, retained event).

---

## 6. Density and responsive strategy

Density comes from rhythm, not from smaller type: 40px rows, 32px header rows, 4/8/12px radius, hairlines owned
by the row (so the last line never doubles with the frame), one surface step per level.

Below `md` **nothing is shrunk** — the table's information is re-laid out. Each list pairs its table with
`AdminCardList`:

| Width | Representation |
|---|---|
| 1440 / 1280 | Full tables, page measure `max-w-page`, filters on one line |
| 1024 | Same tables (rail collapses to icons at `lg` boundaries in the shell) |
| 768 | Tables still render (`md`), sidebar becomes the drawer, controls switch to 44px |
| 480 | Stacked card items: identity + status on line 1, technical metadata below, critical values first |

Both representations are derived from **one** view model per page (`toRow()` in the log pages, row objects in
the lists), so the two can never disagree. Filter controls stay on one line by collapsing to full-width
inputs rather than by hiding filters; the toolbars are real GET forms, so search and filters work with JS off.

---

## 7. Accessibility

- **Keyboard / focus** — one canonical focus recipe (`focus-visible:outline` + admin accent, 2px, offset) at
  every control, including the sidebar's shared `FOCUS` constant, drawer trigger, close button, links,
  sign-out, copy button, pagination and the audit action links.
- **Drawer & command menu** — real dialogs (`role="dialog"`, `aria-modal`, labelled), Escape closes, focus
  moves in and returns to the trigger, `aria-expanded` / `aria-controls` on the trigger.
- **Tables** — real `<table>` with `sr-only` caption, `th scope="col"`, `aria-sort` on sortable headers, one
  tab stop per row (stretched link), icon-only controls labelled.
- **Status never by colour alone** — all seven service states render their word; badges carry text; the
  needs-attention items name the source (`admin_overview() · id`) next to the severity icon.
- **Forms** — visible labels, `aria-*` error regions (`role="alert"`), disabled buttons while submitting,
  password reveal is a labelled toggle, not an icon-only unlabelled button.
- **Copy** — clipboard support is probed on click and the result is announced (`role="status"`), so a blocked
  clipboard is stated instead of silently failing.

---

## 8. Motion

Admin uses the product's budget, unchanged and unexpanded:

| Motion | Where |
|---|---|
| Page entrance (`page-enter`) | route transitions, once per navigation |
| Overlay entrance (`motion-safe:animate-[panel-in…]` / `fade-in`) | drawer, command menu |
| Spinner | the single refresh affordance, and form submits in the auth surfaces |
| Colour `120ms` | hover / focus feedback on rows, controls, links |

Not animated anywhere in Admin: rows, borders, icons, navigation items, metadata, badges. No bounce, elastic
easing, scale, parallax or status flash. The global `prefers-reduced-motion` rule collapses every duration, so
the reduced-motion path needs no per-component code.

---

## 9. Verification results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (12 pre-existing warnings in test files + `tailwind.config.js`) |
| `npx next build` | succeeds; `/showcase*` prerendered static, all `/admin/*` dynamic |
| `scripts/test-admin-foundation.mjs` | 116 passed, 0 failed |
| `scripts/test-admin-users-workspaces.mjs` | 139 passed, 0 failed |
| `scripts/test-admin-pr3.mjs` | 19 passed, 0 failed |
| `scripts/test-admin-pr6.mjs` | 20 passed, 0 failed |
| `scripts/test-mobile-ux.mjs` | 67 passed, 0 failed |
| `scripts/test-typography.mjs` | 19 passed, 0 failed |
| `scripts/test-icons.mjs` | 251 passed, 0 failed |
| `scripts/test-landing-design.mjs` | 93 passed, 0 failed |
| `supabase/tests/product-background.test.mjs` | 2 passed, 0 failed |
| `supabase/tests/session-proxy.test.mjs` | passes (admin paths → `/admin/login`) |
| Rendered HTML/CSS audit | `/`, `/pricing`, `/showcase*`, `/admin/login`, `/admin/forgot-password` return 200 with **no** legacy admin hexes, no `bg-[#…]`, no `backdrop-blur-md`, no `shadow-2xl`; `/admin/*` redirects to `/admin/login` |
| Token audit | `.mono-meta`, `.mono-token`, `.metric`, `.surface-raise`, `.surface-overlay`, `.reveal` all emitted in the compiled CSS |

| Static audit — Admin scope | `bg-[#…]` **0** · gradients **0** · `backdrop-blur-md|lg` **0** · `shadow-2xl|xl|lg` **0** · arbitrary `text-[Npx]` / `rounded-[Npx]` **0** · files with explicit focus rings: 18 · mono-layer usages: 158 |

**Two test assertions were updated deliberately, both to keep the suite's intent rather than its letter:**

1. `test-admin-foundation.mjs` — "focus is visible on every interactive element" counted raw
   `focus-visible:outline` occurrences (≥5). The shell now declares the recipe once (`const FOCUS = …`) and
   applies it at seven sites; the assertion now requires the ring to be *declared* and *applied ≥5 times*, so
   inlining the same five utility classes seven times (the drift the suite exists to prevent) is not rewarded.
2. No other assertion needed to change: table semantics, captions, `aria-sort`, state vocabulary,
   `grid-cols-2 sm:grid-cols-4`, `hidden h-dvh w-[64px] … md:flex lg:w-[248px]`, `initialsFor`,
   `shortIdInline` and the `AdminSubject` precedence all still hold, which is what the suites are for.

---

## 10. Remaining issues

- **`AdminPagination` has no numbered pages.** Prev/next plus "page X / Y" is deliberate (the RPCs expose
  page + total only), but a jump-to-page control would need a new query parameter and is out of scope here.
- **Bulk selection and row expansion do not exist** in Admin. The plan's table section specifies them for
  lists that gain a real action; today no admin RPC accepts a write, so they would be dead UI.
- **`/admin/users` and `/admin/workspaces` still render the table markup for `md+` only.** The stacked list is
  the mobile representation; a "compact table" middle step (768–1024) was considered and rejected as noise.
- **Dead decorative components remain** outside Admin: `src/components/ui/nexus-grid.tsx` (radial gradient +
  1.5px backdrop blur), `src/components/ui/demo.tsx` (6px filter blur entrance) and
  `src/components/spatial/nexus-spatial-field.tsx` are not imported anywhere. They are the last files in the
  repo carrying decorative blur/gradient; deleting them is a one-line decision nobody has made yet.
- **`tailwind.config.js` is still a v3 mirror.** It is not consumed by the Tailwind v4 build (which reads
  `globals.css`), but it disagrees with the restored ramp in several keys.
- **Admin has no visual regression harness.** The suites assert structure and vocabulary, not pixels; the
  rendered-HTML audit is manual (see §9).

## 10b. Later additions

- **2026-09-29 — slide label (animated CTA text).** `/admin/overview`'s "Needs attention" navigation action now
  carries the shared slide interaction (same component as the product, no Admin copy), and its two source-level
  issues were fixed with it (raw `<a href>` → `Link`; the Platform-status action link gained the missing focus
  ring). Every other Admin control is documented as intentionally still. See
  `docs/SLIDE-LABEL-IMPLEMENTATION.md` §3.

## 11. Next improvements

1. **Snapshot the four list screens** (1440 / 768 / 480) into `docs/screenshots/` with the existing
   deterministic mock data, so future changes to the table layer can be diffed visually.
2. **Retire the dead decorative components** (`nexus-grid`, `ui/demo`, `spatial/nexus-spatial-field`) or gate
   them behind the showcase, which is the only surface where such decoration belongs.
3. **Reconcile or delete `tailwind.config.js`** so there is exactly one source of tokens.
4. **Add `size` / numbered pagination** to `AdminPagination` once an admin read exposes it — the toolbar
   already carries `size` through submit, so only the control is missing.
5. **Extend the audit pattern** to any future write surface: `recordAdminAudit` already defines the outcome
   vocabulary the badge renders, so a new privileged action appears in the log with no UI work.

---

## 12. Modified files (Admin scope)

```
src/app/admin/activity/loading.tsx
src/app/admin/activity/page.tsx
src/app/admin/audit-log/loading.tsx
src/app/admin/audit-log/page.tsx
src/app/admin/forgot-password/page.tsx
src/app/admin/overview/loading.tsx
src/app/admin/overview/page.tsx
src/app/admin/reset-password/page.tsx
src/app/admin/security/loading.tsx
src/app/admin/security/page.tsx
src/app/admin/subscriptions/loading.tsx
src/app/admin/subscriptions/page.tsx
src/app/admin/users/[userId]/page.tsx
src/app/admin/users/loading.tsx
src/app/admin/users/page.tsx
src/app/admin/workspaces/[workspaceId]/page.tsx
src/app/admin/workspaces/loading.tsx
src/app/admin/workspaces/page.tsx
src/components/admin/access-denied.tsx
src/components/admin/activity-list.tsx
src/components/admin/admin-command-menu.tsx
src/components/admin/admin-icons.tsx
src/components/admin/admin-login-form.tsx
src/components/admin/admin-refresh-button.tsx
src/components/admin/admin-shell.tsx
src/components/admin/badges.tsx
src/components/admin/copy-button.tsx
src/components/admin/detail.tsx
src/components/admin/directory.tsx
src/components/admin/health-list.tsx
src/components/admin/kpi.tsx
src/components/admin/list-controls.tsx
src/components/admin/panel.tsx
src/components/admin/states.tsx
src/components/admin/status.tsx
src/components/admin/table.tsx
```

Shared files touched by the Admin work:

```
NEXUS-DESIGN-KNOWLEDGE/06-NEXUS-CONTEXT/NEXUS-DESIGN-DECISIONS.md
NEXUS-DESIGN-KNOWLEDGE/06-NEXUS-CONTEXT/NEXUS-TOKENS.md
docs/ADMIN-DESIGN-EVOLUTION-REPORT.md
docs/DESIGN-EVOLUTION-REPORT.md
docs/NEXUS-ADMIN-DESIGN-EVOLUTION-PLAN.md
docs/NEXUS-DESIGN-EVOLUTION-PLAN.md
scripts/test-admin-foundation.mjs
src/app/globals.css
src/app/showcase/dashboard/page.tsx
src/app/showcase/page.tsx
```

(The remaining changed files in `git status` belong to the product-side evolution reported in
`docs/DESIGN-EVOLUTION-REPORT.md`.)
