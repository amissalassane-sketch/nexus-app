# NEXUS — Guide: no more stuck steps

## Symptom

The guided tour would display a step and then dead-end: the primary button
did nothing and the user waited forever (reported on both desktop and mobile).

## Root causes found

1. **Stale counts** — `OnboardingProvider` only received the counts injected
   by the server layout, which are frozen after the initial render. After
   client-side navigation (or in a second tab), a step whose work already
   existed (e.g. `create_project` when a project already exists) waited for a
   `project_created` event that would never fire.
2. **Silent no-op on the interact step** — when the target
   (`[data-guide='intelligence-input']`) was not in the DOM (page error, no
   workspace, content not rendered), the primary button ran
   `router.push(step.href)` to the *current* page: a no-op. The step could
   never complete.
3. **No escape hatch on create/interact steps** — if the product action could
   not be completed (form error, plan limit, RLS), the guide waited forever;
   only skipping the whole tour was possible.
4. **Stuck spinner on navigate steps** — `pending` was set on button click and
   only cleared when the step changed; a failed push (route error, auth
   redirect) left the button spinning forever.
5. **Modal false positives** — the spotlight/card "yield to modal" check used
   `document.querySelector("[role='dialog'][aria-modal='true']")` without a
   visibility check, so a hidden or leftover dialog (route transition,
   closing animation) dimmed the card to 20% and disabled its buttons.

## Changes

- `project-manager` / `task-manager` broadcast ground truth via a
  `nexus:counts` event after every successful fetch; the provider merges them
  with `Math.max` into the facts (`liveCounts`). A pending `create_project` /
  `create_task` now completes immediately when the work already exists.
- `create_project` / `task_created` activation events also bump the live
  counts, covering creations outside the managers (e.g. Intelligence Ask).
- **Per-step skip**: create/interact steps get a "Skip this step" /
  « Passer cette étape » action (`skipStep` on the onboarding context,
  `onboarding_step_skipped` analytics event) so no step can dead-end.
- **Interact retry**: when the target is missing, the primary button becomes
  "Retry" / « Réessayer » and re-runs the page's server render
  (`router.refresh()`) or navigates to the step's destination — never a no-op.
- **Pending safety net**: navigate/acknowledge buttons unlock after 2.5 s if
  the push did not advance the step.
- **Visible-modals-only**: both the spotlight panes and the tour card now only
  yield to a modal dialog that actually has a visible box.
- Removed the dead render-phase state reset in `GuidedTour` (the `key`
  remount already handles step changes).
- EN/FR copy: `guide.skipStep`, `guide.retry`.

## Tests

`npx tsx supabase/tests/onboarding-product.test.mjs` — 51 assertions:
skipping each stuck step advances the tour, fresh counts unblock pending
create steps, new copy exists in both locales, plus source-level wiring
checks for every escape hatch (no browser test stack by design).

Full `npm run test:unit` passes. Two pre-existing `test:landing` failures
(unrelated: landing framer-motion import, missing `sign-in-flow-1.tsx`)
already exist on untouched master.

## Limits

- Live end-to-end run needs the real Supabase (auth) — not available in this
  sandbox. The model + wiring tests and a clean dev-server compile of every
  guide route are the verification performed here.
