# Inventaire cumulatif — 22 septembre 2026

Branche : `arena/01a0cab9-nexus-app`. Base : b1717d5eeef3579ba0b5d71a26425a17d00b9d05. Aucun commit/push/merge effectué.

116 chemins modifiés/non suivis, **incluant** la tranche antérieure et les documents/preuves. `git diff --stat` seul ne compte pas les fichiers non suivis.

## Chemins

- `.env.example`
- `SECURITY.md`
- `UX_WRITING.md`
- `docs/AUDIT_INITIAL_2026-09-22.md`
- `docs/BILLING.md`
- `docs/GLOBAL_AUDIT_FINAL_2026-09-22.md`
- `docs/GLOBAL_AUDIT_INITIAL.md`
- `docs/GLOBAL_DOCUMENTS_OBSERVABILITY.md`
- `docs/GLOBAL_INTEGRATIONS_AUDIT.md`
- `docs/GLOBAL_UX_AUDIT.md`
- `docs/NEXUS_AUDIT_FINAL_2026-09-22.md`
- `docs/SECURITY.md`
- `docs/audit-2026-09-22/accessibility-public-pages.json`
- `docs/audit-2026-09-22/global-accessibility-public-pages.json`
- `docs/audit-2026-09-22/global-browser-interactions.json`
- `docs/audit-2026-09-22/global-change-inventory.md`
- `docs/audit-2026-09-22/global-extra-tests.json`
- `docs/audit-2026-09-22/global-final-commands.json`
- `docs/audit-2026-09-22/global-http-smoke.json`
- `docs/audit-2026-09-22/global-test-results.md`
- `docs/audit-2026-09-22/inventory.md`
- `docs/audit-2026-09-22/test-results.md`
- `docs/legal/AI_TRANSPARENCY.md`
- `docs/legal/BILLING_COMPLIANCE.md`
- `docs/legal/COOKIE_POLICY.md`
- `docs/legal/DATA_MAP.md`
- `docs/legal/PRIVACY.md`
- `docs/legal/RETENTION.md`
- `docs/legal/THIRD_PARTY_PROCESSORS.md`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `scripts/purge-inactive-memory.mjs`
- `scripts/test-admin-users-workspaces.mjs`
- `scripts/test-icons.mjs`
- `scripts/test-p0-domains.mjs`
- `src/app/(app)/billing/[status]/page.tsx`
- `src/app/(app)/billing/page.tsx`
- `src/app/(app)/integrations/page.tsx`
- `src/app/(app)/plans/page.tsx`
- `src/app/(app)/settings/privacy/page.tsx`
- `src/app/(app)/settings/regional/page.tsx`
- `src/app/admin/forgot-password/page.tsx`
- `src/app/admin/intelligence/page.tsx`
- `src/app/admin/overview/page.tsx`
- `src/app/admin/reset-password/page.tsx`
- `src/app/api/integrations/[providerId]/connect/route.ts`
- `src/app/api/integrations/[providerId]/sync/route.ts`
- `src/app/api/integrations/callback/[providerId]/route.ts`
- `src/app/api/integrations/route.ts`
- `src/app/api/intelligence/query/route.ts`
- `src/app/api/settings/privacy/route.ts`
- `src/app/api/settings/regional/route.ts`
- `src/app/cookies/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/privacy/page.tsx`
- `src/components/admin/admin-login-form.tsx`
- `src/components/calendar/calendar-manager.tsx`
- `src/components/files/files-manager.tsx`
- `src/components/integrations/integration-platform.tsx`
- `src/components/intelligence/intelligence-ask.tsx`
- `src/components/intelligence/intelligence-view.tsx`
- `src/components/landing/footer.tsx`
- `src/components/landing/pricing.tsx`
- `src/components/legal/legal-data.ts`
- `src/components/legal/legal-layout.tsx`
- `src/components/privacy-settings.tsx`
- `src/components/regional-settings.tsx`
- `src/components/task-manager.tsx`
- `src/components/theme-control.tsx`
- `src/components/ui/modal.tsx`
- `src/components/user-settings-panel.tsx`
- `src/lib/admin/health.ts`
- `src/lib/admin/nav.ts`
- `src/lib/billing/adapters/availability.ts`
- `src/lib/billing/adapters/stripe.ts`
- `src/lib/billing/entitlements/index.ts`
- `src/lib/billing/payment-contract.ts`
- `src/lib/billing/plans.ts`
- `src/lib/billing/pricing-catalog.ts`
- `src/lib/billing/provider.ts`
- `src/lib/billing/state-machine.ts`
- `src/lib/billing/webhook-processing.ts`
- `src/lib/global/context.ts`
- `src/lib/global/country.ts`
- `src/lib/global/currency.ts`
- `src/lib/global/formatting.ts`
- `src/lib/global/integration-availability.ts`
- `src/lib/global/locale.ts`
- `src/lib/global/payment-availability.ts`
- `src/lib/global/regional-policy.ts`
- `src/lib/global/timezone.ts`
- `src/lib/integrations/adapters/google-calendar.ts`
- `src/lib/integrations/connections.ts`
- `src/lib/integrations/crypto.ts`
- `src/lib/integrations/oauth-state.ts`
- `src/lib/integrations/providers.ts`
- `src/lib/integrations/view.ts`
- `src/lib/intelligence/actions.ts`
- `src/lib/intelligence/ai-provider.ts`
- `src/lib/intelligence/intent.ts`
- `src/lib/intelligence/memory.ts`
- `src/lib/intelligence/tools.ts`
- `src/lib/privacy/request.ts`
- `src/lib/theme/theme.ts`
- `supabase/migrations/20260922210000_nexus_audit_hardening.sql`
- `supabase/migrations/20260922220000_global_preferences_retention.sql`
- `supabase/tests/00_base_schema_fixture.sql`
- `supabase/tests/global-privacy-rls.test.mjs`
- `supabase/tests/global-product.test.mjs`
- `supabase/tests/integrations-hardening.test.mjs`
- `supabase/tests/integrations-rls.test.mjs`
- `supabase/tests/intelligence-agent-v2.test.mjs`
- `supabase/tests/intelligence-agent.test.mjs`
- `supabase/tests/stripe-transport.test.mjs`

## Migrations présentes : 41

Inventaire/hash ne signifie ni audit intégral de chaque instruction ni application distante.

| Fichier | SHA-256 |
|---|---|
| 001_nexus_core.sql | 0674505f7e6bcb26e030229770f8a844e33e26f10f33456b208a9e31fd3a185c |
| 002_nexus_storage.sql | e2134619bd4bb622677d09e14370a52aed6f59183e8a697970b34b3727d11a4a |
| 003_nexus_ai.sql | 0bcc39118907754dda7313a5e30e8fefc19a9ffd7e3bb1be3b888f7a84348614 |
| 004_nexus_automations.sql | b403d3822b2d3475368447353917e28069d985df785411c1f5c1cbdffa60a1d6 |
| 005_nexus_worker.sql | e3701592342c0270820167e8aafaa066e04cb896ba69072e0d079248c1ca5e58 |
| 006_nexus_workspace_bootstrap.sql | 759ab01f29830f2b298f1dd08b0f8229cef057ff37b0ecc4722260d9bd3bea93 |
| 007_freemium_enforcement.sql | e87d2e31057518f442875ad7673b53116e33ad24692044acbb55b9303d776374 |
| 008_sync_plan_limits_and_slug.sql | 914e4f71b3a6e0d8c246604f6d330c64c8056ca21ed3b19208bf246382c74cfd |
| 009_enforce_task_limit_on_status_update.sql | 894bd93aeeff3d5a00a29eb713e473d9a71fbb7a02790da1d40b7dd7de046031 |
| 010_allow_profile_self_repair.sql | 74b06fcef16c7059ac04c25e47df93bb77638f3214166822f9e3455afe7da3b7 |
| 011_enforce_workspace_limit.sql | bff044c36816bc64513df73181f735e4eeee4fdbeda065a5689ddf67116a45e8 |
| 012_enforce_workspace_membership_on_write.sql | 409f3075363ae53f887e5fc4e36b451b46446cc795935eb5f766bd7e7f7f499a |
| 013_modernize_schema.sql | 9b841aa76347f8d4ddc39b854075728a6bf406eed49915961f548f2a0e3e0fdc |
| 014_ensure_onboarding_intent.sql | ccbab1a6eb51ee9a11d390ecd5c1ce442228f74ee23a8b5acbecb3135d5e57d3 |
| 015_dependencies_and_activity.sql | 54dabd40beea6af536b30fc54449a725ddfe426e10aadb846bbda909b3d6569f |
| 016_fix_onboarding_workspace_bootstrap.sql | 08fbd978970f7efc18f9e50a635d50da875ccf3c045ee9fbc344edb1e35e7bd6 |
| 017_fix_self_claim_rls_recursion.sql | 3af988b712e69ed5a012aa5dae197cf04e5712641d34757a0ddfec4f39dcd85a |
| 018_harden_onboarding_bootstrap.sql | 984d4bccd0af0aca34b163ce68d77cc4dfaf4cbe78ba4715dc1c2b05f3734c94 |
| 019_auth_rearchitecture_username.sql | 406100c0df95447a5a56931566657d46811ab456fea89d3edb70be02c5079123 |
| 020_access_first_profiles.sql | 1ed7b6f0f59c8dec2dea0b45c5621a11fbb102f9dc2a6b263f23a02f37663808 |
| 021_workspace_bootstrap_bounded_observability.sql | 63926dd41fe858dd640cea999ccc2b5aeb71aa656e6798d8bfd420a7bbc10f6e |
| 022_onboarding_progress.sql | 79d899473317d6f5c1348e3a7026682bce81764ea7bcaf22d31a0050bce9f440 |
| 023_intelligence_memory.sql | 7c1d548a7ab667c8f72e74747ed546bab8e73dee41fe7cf20881b769b6bb8e6d |
| 024_intelligence_signals.sql | 50350c8139c0e0d50f22f20159d835c491f9df3179a3c87b0653582aa13c1f85 |
| 025_intelligence_missions.sql | 447a9ee899decc638a4b5ac77d488ada0bedc75b2a407bb8bbf9a6ea46d7e1ba |
| 026_admin_control_plane.sql | 40bf3f169868141baa99f434cc6ae26d2b61ea64af11e92e2c1cdf9f25681dd5 |
| 027_admin_directory.sql | 206683ec5e1c609af244b5c059cfc49b7f5e6e9a54996513083788c62b99c088 |
| 028_admin_activity_security.sql | de5b81870d4b4ca5890030fbff4cf1f61a6c337f6a22aadc87b4ed9f7d7c141b |
| 029_admin_subscriptions.sql | 82df18068ead1951a7249d565972a965c156262b569fe309390280af1613c711 |
| 20260915130000_nexus_core_contract.sql | d47313d32a4b1f25c7a41b56c60bc7ca6c3f552407b7e3f89cfbbfa43c8faa22 |
| 20260915130500_nexus_lineage_reconciliation.sql | 712962c157fc848599e4e5c243932d3b8c962264f3ce2c7bc5a6f3615f1e6341 |
| 20260915131000_nexus_auth_workspace_bootstrap.sql | ffee74d8b18bc15d47f0e34516fb5563351c495cac3258970f27c230fb90e735 |
| 20260915140000_nexus_freemium_write_guards.sql | a33b8e6dfd6b770e500e5ad4f1240d110d9008031dae5d7c59f1f3363049c6fc |
| 20260915220000_nexus_subscription_contract.sql | 78c8f9df66d2fe6c4d50a21dceee6c9ab7badc80fb7fc6fda2d10146c9045c0c |
| 20260920150000_revoke_anon_execute_workspace_helpers.sql | a082683cb485164e11ac36adbd5ad483ae7225309df8e72bd42f0edd3295c62f |
| 20260920160000_reconcile_core_column_drift.sql | 80caa271f00e0049a907b6ceb8fd828bbc589dcafacf4486508d5eeee0502c2f |
| 20260921190000_admin_effective_plans.sql | a4e7899c818e217cc1f7cb106636f995030f52d78db6ac7c52d955cc3ecab3e8 |
| 20260922120000_fix_activity_action_trigger_cast.sql | 61269c4f746c175b3692b6f6e0675977d313e8a592b1d3fe98f0e8bc3f7dafc6 |
| 20260922130000_nexus_context_platform.sql | a0691846223a01fe5331819a61884a690c2276c1a5db6df75a6e56f6c4e68c4f |
| 20260922210000_nexus_audit_hardening.sql | 66eec685e05fedf73d30c6eb907f23ff95f1ee59a5d75f695950606e8ff34303 |
| 20260922220000_global_preferences_retention.sql | d6c8b3a0b72ef737fd0944efa7a0cc078541caef51ef12474d74fbed39e88520 |

## Dépendances ajoutées dans cette tranche

- @js-temporal/polyfill : ^0.5.1
- stripe : ^22.6.2
- server-only : ^0.0.1

Résolution reproductible via package-lock.json ; aucun SDK ne prouve un compte marchand actif.
