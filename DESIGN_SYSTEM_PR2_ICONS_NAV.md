# DESIGN SYSTEM — PR2: ICON FOUNDATION + NAVIGATION

## Scope

Tabler as the icon foundation (`NexusIcon` wrapper) and migration of the
global navigation zone. No other product surface touched; Lucide remains
elsewhere until PR3–PR4 (dependency kept).

## Foundation

- `src/components/nexus-icon.tsx` — `NexusIcon` wrapper generalized from
  the proven admin pattern: 24×24 grid, outline, stroke **1.75**,
  `currentColor`, size scale **nav 18 / toolbar 18 / action 16 /
  state 24 / stateLg 32**, decorative (`aria-hidden`) by default,
  `role="img"` + label when named. Call sites import glyphs directly
  from `@tabler/icons-react` (tree-shakable); dynamic selection uses
  explicit component maps, never string resolution or namespace imports.
- `@tabler/icons-react` was already installed (3.46.0) — no install
  needed. Three brief-named glyphs do not exist in 3.46.0 and were
  replaced by better-sense equivalents (brief allows this):
  `FolderKanban` → `IconLayoutKanban`, `Boxes` → `IconBox`,
  `Info` → `IconInfoCircle`. `ChevronsUpDown` → `IconSelector`
  (Tabler's ⇅), `CheckSquare` → `IconChecklist`, `KeyRound` → `IconKey`,
  `Settings2` → `IconSettings`, `LifeBuoy` → `IconLifebuoy`,
  `CheckCircle2` → `IconCircleCheck`.

## Navigation zone migrated (Lucide-free)

- `layout/nav-config.ts` — model now holds `TablerIcon` references.
- `layout/workspace-sidebar.tsx` — brand menus, search, Create menu,
  both nav renders (`size="nav"`).
- `layout/topbar.tsx` — breadcrumb, search field, help, account menu.
- `layout/app-shell.tsx` — mobile header, tab bar, nav drawer; the one
  hand-rolled inline SVG (search) is replaced by the system glyph.
- `notification-preview.tsx` — topbar bell, empty state (`size="state"`),
  per-type explicit map (also fixes stray default 2.0 strokes).
- `command-menu.tsx` — page-entry render line only, so the shared model
  change type-checks; the palette's own icons stay Lucide until PR3.

## Size decisions (brief scale, verified against containers)

- Nav items 15/17 → **18**: rows are h-10 / lg:h-34, tab bar 56px — fit.
- Toolbar buttons (h-8/h-10) → **18**; dropdown/row/tile glyphs → **16**
  (tiles are 24–28px — fit).
- One documented `px` escape: breadcrumb separator at **14px**, optically
  matched to 13px inline text (the scale's 16px would overpower the row).
- Dropped two one-off stroke exceptions (2.0 on Create Plus and the
  drawer avatar) back to the 1.75 standard.

## Tests

- `scripts/test-icons.mjs` (`npm run test:icon`, in the `test` chain) —
  16 assertions: wrapper defaults, no namespace/string icon resolution
  anywhere in `src`, nav-zone Lucide-free, all four model render sites
  through `NexusIcon`.

## Validation

- `next build` succeeds; `tsc --noEmit` clean; `eslint` clean.
- `test:icon` 16/16, `test:unit` 0 failures, `test:mobile` 67/67,
  `test:creation` 12/12, `test:guide` 12/12, `test:type` 19/19,
  `test:freemium` 134/134.
- Visual QA by construction: every migrated call site keeps its exact
  layout classes; only glyph source/size/stroke changed, each checked
  against its container.

## Next (PR3)

Dashboard / product surfaces / intelligence (incl. the rest of
command-menu, kpi-grid, managers, empty states, signal icons).
