# NEXUS — "New goal" modal: visual critique & targeted correction

Date: 2026-09-27 — scope: the New goal modal (`src/components/goal-manager.tsx` form + the
shared `Modal` primitive), its backdrop/overlay, and the two confirmed input-copy/treatment
issues. Nothing else was touched.

Evidence note: no screenshot file was attached to the session workspace. The visual findings
described in the review briefs were treated as the screenshot evidence and **every claim was
re-verified against source code and against real headless-Chromium renders** (Chromium 138 via
`@sparticuz/chromium` + `puppeteer-core`, driving the app against the repo's own Supabase stub,
signed in as the stub owner on `/goals`). Render evidence is in `docs/modal-review-2026-09-27/`
and the geometry figures below are measured DOM values from those sessions, before and after
the fix.

---

## 1. Root cause(s)

**Backdrop / detached modal / right-edge strip — one root cause with two reinforcing defects.**

The modal overlay is `position: fixed; inset: 0` and therefore assumed to cover the viewport.
It did not, because its DOM ancestors became **containing blocks for fixed-position descendants**:

1. `#nexus-main` and every page root (`div.page-enter`) run `animation: page-enter … both`.
   The keyframe's end state was `transform: translateY(0)`, and with `animation-fill-mode: both`
   Chrome keeps a computed transform matrix (`matrix(1,0,0,1,0,0)`) **forever** after the
   entrance finishes (verified empirically in-browser). Any non-`none` computed transform makes
   the element a containing block for `position: fixed` descendants.
2. `PageTransition` additionally carried `will-change-transform`, which creates the same
   containing block eagerly, for the whole page lifetime.

Consequence, measured at 1280×800 with the modal open (before):

- overlay box = `{x: 272, y: 88, w: 984, h: 347}` — the *content column*, not the viewport;
- the scrim therefore painted only a floating rectangle over the page content (the sidebar,
  topbar and the right gutter stayed at full brightness — measured `(17,17,16)` vs `(9,9,8)`
  inside the scrim);
- the scroll container of `<main>` occupies the right edge of the viewport, **outside** the
  scrim's x-range — this is the "suspicious vertical light/gray strip": the page's own
  scrollbar column left unscrimmed (a scrollbar "belonging to the wrong container", exactly one
  of the suspected mechanisms). It is not a width-change or a document-scrollbar problem:
  `document` never scrolls in the app shell (`h-dvh` + `main` is the scroll container), and
  opening the modal changes no document width;
- the panel is `max-h-[min(92dvh,800px)]` but was centered inside the short content box and
  got **clipped top and bottom** (panel taller than its containing block).

**Scrim treatment** — separate, confirmed defect: `bg-black/70 backdrop-blur-[3px]` over the
intentional near-black NEXUS shell crushed the interface behind the dialog into a void. The
command palette in `globals.css` documents itself as "a deeper backdrop than dialogs" at
`rgba(0,0,0,0.78)`, so dialogs were meant to be meaningfully lighter than 0.78 — 0.70 was not.

**Date copy** — confirmed contradiction: the field is a native `<input type="date">` (with
`lang="en-US"`), which displays locale-based segments (`mm/dd/yyyy` in the screenshot) while the
helper claimed `Format: YYYY-MM-DD`. The two describe different things (display vs data). The
submitted/stored value is always `YYYY-MM-DD` (HTML value semantics; `goals.target_date` is a
Postgres `date`, `supabase/migrations/001_nexus_core.sql:525`).

**Number input** — the browser's raw spinner buttons were the only un-curated native chrome left
in the form primitives (the Select chevron is custom SVG, the date indicator and range are
already normalized in the same `globals.css` "Native controls" section).

---

## 2. Confirmed visual issues

1. Scrim covered only the content column; panel clipped top/bottom; sidebar/topbar unscrimmed —
   the modal read as a floating rectangle, not a layer above the app. *(Confirmed: DOM geometry
   + pixels.)*
2. Unscrimmed scrollbar column at the right edge while the modal was open. *(Confirmed: the
   scrim's box ends at x=1256 while `main`'s scroll column runs to x=1280; before-fix pixels at
   the right edge are full-brightness.)*
3. `black/70` + blur over the near-black shell made the underlying NEXUS interface barely
   recognizable. *(Confirmed: pixels + the documented overlay ladder in `globals.css`.)*
4. `mm / dd / yyyy` display contradicted the `Format: YYYY-MM-DD` helper. *(Confirmed in
   source; visible in renders.)*
5. Raw browser number spinners visually conflict with the curated input treatment. *(Confirmed:
   the primitives curate every other native control; spinners were left raw.)*

## 3. Corrections implemented

1. **Overlay geometry (root cause)** — `Modal` now portals its overlay to `document.body`
   (`createPortal`, render-gated after mount so SSR/hydration stay consistent). The overlay is
   now independent of any transformed/`will-change` ancestor — measured `{x:0, y:0, w:1280,
   h:800}` at 1280×800 (full viewport, all sizes).
2. **Containing-block hygiene** — `page-enter` animations now use `animation-fill-mode:
   backwards` (never `both`) and end at `transform: none`; `will-change-transform` removed from
   `PageTransition`. Visually identical entrance; after it finishes there is no residual
   transform matrix anywhere in the page chain. (Verified in-browser: computed `transform`
   resolves to `none` instead of a matrix.)
3. **Restrained scrim** — `bg-black/70 backdrop-blur-[3px]` → `bg-black/50 backdrop-blur-[2px]`.
   This sits on the existing NEXUS overlay ladder (spotlight 40% < dialogs 50% < drawers 60% <
   command 78%) and keeps a light blur only — no glass, no gradients, no new colors.
4. **Date helper copy** — `hint="Format: YYYY-MM-DD"` → `hint="Saved as YYYY-MM-DD."` —
   truthful for every browser (it describes the accepted/canonical data format, which is
   unchanged), and it no longer contradicts the native control's locale display. No behavioral
   change: submission, validation, and DB format untouched.
5. **Number spinner chrome** — CSS-only normalization in the existing "Native controls" section
   of `globals.css`: `appearance: textfield` + hidden `::-webkit-*-spin-button`. Keyboard ↑/↓
   stepping and numeric semantics (`type`, `min`, `max`, value handling) are untouched.

## 4. Exact visual changes

- The scrim now dims the **entire** viewport uniformly in both themes; the sidebar, topbar,
  cards, and the scrollbar column remain visibly (dimmed) recognizable behind the dialog
  (before: content column scrimmed at `(9,9,8)`, chrome at full `(17,17,16)`; after: uniformly
  scrimmed to the viewport edge).
- The panel is centered in the viewport and fully visible (title, fields, and footer no longer
  clipped) at every tested size.
- Scrim opacity 70% → 50%, blur 3px → 2px.
- Target date helper reads "Saved as YYYY-MM-DD." under a native `mm/dd/yyyy` control.
- Progress (%) input no longer shows browser spinner buttons.
- Nothing else changed: title, description, field layout (Title → Status | Progress | Target
  date → Description), spacing, typography, button hierarchy (white `Add goal` primary per
  `button.tsx` "primary: white surface, black label — one per screen"; ghost `Cancel`; icon
  close), sheet-vs-dialog behavior, and animations are untouched.

Evidence: `docs/modal-review-2026-09-27/` (01/03 before, 02/04/05/06 after).

## 5. Issues intentionally left unchanged

- **Form hierarchy** (Title → 3-up attribute row → Description): semantically and visually
  coherent as-is; the existing structure supports no clearer grouping without adding complexity.
- **Status field**: it is a **native `<select>`** (shared `Select` primitive) with a custom
  chevron — interactive, recognizable affordance, correct behavior. Untouched.
- **Primary action color**: the strong white `Add goal` is the documented NEXUS primary
  treatment (dark theme `--accent: #ffffff` / `--accent-fg: #000000`; inverts in light theme).
  Hover, disabled (`bg-bg-surface-2`/`text-text-quaternary`), focus-visible (global ring) and
  keyboard activation all exist. `Cancel` (ghost, `text-text-secondary`) stays clearly secondary
  but visible. Untouched.
- **Modal proportions**: `sm:max-w-lg` (512px) is the shared default used by all seven `Modal`
  consumers; padding/field spacing follow the token scale. Shrinking it would be a global change
  with no evidence behind it. Untouched.
- **Placeholders** ("What do you want to achieve?", "Why does this goal matter?"): they are
  content guidance (the *what*/*why* of the field), not label restatements; labels are always
  visible via `Field` (the primitive's documented contract). Untouched.
- **Identical date hint in sibling managers**: `project-manager.tsx` and `task-manager.tsx` carry
  the same `Format: YYYY-MM-DD` contradiction on their due-date fields. Same fix applies there,
  but those components are outside this task's scope — left unchanged deliberately.
- **Onboarding `contextual-tip` overlap** (new finding, unrelated to the modal): at ≥1024px the
  first-visit tip (`contextual-tip.tsx`, `lg:right-6 lg:top-[72px]`, `pointer-events-auto`)
  fully overlaps the page's "New Goal" button and swallows mouse clicks until dismissed via
  "Got it" (keyboard access unaffected). Same bug family as `PROJECT_CREATION_FIX_REPORT.md`.
  Out of scope here — flagged for a separate fix.
- Unused `.modal-backdrop` / `.modal-panel` CSS block in `globals.css` (dead classes from an
  older implementation) — left in place; not part of this correction.
- Body scroll lock (`document.body.style.overflow = "hidden"`) is a no-op in the app shell
  (document never scrolls; `main` is the scroll container). Preserved as-is; the modal's
  `overscroll-contain` already stops wheel chaining through the overlay.

## 6. Accessibility verification

Verified in headless Chromium (real interaction):

- `role="dialog"`, `aria-modal="true"`, accessible name (`aria-label` = title), description via
  `aria-describedby` — all present and unchanged.
- Label/input associations (`Field` `htmlFor` ↔ control `id`) — unchanged and intact.
- Tab containment: focus cycles Title → Status → Progress → Target date (native date segments)
  → Description → footer/actions and stays inside the dialog (focus-trap logic untouched).
- Escape closes; body overflow restored; **focus restoration to the trigger** verified on the
  keyboard path (focus "New Goal" → Enter → type in fields → Escape) and the mouse path.
- Initial focus lands on the first control in the dialog (unchanged behavior).
- Focus-visible: global ring renders on the focused control (visible in the after-renders).
- Reduced motion: `prefers-reduced-motion: reduce` renders the modal open and visible
  (entrance animations are globally downgraded in `globals.css`).
- Deep link `?create=1` opens the dialog at full-viewport geometry (this was broken before the
  portal — measured `{272,88,984,798}` before, `{0,0,1280,800}` after).

**Not verified (no claim made):** formal WCAG 2.x AA audit (contrast math, SR walkthrough with
NVDA/VoiceOver), real iOS/Android on-screen keyboard behavior, Firefox and Safari rendering.
Token-level contrast for text/surfaces is asserted by the design system in `globals.css`; the
scrim change was checked by pixel sampling only.

## 7. Responsive verification

Headless Chromium at 375×812, 390×844, 414×896, 768×1024, 1024×768, 1280×800, 1440×900
(after-fix): overlay = full viewport at every size; panel fully inside the viewport (no
clipping); no document horizontal overflow. Below `sm` the modal is the existing bottom sheet
with single-column stacked fields; from `sm` up it is the centered dialog with the 3-up row
(768px: three 143px columns, date input `scrollWidth == clientWidth` → no internal clipping).
Footer buttons keep `flex-wrap` + ≥36px (44px on touch) targets. Internal scrolling
(`overflow-y-auto` + `overscroll-contain` + pinned footer) unchanged. *(All figures from
measured DOM in the browser sessions; not a device lab.)*

## 8. Tests

| Command | Result |
|---|---|
| `git diff --check` | ✅ clean |
| `npm run type-check` | ✅ clean |
| `npm run lint` | ✅ 0 errors, 11 warnings — identical to the pre-change baseline (all pre-existing) |
| `npm run build` | ✅ success |
| `npm run test:unit` | ✅ exit 0, all suites pass |
| `npm run test:creation` | ✅ 37 passed, 0 failed |
| `npm run test:guide` | ✅ 12 passed, 0 failed (incl. `goal-manager: ?create=1 opens the form`) |
| `npm run test:type` | ✅ 19 passed, 0 failed |
| `npm run test:mobile` | ⚠️ 65 passed, 2 failed — **identical to the pre-change baseline**; both failures pre-exist this work and are unrelated: `intelligence-ask: tool trace is a collapsible accordion`, and `modal: bottom sheet on phones` which asserts a literal `max-h-[92dvh]` substring that the code has spelled `sm:max-h-[min(92dvh,800px)]` since before this change |

Caveat: `test:unit`'s `session-proxy` suite binds `127.0.0.1:54321` — the green run above was
executed with that port free. If a local Supabase stub is running on 54321, that one suite will
fail with `EADDRINUSE` (environment collision, not a code failure).

## 9. Remaining risks / limitations

- Visual verification was done in headless Chromium 138 only (this sandbox cannot download
  Firefox/WebKit builds and has no device lab). Browser-specific quirks (e.g. Firefox's
  handling of `lang` on date inputs) are why the helper copy avoids claiming a display format.
- With the portal, the dialog mounts one commit after hydration (a client-only overlay — same
  class as the command palette and toasts). The `?create=1` deep link opens it immediately after
  mount; verified working.
- The modal's two-layer fix (portal + containing-block hygiene) is belt-and-suspenders: the
  portal alone fixes the dialog at all times; the animation/fill fixes restore `position: fixed`
  semantics for anything else inside pages (e.g. the intelligence side drawer) after the 380–420ms
  entrance.
- The onboarding `contextual-tip` can still intercept mouse clicks on page-level create buttons
  at ≥1024px until dismissed (pre-existing, out of scope, flagged above).
- No claim of WCAG compliance; see §6.

## 10. Files changed

| File | Change |
|---|---|
| `src/components/ui/modal.tsx` | Portal overlay to `document.body` (root-cause fix for overlay geometry); scrim `bg-black/70`+`blur-[3px]` → `bg-black/50`+`blur-[2px]` |
| `src/app/globals.css` | `page-enter` fill `both`→`backwards` + end-state `transform: none` (persistent-transform/containing-block fix); number-input spinner normalization |
| `src/components/motion/page-transition.tsx` | Removed `will-change-transform` (persistent containing block); entrance fill `both`→`backwards` |
| `src/components/goal-manager.tsx` | Date helper copy: `Format: YYYY-MM-DD` → `Saved as YYYY-MM-DD.` |
| `NEW_GOAL_MODAL_REPORT.md` | This report |
| `docs/modal-review-2026-09-27/*.png` | Before/after render evidence (6 files) |

The modal is not "perfect" — it is now a restrained, coherent NEXUS interaction layer with no
interface contradictions, and the items above remain honest open edges.
