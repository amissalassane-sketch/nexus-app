# NEXUS — EXECUTION STATE

> Reprise automatique : lire ce fichier, puis `git status` + derniers commits.
> Branche : `arena/01a0192a-nexus-app`. Règle : commit + push après CHAQUE bloc.

## État actuel du projet

NEXUS V4 correction plan — blocs P0 à P7 TERMINÉS, commités et poussés.
P8 (notifications actionnables) en cours, puis audit final SaaS.

## Dernier bloc terminé

**P7 — GOAL › PROJECT › TASK** (commit `597bac8`)

## Bloc actuellement en cours

**P8 — Notifications actionnables** (migration 015 : producers PostgreSQL + UI severity/action)

## Blocs terminés (historique)

| Bloc | Commit | Contenu |
| --- | --- | --- |
| Baseline | `5851823` | Fonts Geist auto-hébergées, `design/` exclu de tsc + eslint |
| P0 | `b221819` | Migration 011 (owner membership trigger + backfill + owner exempt du member limit + policy pg_policies-guarded), `getProfileSummary()`, layout `(app)` guard, onboarding réparateur (aucune redirection non vérifiée), tests statiques |
| P1 | `24b0f8a` | Onboarding 3 étapes vérifiées (identité, intention §8, première valeur saisie par l'utilisateur), migration 012 `onboarding_intent` |
| P4 | `cd1bd41` | `@config` Tailwind branché (les tokens DA se génèrent réellement), conteneur unique 1180px, 1 seul h1/page, cartes plan de hauteur égale + CTA ancrés, prix « Free » (jamais « 0 »), note unique, boutons désactivés sobres, dropdown Create ancré + scale-in, indicateur sidebar animé, tokens motion |
| P2 | `9ef19da` | Système toast, primitives UI (motion encodée), quick-create task, édition inline, UI optimiste (complétion, progression, notification lue) avec rollback + toast, skeletons, stagger |
| P3 | `f91485a` | Moteur déterministe (8 signaux, raison TOUJOURS affichée) + tests unitaires, `/intelligence`, bloc Focus dashboard, couche LLM optionnelle (clé serveur uniquement, signaux agrégés seulement, rate-limit IP+workspace, dégradation propre) |
| P6 | `998042e` | ⌘K au niveau shell (meta/ctrl+k + preventDefault), bouton visible « Search… ⌘K », créer ×3 + naviguer ×8 + recherche réelle `/api/search` + Ask NEXUS, ↑↓⏎Esc, dialog a11y, focus restitué, zéro setState-in-effect |
| P5 | `2738822` | Settings réels : side-nav Account/Workspace/Preferences/Billing, email + mot de passe + sessions (signOut global), danger zone expliquée (RPC future, non simulée), renommage workspace vérifié serveur (`/api/workspace/rename`), membres réels, usage RPC, préférences (migration 013 `preferences jsonb`, densité live + format de date), `/auth/callback` PKCE |
| P7 | `597bac8` | Migration 014 `projects.goal_id`, sélecteur projet tâche + filtre + badge (sonde de capacité), sélecteur goal projet + dépliage tâches (prochaine action, blocages), « what advances this goal » + avertissement sans projet, ligne de chaîne Goal › Project › Task sur le dashboard |

## Fichiers modifiés (principaux, depuis master)

- `src/app/(app)/**` — route group + layout guard + toutes les pages
- `src/app/onboarding/page.tsx` — wizard 3 étapes
- `src/app/intelligence` → `src/app/(app)/intelligence/page.tsx`
- `src/app/api/{search,intelligence/brief,workspace/rename,billing/upgrade,auth/session}/route.ts`
- `src/app/auth/callback/route.ts`
- `src/components/{nexus-shell,task-manager,project-manager,goal-manager,notification-center,settings-panel,command-palette,toast,ui,billing-upgrade-button}.tsx`
- `src/lib/{profile,preferences}.ts`, `src/lib/intelligence/{engine,server}.ts`
- `src/app/globals.css`, `tailwind.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `package.json`
- `supabase/migrations/011…014`, `supabase/tests/*`

## Migrations créées (repo)

- 011_workspace_owner_membership.sql (P0)
- 012_onboarding_intent.sql (P1)
- 013_profile_preferences.sql (P5)
- 014_project_goal_link.sql (P7)
- 015_notification_producers.sql (P8 — en cours)

## Migrations appliquées / testées

- **AUCUNE appliquée en production depuis cette session** — `npx supabase db push` reste à
  exécuter par l'opérateur après déploiement (les migrations sont idempotentes).
- Testées statiquement : `node supabase/tests/migration-logic.test.mjs` (11 assertions).

## Tests réussis

- `node supabase/tests/auth-flow.test.mjs` — 17 assertions (P0/P1/P6 invariants)
- `node supabase/tests/migration-logic.test.mjs` — 11 assertions (011 + limites TS/SQL + idempotence triggers)
- `node --experimental-strip-types supabase/tests/intelligence-engine.test.mjs` — 17 assertions (signaux, cascade, chaîne P7)
- `npm run lint` — 0 erreur (règles React Compiler incluses)
- `npm run build` — passe (fonts auto-hébergées ; env placeholder)

## Tests échoués

- Aucun en cours. (Historique : 3 échecs corrigés pendant P0 — regex tests trop strictes.)

## Problèmes connus

1. **`npx supabase db push` non exécuté** — indispensable pour P0 (owner membership), 012, 013, 014, 015. L'app dégrade proprement sans les colonnes (sondes), mais P0 exige la migration.
2. **Test manuel navigateur non fait** (⌘K, signup complet, mobile 390px) — sandbox sans navigateur/Supabase réel. Statut : NOT VERIFIED en conditions réelles.
3. `tasks.project_id` supposé présent (plan P7) — l'app le SONDE et masque l'UI si absent.
4. Paiement (FedaPay) volontairement non branché — route 501 explicite (pas de simulation).
5. Suppression de compte + invitations membres : FUTURE DATABASE CHANGE, expliqués dans l'UI, non simulés.

## Prochaine action exacte

1. Migration 015 : `notify_workspace()` helper (dédup par notification non lue), triggers — tâche bloquée (→ projet bloqué), jalons projet 25/50/75/100 %, activité task_completed ; RPC `refresh_workspace_signals()` (retards, objectifs à risque, limite plan 80 %) appelé depuis `collectWorkspaceIntel`.
2. NotificationCenter : afficher severity + action (colonnes ajoutées, dégradation si absentes).
3. Tests migration-logic + lint + build → commit `feat(notifications)` → push.
4. **Audit final SaaS** (checklist complète), corrections, commit `chore(audit)`, push.
5. Mettre à jour ce fichier à chaque étape.
