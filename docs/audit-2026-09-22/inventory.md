# Inventaire du dépôt audité

Inventaire automatique des chemins et DDL, complément de la revue ciblée. Ne démontre pas que les migrations sont appliquées en production.

## Routes Next.js

- `src/app/(app)/activity/page.tsx`
- `src/app/(app)/app/intelligence/page.tsx`
- `src/app/(app)/app/page.tsx`
- `src/app/(app)/calendar/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/files/page.tsx`
- `src/app/(app)/goals/page.tsx`
- `src/app/(app)/integrations/page.tsx`
- `src/app/(app)/notes/page.tsx`
- `src/app/(app)/notifications/page.tsx`
- `src/app/(app)/projects/page.tsx`
- `src/app/(app)/settings/billing/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/tasks/page.tsx`
- `src/app/(app)/upgrade/page.tsx`
- `src/app/acceptable-use/page.tsx`
- `src/app/admin/activity/page.tsx`
- `src/app/admin/audit-log/page.tsx`
- `src/app/admin/forgot-password/page.tsx`
- `src/app/admin/intelligence/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/admin/overview/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/reset-password/page.tsx`
- `src/app/admin/security/page.tsx`
- `src/app/admin/subscriptions/page.tsx`
- `src/app/admin/users/[userId]/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/workspaces/[workspaceId]/page.tsx`
- `src/app/admin/workspaces/page.tsx`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/resend-confirmation/route.ts`
- `src/app/api/auth/signin/route.ts`
- `src/app/api/auth/signout/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/update-password/route.ts`
- `src/app/api/billing/upgrade/route.ts`
- `src/app/api/capture/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/integrations/[providerId]/connect/route.ts`
- `src/app/api/integrations/[providerId]/route.ts`
- `src/app/api/integrations/[providerId]/sync/route.ts`
- `src/app/api/integrations/callback/[providerId]/route.ts`
- `src/app/api/integrations/route.ts`
- `src/app/api/intelligence/action/route.ts`
- `src/app/api/intelligence/missions/route.ts`
- `src/app/api/intelligence/query/route.ts`
- `src/app/api/intelligence/signals/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/search/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/confirm/route.ts`
- `src/app/auth/confirm-error/page.tsx`
- `src/app/cookies/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/how-it-works/page.tsx`
- `src/app/intelligence/page.tsx`
- `src/app/legal/page.tsx`
- `src/app/login/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/page.tsx`
- `src/app/pricing/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/verify-email/page.tsx`

## Bibliothèques

- `src/lib/access.ts`
- `src/lib/admin/activity-security.ts`
- `src/lib/admin/attention.ts`
- `src/lib/admin/audit.ts`
- `src/lib/admin/data.ts`
- `src/lib/admin/directory.ts`
- `src/lib/admin/format.ts`
- `src/lib/admin/guard.ts`
- `src/lib/admin/health.ts`
- `src/lib/admin/nav.ts`
- `src/lib/admin/query.ts`
- `src/lib/admin/subscriptions.ts`
- `src/lib/admin/types.ts`
- `src/lib/auth-errors.ts`
- `src/lib/auth-flow.ts`
- `src/lib/auth.ts`
- `src/lib/billing/plans.ts`
- `src/lib/billing/provider.ts`
- `src/lib/billing/subscription-state.ts`
- `src/lib/billing/types.ts`
- `src/lib/billing/usage.ts`
- `src/lib/bootstrap-diagnostics.ts`
- `src/lib/capture.ts`
- `src/lib/cn.ts`
- `src/lib/data-errors.ts`
- `src/lib/entitlements.ts`
- `src/lib/integrations/adapters/google-calendar.ts`
- `src/lib/integrations/catalog.ts`
- `src/lib/integrations/connections.ts`
- `src/lib/integrations/crypto.ts`
- `src/lib/integrations/oauth-state.ts`
- `src/lib/integrations/providers.ts`
- `src/lib/integrations/view.ts`
- `src/lib/intelligence/actions.ts`
- `src/lib/intelligence/advanced.ts`
- `src/lib/intelligence/agent.ts`
- `src/lib/intelligence/ai-provider.ts`
- `src/lib/intelligence/context-builder.ts`
- `src/lib/intelligence/context-graph.ts`
- `src/lib/intelligence/data-error.ts`
- `src/lib/intelligence/engine.ts`
- `src/lib/intelligence/intent.ts`
- `src/lib/intelligence/memory.ts`
- `src/lib/intelligence/mission.ts`
- `src/lib/intelligence/planner.ts`
- `src/lib/intelligence/recovery.ts`
- `src/lib/intelligence/references.ts`
- `src/lib/intelligence/signal-api.ts`
- `src/lib/intelligence/signal-store.ts`
- `src/lib/intelligence/signals.ts`
- `src/lib/intelligence/tools.ts`
- `src/lib/intelligence/types.ts`
- `src/lib/is-typing-target.ts`
- `src/lib/onboarding/analytics.ts`
- `src/lib/onboarding/i18n.ts`
- `src/lib/onboarding/model.ts`
- `src/lib/onboarding/persistence.ts`
- `src/lib/onboarding-diagnostics.ts`
- `src/lib/plan-errors.ts`
- `src/lib/plan-limits.ts`
- `src/lib/profile-state.ts`
- `src/lib/request-json.ts`
- `src/lib/request-origin.ts`
- `src/lib/schema-errors.ts`
- `src/lib/server-logs.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/config.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/lib/utils.ts`
- `src/lib/workspace.ts`

## Migrations : inventaire de chaque fichier

| Fichier | Lignes | Tables déclarées | Fonctions déclarées | RLS activations | SHA256 (12 caractères) |
|---|---:|---:|---:|---:|---|
| `001_nexus_core.sql` | 1335 | 15 | 7 | 15 | 0674505f7e6b |
| `002_nexus_storage.sql` | 177 | 0 | 2 | 0 | e2134619bd4b |
| `003_nexus_ai.sql` | 608 | 5 | 4 | 5 | 0bcc39118907 |
| `004_nexus_automations.sql` | 706 | 3 | 7 | 3 | b403d3822b2d |
| `005_nexus_worker.sql` | 429 | 1 | 7 | 1 | e3701592342c |
| `006_nexus_workspace_bootstrap.sql` | 120 | 0 | 3 | 0 | 759ab01f2983 |
| `007_freemium_enforcement.sql` | 324 | 1 | 8 | 1 | e87d2e310575 |
| `008_sync_plan_limits_and_slug.sql` | 100 | 0 | 2 | 0 | 914e4f71b3a6 |
| `009_enforce_task_limit_on_status_update.sql` | 54 | 0 | 1 | 0 | 894bd93aeeff |
| `010_allow_profile_self_repair.sql` | 15 | 0 | 0 | 0 | 74b06fcef16c |
| `011_enforce_workspace_limit.sql` | 80 | 0 | 2 | 0 | bff044c36816 |
| `012_enforce_workspace_membership_on_write.sql` | 135 | 0 | 2 | 0 | 409f3075363a |
| `013_modernize_schema.sql` | 87 | 0 | 0 | 0 | 9b841aa76347 |
| `014_ensure_onboarding_intent.sql` | 28 | 0 | 0 | 0 | ccbab1a6eb51 |
| `015_dependencies_and_activity.sql` | 86 | 1 | 2 | 1 | 54dabd40beea |
| `016_fix_onboarding_workspace_bootstrap.sql` | 263 | 0 | 3 | 0 | 08fbd978970f |
| `017_fix_self_claim_rls_recursion.sql` | 76 | 0 | 1 | 0 | 3af988b712e6 |
| `018_harden_onboarding_bootstrap.sql` | 265 | 0 | 5 | 0 | 984d4bccd0af |
| `019_auth_rearchitecture_username.sql` | 55 | 0 | 1 | 0 | 406100c0df95 |
| `020_access_first_profiles.sql` | 90 | 0 | 1 | 0 | 1ed7b6f0f59c |
| `021_workspace_bootstrap_bounded_observability.sql` | 338 | 0 | 3 | 0 | 63926dd41fe8 |
| `022_onboarding_progress.sql` | 22 | 0 | 0 | 0 | 79d899473317 |
| `023_intelligence_memory.sql` | 59 | 1 | 0 | 1 | 7c1d548a7ab6 |
| `024_intelligence_signals.sql` | 68 | 1 | 0 | 1 | 50350c8139c0 |
| `025_intelligence_missions.sql` | 58 | 1 | 0 | 1 | 447a9ee899de |
| `026_admin_control_plane.sql` | 832 | 2 | 10 | 2 | 40bf3f169868 |
| `027_admin_directory.sql` | 805 | 0 | 4 | 0 | 206683ec5e1c |
| `028_admin_activity_security.sql` | 128 | 0 | 3 | 0 | de5b81870d4b |
| `029_admin_subscriptions.sql` | 388 | 0 | 1 | 0 | 82df18068ead |
| `20260915130000_nexus_core_contract.sql` | 138 | 0 | 0 | 0 | d47313d32a4b |
| `20260915130500_nexus_lineage_reconciliation.sql` | 245 | 0 | 0 | 0 | 712962c157fc |
| `20260915131000_nexus_auth_workspace_bootstrap.sql` | 603 | 0 | 3 | 0 | ffee74d8b18b |
| `20260915140000_nexus_freemium_write_guards.sql` | 392 | 0 | 7 | 0 | a33b8e6dfd6b |
| `20260915220000_nexus_subscription_contract.sql` | 601 | 0 | 8 | 0 | 78c8f9df66d2 |
| `20260920150000_revoke_anon_execute_workspace_helpers.sql` | 9 | 0 | 0 | 0 | a082683cb485 |
| `20260920160000_reconcile_core_column_drift.sql` | 204 | 0 | 0 | 0 | 80caa271f00e |
| `20260921190000_admin_effective_plans.sql` | 612 | 0 | 3 | 0 | a4e7899c818e |
| `20260922120000_fix_activity_action_trigger_cast.sql` | 294 | 0 | 3 | 0 | 61269c4f746c |
| `20260922130000_nexus_context_platform.sql` | 660 | 4 | 6 | 4 | a0691846223a |
| `20260922210000_nexus_audit_hardening.sql` | 101 | 0 | 1 | 0 | 66eec685e05f |

## Tests existants et ajoutés

- `supabase/tests/activity-action-trigger.test.mjs`
- `supabase/tests/admin-access.test.mjs`
- `supabase/tests/admin-auth-contract.test.mjs`
- `supabase/tests/admin-config.test.mjs`
- `supabase/tests/admin-control-plane.test.mjs`
- `supabase/tests/admin-directory.test.mjs`
- `supabase/tests/admin-subscriptions-unit.test.mjs`
- `supabase/tests/admin-subscriptions.test.mjs`
- `supabase/tests/admin-users-workspaces.test.mjs`
- `supabase/tests/auth-flow.test.mjs`
- `supabase/tests/auth-workspace-bootstrap.test.mjs`
- `supabase/tests/billing-provider.test.mjs`
- `supabase/tests/bridge-lineage-hermetic.test.mjs`
- `supabase/tests/capture-parser.test.mjs`
- `supabase/tests/core-contract.test.mjs`
- `supabase/tests/data-errors.test.mjs`
- `supabase/tests/freemium-contract.test.mjs`
- `supabase/tests/integrations-contract.test.mjs`
- `supabase/tests/integrations-hardening.test.mjs`
- `supabase/tests/integrations-rls.test.mjs`
- `supabase/tests/intelligence-agent-v2.test.mjs`
- `supabase/tests/intelligence-agent.test.mjs`
- `supabase/tests/intelligence-data-contract.test.mjs`
- `supabase/tests/intelligence-experience.test.mjs`
- `supabase/tests/intelligence-memory.test.mjs`
- `supabase/tests/intelligence-mission.test.mjs`
- `supabase/tests/intelligence-proactive.test.mjs`
- `supabase/tests/intelligence-signals.test.mjs`
- `supabase/tests/lineage-reconciliation.test.mjs`
- `supabase/tests/migration-logic.test.mjs`
- `supabase/tests/mobile-experience.test.mjs`
- `supabase/tests/onboarding-product.test.mjs`
- `supabase/tests/onboarding-rls.test.mjs`
- `supabase/tests/product-background.test.mjs`
- `supabase/tests/request-json.test.mjs`
- `supabase/tests/request-origin.test.mjs`
- `supabase/tests/schema-errors.test.mjs`
- `supabase/tests/session-proxy.test.mjs`
- `supabase/tests/subscription-contract.test.mjs`
- `supabase/tests/workspace-bootstrap.test.mjs`
- `scripts/test-admin-foundation.mjs`
- `scripts/test-admin-pr3.mjs`
- `scripts/test-admin-pr6.mjs`
- `scripts/test-admin-users-workspaces.mjs`
- `scripts/test-icons.mjs`
- `scripts/test-intelligence-context.mjs`
- `scripts/test-landing-design.mjs`
- `scripts/test-mobile-ux.mjs`
- `scripts/test-onboarding-guide.mjs`
- `scripts/test-p0-domains.mjs`
- `scripts/test-project-creation.mjs`
- `scripts/test-typography.mjs`
