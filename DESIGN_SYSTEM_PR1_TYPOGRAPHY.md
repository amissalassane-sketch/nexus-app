# DESIGN SYSTEM — PR1: TYPOGRAPHY FOUNDATION

## Scope

Instrument Sans as the single UI voice, Geist Mono confirmed for technical
data, one documented type scale. No visual redesign, no icon changes.

## Phase 0 audit (summary)

- UI font was **Inter Variable**, self-hosted via `next/font/local`
  (`src/fonts/Inter-Variable.woff2` → `--font-inter` → `--font-sans`).
- **Geist Mono Variable** already in place for `--font-mono` — kept as-is.
- Tailwind **v4** (`@theme` in `globals.css`); `tailwind.config.js` is only
  an external-primitive mirror, never used by the app build.
- A semantic scale already existed (display/h1–h4/xl/lead/body/small/
  caption/button/mono/eyebrow) but its hierarchy was undocumented.
- Deviation from the target system: **labels/eyebrows used mono**
  (`@utility eyebrow`, `.nexus-eyebrow*`, ~59 files).
- Icons (for PR2–PR4): Lucide in 80 files / 87 icons, already converging
  on `strokeWidth={1.75}`; `@tabler/icons-react` installed and already
  used by `src/components/admin/admin-icons.tsx` (the pattern to
  generalize); `simple-icons` for brand glyphs only (kept); no local SVG
  library, no Font Awesome/Heroicons.

## Changes

1. `src/fonts/InstrumentSans-Variable.woff2` — single latin upright
   variable file (30 KB, wght 400–700; no italics used in the codebase),
   vendored from the official Fontsource release tarball. No new
   dependency, no CDN at build or runtime. `Inter-Variable.woff2` removed.
2. `src/app/layout.tsx` — `next/font/local` now serves Instrument Sans
   (`--font-instrument`, `display: swap`, system fallbacks).
3. `src/app/globals.css`
   - `--font-sans` → Instrument Sans stack; `--font-mono` untouched.
   - Documented hierarchy: each scale step now has one stated function
     (token names unchanged — zero churn in consuming files).
   - `eyebrow`, `.nexus-eyebrow`, `.nexus-eyebrow-pill` → Instrument Sans
     semibold (labels are ordinary text, never mono).
   - `.nexus-meta*` (counts, dates) intentionally left in mono: technical
     data, consistent with the admin `font-mono` test.
4. `tailwind.config.js` — mirror `fontFamily.sans` updated to prevent
   drift with the app tokens.
5. Stale "Inter" comments updated (`nexus-logo.tsx`, editorial accent
   note). The serif editorial accent (system stack, marketing-only) is
   untouched, per the brief.
6. `scripts/test-typography.mjs` (`npm run test:type`, in the `test`
   chain) — 19 assertions locking the foundation.

## Known deviation (deferred to the PR4 consistency pass)

~46 files use raw `font-mono … uppercase` label patterns. Each call site
needs human judgment (technical data vs. label), so no blind codemod was
applied. The centralized utilities (59 files) are fixed; the remainder is
inventoried for PR4.

## Validation

- `next build` succeeds; output emits `InstrumentSans_Variable-*.woff2`,
  zero Inter artifacts.
- `tsc --noEmit` clean, `eslint` clean.
- `test:type` 19/19, `test:unit` 0 failures, `test:mobile` 67/67,
  `test:creation` 12/12, `test:guide` 12/12.
