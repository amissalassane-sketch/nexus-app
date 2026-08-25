# NEXUS — Guided activation (second pass)

## Initial state

Commit `4ddac6a` already delivered access-first onboarding: provider, persistence, welcome, checklist, Help, and activation = project + task + Intelligence.

## Existing architecture (kept)

- `OnboardingProvider` in the app shell
- `profiles.onboarding_progress` + localStorage
- Product facts from live counts (RLS)
- Auth, Google, email, workspace bootstrap unchanged

## Problems identified

- Steps jumped straight to “create” without highlighting Projects / Tasks
- Overlay blocked clicks on the highlighted control
- Intelligence completed on any pointer down (page open)
- `data-tour` instead of stable `data-guide`
- Copy hardcoded; no FR/EN layer
- Help always said “restart”
- Multiple layers could compete
- Checklist used profile instead of first goal

## Changes

- State machine: welcome → navigate_projects → create_project → navigate_tasks → create_task → navigate_intelligence → interact_intelligence
- Create / interact steps require **real product facts**
- Spotlight with a click-through hole (four panes)
- Missing target waits, then fallback copy — no deadlock
- Welcome: Get started / Explore on my own
- Intelligence Ask bar: send is the interaction event
- `data-guide` targets on nav, create, form, help
- EN/FR copy module (`src/lib/onboarding/i18n.ts`)
- Single guidance layer via `pickGuidanceLayer`
- Help: Continue setup vs Replay product tour
- Checklist from product facts (project, task, intelligence, goal)

## New / extended components

- `spotlight.tsx`, `welcome-screen.tsx`, `intelligence-ask.tsx`
- Hardened `guided-tour`, `help-center`, `checklist`, `model`

## Events

Existing plus: `intelligence_opened` (reserved), `intelligence_interaction`, `feature_first_visit`, `tour_replayed`

## Persistence / security

Unchanged model. Client never marks create complete without a real insert event + count. RLS untouched.

## Tests

`npx tsx supabase/tests/onboarding-product.test.mjs` — action-based completion, skip/resume, layers, i18n, targets.

Auth-flow / PGlite RLS not re-run here (need stub + PGlite).

## Limits

- Apply `022_onboarding_progress.sql` on live Supabase for multi-device.
- Auth-flow E2E needs a running Next + stub.

Not claimed production-ready until those external suites run.
