# NEXUS Intelligence — Phase 4 : Mission Engine / Orchestration multi-étapes

**Branche** : `arena/01a03d08-nexus-app` · **Date** : 2026-08-26
**Périmètre** : uniquement Intelligence. Auth, bootstrap workspace, RLS existant, dashboard, onboarding : intacts.

---

## 1. Audit initial (ce qui existait réellement)

| Élément | Constat vérifié dans le code |
|---|---|
| `planner.ts` | Produit des plans **statiques** (`IntelligencePlan` : étapes de recommandation sans statut). Aucun état par étape, aucune dépendance, aucune progression, aucune persistance. |
| `actions.ts` (`executeIntelligenceAction`) | Mutations sécurisées + read-back + vérification — **réutilisé tel quel** comme socle de véracité. |
| `memory.ts` / `intelligence_memory` (023) | Mémoire persistée par (user, workspace) ; `lastPlan` sans référence mission. |
| `signals.ts` / `signal-store.ts` / `intelligence_signals` (024) | Signaux persistés + recompute déterministe — réutilisés pour le lien signal ↔ mission. |
| `agent.ts`, `intent.ts`, `references.ts`, `tools.ts` | Boucle bornée, résolution de références, outils — réutilisés (l'agent reçoit désormais la mission en contexte). |
| Routes | `query` (agent), `action` (mutations + vérification), `signals` (GET/POST + focus mémoire). |
| Baseline | 482 assertions vertes + 37 onboarding avant modification. |

**Ce qui manquait réellement** : types Mission/Step/Context/NextBestAction, moteur de mission (décomposition vérifiable, dépendances, recompute déterministe, nextBestAction, boucle bornée), persistance + RLS, API missions, UI mission panel, tests dédiés, démo.

## 2. Architecture retenue

```
UNDERSTAND (détection « Prépare-moi pour… » + keyword + échéance)
   ↓
LOAD CONTEXT (snapshot réel + entités liées réelles + signaux actifs)
   ↓
DECOMPOSE (5 étapes, completionRule déterministe par étape)
   ↓
PLAN (dépendances entre étapes)
   ↓
VALIDATE / EVALUATE (recomputeMission : statuts depuis le snapshot réel)
   ↓
EXECUTE (nextBestAction → confirmation humaine → mutation serveur)
   ↓
VERIFY (read-back) → étape completed (uniquement ici) / failed
   ↓
UPDATE MISSION (persistance + mémoire lastMissionId)
   ↓
RE-EVALUATE (runMissionLoop, borné à 8 itérations)
```

Le serveur est l'autorité : le LLM propose, le serveur valide, et **une étape n'est `completed` que si sa règle déterministe est satisfaite par le snapshot réel ou par un read-back vérifié**.

## 3. Fichiers créés

- `src/lib/intelligence/mission.ts` — moteur de mission : détection, extraction keyword/échéance, `findRelatedEntities` (ids réels uniquement), `decomposeMission` (5 étapes + règles), `recomputeMission` (statuts/progression/currentStep/nextBestAction depuis données réelles), `runMissionLoop` (borné à `MISSION_LOOP_MAX_ITERATIONS = 8`), `applyVerifiedActionToStep`, persistance (`saveMission`/`readMission`/`readActiveMissions`/`cancelMission`/`recomputeWorkspaceMissions`).
- `src/app/api/intelligence/missions/route.ts` — API missions (GET + POST create/status/continue/confirmStep/cancel/recompute).
- `src/components/intelligence/mission-panel.tsx` — UI mission (progression, étapes, prochaine action, Continuer/Débloquer/Annuler, ≥44px).
- `supabase/migrations/025_intelligence_missions.sql` — table + RLS.
- `supabase/tests/intelligence-mission.test.mjs` — 64 assertions.
- `scripts/demo-mission.ts` — démo de bout en bout.
- `MISSION_PHASE4_REPORT.md` — ce rapport.

## 4. Fichiers modifiés

- `src/lib/intelligence/types.ts` — types Mission/Step/Context/NextBestAction + `lastMissionId` dans `IntelligenceMemoryState`.
- `src/lib/intelligence/agent.ts` + `ai-provider.ts` — `AgentInput.mission` → bloc mission dans le prompt IA.
- `src/app/api/intelligence/query/route.ts` — détection mission (« prépare-moi… » → création) ; reprise (« où en est… », « et maintenant… » → mission active via `memory.lastMissionId`) ; la mission est renvoyée dans la réponse et passée à l'agent.
- `src/app/api/intelligence/action/route.ts` — `missionId`+`missionStepId` : après mutation **vérifiée**, l'étape passe `completed` (ou `failed` sur échec) + re-évaluation + persistance.
- `src/components/intelligence/intelligence-view.tsx` — `MissionPanel` en tête de la vue.
- `package.json` — `test:intelligence-mission`, `demo:mission`, `test:agent` étendu.

## 5. Migrations

**`025_intelligence_missions.sql`** : `intelligence_missions` (id text PK, user_id, workspace_id, title, objective, kind, status checké, progress, current_step_id, steps jsonb, context jsonb, next_best_action jsonb, timestamps) + index workspace et (user,status) + **RLS complète** (owner + membre actif). Les étapes/contextes sont du JSON structuré et traçable — jamais du texte modèle comme vérité.

## 6. APIs

- **`GET /api/intelligence/missions`** → missions actives du workspace (triées par `updated_at` desc, max 5).
- **`POST /api/intelligence/missions`** :
  - `{ action: "create", query }` → détecte, décompose, évalue, persiste, lie `memory.lastMissionId`.
  - `{ action: "status", id }` → re-évalue (boucle bornée) et retourne la mission.
  - `{ action: "continue", id }` → idem (prochaine action dispo dans `mission.nextBestAction`).
  - `{ action: "confirmStep", id, stepId }` → exécute l'action de l'étape via `executeIntelligenceAction` (confirmation + read-back) → étape `completed`/`failed` → re-évaluation → persistance.
  - `{ action: "cancel", id }` → mission `cancelled`.
  - `{ action: "recompute" }` → re-évalue toutes les missions actives.
- Sécurité : session + membership re-validés ; chaque lecture/écriture scopée `(workspace_id, user_id)` ; id forgé → 404.

## 7. Types

`IntelligenceMission` (id, userId, workspaceId, title, objective, kind, status, progress, currentStepId, steps, context, nextBestAction, timestamps), `MissionStep` (id, title, description, status, order, dependencies, completionRule, targetEntity, action, verification, blockedReason, timestamps), `MissionStepStatus` (planned/ready/in_progress/blocked/waiting/completed/failed/cancelled), `MissionContext` (relatedTaskIds, relatedProjectIds, keyword, deadline, blockerLabels, blockerTaskIds, signals), `MissionNextBestAction` (stepId, label, reason, kind, action, href). + `lastMissionId` dans la mémoire Phase 2.

## 8. Orchestration

`detectMissionRequest` → `createMissionObject` → `runMissionLoop` (recompute itératif borné à 8 itérations, stable) → `applyVerifiedActionToStep` après mutation → re-boucle. La route query crée la mission pour « prépare-moi… » et reprend `memory.lastMissionId` pour « où en est… » / « et maintenant… ». La route action met à jour l'étape ciblée uniquement après le read-back serveur.

## 9. Gestion des dépendances

Une étape devient `waiting` si une dépendance n'est pas `completed`, `blocked` si une dépendance est `blocked`/`failed`, et `ready` seulement quand toutes ses dépendances sont satisfaites. Quand un blocage disparaît (tâche débloquée), l'étape redevient `ready` au recompute (statut toujours reflet de la réalité).

## 10. NextBestAction

Déterministe : première étape `ready` avec action (mutate → confirmation requise ; navigate → lien réel). Si une étape est `blocked` avec une tâche liée réellement bloquée → propose `update_task status: in_progress` sur cette tâche (« Débloquer la tâche »). Si la mission est `completed` → `null`.

## 11. Mémoire

`memory.lastMissionId` persiste le lien mission ↔ conversation. « Où en est ma présentation ? » retrouve la mission, la ré-évalue et la renvoie. « Et maintenant ? » utilise l'état mis à jour. Aucune deuxième mémoire concurrente : la mission vit dans sa table, la mémoire Phase 2 référence son id.

## 12. Signaux

`recomputeMission` reçoit les signaux actifs : un signal critical/warning touchant une entité de la mission bloque l'étape concernée (« Signal actif : … ») et alimente `mission.context.signals`. Le signal résolu → mission re-évaluée. La route action re-évalue la mission après mutation (avec les signaux frais).

## 13. UI

`MissionPanel` en tête d'Intelligence : titre, objectif, barre de progression, étapes avec icônes de statut + raison de blocage, prochaine action avec bouton « Continuer » (ou « Débloquer » si bloquée), annulation, confirmation des mutations via `/api/intelligence/action` (read-back affiché). Tactile (≥44px), responsive, aucune dépendance au hover.

## 14. Sécurité

- Le LLM ne déclare jamais une étape `completed` : seules la règle déterministe (état réel) ou une mutation vérifiée (read-back) le font.
- Les mutations passent exclusivement par `executeIntelligenceAction` (session → workspace → payload → mutation → read-back → vérification) ; confirmation humaine obligatoire ; actions destructives → `confirmDeletion`.
- RLS stricte par (user, workspace) ; ids forgés → 404 ; isolation prouvée par tests.
- Boucle bornée (8 itérations max) — aucune exécution infinie.

## 15. Tests (réellement exécutés)

| Suite | Résultat |
|---|---|
| `test:intelligence-mission` (**nouvelle**, 64) | ✅ |
| `test:intelligence-proactive` (47) · `test:intelligence-signals` (77) | ✅ |
| `test:intelligence-memory` (115) · `test:intelligence-agent-v2` (116) · `test:intelligence-agent` (57) · `test:intelligence` (70) | ✅ |
| `test:onboarding` (37) | ✅ |
| **Total** | **583 assertions vertes** |
| `tsc --noEmit` · `eslint` | ✅ 0 erreur / 0 warning |
| `next build` | ✅ (43 pages) |

Couverture du nouveau fichier (23 points de la spec) : création, décomposition (5 étapes, ordre), dépendances, progression (0→100), nextBestAction, étape blocked (tâche liée bloquée), waiting, completed après read-back, mutation échouée → failed, mission failed, mission cancelled, reprise après refresh, isolation workspace A/B + user A/B, id forgé, signal modifiant une mission, mémoire Phase 2 compatible, signal Phase 3 compatible, action confirmation-gated, action destructive, boucle bornée, absence d'hallucination (aucun id inventé), scénario complet multi-étapes.

## 16. Démo (`npm run demo:mission`)

```
👤 « Prépare-moi pour ma présentation de vendredi. »
🤖 UNDERSTAND → keyword: presentation · échéance: vendredi (2026-08-28)
   Tâches liées (réelles) : Préparer la présentation · Finaliser les slides de la présentation
   Blocages détectés : Finaliser les slides de la présentation
📋 PLAN — mission créée et évaluée : 40% (blocked)
   ✓ Identifier les tâches existantes · ⚠ Vérifier les blocages (tâche liée bloquée)
   ✓ Vérifier les échéances · ⚠ Construire le plan · ⚠ Exécuter le travail lié
🤖 NEXT BEST ACTION : Débloquer « Finaliser les slides de la présentation »
👤 Confirmation → EXECUTE → Task updated and verified → VERIFY: status, completed_at (OK)
🔄 MISSION RÉÉVALUÉE : 80% (active) — 4 étapes ✓, ● Exécuter le travail lié [ready]
🤖 NEXT BEST ACTION : Terminer « Préparer la présentation »
👤 Confirmation → EXECUTE → completed and verified → VERIFY (OK)
✅ MISSION RÉÉVALUÉE : 100% (completed) — toutes les étapes ✓
🔄 REPRISE APRÈS REFRESH : mission retrouvée (completed, 100%).
```

## 17. Limites réelles

**VERIFIED** : tout ce qui précède a été exécuté dans le sandbox (tests, démos, lint, TSC, build).

**NOT VERIFIED** :
- **Aucune base Supabase réelle** : la migration `025` n'a pas été appliquée à Postgres live ; les routes missions répondent 503 sans `.env.local` (comportement attendu). Le comportement RLS suit le pattern exact des tables 023/024 mais n'est pas exercé contre Postgres réel.
- Le `MissionPanel` React n'a pas été rendu dans un navigateur avec session (page protégée → 307) ; interactions couvertes par le code et les invariants mobiles.
- Tests pré-existants `onboarding-rls` / `migration-logic` : nécessitent `@electric-sql/pglite` absent (hors périmètre).
- La décomposition est déterministe (motifs FR/EN) ; une décomposition LLM optionnelle (proposée par le modèle, validée par le serveur) n'est pas activée — le serveur reste l'autorité dans les deux cas.

## 18. Commit

Voir `git log` — commits Phase 4 (`feat(intelligence): Phase 4 — mission engine…`) après restauration des Phases 1-3 dans l'historique de la branche (le dépôt avait été re-cloné à `cd44e28` ; tout le travail des Phases 1-3 était présent dans l'arbre et a été re-committé avant la Phase 4).
