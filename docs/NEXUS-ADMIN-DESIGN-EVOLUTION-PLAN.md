# NEXUS ADMIN — DESIGN EVOLUTION PLAN

**Status:** written after full reconnaissance of the Admin surface, before any implementation.
**Scope:** bring the NEXUS Control Plane to the same design quality, coherence and maturity as the product
environment — as *the same product*, not a second design language.
**Constraints honoured:** route structure, data layer, RPCs, guard, audit writes, mock-free honesty rules and
every existing structural test contract are preserved. No new dependency. No new colour, spacing, radius,
typography or component system.

---

## Status

> **Executed.** The implementation followed the phase order in §O. Results, the modified-file list, the
> verification output and the remaining issues are recorded in `docs/ADMIN-DESIGN-EVOLUTION-REPORT.md`.
> Two frozen assertions were updated deliberately (documented in the report, §9); every other structural
> contract — table semantics, state vocabulary, KPI grammar, rail geometry, `AdminSubject` precedence —
> was preserved.

---

## A. Current Admin architecture

**Routes (16 real, all server components behind a database-backed gate):**

| Route | File | Role |
|---|---|---|
| `/admin` | `page.tsx` (13) | redirect to `/admin/overview` |
| `/admin/overview` | 598 lines | operational dashboard: KPIs, platform status, 9 sections |
| `/admin/users` + `/admin/users/[userId]` | 314 + 505 | directory table → account inspector |
| `/admin/workspaces` + `/admin/workspaces/[workspaceId]` | 323 + 577 | directory table → workspace inspector |
| `/admin/subscriptions` | 404 | plan/status/usage rows, **no money** (no provider) |
| `/admin/security` | 64 | admin context, audit signal, sessions-unavailable |
| `/admin/activity` | 22 | read-only `public.activities` table |
| `/admin/audit-log` | 17 | append-only `admin_audit_log` table |
| `/admin/intelligence` | 46 | provider config + recorded request activity |
| `/admin/{login,forgot-password,reset-password}` | | auth surfaces, deliberately outside the shell |

**Layout:** `app/admin/layout.tsx` — force-dynamic, noindex, `getPlatformAdminState()` → redirect / refusal /
`<AdminShell>`. `scripts/test-admin-foundation.mjs` (586 lines) locks this contract; 4 more suites
(`pr3`, `pr6`, `users-workspaces`, `preview-admin`) lock the lists, subscriptions and directory behaviour.

**Components:** 17 files in `src/components/admin/` — shell, command menu, panel, table, badges, status, kpi,
detail, directory, list-controls, states, activity-list, health-list, icons, copy-button, refresh-button,
login-form, access-denied. **Data layer:** 12 modules in `src/lib/admin/` (nav, query, format, guard, data,
directory, subscriptions, health, audit, activity-security, attention, types) — untouched by this work.

**Shell today:** 64px icon rail below `lg`, 248px labelled rail above it, drawer below `md`, ⌘K command menu,
identity footer, refresh, sign-out.

---

## B. Current visual language

The control plane runs its **own namespaced ramp** declared in `globals.css` and confined to `src/app/admin`
+ `src/components/admin` by a tested isolation rule.

| Layer | Current admin value | Product value |
|---|---|---|
| canvas / sidebar | `#000000` (contract) | `#000000` |
| panel surface | `#171719` (blue-charcoal) | `#0f0f0f` |
| raised | `#1f1f22` | `#151515` |
| overlay | `#28282c` | `#1c1c1c` |
| borders | solid `#2a2a2d` / `#3a3a3e` | white-alpha hairlines 6/8/14/22 % |
| text | `#ffffff` / `#a1a1a6` / `#8e8e94` | `#f2f2f2` / `#b0b0b0` / `#868686` |
| accent | Volt Lime `#d2ff4d` (contract) | white + lavender for intelligence |

**And the content canvas is LIGHT.** `html[data-theme="light"] [data-dashboard-root="true"]` has higher
specificity than `[data-dashboard-root="true"].admin-root`, so in the default light theme the admin roots
paint `#f7f7f5`; `.admin-canvas` then declares a full **light** admin ramp (`#f7f7f5` canvas, `#ffffff`
panels) while dark panels are re-darkened per element by
`.admin-canvas [class~="bg-admin-surface"]`. That is the documented "two-zone scoping (contrast fix)".

---

## C. Existing inconsistencies (measured)

| # | Finding | Evidence |
|---|---|---|
| C1 | Admin is not one dark room: light canvas + dark chrome + per-element re-darkening | `globals.css` 4390–4470; specificity bug at 4283 |
| C2 | Surfaces/borders/text are a second ramp, not the canonical ladder | `#171719 / #1f1f22 / #28282c`, solid `#2a2a2d` |
| C3 | Radius drift: 6 inline values where the band defines 4 | `rounded-[8px]`×44, `[6px]`×23, `[4px]`×13, `[7px]`×8, `[10px]`×7, `[12px]`×4 |
| C4 | Two page-title scales: 30px on 6 pages, `text-h1` (22px) on intelligence, 20px in detail headers | `text-[30px]`×4 files vs `text-h1` |
| C5 | Arbitrary type values instead of the ladder | `text-[11px]`×52, `[12.5px]`×38, `[13px]`×33, `[12px]`×32, `[10px]`×27, `[11.5px]`×18, `[9.5px]`×5 |
| C6 | **Two table systems**: `AdminTable*` primitives on users/workspaces/subscriptions vs hand-rolled `<table>` on activity/audit-log | `admin/activity/page.tsx:20`, `admin/audit-log/page.tsx:16` |
| C7 | Control heights not on the canonical ladder: `h-9` (36px) everywhere, plus `h-7`/`h-8` mixed for the same job | shell, list-controls, refresh, copy |
| C8 | Ad-hoc shadows instead of the elevation tokens | drawer `shadow-[0_24px_60px…]`, command `shadow-[0_24px_70px…]`, auth `shadow-2xl` |
| C9 | Duplicate recipes for one job: three "pill" shapes (status 21px/6px, "soon" 4px, copy 7px) and four toolbar button recipes | status.tsx, admin-shell.tsx, copy-button.tsx, list-controls.tsx |
| C10 | Focus rings hand-written per element (`focus-visible:outline-2 outline-admin-accent`) instead of one token recipe | ~30 sites |
| C11 | Non-canonical spacing/radius pairs on identical panels (`p-4 sm:p-5`, `px-4 sm:px-8`, `py-6 sm:py-8`) | admin-shell main, panel.tsx |
| C12 | Loading skeletons re-declare `animate-pulse` per element with ad-hoc radii (`rounded-[6px]`, `rounded-[7px]`, `rounded-[4px]`) | 7 `loading.tsx` files |
| C13 | No shared "log row" even though activity + audit-log + overview all render chronological events with different markup | activity-list.tsx vs audit page inline table |
| C14 | Command palette repeats the product palette's structure with different values (10px radius, 7px rows, `bg-black/70 backdrop-blur-sm`) | admin-command-menu.tsx |
| C15 | Volt Lime appears 62 times; some are state (active rail, live dot), some decoration (icon tint on hover) | census |

**Not found:** hardcoded hex inside admin components (0), gradients (0), Lucide icons (0), invented metrics (0 —
enforced by tests), light-only text colours (0 after the canvas fix).

---

## D. Relationship with the new NEXUS design system

The product evolution defined: a pure-black surface ladder (`#000000 / #080808 / #0f0f0f / #151515 / #1c1c1c`),
white-alpha hairlines, a tracking ladder, a technical monospace layer (`.mono-meta`, `.mono-token`, `.metric`),
a five-value radius band, named geometry tokens, and one canonical recipe per primitive.

**The Admin must inherit all of it.** The admin ramp stays *namespaced* (`--color-admin-*`) because that is an
architectural contract — the isolation rule and the required literals `--color-admin-base: #000000`,
`--color-admin-sidebar: #000000`, `--color-admin-accent: #d2ff4d` are asserted by
`scripts/test-admin-foundation.mjs` — but its **values** become the canonical ones. Two consequences:

1. `--color-admin-surface/2/3` re-point to L2/L3/L4; `--color-admin-border*` become white-alpha hairlines;
   `--color-admin-text*` become the product text ramp.
2. The light canvas and the per-element re-darkening are deleted, and the specificity bug that caused them is
   fixed at the source, so the whole Admin is one dark room like the product.

**Volt Lime is kept, deliberately, as the operator accent** — it is pre-existing NEXUS Admin architecture
(priority 1 in the source-of-truth order) and a tested contract. It is tightened, not expanded: live/active,
progress, focus and the active rail; never a background, never body copy, never decoration. Lavender is used
only where the surface is *about intelligence*, matching the product rule.

---

## E. Linear principles applicable to Admin

| Principle | Application here |
|---|---|
| Surface hierarchy over decoration | L2 panels on L0 canvas, one step per elevation, no gradients (C1, C2) |
| Hairline borders | white-alpha hairlines replace solid strokes (C2) |
| Compact, dense geometry | 32px toolbars, 36–40px rows, 16/20px panel padding (C7, C11) |
| Typography discipline | one page-title step, deliberate negative tracking, mono only for technical roles (C4, C5) |
| Restrained elevation | shadows reserved for overlay-tier surfaces (drawer, palette, auth card) (C8) |
| One component per job | one table system, one pill recipe, one focus ring (C6, C9, C10) |
| Keyboard-first operation | command menu, focus rings, aria-sort, sr-only captions (existing, tightened) |

## F. Vercel principles applicable to Admin

| Principle | Application here |
|---|---|
| 4px spacing foundation | every padding/gap on the scale; named panel/row tokens instead of ad-hoc pairs (C11) |
| Systematic token set | the ladder, not per-component values (C3, C5) |
| Geist Mono as a technical layer | `.mono-meta` for values/timestamps, `.mono-token` for labels/IDs/codes (C5) |
| Strict responsive collapse | documented per breakpoint; drawer ≠ shrunken table (see §K) |
| Consistent primitives | AdminPanel/Row/Table/Status recipes as the only approved marks (C6, C9) |
| Monospace for machine truth | SQLSTATE codes, request ids, counts, durations — never for prose |

## G. Principles NOT imported

- **Linear's dark-on-dark low-contrast text** (quaternary on quaternary) — the control plane is read at 07:00
  on a bad monitor; AA stays.
- **Linear's calm-but-sparse information density** — an operator console needs more rows per screen, not fewer.
- **Vercel's marketing-scale display type** (56px+ hero) — never in a console; page titles cap at `text-h1`.
- **Linear/Vercel colour accents as decoration** — the only accents here are Volt Lime (operational state) and
  lavender (intelligence); both stay rare.
- **Vercel's geist-sans/geist-mono pairing** — NEXUS uses Instrument Sans + Geist Mono; identity is not for swap.
- **Marketing-style KPI cards with sparkline decoration** — this surface's honesty rule forbids invented
  figures; no chart is added that the data layer cannot support.
- **The product's white primary button as the admin's default action** — admin's primary accent is Volt Lime
  scoped to state; primary destructive/compliance actions stay explicit (see §I, Danger).

---

## H. Proposed NEXUS Admin evolution

**H1 — One dark room (canvas → chrome → panel → raise → overlay).**
*Current:* light canvas + dark chrome + per-element re-darkening.
*Principle:* surface contrast, not decoration (Linear surface hierarchy; §6 of the brief).
*Proposed:* admin roots paint `--color-admin-base` (#000000) at every level; `--color-admin-surface` becomes L2
(`#0f0f0f`) for panels, `-2` L3 (`#151515`) for rows/inputs/hover, `-3` L4 (`#1c1c1c`) for overlays; the light
canvas block and the `bg-admin-surface` re-darkening block are removed; the light-theme rule is scoped with
`:not(.admin-root)` so the cascade bug cannot return.
*Affected:* `globals.css` (admin block), every admin page and component (values inherited).
*Risk:* medium — the light canvas was itself a contrast fix; mitigated by re-running the contrast checks and
by keeping the product light theme untouched (admin only).
*Priority:* P0.

**H2 — Hairline borders.**
*Current:* solid `#2a2a2d` / `#3a3a3e`.
*Proposed:* `rgba(255,255,255,0.08)` default, `0.14` strong — identical to the product.
*Affected:* globals admin block; every `border-admin-border`.
*Risk:* low. *Priority:* P0.

**H3 — Text ramp alignment.**
*Current:* `#ffffff / #a1a1a6 / #8e8e94`.
*Proposed:* `#f2f2f2 / #b0b0b0 / #868686`, matching the product ramp and removing the "pure white" glare of a
1,000-row table.
*Affected:* globals admin block; all admin text.
*Risk:* low (contrast improves on black). *Priority:* P0.

**H4 — Radius band.**
*Current:* six inline radii.
*Proposed:* chips/kbd 4 (`rounded-xs`), all controls/nav/rows 8 (`rounded-control`), panels/dropdowns/command
palette 12 (`rounded-surface`), drawer/modal/auth cards 16 (`rounded-overlay`), avatars 8.
*Affected:* panel.tsx, table.tsx, status.tsx, list-controls.tsx, detail.tsx, directory.tsx, states.tsx, shell,
command menu, 7 loading files.
*Risk:* low, purely visual. *Priority:* P1.

**H5 — Type ladder + tracking.**
*Current:* 30px page title, 15px section title, 8 arbitrary sizes.
*Proposed:* page title `text-h1` (22/−0.028em), section title `text-h2` (16/−0.018em), body 13.5, small 12.5,
caption 11.5; panel labels use `.mono-token`; values use `.mono-meta`; KPI values use `.metric`.
*Affected:* overview, security, activity, audit-log, users, workspaces, subscriptions headers; panel.tsx, kpi.tsx.
*Risk:* low — the 30px title was the loudest inconsistency. *Priority:* P1.

**H6 — One control ladder.**
*Current:* h-9 for everything; h-7/h-8 mixed.
*Proposed:* dense toolbar/filter/row action = **32px** (h-8); standard action (refresh, sign-out, page primary)
= **36px → 32px on desktop, 40px on touch**? → resolved as: standard = 32px desktop / 40px touch via
`h-10 sm:h-8`, mirroring the product button rule; auth primary stays 48px.
*Affected:* list-controls, refresh, copy, shell buttons, command menu rows.
*Risk:* low; the mobile 44px rule in globals already grows text controls — it will be raised to match.
*Priority:* P1.

**H7 — One table system.**
*Current:* primitives on 3 lists, hand-rolled tables on activity + audit-log.
*Proposed:* `AdminTableShell / AdminTh / AdminSortTh / AdminTd / AdminTableRow / AdminRowLink` are the only
table implementation; activity and audit-log are migrated; a shared `AdminLogTable` composition renders the
WHO / WHAT / WHEN / WHERE / RESULT pattern on top of it.
*Affected:* `admin/activity/page.tsx`, `admin/audit-log/page.tsx`, table.tsx.
*Risk:* medium (these pages are asserted by tests — sort/caption/aria attributes must survive).
*Priority:* P0 (biggest visual incoherence).

**H8 — One status vocabulary.**
*Current:* three pill recipes (21px/6px status, 4px "soon", 7px copy) + role/plan/priority maps.
*Proposed:* `AdminStatusPill` keeps its API and becomes the canonical Tag (h-5, radius 4, mono 10.5 uppercase);
the "soon" and copy chips become the same recipe; letter-spacing uses the canonical +0.06em; semantic tones only.
*Affected:* status.tsx, shell, copy-button, badges.tsx.
*Risk:* low. *Priority:* P1.

**H9 — Detail-view structure.**
*Current:* header + panel stack, consistent but with mixed radii/padding and a 20px title.
*Proposed:* canonical inspector: header (eyebrow → 22px title + identity mono line + badges + actions) →
Overview panels → Configuration → Activity → Metadata → Danger zone (only where functionality exists).
Panels become the canonical recipe (`rounded-surface`, hairline, 16/20 padding, 44px header row).
*Affected:* `detail.tsx`, both `[id]` pages.
*Risk:* medium — asserted strings in users-workspaces test must survive. *Priority:* P1.

**H10 — Auth surfaces.**
*Current:* light-canvas admin ramp leaks into login/forgot/reset; `rounded-[12px]`, `shadow-2xl`.
*Proposed:* same overlay recipe as the product's auth card (radius 16, `--shadow-overlay`, hairline), controls
at 40px/44px touch, canonical type, focus ring token.
*Affected:* admin-login-form, forgot-password, reset-password pages.
*Risk:* low. *Priority:* P2.

**H11 — Motion budget.**
*Current:* 4 animation names, 31 `transition-colors duration-150`, plus `animate-pulse` skeletons.
*Proposed:* keep the existing names and reduced-motion gates; unify hover feedback at 120ms; entrance motion
only for overlays (drawer, command palette) and page-level reveal; skeletons keep pulse with `motion-reduce`.
*Affected:* command menu, shell drawer, skeletons, hover recipes.
*Risk:* low. *Priority:* P2.

---

## I. Component evolution

| Component | Evolution | Why |
|---|---|---|
| `AdminPanel` | canonical surface recipe; optional 44px header row with title + action; `padded={false}` unchanged | one panel language across 9 screens |
| `AdminSectionTitle` | `text-h2` title, `text-small` description, inline action slot | C4/C5 |
| `AdminEyebrow` | `.mono-token` (10.5/+0.06em uppercase) | C5, canonical mono layer |
| `AdminField/FieldList` | row recipe: 32px min height, hairline, label sans, value `.mono-meta` | dense inspector rows |
| `AdminTable*` | canonical header/row/hover/selected, `aria-sort` preserved, row 40px, chevron chip 8px | C6, C3 |
| `AdminStatusPill` | canonical Tag: h-5, radius 4, mono 10.5 | C9 |
| `KpiTile` | `.metric` value, `.mono-token` label, hairline separators kept (`gap-px bg-admin-border` is a test contract) | C5 |
| `AdminListToolbar` | 32px search/select/apply, canonical field recipe, label via `.mono-token` | C7 |
| `AdminPagination` | 32px edges, mono meta counts | C7 |
| `AdminEmptyState/ErrorState/UnavailableState` | canonical surface + radius, mono diagnostic line via `.mono-meta` | C3 |
| `AdminDetailHeader` | 22px title, tracking −0.028em, identity line `.mono-meta` | C4 |
| `AdminRefreshButton/CopyButton/SignOut` | one secondary-button recipe, 32px (40 touch) | C7, C9 |
| `AdminCommandMenu` | canonical overlay recipe (radius 12, `--shadow-overlay`, single 2px scrim blur, 32px rows) | C14 |
| `AdminSubject/AdminTimeCell/AdminIdValue` | avatar 8px, `.mono-meta` for handle/time/id | C3/C5 |
| `AdminShell` | canonical nav rows (32px), hairline separators, live dot via Volt Lime only, drawer = overlay recipe | C7/C8/C15 |
| **new** `AdminLogRow` | WHO/WHAT/WHEN/WHERE/RESULT composition over the table + list recipes | C13 |

---

## J. Information-density strategy

- **Rows:** 40px standard, 32px compact (dense inspector fields), 44px touch.
- **Tables:** 40px rows, px-3 cells, header 32px, one hairline per row (`border-b`, last row none).
- **Panels:** 16px padding (20px at ≥sm), 44px title row, hairline dividers between regions.
- **Metadata:** one line, `truncate`, mono only for machine values; never wrap a timestamp into two lines.
- **Numbers:** tabular always (`.mono-meta`/`.metric` set `font-variant-numeric`).
- **No card grid multiplication:** KPIs stay a single hairline-split strip; only real sections get panels.
- **Mobile:** density loses columns, never actions (see §K).

## K. Responsive strategy

| Surface | 1440 | 1280 | 1024 | 768 | 480 |
|---|---|---|---|---|---|
| Shell | 248 rail | 248 rail | 248 rail (lg) | 64 icon rail (md) | drawer 280 + scrim |
| Overview KPIs | 4-up | 4-up | 4-up | 4-up | 2-up (`grid-cols-2 sm:grid-cols-4`, test contract) |
| Overview panels | 2-col lg | 2-col | 2-col | stacked | stacked |
| Directory tables | full, 6–7 cols | full | full | horizontal scroll inside frame | same scroll, title+status kept, secondary cols after scroll |
| Audit/activity | full | full | full | scroll | scroll |
| Detail inspector | header + 2-col panels | 2-col | 2-col | stacked | stacked |
| Command palette | 640 centred | 600 | 560 | 90vw | full-width, sticky footer |
| Filters toolbar | one row | one row | one row | wraps | stacked full-width |
| Auth cards | 420 | 420 | 420 | 90% | full-width |

Mobile is a **different arrangement, not a squeezed table**: search + filters stay first-class, the row's
identity and status stay visible, secondary columns are reachable by scrolling the frame (never clipped), and
targets are ≥44px.

## L. Motion strategy

**In:** overlay entrances (drawer 180ms, palette 140ms, scrim fade 120–140ms), refresh spin, skeleton pulse,
hover/active colour transitions at 120ms, focus ring instant. **Out:** row staggering, icon animation, nav
item animation, count-ups, chart tweens, decorative pulses on data. Every animation keeps its
`motion-safe:`/`motion-reduce:` gate; no new keyframes are introduced.

## M. Accessibility strategy

Preserved and extended: server-side gate; `role="dialog"` + `aria-modal` + focus trap/restore in the drawer and
palette; `aria-current`, `aria-expanded`, `aria-controls`, `aria-disabled` on planned nav; `<time dateTime>`;
`<caption class="sr-only">`, `scope="col"`, `aria-sort` on every table; status never colour-only (word + dot);
`role="alert"` for failures, `role="status"` for loading and copy confirmation; one tab stop per table row;
visible focus ring on **every** interactive element (single shared recipe → `--focus-ring`); AA on all surfaces
(re-checked after the ramp change); touch targets ≥44px below `md`.

## N. Migration risks

| Risk | Mitigation |
|---|---|
| Changing `--color-admin-surface*` touches every admin screen at once | Values only, no class renames; verify by rendering each route |
| Removing the light canvas could reintroduce the historical white-on-light bug | The root cause is the specificity bug, fixed with `:not(.admin-root)`; render every route in both themes |
| `test-admin-foundation` asserts exact shell strings (`w-[64px]`, `lg:w-[248px]`, `hidden lg:inline`, drawer id, focus-ring count ≥5) | Keep those literals verbatim; run the suite after every shell edit |
| `test-admin-users-workspaces` / `pr3` / `pr6` assert table semantics, labels, states | Preserve `caption/scope/aria-sort/sr-only status` and the state components; run after each edit |
| Hand-rolled activity/audit tables carry different column sets | Migrate to the shared primitives without changing columns or hrefs |
| Volt Lime contrast on `#0f0f0f` | Keep it for text/icon/marker only; verify ≥3:1 for UI marks (it is ~13:1 on black) |
| Product light theme | Admin-only changes; the product rules stay byte-identical (`--color-bg-base`, `--color-accent`) |

## O. Implementation phases

1. **Foundations** — admin ramp re-point, hairline/radius/type tokens available, light-canvas removal, modal
   overlay recipe. *(Phase 4 of the brief)*
2. **Shell + navigation** — canonical nav rows, groups, separators, drawer overlay, focus recipe. *(Phase 3)*
3. **Primitives** — panel, table, status, kpi, list-controls, states, detail, command menu. *(Phase 5)*
4. **Overview** — title ladder, KPI strip, section hierarchy, needs-attention tone discipline. *(Phase 6)*
5. **Tables and filters** — directory lists + audit/activity migration + new log pattern. *(Phases 7, 11)*
6. **Detail views** — both inspectors on the canonical structure. *(Phase 8–9)*
7. **Subscriptions + intelligence + security** — same primitives; lavender only where intelligence is the
   subject. *(Phases 10–12)*
8. **Settings/auth** — login/forgot/reset on the overlay recipe. *(Phase 13)*
9. **Responsive, motion, accessibility passes.** *(Phases 14–16)*
10. **Verification** — type-check, lint, build, all suites, rendered CSS/HTML audit. *(Phase 17)*

## P. Verification checklist

- [ ] `npx tsc --noEmit` clean · `npm run lint` 0 errors · `npm run build` succeeds
- [ ] `test-admin-foundation`, `test-admin-pr3`, `test-admin-pr6`, `test-admin-users-workspaces`,
      `preview-admin` all green
- [ ] `test-mobile-ux`, `test-typography`, `test-icons`, `test-landing-design`, `product-background` unchanged
- [ ] No `bg-[#…]` in admin; no gradient; no blur except overlay scrims; shadows only from `--shadow-*`
- [ ] Radius values: only 4/8/12/16/pill in admin source
- [ ] Page titles all `text-h1`; section titles `text-h2`; no `text-[30px]`
- [ ] Control heights only 32/40 (+44 touch, 48 auth)
- [ ] Tables: one implementation; caption + `aria-sort` + sr-only status present on all four lists
- [ ] Focus visible on every control (grep count ≥ previous)
- [ ] Both themes render correctly; admin identical in light and dark themes
- [ ] Rendered HTML/CSS audit: no legacy admin surfaces (`#171719`, `#1f1f22`, `#28282c`), no light canvas

---

## Deliverable

Written to `docs/NEXUS-ADMIN-DESIGN-EVOLUTION-PLAN.md` before implementation, per the brief. Implementation
proceeds in the phase order above; the final report is `docs/ADMIN-DESIGN-EVOLUTION-REPORT.md`.
