# NEXUS Intelligence — Phase 3 : Proactivité & Signal Engine (rapport final)

**Branche** : `arena/01a03d08-nexus-app` · **Date** : 2026-08-26
**Périmètre** : uniquement la proactivité d'INTELLIGENCE. Auth, bootstrap workspace, RLS existant, dashboard, navigation, onboarding : intacts.

---

## 1. Audit initial (ce qui existait réellement)

| Élément | Constat réel (vérifié dans le code) |
|---|---|
| `computeInsights()` (engine.ts) | Produit des `Insight[]` déterministes (overdue, blocked, deadline, due-today, projets vides/inactifs, momentum) avec `evidence`/`entity`/`href` — **sans fingerprints, cycle de vie, persistance, cooldown ni scoring expliqué**. |
| `weeklyBriefing`, `workspaceHealth`, `rankPriorities`, `nextBestAction` (advanced.ts) | Réutilisés pour vélocité, santé et priorités — pas de doublons créés. |
| Mémoire Phase 2 (`intelligence_memory`, `memory.ts`, `references.ts`) | Persistée par (user, workspace) ; resolver d'ordinaux/pronoms/suffixes verbaux ; focus mémoire manquant pour les signaux. |
| Couche mutation (`actions.ts`, `/api/intelligence/action`) | Mutations sécurisées + read-back + vérification — réutilisée telle quelle pour les actions des signaux. |
| Tables | `tasks` (status/priority/due_at/completed_at/project_id/timestamps), `projects` (status/due_date/progress/**goal_id**/timestamps), `goals` (progress/target_date), `activities` (triggers), `task_dependencies` (task_id → depends_on_task_id). |
| Notifications | Table `notifications` + `notification-center.tsx` existent mais sans fingerprint/cooldown/lifecycle — la spec autorise une table dédiée pour les signaux. |
| UI proactive | Petit bloc client top-3 non persisté dans `intelligence-ask.tsx` ; `IntelligenceView` avec queue d'insights. Aucun test ne dépend de ce bloc. |
| API | Route `POST /api/intelligence/signals` (refresh/markSeen/dismiss/resolve) — **pas de GET**, pas d'action `focus` (mémoire), pas de signal GOAL. |

**Ce qui manquait** : `GET /api/intelligence/signals`, action `focus` (mémoire + signaux), signal `GOAL_AT_RISK`, intégration des signaux dans le contexte agent (prompt + observabilité), compréhension « Débloque-la », tests nommés `intelligence-proactive.test.mjs`, démo `demo-proactive.ts`, tests API injectables.

**Risques identifiés** : (1) `created_at` des signaux non explicitement persisté → le cooldown/lifetime se basait sur l'heure de lecture (bug réel trouvé et corrigé) ; (2) le fallback `reasonWorkspaceCore` ne capturait pas « Qu'est-ce que je dois faire maintenant ? » (spec §15) ; (3) « Ouvre-la » ne résolvait pas la cible mémoire dans la branche SEARCH.

**Plan minimal** : corriger le bug `created_at` → ajouter GOAL_AT_RISK + `goal_id` aux SELECT → GET + action focus → intégration agent (signaux → contexte/trace) → « Débloque-la » / « Ouvre-la » → tests dédiés + API testable → démo de bout en bout.

## 2. Architecture retenue

```
DATA RÉELLE (1 snapshot : tasks, projects, goals, activities, dependencies)
   ↓
DÉTECTION DÉTERMINISTE (signals.ts — 9 catégories, evidence-grounded)
   ↓
SIGNAL VÉRIFIÉ + SCORING EXPLICABLE (sévérité + échéance + impact + blocage, 0–100)
   ↓
FINGERPRINT + DÉDUPLICATION (type + entity id)
   ↓
COOLDOWN (constantes centralisées ; aggravation ré-alerte)
   ↓
PERSISTANCE (intelligence_signals, RLS user×workspace)
   ↓
getProactiveIntelligence → signaux actifs (règles de silence)
   ↓
IA POUR EXPLICATION SI UTILE (reformulation bornée, fallback déterministe)
   ↓
UI « Needs your attention » → focus mémoire (« Pourquoi ? », « Débloque-la »)
   ↓
CONFIRMATION → ACTION SERVEUR → READ-BACK → RECALCUL → SIGNAL RÉSOLU
```

## 3. Fichiers créés (cette itération)

- `src/lib/intelligence/signal-api.ts` — cœur de l'API signals injectable (401/400/200/404 testables).
- `supabase/tests/intelligence-proactive.test.mjs` — suite dédiée (47 assertions).
- `scripts/demo-proactive.ts` — démo de bout en bout (`npm run demo:proactive`).
- (déjà présents du tour précédent, réutilisés : `signals.ts`, `signal-store.ts`, `proactive-signals-panel.tsx`, migration `024`, route `signals/`, `intelligence-signals.test.mjs`, `demo-signals.ts`).

## 4. Fichiers modifiés (cette itération)

- `src/lib/intelligence/signals.ts` — ajout du signal **GOAL_AT_RISK** (honnêteté : pas de signal sans `target_date` ET sans pression de projets liés).
- `src/lib/intelligence/signal-store.ts` — **bug corrigé** : `created_at` explicitement persisté (le cooldown/lifetime en dépend).
- `src/lib/intelligence/signal-api.ts` (nouveau) + `src/app/api/intelligence/signals/route.ts` (rewrite wrapper) — **GET** = refresh, POST : refresh/markSeen/dismiss/resolve/**focus** (pointe la mémoire Phase 2 sur l'entité du signal).
- `src/lib/intelligence/memory.ts` — `focusMemoryOnEntity` (helper pur).
- `src/lib/intelligence/agent.ts` + `ai-provider.ts` + `types.ts` — `AgentInput.signals` : les signaux actifs alimentent le prompt IA ; trace `agent.signals` (count, top, usedAsContext).
- `src/app/api/intelligence/query/route.ts` — charge les signaux actifs persistés (léger, sans recalcul par requête) et les passe à l'agent.
- `src/lib/intelligence/intent.ts` + `advanced.ts` — « débloque/débloquer/unblock/deblock » → UPDATE `status: in_progress` ; « ouvre/open/affiche/montre » → SEARCH avec cible résolue ; PRIORISATION élargie (« je dois faire », « what should i do », « what is next ») pour « Qu'est-ce que je dois faire maintenant ? ».
- `src/components/intelligence/proactive-signals-panel.tsx` — envoi `focus` à l'ouverture des preuves (intégration mémoire).
- `src/app/api/intelligence/query/route.ts` + `signals/route.ts` — `goal_id` ajouté aux SELECT projets.
- `package.json` — scripts `test:intelligence-proactive`, `demo:proactive` ; `test:agent` étendu.

## 5. Types de signaux implémentés (9)

| Type | Détection (preuves réelles) | Sévérité |
|---|---|---|
| `TASK_OVERDUE` | tâche ouverte, `due_at` passé (jours de retard, priorité, projet) | critical |
| `TASK_DUE_SOON` | ouverte, due ≤48h (aujourd'hui/demain) | warning (≤24h) / attention (24–48h) |
| `BLOCKED_WORK` | statut blocked + dépendances réelles (`task_dependencies`) | critical si bloque d'autres tâches, sinon warning |
| `PROJECT_AT_RISK` | ≥2 facteurs : retard, bloquées, échéance ≤7j, inactivité ≥7j, progression faible | critical (≥4 facteurs) / warning (3) / attention (2) |
| `PROJECT_STALE` | ouvert avec tâches ouvertes, sans activité ≥7j (formulation prudente « activité faible ») | attention |
| `PRIORITY_CONFLICT` | ≥3 urgentes simultanées, urgentes sans date, ≥4 dues aujourd'hui (recommandation dérivée : débloquer la tâche bloquante) | critical / warning |
| `DEADLINE_RISK` | échéance projet ≤3j + tâches ouvertes (preuves : nombre, progression) | critical (0j) / warning (1j) / attention |
| `GOAL_AT_RISK` | objectif avec `target_date` : échéance ≤7j + progression <40%, ou projets liés (`goal_id`) en retard/bloqués — **jamais sans données suffisantes** | warning / attention |
| `POSITIVE_PROGRESS` | ≥5 terminées cette semaine, ou vélocité >1,5× semaine précédente | info |

## 6. Règles de scoring (déterministes, explicables)

`score = Σ facteurs`, borné 0–100, chaque facteur documenté dans `scoreBreakdown` :
- **sévérité** : info 10 / attention 25 / warning 45 / critical 65
- **échéance** : aujourd'hui +25, demain +18, 2j +12, 3j +8
- **retard** : +3/jour (plafond 20)
- **impact** : +8/entité affectée (plafond 25) ; **blocage** : +15 si la tâche bloque d'autres
- **stagnation** : +8 (≥7j), +14 (≥14j) ; **conflit** : +4/élément en excès
- Le LLM ne décide jamais de l'existence ni de la gravité — il ne fait que reformuler.

## 7. Déduplication

Fingerprint `TYPE:entityId` (ex. `BLOCKED_WORK:t2`). Le même état → aucun doublon (testé). Nouvelle entité → nouveau fingerprint. Un changement d'état réel (sévérité aggravée, preuves modifiées) rafraîchit la ligne. Les problèmes liés restent des cartes distinctes mais cohérentes (une tâche en retard dans un projet à risque produit 2 signaux différents — c'est voulu : deux informations différentes, pas du spam).

## 8. API

- **`GET /api/intelligence/signals`** : session → workspace actif → snapshot réel → engine → priorisation → dédup → cooldown → `{ signals[], attentionCount, criticalCount, refreshedAt, llmEnriched }` (signaux triés par score décroissant).
- **`POST /api/intelligence/signals`** : `refresh` (idem GET), `markSeen` (new→seen), `dismiss` (→dismissed, ≠resolved), `resolve` (→resolved), `focus` (pointe la mémoire Phase 2 sur l'entité du signal).
- Isolation : chaque requête est scopée `(workspace_id, user_id)` ; un id d'un autre workspace → 404 (testé). Le client ne touche jamais la table.

## 9. Intégration Agent

- La route query charge les **signaux actifs persistés** (top 5, lecture seule, sans recalcul par requête — performance §25) et les passe à `runAgent` → bloc `CURRENT PROACTIVE SIGNALS` dans le prompt IA.
- Trace `agent.signals` : `{ count, top: [fingerprints], usedAsContext }` — observabilité sans chaîne de raisonnement.
- « Qu'est-ce que je dois faire maintenant ? » → PRIORISATION (branch élargie) : réponse opérationnelle ancrée dans les données.

## 10. Intégration mémoire (Phase 2)

- Ouvrir les preuves d'un signal dans l'UI envoie `focus` → `focusMemoryOnEntity` → `lastTarget` = entité du signal.
- « Pourquoi ? » conserve la cible du signal (EXPLAIN/why résolu) ; « Débloque-la » résout la bonne entité et propose `update_task status: in_progress` (confirmation requise) ; référence ambiguë → clarification (testé).
- Après mutation vérifiée : `markSignalActed` → recalcul → fingerprint disparu → `resolved` (jamais `dismissed`).

## 11. UI

Section « Needs your attention » en tête de la vue Intelligence : cartes sévérité (Critique/Élevé/Moyen/Info), titre, résumé factuel, bouton « Pourquoi ? » (evidence + décomposition du score), actions (liens de navigation réels + mutations confirmation-gated via `/api/intelligence/action`), lifecycle auto (new→seen à l'affichage), règle de silence (rien à signaler → panneau masqué), ≥44px tactiles, aucune dépendance au hover.

## 12. Sécurité

- Le LLM ne détecte pas : la détection est 100 % déterministe sur le snapshot réel.
- Les mutations des signaux passent exclusivement par `/api/intelligence/action` (session → workspace → payload → mutation → read-back → vérification) ; confirmation humaine obligatoire ; aucune suppression automatique.
- RLS `intelligence_signals` : owner + membre actif du workspace ; les données persistées sont structurées (evidence, score_breakdown, suggested_actions), jamais du texte modèle brut.
- Isolation prouvée par tests (workspace A vs B, suppression cross-workspace → 404/refus).

## 13. Tests (chiffres réels, exécutés)

| Suite | Résultat |
|---|---|
| `test:intelligence-signals` (77) | ✅ |
| `test:intelligence-proactive` (**nouvelle**, 47) | ✅ |
| `test:intelligence-agent` (57) · `test:intelligence-agent-v2` (116) | ✅ |
| `test:intelligence-memory` (115) · `test:intelligence` (70) | ✅ |
| `test:onboarding` (37, non-régression) | ✅ |
| **Total** | **482 assertions vertes** |
| `tsc --noEmit` · `eslint` | ✅ 0 erreur / 0 warning |
| `next build` | ✅ (42 pages) |

Couverture du nouveau fichier : détection (9 catégories dont GOAL honnête), priorisation (critical→warning→info, score = Σ facteurs, borné), dédup (0 doublon), actualisation après mutation (présent → exécution vérifiée → résolu), isolation, mémoire+signaux (focus, « Pourquoi ? », « Débloque-la », ambigu → clarification), API (401 sans session, 400 sans workspace, réponse structurée triée, 404 cross-workspace), agent (signaux en contexte + trace).

## 14. Démo (`npm run demo:proactive`)

```
Workspace : 1 tâche en retard · 1 tâche bloquée (bloque 2 autres) · 1 projet à risque · 4 urgentes aujourd'hui
Signals detected: 11
1. CRITICAL  « Payment API » bloque 2 tâches   — Evidence: Bloque 2 tâche(s) · Projet Refonte du site
2. CRITICAL  « Présentation client » est en retard — Evidence: En retard de 3 jours · Priorité urgent
3. WARNING   « Refonte du site » a besoin d'attention — Evidence: 1 en retard · 1 bloquée · Échéance dans 2j
4. CRITICAL  Conflit de priorités — Evidence: 5 urgentes simultanées

User: "Why is Payment API critical?"   → résout la cible (t2) → preuves réelles → explication
User: "Ouvre-la"                        → open_task réel (t2)
User: "Débloque-la"                     → propose in_progress → confirmation → exécution serveur
                                          → read-back vérifié (status, completed_at) → recalcul
Payment API blocked signal: RESOLVED
```

## 15. Ce qui a réellement été vérifié

- Détection/score/dédup/cooldown/lifecycle : exécutés via les 124 assertions des 2 suites signaux + les 4 démos.
- Boucle fermée complète : détection → classement → explication → action → confirmation → exécution → read-back → recalcul → résolution (démo `demo-proactive` et `demo-signals`).
- API contract (401/400/200/404) : testé au niveau du handler injectable (`signal-api.ts`).
- Bug `created_at` identifié par échec de test, corrigé, re-testé.
- Lint, TSC, build, 482 + 37 assertions.

## 16. Ce qui n'a pas pu être vérifié

- **Aucune base Supabase réelle** dans ce sandbox : la migration `024` n'a pas été appliquée à Postgres live ; `GET/POST /api/intelligence/signals` répondent 503 sans `.env.local` (comportement attendu, wrapper testé à travers `handleSignalsRequest`). Le comportement RLS de `intelligence_signals` suit le pattern exact des tables existantes mais n'est pas exercé contre Postgres réel.
- Le panneau React n'a pas été rendu dans un navigateur avec session (page protégée → 307) ; les interactions sont couvertes par le code et les invariants (≥44px, pas de hover).
- Tests pré-existants `onboarding-rls` / `migration-logic` : nécessitent `@electric-sql/pglite` absent de `package.json` (hors périmètre, non lié).

## 17. Limites restantes

- Le recalcul complet des signaux se déclenche à l'ouverture d'Intelligence et après mutation (via l'UI) — pas de polling serveur automatique (choix performance, spec §13 « éventuellement »).
- GOAL_AT_RISK dépend de `projects.goal_id` : les lignes créées avant la migration 013 n'ont pas de lien goal → pas de signal (honnêteté conservée).
- L'enrichissement LLM des signaux est optionnel et borné (3 premiers, timeout 8 s, fallback déterministe) — non activé par défaut dans l'UI.
- Le signal `acted` n'est pas automatiquement converti en `resolved` sans un recalcul (l'UI déclenche le refresh après action).

## 18. Commit créé

`git commit` (sur `arena/01a03d08-nexus-app`) — Phase 3 complète : signal engine, GET/focus API, intégration agent+mémoire, tests dédiés, démo de bout en bout. (Voir le message de commit détaillé.)
