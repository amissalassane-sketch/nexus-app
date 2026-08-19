# NEXUS — EXECUTION STATE

> Reprise automatique : lire ce fichier, puis `git status` + derniers commits.
> Branche : `arena/01a0192a-nexus-app`. Règle : commit + push après CHAQUE bloc.

## État actuel du projet

**MISSION P0 → P8 TERMINÉE + AUDIT FINAL TERMINÉ.** Tous les blocs sont commités et poussés.
Lint 0 erreur, build OK, tests 20 + 17 + 17 assertions passent.
Prochaine étape = opérateur humain : `npx supabase db push` + test manuel en production.

## Dernier bloc terminé

**AUDIT FINAL SaaS** (commit voir git log — `fix(audit)`)
Corrections issues de l'audit : middleware laisse passer `/auth/callback` (PKCE),
navigation mobile réelle (bottom nav 5 onglets, cibles ≥ 44 px), login/signup restylés
en tokens DA avec logo officiel, redirects du callback relativisés + `next` sanitisé
(pas d'open redirect).

## Bloc actuellement en cours

**Aucun — mission d'implémentation terminée.** Voir « Prochaine action exacte ».

## Blocs terminés (historique)

| Bloc | Contenu |
| --- | --- |
| Baseline | Fonts Geist auto-hébergées, `design/` exclu de tsc + eslint |
| P0 | Migration 011 (owner membership trigger + backfill + owner exempt du member limit + policy guarded), `getProfileSummary()`, layout `(app)` guard, onboarding réparateur, tests statiques |
| P1 | Onboarding 3 étapes vérifiées (identité / intention §8 / première valeur saisie), migration 012 `onboarding_intent` |
| P4 | `@config` Tailwind branché (tokens DA réellement générés), conteneur unique 1180px, 1 h1/page, cartes plan hauteur égale + CTA ancrés, prix « Free » (jamais « 0 »), note unique, disabled sobres, dropdown Create ancré + scale-in, indicateur sidebar animé, tokens motion |
| P2 | Toasts, primitives UI (motion encodée), quick-create, édition inline, UI optimiste avec rollback + toast, skeletons, stagger |
| P3 | Moteur déterministe (8 signaux, raison TOUJOURS affichée) + tests, `/intelligence`, Focus dashboard, couche LLM optionnelle (clé serveur, signaux agrégés seulement, rate-limit, dégradation propre) |
| P6 | ⌘K shell-level, bouton visible, créer ×3 + naviguer ×8 + recherche réelle + Ask NEXUS, ↑↓⏎Esc, dialog a11y, focus restitué, zéro setState-in-effect |
| P5 | Settings réels (side-nav, email/password/sessions, danger zone expliquée non simulée, rename vérifié serveur, membres réels, usage, préférences migration 013, `/auth/callback` PKCE) |
| P7 | Migration 014 `projects.goal_id`, sélecteur/filtre/badge projet sur tâche (sonde), sélecteur goal sur projet + dépliage tâches, « what advances this goal », chaîne Goal › Project › Task sur dashboard |
| P8 | Migration 015 : producers notifications (bloqué, jalons 25/50/75/100, activité complétée ; RPC refresh : retards, objectifs à risque, limite 80 % — dédupli par non-lu, membre vérifié, exception-guarded), sévérité + action dans l'inbox |
| AUDIT | middleware `/auth/callback`, bottom nav mobile, login/signup DA, callback redirects sûrs |

## Migrations créées (repo) — aucune appliquée en prod depuis cette session

011 owner membership · 012 onboarding_intent · 013 preferences jsonb · 014 projects.goal_id · 015 notification producers.
**Toutes idempotentes.** `npx supabase db push` À EXÉCUTER (les colonnes 012/013/014/015 dégradent proprement si absentes ; P0 EXIGE 011).

## Tests

- `node supabase/tests/auth-flow.test.mjs` — **20 ok** (P0/P1/P6 + audit)
- `node supabase/tests/migration-logic.test.mjs` — **17 ok** (011/015 + cohérence limites TS↔SQL + idempotence)
- `node --experimental-strip-types supabase/tests/intelligence-engine.test.mjs` — **17 ok** (signaux, cascade, chaîne P7)
- `npm run lint` — 0 erreur (React Compiler rules incluses) · `npm run build` — OK
- Smoke runtime (next start, env placeholder) : `/login` 200 + DA rendue, `/signup` 200,
  `/` `/dashboard` `/tasks` → 307 `/login`, `/auth/callback` atteint son route handler ✓

## Véracité (IMPLEMENTED / TESTED / VERIFIED / NOT VERIFIED)

- IMPLEMENTED + TESTED (statique/unit) : tout ce qui est listé ci-dessus.
- VERIFIED (runtime sandbox) : rendu des pages publiques, redirections, build, lint.
- **NOT VERIFIED (conditions réelles)** : signup complet contre Supabase réel, email de
  confirmation, ⌘K au clavier dans le navigateur, mobile 390 px, triggers 015 en base,
  rate-limits sous charge. **Aucun test navigateur/Supabase réel possible dans la sandbox.**

## Problèmes connus (assumés, non-bugs)

1. `db push` non exécuté — indispensable (surtout 011).
2. FedaPay non branché — route 501 explicite, jamais simulé.
3. Invitations membres + suppression de compte — FUTURE DATABASE CHANGE, expliqués dans l'UI.
4. `tasks.project_id` supposé présent (plan P7) — sondé, UI masquée si absent.
5. Migrations 001-010 absentes du repo (pré-existantes en prod) — 011+ les complètent sans les réécrire.

## Prochaine action exacte (opérateur)

1. Déployer la branche, puis `npx supabase db push` (011 → 015).
2. Test manuel prod avec un compte NEUF : signup → onboarding 3 étapes → dashboard
   (workspace lié, Billing usage réel, Settings → rôle owner) → créer projet/tâche/goal →
   compléter (optimiste + toast) → F5 (persistance) → ⌘K → mobile 390 px (bottom nav) →
   `/intelligence` (signaux + raisons) → notifications (retards après édition d'une date).
3. Optionnel : définir `NEXUS_AI_API_KEY` (+ `NEXUS_AI_BASE_URL`, `NEXUS_AI_MODEL`) côté
   serveur pour activer la couche LLM du brief — sans clé, texte déterministe.
