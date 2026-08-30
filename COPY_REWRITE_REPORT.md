# NEXUS copy rewrite report

Scope: every user-visible string in the repository (landing and public pages, app UI,
Intelligence surfaces, engine-generated copy, onboarding, errors, metadata, email
templates, SQL error messages). Copy only: no logic, routes, APIs, components or
architecture were changed.

## FILES MODIFIED

67 files.

Landing (English): `src/components/landing/` — hero, value-band, model-section,
features, intelligence-section, how-it-works, trust, pricing, faq, final-cta, footer,
landing-nav.

Public pages: `src/app/page.tsx`, `src/app/pricing/page.tsx`,
`src/app/how-it-works/page.tsx`, `src/app/intelligence/page.tsx`,
`src/app/layout.tsx` (metadata titles/description/template), `src/app/manifest.ts`,
`src/app/not-found.tsx`.

App pages: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/app/intelligence/page.tsx`,
`src/app/(app)/activity/page.tsx`, `src/app/(app)/integrations/page.tsx`,
`src/app/(app)/upgrade/page.tsx`, `src/app/(app)/settings/billing/page.tsx`.

Intelligence UI: `src/components/intelligence-panel.tsx`,
`src/components/intelligence/intelligence-ask.tsx`, `intelligence-canvas.tsx`,
`intelligence-view.tsx`, `mission-panel.tsx`, `proactive-signals-panel.tsx`,
`signal-detail.tsx`, `forecast-panel.tsx`, `priority-focus.tsx`,
`nexus-intelligence/nexus-intelligence-hero.tsx`, `intelligence-signals.tsx`,
`explainable-intelligence.tsx`, `next-best-action.tsx`, `workspace-to-action.tsx`,
`intelligence-closing.tsx`.

Engine copy: `src/lib/intelligence/advanced.ts` (briefing, health, forecast, focus,
ask narratives, day/week plans), `planner.ts`, `mission.ts`, `engine.ts`,
`signals.ts`, `tools.ts`, `agent.ts`, `ai-provider.ts` (trace labels only).

App UI: `src/components/task-manager.tsx`, `project-manager.tsx`,
`user-settings-panel.tsx`, `profile/profile-completion-modal.tsx`,
`mobile-home/mobile-overview.tsx`, `command-menu.tsx`, `auth/auth-layout.tsx`,
`layout/app-shell.tsx`, `layout/topbar.tsx`, `layout/workspace-sidebar.tsx`,
`ui/page-skeleton.tsx`.

Onboarding: `src/lib/onboarding/i18n.ts` (EN and FR in sync), `src/lib/onboarding/model.ts` (fallback copy).

Supabase: `supabase/email-templates/confirm-signup.html`, `recovery.html`,
`migrations/007_freemium_enforcement.sql`, `009_enforce_task_limit_on_status_update.sql`,
`011_enforce_workspace_limit.sql`, `021_workspace_bootstrap_bounded_observability.sql`
(wording of `PLAN_LIMIT_EXCEEDED` messages only; the `PLAN_LIMIT_EXCEEDED` code prefix
that tests and error mapping rely on is untouched).

## COPY SURFACES REVIEWED

- All 12 landing sections and 4 public pages (read in full).
- Dashboard (desktop + phone surface), /app/intelligence page and every panel it renders
  (Mission, Proactive signals, Ask, Health, Briefing, Focus, Forecast, Canvas,
  Signal list/detail).
- Tasks / Projects / Goals managers, Activity, Notifications, Settings (all tabs),
  Billing, Upgrade, Integrations.
- Command menu, workspace sidebar, topbar, mobile home overview, auth layout and all
  auth flows (login, signup, check-email, confirm-error, forgot/reset password).
- Onboarding welcome screen and guided tour (EN + FR), profile completion modal.
- Intelligence engine output (deterministic narratives, signals, mission text,
  planner steps, tool traces, agent workflow labels, verification lifecycle).
- Error strings: `auth-errors.ts`, `data-errors.ts`, `plan-errors.ts`,
  `schema-errors.ts`, API route errors.
- Browser metadata (title template, OG, Twitter, manifest), sitemap/robots left as-is.
- Supabase email templates and SQL `RAISE EXCEPTION` messages.

## MAIN WRITING CHANGES

1. Em dashes removed from every user-visible string. Replaced with a period, a comma,
   a colon or a separate sentence depending on the rhythm needed. Code comments and
   the `/[-–—]/g` regex literals intentionally keep them. Date placeholders that used
   "—" as a missing value now use an en dash "–" (task/project managers, dashboard,
   forecast panel), matching the existing dashboard convention.
2. Removed hedges and soft claims from engine copy: "It is recommended to…",
   "It would be useful to…", "work is flowing smoothly", "all initiatives are
   progressing within safe parameters", "NEXUS would… (and) will be verified" all
   became direct, verifiable statements.
3. Removed false or unverifiable claims:
   - Settings "Nothing is sent to an external model provider" was inaccurate when an
     API key is configured (`ai-provider.ts` detects OpenAI/Anthropic keys). Rewritten
     to state what is true in both configurations.
   - Landing intelligence footer dropped "no external model call" / "no data leaving
     the workspace" in favor of "Read from your own tasks, projects and goals."
   - Proactive panel "+ N other signals in the full list" implied a list that does
     not exist (DISPLAY_LIMIT caps cards; the rest are only counted). Now says they
     are lower-priority signals.
   - Day-plan narrative no longer claims a fixed 09:00/noon/afternoon structure the
     planner does not produce; it says the ordering comes from verified deadlines and
     blockers.
4. Signals are factual with real counts (e.g. PRIORITY_CONFLICT now reports the actual
   number of urgent and due-today tasks instead of a vague "many commitments at the
   same time").
5. Empty states made concrete and short, each with a usable next step. Error states
   state what happened and what the user can do (e.g. "NEXUS could not read this
   workspace. Your session may have expired… Nothing was changed." + Retry).
6. Brand voice: the product never speaks as "we" in the app UI ("We couldn't read
   this workspace" → "NEXUS could not read this workspace"). The recovery email no
   longer opens with "We received a request".
7. Mixed-language cleanup inside the Ask console (a French UI): "Action
   Recommendation" → "Action recommandée", "Open in Tasks/Goals/Projects" →
   "Ouvrir dans Tâches/Objectifs/Projets", "View" → "Voir", loading line and
   proactive count in French to match the surrounding panel.
8. Removed banned/AI vocabulary from user-visible text: "unlock" (SQL limit messages,
   "unlock a projection"), "intelligent" (onboarding title), "strategic deep work"
   (planner), "operating plan / cadence / triaged against friction point" phrasing in
   the weekly plan, "Explore on my own" → "Skip the guide".
9. NEXUS vocabulary preserved everywhere: Intelligence, Mission, Next Best Action,
   Workspace, Goal, Project, Task, Activity, Signal, Risk, Context, Verification,
   Ask NEXUS, Workspace Health, Server Verified / "Verified" states.

## TEXT REMOVED OR REWRITTEN (representative before / after / why)

- BEFORE: "NEXUS would complete "X" in this workspace. The action is proposed for
  your confirmation and will be verified before success is reported."
  AFTER: "This will complete "X" in this workspace. It runs only after your
  confirmation, and NEXUS verifies the result before reporting success."
  WHY: remove the "would" hedge; state the contract plainly.

- BEFORE: "NEXUS structured your workday based on verified deadlines and
  dependencies: clear overdue debt first at 09:00, address blockers before noon, and
  execute scheduled commitments this afternoon."
  AFTER: "NEXUS ordered the day from your verified deadlines and blockers. The most
  urgent items come first, at 09:00."
  WHY: the original invented a noon/afternoon structure the planner does not produce.

- BEFORE: "No active task is marked blocked in any project. Work is flowing
  smoothly."
  AFTER: "No open task is marked blocked in any project."
  WHY: "flowing smoothly" is a mood, not a fact. The first sentence is the fact.

- BEFORE: "The workspace contains many urgent commitments at the same time.
  INTELLIGENCE signals the conflict without deciding for you what must be sacrificed."
  AFTER: "The workspace has 3 urgent tasks and 2 deadlines for today. You choose
  what comes first."
  WHY: factual counts from the signal context, no vague plural, and the product does
  not editorialize about "sacrifice".

- BEFORE: "It is recommended to create a dedicated project for "X" so your team can
  organize tasks, track deadlines and monitor momentum."
  AFTER: "This creates a project for "X" in your workspace. Tasks and deadlines will
  be tracked against it."
  WHY: hedge removed; the sentence now describes what the proposed action does.

- BEFORE: "Everything you create inside NEXUS — projects, tasks, goals and the
  workspace activity log — is already analysed."
  AFTER: "Everything you create inside NEXUS is already analysed: projects, tasks,
  goals and the workspace activity log."
  WHY: em dashes; the colon carries the list more cleanly.

- BEFORE: "Your workspace is ready · LET NEXUS UNDERSTAND YOU (3/5)"
  AFTER: "Your workspace is ready · Setup (3/5)"
  WHY: "let NEXUS understand you" is marketing; the steps are setup.

- BEFORE: "Active Momentum" / "Throughput" (dashboard stat labels)
  AFTER: "Projects" / "Completed"
  WHY: the labels now name what is actually counted.

- BEFORE (onboarding, FR): "Mettons-nous en condition de produire. Je vous guide sur
  l'essentiel."
  AFTER: "Ajoutez un projet et une première tâche, et NEXUS commence à lire votre
  travail."
  WHY: the first version promised a state ("ready to produce"); the second describes
  the two real first steps and what NEXUS does with them.

- BEFORE (recovery email): "We received a request to reset your NEXUS password."
  AFTER: "A password reset was requested for your NEXUS account."
  WHY: the app never speaks as "we"; passive keeps it factual.

- BEFORE (settings): "It runs on your data, in your session. Nothing is sent to an
  external model provider."
  AFTER: "The built-in engine reasons in your session. If an external model is
  enabled for NEXUS Intelligence, it only ever sees the read-only context listed
  below."
  WHY: the old sentence was false when OPENAI/ANTHROPIC keys are configured (the
  provider adapter sends the workspace context in that case).

- BEFORE: "Upgrade to unlock more." (SQL PLAN_LIMIT_EXCEEDED message)
  AFTER: "Upgrade to add more."
  WHY: "unlock" is banned vocabulary; the message is a server-side fallback that can
  reach the UI.

## TEST RESULTS

`npm test` (all three groups), run after the changes:

- test:unit (10 suites, via tsx):
  intelligence-agent 57/57, intelligence-agent-v2 116/116, intelligence-memory
  115/115, intelligence-proactive 47/47, intelligence-signals 77/77,
  intelligence-mission 64/64, intelligence-experience 70/70,
  onboarding-product 37/37, schema-errors 41/41, mobile-experience 45/45.
- test:mobile (`scripts/test-mobile-ux.mjs`): all checks pass (intelligence-ask
  "Outils consultés", mission-panel "Prochaine meilleure action", nav hrefs,
  ConfirmDialog usage, `opacity-100 sm:opacity-0` preserved).
- test:landing (`scripts/test-landing-design.mjs`): 92/92, including "NEXUS reads
  the work." before "Free to start", plan limits derived from `plan-limits.ts`,
  no banned trust/pricing claims, native FAQ, table caption + scoped headers.

Total: 782 assertions, 0 failures. No test was removed or weakened; assertions that
checked copy (e.g. "Outils consultés", "Prochaine meilleure action", "Clear
deadline debt", the planner step "dette") were kept and still pass.

TypeScript: `tsc --noEmit` passes with 0 errors.
Lint: `npm run lint` passes with 0 errors (20 pre-existing warnings in files not
touched by this change: motion components, ui/dropdown, ui/modal, test helpers,
tailwind.config.js).

## BUILD RESULT

`npm run build` (Next.js 16) succeeds, exit 0. All routes compile, static and
dynamic, including /app/intelligence, /dashboard, /upgrade and the public
/intelligence page.

## REMAINING ISSUES

1. Pricing mismatch (pre-existing, flagged only, not changed): the landing pricing
   table hardcodes $19 (Pro) and $49 (Team) in `src/components/landing/pricing.tsx`,
   while `src/lib/billing/plans.ts` deliberately leaves `priceLabel: null` for both
   plans because no payment provider is connected yet. Someone needs to decide the
   real prices or make the landing derive them from one source.
2. Browser tab titles may double the suffix (pre-existing): the root layout template
   is now "%s. NEXUS" and several (app) pages already carry ". NEXUS" in their
   titles (e.g. "Intelligence. NEXUS"). Next.js applies the template on top, so those
   tabs can render as "Intelligence. NEXUS. NEXUS". The page-level strings were kept
   to preserve existing behavior; the clean fix is dropping the suffix from the page
   titles (or dropping the template).
3. Mixed EN/FR UI remains by design of the current codebase: the app shell, managers,
   dashboard and /app/intelligence page are English, while Mission, Proactive
   signals, Ask console and onboarding guides are French (onboarding i18n serves both).
   Copy was improved within each language, not unified; unification is a product
   decision.
4. Em dashes remain in code comments and in the `/[-–—]/g` regex literals
   (advanced.ts, intent.ts, references.ts), and in one LLM prompt template line in
   ai-provider.ts (signal list formatting sent to the model, not shown to users).
   None of these are user-visible.
