# PROJECT CREATION FIX REPORT

## Symptom

Creating a project in NEXUS was impossible: clicking "New project" / "Add
project" repeatedly had no visible effect, and the page felt broadly broken
("ça bug même").

## Root cause (critical): the guided tour swallowed every click

`GuidedTour` (`src/components/onboarding/guided-tour.tsx`) renders a
`fixed inset-0 z-[70]` wrapper — above every product dialog (`z-[60]`) —
with **default (`auto`) pointer events**. A fullscreen element with `auto`
pointer events is itself the hit target for the whole viewport, so:

- the spotlight "hole" around the highlighted target was **not** clickable
  (clicks landed on the wrapper, never on the underlying button);
- when the create modal opened underneath, **every** modal click (inputs,
  "Add project") landed on the tour wrapper instead of the dialog;
- the tour card itself became `pointer-events-none` while a modal was open,
  so the user could not even skip the tour with the mouse.

Result: mouse users in the onboarding guide could click "create" forever
with zero effect — on Projects, and identically on Tasks. Only keyboard
(Tab/Enter/Escape) still worked, which is why it felt like a general bug.

## Fixes

### 1. `src/components/onboarding/guided-tour.tsx`

- Wrapper is now `pointer-events-none`: only the spotlight panes
  (`pointer-events-auto`) and the tour card intercept clicks. The
  spotlight hole and any open dialog underneath are clickable again.
- While a modal dialog is open, the tour card steps out of the way
  entirely (`invisible`, kept mounted so it returns without re-animating)
  instead of hovering dimmed over the form.
- `Escape` while a dialog is open is owned by the dialog (closes it) and
  no longer skips the whole tour underneath.

### 2. `src/components/onboarding/spotlight.tsx`

- Documents the clickability invariant next to the pane logic so a future
  edit cannot silently regress it.

### 3. `src/components/project-manager.tsx` — no more silent dead-ends

- The submit button is **never disabled on a missing workspace id** again.
  Submitting re-resolves the workspace first; if it stays unreachable, an
  explicit error is shown and the form content is kept.
- New inline warning + "retry the connection" action inside the dialog
  when the workspace is not connected.
- Creation slugs are now unique (`name-<random>`), diacritics-folded
  ("Café" → `cafe-…`), and never empty — duplicate names no longer die on
  the `unique(workspace_id, slug)` constraint with a confusing error.
- A failing plan-limit check now surfaces a connection error instead of
  failing silently.
- Post-save refresh uses the resolved workspace id (previously the stale
  `null` state could wipe the just-created list), and the "Project
  created/updated" confirmation is set **after** the form reset so the
  user actually sees it.

### 4. Regression tests — `scripts/test-project-creation.mjs`

12 structural assertions (tour clickability + creation dead-ends), wired
as `npm run test:creation` and included in the `npm test` chain.

## Validation

- `tsc --noEmit`: clean.
- `eslint` on all touched files: clean.
- `test:creation`: 12/12 pass.
- `test:unit` (incl. onboarding-product), `test:mobile`, `test:freemium`:
  all pass.
- `test:subscription`, `test:landing`, and 3 `test:admin` sub-suites fail
  **identically on the pristine base tree** (verified via `git stash`):
  pre-existing issues (`storage.buckets` PGlite fixture, missing
  `sign-in-flow-1.tsx` fixture, admin-surface drift) — unrelated to this
  fix and left untouched.

## Follow-ups (not in scope)

- `task-manager.tsx` and `goal-manager.tsx` share the old
  `disabled={saving || !workspaceId}` submit pattern — worth the same
  hardening pass (the tour fix already unblocks them).
- Pre-existing suite failures above deserve their own tickets.
