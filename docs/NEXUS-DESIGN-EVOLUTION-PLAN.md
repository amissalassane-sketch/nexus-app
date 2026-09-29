# NEXUS — DESIGN EVOLUTION PLAN

**Scope:** elevate the whole NEXUS product design by applying *principles* from Linear and Vercel to the
existing NEXUS architecture, tokens, and identity. Not a redesign. Not a clone.
**Status:** plan authored **before** implementation. Implementation log at the end (§10).
**Authority order used:** existing NEXUS architecture/functionality → existing NEXUS tokens & identity →
existing showcase audit → Linear principles → Vercel principles.

---

## 0. Source situation (read this first)

The two reference files named in the brief (`Linear DESIGN.md`, `Vercel DESIGN.md`) are **not present in this
repository**. The workspace contains one analysis-format `DESIGN.md` (a Notion analysis) plus a curated
in-repo reference layer that was written from the same material:

- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/linear.md`
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/vercel-geist.md`
- `NEXUS-DESIGN-KNOWLEDGE/02-DESIGN-SYSTEMS/design-tokens-methodology.md`, `.../motion-language.md`
- `NEXUS-DESIGN-KNOWLEDGE/06-NEXUS-CONTEXT/*` (brand, rules, tokens, components, decisions)

The plan below therefore applies: (a) the Linear/Vercel principles **enumerated in the brief** — which are the
distilled content of those two files — (b) the retained principles already recorded in the in-repo reference
docs, and (c) the observable, well-documented behaviour of the real Linear and Vercel/Geist systems. Where the
brief and the in-repo docs disagreed with a literal copy of Linear/Vercel, **NEXUS identity won** (§2.3).

If you paste the two `DESIGN.md` files, §4 rows can be re-graded against their exact values; the architecture
of the plan does not change.

---

## 1. What was inspected

| Layer | Files | Findings that matter |
|---|---|---|
| Token source of truth | `src/app/globals.css` (4 361 lines), `tailwind.config.js` | Two conflicting ramps exist: the documented "Pill Atelier Noir" pure-black ladder (`#000000 / #080808 / #0f0f0f / #151515 / #1c1c1c`, white-alpha hairlines 6–22 %) and the *shipping* warm-grey ladder (`#111110 / #171716 / #1c1c1a / #20201e`, solid hex borders `#2a2a27`). The showcase hardcodes `#000000`, so **three surface languages coexist**. |
| Type | `@theme` typography block, `@utility eyebrow/numeric`, tests | Excellent ladder (display-xl 58 → eyebrow 10.5) but tracking is uneven, the metric step (26px mono) is inline in a component, and a "technical metadata" layer is hand-rolled in ~40 places (`font-mono text-[10.5px]`). |
| Radii | `--radius-*` (11 named stops) | Named by usage (good, documented rule) but 14 px `panel` sits between 12 and 16 with no rule; `rounded-[5px]/[6px]/[7px]/[9px]` one-offs in components. |
| Shell | `layout/app-shell.tsx`, `layout/topbar.tsx`, `layout/workspace-sidebar.tsx`, `showcase/showcase-shell.tsx` | 248 px sidebar / 56 px topbar geometry is correct and must be preserved. Sidebar nav item is 34 px on desktop / 40 px on touch; topbar omnibar 32 px. Hardcoded `bg-[#000000]` in 9 places in `app-shell` + 6 in `showcase-shell`. |
| Primitives | `src/components/ui/*` (24 files) | `Button` (5 variants, 4 sizes, glow shadow on primary hover), `Card/Panel/SectionHeader`, `Badge/CountBadge/StatusDot`, `Input/Textarea/Select/Field/Checkbox`, `PillTabs`, `Modal`, `Dropdown`, `Toast`, `Feedback`, `PageHeader`, `PageSkeleton`. Each is individually good; the *recipes* differ (border strength, radius, height, hover treatment, mount animation). |
| Showcase | `src/app/showcase/**` (6 routes), `src/components/showcase/**`, `src/lib/showcase/mock-data.ts` | Deterministic mock data, real product components, discrete motion layers. Known audit issues confirmed by reading: intelligence hero gradient + 48 px lavender glow blob + hardcoded `#171719/#141416/#101012`; command center double blur (scrim `backdrop-blur-sm` + sticky group header `backdrop-blur-sm`) + hardcoded `#171717/#1C1C1C/#111111`; capture panel hardcoded `#141416/#1A1A1D`; tasks board mixes `bg-bg-surface` cards on `bg-bg-subtle/50` columns with a `shadow-xs` that is not defined in the token set. |
| Guardrail tests | `scripts/test-typography.mjs`, `test-mobile-ux.mjs`, `test-icons.mjs`, `test-landing-design.mjs`, `supabase/tests/product-background.test.mjs`, `scripts/test-admin-foundation.mjs` | Typography, mono discipline, safe areas, touch targets, 44 px targets, AA contrast on the four documented dark surfaces, pure-black base and white accent, admin ramp isolation are all **asserted in CI**. Any evolution must keep them green — these are treated as non-negotiable contracts. |

---

## 2. Design position

### 2.1 What NEXUS keeps (identity, not negotiable)
Pure-black matte canvas · monochrome chrome (white accent reserved) · **one** intelligence colour (lavender,
`#e9e4ff`, signal-only) · 248 px sidebar · 56 px topbar · Instrument Sans + Geist Mono split (sans = everything
a person reads, mono = technical data) · dense, calm, technical character · minimal atmosphere (one dot grid,
nothing else) · motion that names a state, never decorates · mobile as a first-class citizen.

### 2.2 What Linear and Vercel each contribute (principles only)
- **Linear → refinement of surfaces and components:** a *surface ladder* where elevation is expressed as
  surface step + 1 px hairline (not shadow); radius discipline in the 8–16 px band; compact control geometry;
  negative tracking that increases with size; dense product-first layout; decoration reduced to nothing.
- **Vercel → system precision:** 4 px spacing foundation with few, deliberate stops; a strict numbered type
  hierarchy; monospace as a *legitimate layer* (IDs, timestamps, status, commands, data labels) rather than a
  costume; strict breakpoint behaviour with explicit collapses; one canonical implementation per primitive.

### 2.3 What is explicitly rejected
Linear's palette/radius/tracking values as *values* · Linear's issue-tracking vocabulary (Cycles, Triage) ·
Vercel's light canvas and its brand colours · Vercel's shadow-as-border trick (it is designed for light
surfaces; NEXUS's white-alpha hairline solves the same problem on near-black) · gradients, glow blobs,
glassmorphism, decorative lavender, elastic bounce, parallax · shadcn/Tailwind-default recipes that would
flatten the NEXUS character (e.g. 6 px "sm" radii everywhere, 700 weights, 4 px card radius miniapp look).

---

## 3. The six system decisions (what "elevate" actually means here)

| # | Decision | From |
|---|---|---|
| D1 | **One canonical dark surface ladder**: L0 canvas `#000000`, L1 chrome `#080808`, L2 surface `#0f0f0f`, L3 raised `#151515`, L4 overlay `#1c1c1c`. Elevation = surface step + 1 px hairline. Shadows only for true overlays. | Linear surface hierarchy + the ramp already documented in `NEXUS-TOKENS.md`, `tailwind.config.js` and three CI tests |
| D2 | **Hairline border system on dark**: white-alpha 6 % / 8 % / 14 % / 22 % for subtle / default / strong / focus. Solid greys stay only in the light theme. | Linear hairline system + in-repo brand rule ("bordures découvertes, pas annoncées") |
| D3 | **Tracking ladder that relaxes as size drops**: −0.045 em (58) → −0.032 em (34) → −0.028 em (22) → −0.018 em (16) → −0.012 em (14) → −0.008 em (13) → −0.005 em (13.5 body) → 0 (12.5/11.5) → +0.1 em (eyebrow). Never tightened small text. | Vercel compression-as-identity + the rule already recorded in `vercel-geist.md` |
| D4 | **A real technical monospace layer**: `.mono-meta` (11 px, tertiary), `.mono-token` (10.5 px uppercase code), `.metric` (24 px tabular). Used for IDs, timestamps, counts, status, commands, data labels — never for prose, never for eyebrows. | Vercel mono layer + existing NEXUS mono rule |
| D5 | **4 px spacing foundation, few stops**: 0/2/4/8/12/16/20/24/32/40/48/64 + named layout tokens (`--sidebar-w`, `--topbar-h`, `--row-h*`, `--control-h*`). Half-stops (10/14/18) removed from every file touched. | Vercel spacing foundation |
| D6 | **Radius band 4/8/12/16/pill** with the legacy usage names aliased to those values. Panel 14 → 12. | Linear compact geometry + the existing "named by usage" rule |

**NEXUS-specific layer (the reason this is not a Linear or Vercel clone):** the *intelligence* surfaces get
their own canonical components — `intelligence` button variant, `.signal` recipe, evidence/grounding row,
mission step — all built from the same ladder as the rest of the OS, so the AI reads as **an organ of the
operating system**, not a chat panel bolted onto a dashboard.

---

## 4. Evolution plan — audited area by area

Priority: **P0** = foundation (everything depends on it) · **P1** = product-critical · **P2** = polish.
Risk: **L** low (visual only, no behaviour) · **M** medium (multiple call sites) · **H** high (shell/layout or
shared primitive used product-wide).

### 4.1 Foundations

| Area | Current NEXUS | Linear principle | Vercel principle | Proposed evolution | Reason | Affected | Risk | P |
|---|---|---|---|---|---|---|---|---|
| **1. Colour tokens** | Dark ramp is warm grey (`#111110/#171716/#1c1c1a/#20201e`); showcase hardcodes `#000000`; landing tests assert a *different* set | Desaturated neutrals, colour only for state | Strict token layers, no decorative accent | Ship one dark ramp (D1) in `html.dark`; keep light theme as is; lavender (`#e9e4ff`) unchanged and still signal-only; semantic colours unchanged; add `--lavender-strong: #b9aeff` used **only** as a filled intelligence accent | Removes the three-surface-language ambiguity; restores documented identity; all CI contrast contracts already target this ramp | `globals.css`, every `bg-bg-*` consumer | M | P0 |
| **2. Surface hierarchy** | 5 named levels, but components mix `bg-bg-subtle` for "card" and `bg-bg-surface` for "row"; 4 different elevation recipes | Surface step + hairline instead of shadow | Component primitives with one recipe each | Level roles fixed: canvas = page, chrome = sidebar/topbar, panel = cards, raise = rows/inputs/hover, overlay = modal/dropdown/toast. Add `.surface-raise`, `.surface-overlay` utilities that encode the recipe | "Do not solve the same UI problem differently on different pages" | `ui/card.tsx`, `ui/modal.tsx`, `ui/dropdown.tsx`, all panels | M | P0 |
| **3. Border hierarchy** | Dark uses solid hex greys; alpha hairlines only in the mirror config | 1 px hairline, low contrast, never heavy | Consistent borders, no double signal (border + ring) | D2. Also: focus = ring only, never border + ring | Crisper on pure black; matches brand rule; removes "double border" reads | `globals.css`, all borders | M | P0 |
| **4. Typography** | Strong ladder, uneven tracking, no metric step, no mono layer utilities | Negative tracking on display, tight headings | Numbered hierarchy, mono layer | D3 + D4; add `--text-metric` (24 px) replacing the inline 26 px KPI value; body tracking −0.005 em; small/caption 0 | Sets the product's voice: confident at the top, calm in the middle, precise in data | `globals.css`, `kpi-grid`, all headings | L | P0 |
| **5. Font sizing** | 13.5 px base, 10.5–58 px ladder | Compact product sizing | Numbered steps | Keep sizes (identity + tests), remove inline `text-[10px]/[11px]/[13px]/[14.5px]/[17px]/[26px]/[28px]` one-offs in every file touched | One scale, no orphan sizes | showcase, dashboard components | L | P1 |
| **6. Letter spacing** | Mixed inline `tracking-[-0.02em]` etc. | As above | As above | D3, exposed only as tokens; no inline tracking except in marketing display blocks | Consistency | as above | L | P0 |
| **7. Line height** | Paired to each step; some `leading-relaxed` inline | Body 1.55 | Body 1.5, headings tight | Keep token pairs; replace `leading-relaxed` in dense product panels with the `text-body/text-small` pairs | Dense product reading stays predictable | panels, lists | L | P1 |
| **8. Spacing scale** | Tailwind defaults + half-stops (`gap-2.5`, `py-3.5`, `p-5`, `mt-0.5`) | Compact 4/6/8/12 rhythm | 4 px foundation, deliberate jumps | D5 + named layout tokens (`--sidebar-w: 248px`, `--topbar-h: 56px`, `--control-h*: 28/32/40`, `--row-h*: 32/40/44`, `--panel-pad: 16`) | Geometry becomes a system value, not a repeated literal | `globals.css`, all touched files | L | P0 |
| **9. Radius scale** | 11 stops incl. one-off 14 px and inline 5/6/7/9 px | 8–16 px band | Consistent primitives | D6 (+ aliases so existing classes keep working) | Fewer shapes = more maturity | `globals.css`, badges, inputs | L | P0 |

### 4.2 Components

| Area | Current NEXUS | Linear principle | Vercel principle | Proposed evolution | Reason | Affected | Risk | P |
|---|---|---|---|---|---|---|---|---|
| **10. Buttons** | 5 variants, 4 sizes, white glow shadow on primary hover, `active:scale` micro-bounce | Compact geometry, no glow | One primitive, strict states | Height ladder 28/32/36/40 (36/40 on touch), radius 8, hover = surface/alpha step only, **no glow**, press = 1 px translate (no scale bounce). Add `intelligence` variant (lavender hairline + lavender label) as the single canonical AI action | The AI layer needs a button that belongs to the OS; glows cheapen the product | `ui/button.tsx`, `ui/create-button.tsx`, all call sites | M | P0 |
| **11. Inputs** | Two recipes (default field, pill field) + ad-hoc search fields in tasks/showcase | 1 px border, calm focus | Consistent primitive + states | One field recipe (h-8/h-10/h-11), radius 8, `hairline → strong on hover`, focus ring token only, error via `aria-invalid`. Add canonical `SearchField` so filters stop being re-invented | Same control, one look, everywhere | `ui/input.tsx`, tasks, showcase, filters | M | P0 |
| **12. Cards** | `Card` (bg-subtle + mount animation + hover lift/shadow), `Panel` (bg-subtle/70 + 46 px header + mount animation) | Surface + hairline, no lift | Primitive with fixed geometry | `Panel` = L2 surface, 44 px header, 16/20 px padding, hairline sections, **no mount animation by default** (opt-in `reveal`); `Card` = same surface language for chrome-less content; hover = border + surface step, no shadow | Mount animation on 61 components is decoration, not feedback; hover-lift is a mobile-cramping pattern | `ui/card.tsx` + all panels | M | P0 |
| **13. Tables / dense rows** | Rows rebuilt per feature (priority queue, projects, activity, plan table) | Dense product rows, hairline separators | Consistent row primitive | New `Row` + `DataList` primitives: 40 px row (44 touch), hairline `border-b` last:0, hover `surface-raise`, leading icon slot, mono trailing slot | This is the single biggest "one product" win: lists will finally match | new `ui/row.tsx`, dashboard panels, activity | M | P1 |
| **14. Badges** | 8 tones, all mono uppercase 20 px, radius 5, plus inline chips | Small chips, restrained | Mono only for technical tokens | `Badge` = sans, 11 px, medium, no uppercase, height 20, radius 4, hairline+bg tone (states). `Tag` (new) = mono 10.5 px uppercase tracking .06em for IDs/codes/counts. `StatusDot` unchanged | States are prose-ish (Blocked, Running); IDs are tokens. Stops the mono overload | `ui/badge.tsx`, 58 call sites | M | P1 |
| **15. Navigation** | Sidebar 248 px (keep), nav item 40/34 px, active = inset ring + alpha bg + lavender rail | Compact nav, quiet active state | Strict primitives | Nav item 40 px touch / 32 px desktop, radius 8, active = `surface-raise` + lavender rail (identity kept), hover = `accent-ghost`, mono counts; section labels keep the eyebrow spacing scale | Preserves geometry, removes the "double ring" active style | `ui/navigation.tsx`, `workspace-sidebar.tsx` | M | P1 |

### 4.3 Surfaces of the operating system

| Area | Current NEXUS | Linear principle | Vercel principle | Proposed evolution | Reason | Affected | Risk | P |
|---|---|---|---|---|---|---|---|---|
| **16. Command Center** | Real palette (`command-menu.tsx`) + showcase copy; sticky group header `bg-bg-surface-3/95 + backdrop-blur`; scrim blur | Overlay surface + hairline, no glass | Precise primitives, no effects | Overlay = L4 `#1c1c1c` + hairline default + `--shadow-overlay`; **scrim = flat dim, no blur**; sticky group header = solid L3 + bottom hairline (no blur); rows 36 px, active = surface raise + left rail; footer status bar in mono; ⌘K everywhere | Fixes the audit's double blur; keeps the "over a live workspace" layer separation | `showcase/command-showcase-view.tsx`, `command-menu.tsx` | M | P0 |
| **17. Intelligence surfaces** | Hero card with gradient + glow blob + `#171719` hardcodes; signals with inline tints; mission steps custom | No decoration, structure carries meaning | Strict primitives | Hero = L2 surface + lavender **hairline** + lavender eyebrow chip only (no gradient, no blob, no coloured shadow); signals = one `.signal` recipe (hairline, severity rail, spelled-out severity); evidence = `.mono-token` chips; mission = canonical step list with lavender current marker | The audit's #1 issue. Intelligence must look reasoned, not marketed | `showcase/intelligence-showcase-view.tsx`, `intelligence/*` | M | P0 |
| **18. Capture / omnibar** | Capture bar (real) + showcase capture flow with hardcoded `#141416/#1A1A1D` | Quiet input, no chrome inflation | One control primitive | Omnibar = `surface-raise` + hairline strong, 44 px, hairline focus; stage chips = segmented control (canonical tabs); extraction cards = `Panel`-lite with mono labels; confirmed banner = success semantic only | One input language across capture, search, ask | `capture/*`, `showcase/capture-showcase-view.tsx` | L | P1 |
| **19. Tasks / Kanban** | 4 columns, custom card recipe, `shadow-xs` (undefined), blocked callout in danger tint | Dense board, hairline columns | Depth rules | Column = L1 chrome surface + hairline; card = L2 surface + hairline default, hover hairline strong; meta row = `Tag` + mono date; blocked = danger hairline + danger label (no tinted shadow) | Board becomes the canonical dense-surface example | `showcase/tasks-showcase-view.tsx`, `task-manager.tsx` | L | P1 |
| **20. Projects** | `ActiveProjectsPanel` table-ish rows | Dense rows | Row primitive | Move to `DataList`: project / owner / health (dot + word) / progress (bar) / mono due date | Consistency with priority queue + activity | `dashboard/active-projects.tsx` | L | P2 |
| **21. Goals** | Progress bars + meta | Restrained state colour | Numbered hierarchy | Progress = 4 px track, 2 px radius, semantic fill only; labels h4 + mono value | Same bar everywhere | `goal-manager.tsx`, panels | L | P2 |
| **22. Calendar / upcoming** | Upcoming list with mono dates | Dense, quiet | Mono timestamps | `mono-meta` timestamps, hairline rows, "today" marker in lavender only once | Timestamps are the mono layer's home | `dashboard/upcoming-panel.tsx` | L | P2 |
| **23. Notes** | Feature panels | — | — | Apply primitives only (rows, panels, mono metadata); no layout change | Do not re-architect features that already work | `notes/*` | L | P2 |
| **24. Activity** | Icon + actor + target + relative time | Dense ledger | Mono metadata | `DataList` rows, mono time, hairline separators, first-row emphasis removed | Ledger reads as system truth | `activity-list.tsx` | L | P1 |
| **25. Settings** | Form panels, pill auth fields | Grouped panels | One control | Grouped `Panel` sections with hairline rows, canonical fields | Settings is where inconsistency is most visible | `settings/*`, `user-settings-panel.tsx` | M | P2 |
| **26. Empty states** | `EmptyState` primitive | Quiet, one action | Primitive | Hairline frame, icon rail, one primary + optional secondary; **mono context line** (e.g. `0 items · filter: blocked`) | Explains "why empty" like a system, not like a marketing page | `ui/feedback.tsx` + callers | L | P1 |
| **27. Loading states** | `PageSkeleton` with 8 staggered mount animations | Fast perceived speed, low noise | Skeleton = real layout | Skeleton mirrors the real grid, `.skeleton` breath only, **no per-block entrance animations**, `aria-busy` kept | Motion budget belongs to real data arriving | `ui/page-skeleton.tsx` | L | P1 |
| **28. Error states** | `Alert` + inline `auth-error` | Inline, factual | Semantic only | One error recipe: danger hairline, danger label, mono reference id slot, retry as secondary button | Errors are system states, not alarms | `ui/feedback.tsx` | L | P1 |
| **29. Success states** | Toast + `success` badge + green banners | Quiet confirmation | Semantic only | Success = success hairline + check + short mono confirmation of *what changed*; no green fill blocks | Green fill is the most common AI-SaaS tell | `ui/toast.tsx`, capture confirm | L | P1 |
| **30. Responsive** | Breakpoints declared (480/640/768/834/1024/1280/1440/1536), shells adapt, showcase grids collapse | (Linear is desktop-first — explicitly *not* copied) | Strict collapse rules | Explicit contract per component (§6): 1440 / 1280 / 1024 / 768 / 480. No component may merely shrink: boards scroll horizontally below 768 with snap, KPI grid 6→3→2, panels stack, topbar collapses to icon rows, sidebar 248 → drawer 288, command palette → full-width sheet below 640 | Mobile is a NEXUS strength; the evolution must not trade it away | all showcase + shell | M | P1 |
| **31. Motion** | Rich, named, well-gated; but mount animations on 61 components | Restrained, purposeful | State transitions only | Keep every named animation and the discrete-layer structure. New budget: **entrance** only at page/board level (stagger ≤ 6 items, 40 ms), **state** transitions on hover/active/focus, **continuity** on overlays. Card/Panel mount animations become opt-in `reveal`. All durations from `--duration-*` | Preserves motion-readiness for Figma/Butter while removing ambient noise | `globals.css`, all components | M | P0 |

---

## 5. Adopt / Keep / Reject summary

**Adopt** — surface ladder with hairline elevation · alpha hairlines on dark · tracking ladder by size · mono
as a technical layer · 4 px spacing with named layout tokens · radius band 4/8/12/16/pill · compact control
geometry · one canonical recipe per primitive · dense row/data-list primitive · strict responsive contract ·
restrained motion budget · numbered hierarchy (one h1 per screen, panels h2, rows h3/body, metadata mono).

**Keep** — pure-black matte canvas · monochrome chrome · white primary accent · lavender as the single
intelligence signal · 248/56 geometry · Instrument Sans + Geist Mono · dot-grid substrate (product shell only)
· all named NEXUS motion tokens · the deterministic showcase mock-data architecture · safe-area and 44 px
touch rules · admin's isolated ramp.

**Reject** — Linear palette/radii/tracking values · Linear's issue-tracking vocabulary · Vercel light canvas,
brand colours and shadow-as-border · shadcn defaults (6 px radii, 700 weights) · gradients, glow blobs,
glassmorphism, neon · decorative lavender · bounce/elastic/parallax · dark-pattern "AI shimmer".

---

## 6. Responsive contract (explicit, per major component)

| Component | 1440 | 1280 | 1024 | 768 | 480 |
|---|---|---|---|---|---|
| Sidebar | 248 fixed | 248 fixed | 248 fixed | drawer 288 (overlay) | drawer 288 (full-height sheet) |
| Topbar | 56, breadcrumb + 320 omnibar + status | 56, breadcrumb + 280 omnibar | 56, breadcrumb + icon search | 56, title + search + bell | 56, title + search icon + bell |
| Page padding | 32 | 32 | 24 | 24 | 16 |
| KPI grid | 6 cols | 4 cols | 3 cols | 2 cols | 2 cols (value 20 px) |
| Dashboard split | 7/5 cols | 7/5 | 7/5 | stacked | stacked |
| Kanban | 4 cols | 4 cols | 4 cols | 2 × 2 grid | horizontal scroll-snap, 280 px columns |
| Panels | keep padding 16/20 | same | padding 16 | padding 16 | padding 16, header wraps to 2 lines |
| Command palette | 680 centred, 14 vh top | 640 | 600 | 90 vw | full-width sheet, 100 % width, sticky footer |
| Tables / data lists | full row | full row | hide tertiary column | hide mono column, keep title + state | title + state stacked |
| Intelligence hero | 2-up (copy + CTA) | 2-up | 2-up | stacked CTA | stacked, CTA full-width |
| Errors / empty | inline in panel | same | same | same | full-width, action buttons 44 px |
| Motion | full | full | full | reduced stagger | entrance only (no hover-dependent feedback) |

---

## 7. Implementation phasing

| Phase | Content | Priority | Risk | Files |
|---|---|---|---|---|
| **1** | Foundations: dark ladder, hairlines, radii, tracking, layout tokens, mono utilities, motion budget, `.surface-*`/`.reveal` | P0 | M | `globals.css`, `tailwind.config.js` |
| **2** | Primitives: button, input (+`SearchField`), card/panel, badge (+`Tag`), row/data-list, tabs, modal/dropdown/toast elevation, feedback (empty/error/success), page-header, page-skeleton | P0 | M | `src/components/ui/*` |
| **3** | Shell: nav item geometry, sidebar tokens, topbar omnibar, breadcrumb/mono counts (geometry preserved) | P1 | M | `layout/*`, `ui/navigation.tsx` |
| **4** | Showcase elevation + audit fixes (gradient/glow, hardcoded surfaces, double blur, layer separation, geometry preserved, mock data untouched) | P0 | M | `showcase/*`, `src/app/showcase/*` |
| **5** | Product propagation on the surfaces the showcase exercises: dashboard panels, capture bar, activity list, command menu | P1 | M | `dashboard/*`, `capture/*`, `activity-list.tsx`, `command-menu.tsx` |
| **6** | Verification: `tsc`, `eslint`, `next build`, all invariant test suites, responsive pass notes | P0 | L | — |

---

## 8. Guardrails (must stay green)

`npm run type-check` · `npm run lint` · `npm run build` · `test:type` · `test:icon` · `test:mobile` ·
`test:landing` · `test:admin` (admin ramp isolation + pure-black product ramp) · `product-background` ·
`test:global`. No new dependency. No change to mock-data determinism, route structure, or data fetching.

---

## 9. Definition of done

1. One surface language: page, chrome, panel, raise, overlay reachable through tokens only — no hardcoded
   surface hex in product or showcase code.
2. One primitive per problem; the showcase uses the same `Button`, `Panel`, `Row`, `Badge`, `Tag`, `Field`
   as the product.
3. Every audited issue fixed: intelligence hero gradient/glow removed, hardcoded surfaces normalised, command
   centre double blur removed, Figma/Butter layer separation preserved, sidebar/topbar geometry preserved,
   motion-ready discrete layers preserved.
4. Typography: display tracking ladder, mono layer used for technical data only, no orphan font sizes in
   touched files.
5. Responsive behaviour explicit at 1440/1280/1024/768/480 — no component that merely shrinks.
6. Motion restrained: entrance at page/board level, state transitions, overlay continuity — all gated by
   `prefers-reduced-motion`.
7. All guardrails green.
