# GUIDE HARDENING REPORT

Follow-up to `PROJECT_CREATION_FIX_REPORT.md`. Full audit of the onboarding
guidance layer (guided tour, welcome screen, checklist, contextual tips,
help center) with one goal: the guide must do its configured job — welcome
→ first project → first task → intelligence — without ever interfering
with the product underneath, and without the intermittent glitches
reported.

## What the audit verified as already correct

- All step-advancing signals are wired: `project_created`, `task_created`,
  `goal_created` and `intelligence` (fired on a real question submit, not
  on page view).
- `trackEvent` cannot break step completion; local persistence is total
  (never throws); remote sync failures were already swallowed.
- The `C` shortcut opens the command palette (a real modal dialog the tour
  yields to) — it cannot wipe an open form.
- Checklist, contextual tips and the welcome screen are small, dismissable
  surfaces below dialog z-indexes; FR copy is complete (compile-time
  typed).

## Fixes

### 1. One dialog observation, shared and pre-paint

`GuidedTour` and `Spotlight` each ran their own `MutationObserver` over
the whole document to detect open dialogs — duplicated work that could
transiently disagree. Both now share a single `useModalActive()` hook
(`spotlight.tsx`), owned by the tour and passed down to the spotlight.

The hook runs pre-paint (`useLayoutEffect`): on deep links like
`/projects?create=1`, where the dialog and the tour mount in the same
commit, the tour no longer flashes one frame over the dialog it must
yield to.

### 2. The tour steps out entirely while a dialog owns the screen

Spotlight panes went from `opacity-20` to `opacity-0` when a modal is
active. Combined with the card already stepping aside, the tour is now
visually gone while the user completes a form — no residual dim over the
inputs, no confusion about what owns the screen.

### 3. Guidance boot can never hang in limbo

`OnboardingProvider` hydration awaited the remote read unguarded: a
transient network failure (or a misconfigured Supabase client, which
throws synchronously) aborted the boot before `setHydrated(true)`, leaving
the user with no welcome, no tour, no checklist and no tips — silently,
until reload. Boot is now `try/finally`: remote state is a bonus, local
state is the fallback, hydration always settles. `persist()` is likewise
incapable of throwing into click/activation handlers.

### 4. Every guidance entry point opens its form

`goal-manager.tsx` only honored `?create=1` on mount: clicking the
checklist's "Create your first goal" while already on `/goals` was a
silent no-op. It now has the same derive-on-prop-change handling as the
project and task managers.

### 5. Label hygiene

The sidebar's global "Create" menu trigger was mislabeled
`data-guide="create-project"`. Nothing queries it today, but the wrong
label was a trap for any future tour step. It is now
`data-guide="global-create"`; `create-project` unambiguously designates
the project dialog submit.

### 6. Help center modal manners

`help-center.tsx` is a real modal (`aria-modal`) but let the background
scroll and left keyboard focus behind the overlay. It now locks body
scroll, moves focus inside on open, and restores focus to the opener on
close — mirroring the `Modal` primitive.

### 7. Dead code removed

The exported `measureGuide()` helper had zero callers (and a scrolling
side effect). Removed.

## Regression tests — `scripts/test-onboarding-guide.mjs`

12 structural assertions, wired as `npm run test:guide` and included in
the `npm test` chain. The pre-existing creation suite was updated for the
intended `opacity-0` behavior.

## Validation

- `tsc --noEmit`: clean. `eslint` on all touched files: clean.
- `test:guide` 12/12, `test:creation` 12/12, `test:unit` (incl.
  onboarding-product) 0 failures, `test:mobile` 67/67, `test:freemium`
  134/134.
- Pre-existing failures (`test:subscription`, `test:landing`, 3
  `test:admin` sub-suites) unchanged and unrelated — see the previous
  report.

## Remaining follow-ups (unchanged)

- `task-manager.tsx` / `goal-manager.tsx` submit hardening (same pattern
  as projects) — tour fix already unblocks them.
- Pre-existing suite failures deserve their own tickets.
