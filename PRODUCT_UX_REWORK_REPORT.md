# NEXUS — Product & UX rework

## 1. Product audit

NEXUS already had a strong **access-first** architecture:

- Auth (email, Google, verification, recovery) is intact and routes into `/app`.
- Workspace bootstrap is bounded, idempotent, and never blocks the dashboard.
- Profile completeness is UI guidance only.
- The dashboard already answers “what’s happening” for empty and populated workspaces.
- Sidebar IA is close to the recommended hierarchy (Overview, Intelligence, Projects, Tasks, Goals, workspace, settings/billing).

What was missing was a **first-run product system**: interactive guidance tied to real actions, persistent progress, a single guidance channel, contextual help, and activation analytics.

## 2. Problems identified

- New users landed on a capable dashboard but without a guided path to first value.
- Empty states explained features, but there was no interactive coach.
- Profile prompt could compete with first-run attention.
- Help in the top bar pointed at Settings, not a product guide.
- Activation was not instrumented; “onboarding complete” could have been confused with value.

## 3. Decisions made

- Keep auth, RLS, bootstrap, and existing managers.
- Add a declarative onboarding model (`OnboardingProvider` → state → steps → persistence).
- Complete steps from **real product facts** (project/task counts, Intelligence visit).
- Persist locally (resume after close) and on `profiles.onboarding_progress` (RLS self-update only).
- One guidance surface at a time: tour **or** checklist/tip/help.
- Activation = first project + first task + first Intelligence interaction.

## 4. UX changes

- First-run welcome card (Let’s get started / Skip).
- 4-step interactive guide: welcome → create project → create task → Intelligence.
- Persistent “Get started” checklist (2/4, dismissible).
- Contextual tips on first visit to Projects / Tasks / Goals / Intelligence.
- Help center from the life-ring control.
- Empty dashboard copy: workspace starts here + single primary CTA.
- Profile prompt hidden while the tour is active.

## 5. Authentication changes

None to the security model. Post-auth destination remains `/app`. Google, email, verification, and recovery are unchanged.

## 6. Onboarding architecture

```
OnboardingProvider
  → OnboardingState (status, completedSteps, tips)
  → ProductFacts (counts + intelligence)
  → Persistence (localStorage + profiles.onboarding_progress)
  → GuidedTour | Checklist | ContextualTip | HelpCenter
```

## 7. Guided tour architecture

Declarative `GUIDE_STEPS` with `target`, `href`, and completion conditions. Overlay + spotlight (`data-tour`). Escape skips. `prefers-reduced-motion` reduces motion. Steps do not complete on “Next”.

## 8. Activation definition

```
ACCOUNT_CREATED → FIRST_LOGIN → FIRST_PROJECT → FIRST_TASK → FIRST_INTELLIGENCE
```

`signup_completed` and `tour_completed` are **not** activation.

## 9. Analytics events

`onboarding_started`, `onboarding_skipped`, `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_completed`, `first_project_created`, `first_task_created`, `first_goal_created`, `first_intelligence_interaction`, `profile_started` (reserved), `profile_completed`, `activation_reached`.

Emitted as `nexus:analytics` (no PII).

## 10. Security verification

- New column is on `profiles` only; existing self RLS applies.
- No public tables, no service key, no RLS disable.
- Remote writes use the user session client.

## 11. Tests executed

- `node supabase/tests/onboarding-product.test.mjs` (model: new user, skip, resume, existing project, activation).
- Existing migration / RLS / bootstrap tests when run in this environment.
- Full `auth-flow.test.mjs` requires a running Next + stub (external to a static build).

## 12. Build verification

See the execution log for `npm run lint` and `npm run build`.

## 13. Remaining limitations

- Applying `022_onboarding_progress.sql` on a live Supabase project is an **external** operator step.
- Analytics are in-app events; no third-party sink is configured.
- Multi-device resume needs the new column applied in production.
- Interactive tour highlight depends on `data-tour` targets being in the DOM.

## 14. Commit hash

Recorded after commit on `arena/01a03a76-nexus-app`.
