# NEXUS — architecture effective

État : audit du 21 septembre 2026, suite de la PR #81. Ce document décrit le code, pas un déploiement certifié.

## Frontières

Next 16.3.5 / React 19.2.8 / App Router. Les Server Components et routes API utilisent le client Supabase lié aux cookies. `src/proxy.ts` renouvelle la session et transmet le pathname réel ; les routes API vérifient leur propre authentification. Les composants client gèrent interactions et formulaires, pas l'autorité admin ni les limites SQL.

`next.config.ts` conserve les mécanismes Next/Vercel : Turbopack, routes dynamiques, headers, standalone uniquement hors Vercel. Aucune modification de configuration cloud, aucune réécriture.

## Matrice d'audit

| Système | État local | Sources | Tests | Risque / action |
|---|---|---|---|---|
| Auth | YELLOW | `lib/auth*`, `lib/supabase/*`, `app/auth/*`, `app/api/auth/*` | session-proxy, request-origin, admin-auth-contract | Emails réels, brute force et OAuth non vérifiés ; ancien E2E obsolète |
| Bootstrap | YELLOW | migrations 006–022, 20260915131000 ; `lib/auth-flow.ts` | bridge-lineage-hermetic, onboarding-product | Anciennes fixtures cassées ; vérifier concurrence PostgreSQL réel |
| Workspace | YELLOW | `lib/workspace.ts`, migrations 001/006/012/017 | freemium, bridge-lineage | Membership actif le plus récent ; RLS distante inconnue |
| Admin | GREEN local / BLOCKED distant | `lib/admin`, `app/admin`, migrations 026–029 | admin-access, directory, SQL admin | Identité base de données ; aucun état frontend ne suffit |
| Plans | GREEN local / BLOCKED distant | subscription-state, migrations 20260915220000 et 20260921190000 | subscription-contract, admin-subscriptions | Nouvelle migration à vérifier/appliquer sur le bon projet |
| Paiement | RED | `lib/billing/provider.ts`, API upgrade | billing-provider | Interface uniquement, pas d'adaptateur ni webhook financier |
| Intelligence | YELLOW | `lib/intelligence`, API intelligence | agent, memory, mission, signals, data-contract | Erreurs corrigées ; budgets persistants et contexte notes/calendrier incomplets |
| Usage IA | RED | ai-provider, signal-store, migration 003 | tests provider timeout/fallback | `ai_usage` existe mais n'est pas un budget opposable ; spécification dans INTELLIGENCE.md |
| UI produit | YELLOW | `(app)`, components/layout, globals.css | mobile, product-background, landing | Noir opaque conservé ; pas de preuve navigateur aux six largeurs |
| Déploiement | BLOCKED pour inspection | config Next, check GitHub Vercel | build local ; check PR | CLI non authentifié ; URL distante inaccessible en TLS |

## Données historiques conservées

001 : profiles, workspaces, workspace_members, spaces, projects, tasks, task_relations, notes, note_relations, files, events, reminders, goals, activities, notifications.
003 : ai_conversations, ai_messages, ai_memories, ai_usage, ai_context_snapshots.
004 : automations, automation_executions, automation_schedules. 005 : worker_jobs.
023–025 : intelligence_memory, intelligence_signals, intelligence_missions.
026 : platform_admins et admin_audit_log. Abonnements workspace : migration 007 puis contrat 20260915220000.

La présence de notes/fichiers/calendrier en SQL ne prouve ni un écran autonome ni un tool IA. Aucun `/notes` ou `/files` autonome n'a été trouvé dans l'arbre des pages ; ne pas inventer ces parcours dans la certification.

## Parcours réel

Signup/login/confirmation → cookies vérifiés → profil minimal → bootstrap workspace idempotent → `/app`. Le profil complet est optionnel, pas une condition d'accès. `/onboarding` existe mais n'est pas la destination obligatoire de tous les utilisateurs.

Admin : session → `platform_admin_context()` → rôle actif en base → layout/pages serveur → RPC avec `admin_assert_access('viewer')`. RLS/grants constituent une seconde frontière. Les journaux admin et l'usage IA ne sont pas la même chose.

## Performance : observations, pas de benchmark inventé

Lectures de snapshot parallèles ; maximum 500 tâches sur les chemins Intelligence examinés ; certaines listes projets/objectifs ne sont pas paginées. Mémoire/contextes longs et résultats PostgREST tronqués restent un risque de complétude. Les agrégats admin parcourent les workspaces et appellent désormais le résolveur canonique : mesurer `EXPLAIN (ANALYZE, BUFFERS)` en staging avant de promettre une performance à grande échelle.

Aucun changement cosmétique de memoization, routing, prefetch, fonts ou bundles effectué sans mesure. Les suites de code ne mesurent ni Web Vitals, ni délai email, ni latence fournisseur. Mesures distantes bloquées.
