# NEXUS Intelligence — Rapport de transformation en agent opérationnel

**Branche** : `arena/01a03d08-nexus-app`
**Date** : 2026-08-26
**Périmètre** : uniquement Intelligence et les primitives nécessaires (aucun changement à l'auth, au bootstrap workspace, au RLS, au dashboard).

---

## 1. Architecture actuelle

```
User
 ↓
Intelligence UI (intelligence-ask.tsx — console conversationnelle)
 ↓
POST /api/intelligence/query
 ↓
Session + membership actifs (re-validation serveur)
 ↓
Context Builder — snapshot scopé par workspace_id (tasks, projects, goals, activities, dependencies)
 ↓
AGENT LOOP (src/lib/intelligence/agent.ts)
  1. Intent / Request Understanding   → classifyIntent (FR/EN, mémoire de session)
  2. Tool Selection                   → selectToolsForIntent (déterministe, par intention)
  3. Tool Execution (lecture)         → runReadTools sur le snapshot réel (jamais Supabase direct)
  4. Tool Calling (optionnel)         → le modèle propose des outils → le serveur valide (registry)
                                        → seuls les outils de lecture sont exécutés
  5. Planner                          → buildPlan (résumé + étapes, jamais de chaîne de raisonnement)
  6. Réponse structurée               → AI provider (OpenAI/Anthropic) ou fallback déterministe
  7. Verification                     → read-back après mutation (actions.ts)
 ↓
Réponse validée : { response, agent, intent, context, proactive }
```

Les mutations suivent un chemin totalement séparé et plus verrouillé :

```
UI → POST /api/intelligence/action
   → session → workspace → payload → mutation → audit (trigger DB) → read-back → vérification
```

## 2. Ce qui existait déjà (réutilisé, non recréé)

| Élément | Fichier |
|---|---|
| Routeur d'intentions FR/EN (`ANALYZE, PRIORITIZE, PLAN, SUMMARIZE, DETECT, SEARCH, CREATE, UPDATE, COMPLETE, MOVE, DELETE, EXPLAIN`) | `src/lib/intelligence/intent.ts` |
| Context Builder scopé + prompt compact | `src/lib/intelligence/context-builder.ts` |
| Provider IA agnostique (OpenAI / Anthropic / nexus-engine) avec timeout + fallback | `src/lib/intelligence/ai-provider.ts` |
| API query structurée + historique de session | `src/app/api/intelligence/query/route.ts` |
| API action sécurisée (validation session/workspace/payload + confirmation) | `src/app/api/intelligence/action/route.ts` |
| Couche de mutation + vérification (create/update/complete/move/delete) | `src/lib/intelligence/actions.ts` |
| Moteur déterministe : signaux, next best action, santé, briefing, prévisions, priorités, réponses | `src/lib/intelligence/engine.ts`, `advanced.ts` |
| Confirmation humaine + affichage de vérification dans l'UI | `src/components/intelligence/intelligence-ask.tsx` |
| Audit de toutes les mutations réelles (triggers `record_workspace_activity`) | `supabase/migrations/015_dependencies_and_activity.sql` |
| Proactivité (signaux « nécessitent votre attention ») | `engine.ts` + API |

## 3. Ce qui a été ajouté

### Nouveaux modules
- **`src/lib/intelligence/tools.ts`** — système d'outils explicite (registry, permissions, risque, sélection par intention, exécution de lectures réelles, validation des propositions du modèle).
- **`src/lib/intelligence/planner.ts`** — planner explicite (résumé factuel + étapes ordonnées, FR/EN).
- **`src/lib/intelligence/agent.ts`** — orchestrateur de la boucle agentique complète (déterministe + IA), validation des tool calls proposés par le modèle, trace d'exécution honnête.
- **`scripts/demo-agent-loop.ts`** — preuve fonctionnelle de la boucle complète (`npm run demo:agent`).
- **`supabase/tests/intelligence-agent-v2.test.mjs`** — 116 assertions du nouveau protocole.

### Enrichissements
- **Types** (`types.ts`) : `IntelligenceToolCall`, `IntelligencePlan`, `AgentRunResult`, `AgentState` ; champs `toolCalls`, `plan`, `confidence`, `needsConfirmation`, `sources` sur la réponse structurée.
- **Provider IA** : catalogue d'outils dans le prompt, le modèle propose `plan`/`toolCalls`/`confidence`, **retry contrôlé** (1 tentative sur erreur réseau/5xx/429, jamais sur timeout), validation stricte du JSON de sortie.
- **Routeur d'intentions** : « Mets cette tâche en urgente », « Passe-la en haute priorité », « Set this task as urgent » → UPDATE avec priorité extraite ; « Fais-moi un plan pour rattraper mes tâches en retard », « Prépare-moi pour vendredi » → PLAN ; « Et pour vendredi ? » → MOVE sur la cible de session ; « Finalement annule » → DELETE ; extraction de priorité/date (`extractPriorityFromQuery`, `extractDueDateFromQuery`).
- **Mutations** : `update_goal` et `delete_goal` implémentés et vérifiés (ajoutés au type, à la route d'action, au registry).
- **Vérification** : `workspace_id` désormais vérifié explicitement dans le read-back des créations (titre, priorité, statut, échéance, workspace).
- **API query** : renvoie `agent` (états réels, tools, plan, confidence, sources) ; le fallback client utilise désormais `runAgentDeterministic` (même protocole).
- **UI** : états agent honnêtes (pense → outils → plan → terminé), trace des outils réellement exécutés, carte « Plan recommandé », badge de confiance, workflow agent repliable.

## 4. Outils Intelligence disponibles

**Lecture (exécutés par l'agent sur le snapshot réel, jamais Supabase direct)**
`get_workspace_overview`, `get_projects`, `get_project`, `get_tasks` (filtres all/open/overdue/blocked/due_today/due_this_week/done), `get_task`, `get_goals`, `get_activity`, `get_blocked_tasks`, `get_overdue_tasks`, `get_priorities`, `search_workspace`.

**Mutation (proposition-only → `POST /api/intelligence/action`, confirmation obligatoire)**
`create_task`, `update_task`, `delete_task`, `create_project`, `update_project`, `delete_project`, `create_goal`, `update_goal`, `delete_goal`, `complete_task`, `move_task`.

**Navigation (raccourcis UI)**
`open_project`, `open_task`, `open_tasks`, `open_intelligence`, `open_activity`.

## 5. Actions réellement exécutables

| Action | Risque | Confirmation | Vérification après coup |
|---|---|---|---|
| create_task / create_project / create_goal | low | requise | oui (existence, champs, workspace_id) |
| update_task / update_project / update_goal | medium | requise | oui |
| complete_task / move_task | low | requise | oui (statut + completed_at / due_at) |
| delete_task / delete_project / delete_goal | high | obligatoire + `confirmDeletion` | oui (ligne absente) |

Chaque mutation est ré-scopée au workspace actif, re-validée (id résolu par lecture scopée), audité par trigger DB, puis relue avant d'annoncer le succès.

## 6. Sécurité

- Le modèle **propose** (intent, plan, tool calls, arguments) ; le **serveur décide** (permissions, validation, exécution, confirmation).
- Aucune clé API côté client (`.env.local` uniquement, jamais `NEXT_PUBLIC_` pour les clés IA).
- L'agent n'importe jamais Supabase : il consomme un snapshot déjà scopé par `workspace_id` (testé statiquement + par isolation).
- Le modèle ne peut pas proposer de SQL ; les tool calls inconnus ou de mutation sont rejetés (trace « skipped »).
- Chaque id client est re-résolu par une lecture `.eq("workspace_id", …)` avant mutation (testé : tâche d'un autre workspace impossible à muter).
- Suppression : double confirmation (`confirmed` + `confirmDeletion`) exigée côté serveur.
- Timeouts bornés (AbortController, 10 s par défaut), retry contrôlé, fallback déterministe systématique.

## 7. Workflow agentique (la boucle)

Démo complète : **`npm run demo:agent`**

```
👤 « Organise ma journée et dis-moi ce que je dois faire en priorité. »

🤖 INTELLIGENCE
   • Analyse de votre workspace réel
   • Consultation de 7 outils : get_workspace_overview, get_overdue_tasks,
     get_blocked_tasks, get_tasks, get_priorities, get_projects
   • Préparation du plan
   • Réponse prête

   INTENTION : PLAN · CONFIDENCE : 95%
   RÉPONSE : Operational schedule for today
   📋 PLAN : J'ai analysé 3 projets et 4 tâches ouvertes. Voici le plan que je recommande.
     1. Éliminer la dette de retard — “Fix API integration”
     2. Débloquer le travail
     3. Protéger les échéances du jour — “Finish homepage”
     4. Avancer les jalons de la semaine

   ACTIONS PROPOSÉES : create_task “Préparer la présentation” (confirmation humaine requise)
   EXÉCUTION (action serveur) : ✓ Task “Préparer la présentation” created and verified
   VÉRIFICATION : ✓ existence · title, priority, status, due_at, workspace_id
   ✅ CONFIRMATION : Tâche créée avec succès et vérifiée.
   🔁 BOUCLE FERMÉE : la tâche créée apparaît dans la nouvelle analyse des priorités.
```

## 8. Tests exécutés

| Suite | Contenu | Résultat |
|---|---|---|
| `npm run test:intelligence-agent` (v1) | intentions FR/EN, mémoire, mutations + vérification, isolation, timeout, fallback, mobile | 57 / 57 ✅ |
| `npm run test:intelligence-agent-v2` (nouveau) | registry d'outils, sélection par intention, exécution de lectures réelles, validation des propositions du modèle, planner, scénarios A–H complets, mémoire (« Mets-la en urgente », « Et pour vendredi », « Finalement annule »), multi-step tool calling, fallback, timeout, échec provider, retry, échec de vérification, isolation workspace, RLS, invariants sécurité, mobile | 116 / 116 ✅ |
| `npm run test:intelligence` | 6 capacités, synonymes, dépendances | 70 / 70 ✅ |
| `npm run test:onboarding` | parcours onboarding | 37 / 37 ✅ |
| `tsc --noEmit` | typage strict | ✅ |
| `eslint` | 0 erreur, 0 warning | ✅ |
| `next build` | build de production complet (41 pages) | ✅ |

## 9. Résultats

- La boucle complète exigée (analyser → lire → raisonner → planifier → proposer → exécuter → vérifier → confirmer) est implémentée et démontrée par `npm run demo:agent`.
- Aucune donnée inventée : chaque affirmation de réponse provient d'un outil de lecture réel ; chaque mutation passe par la couche serveur et est relue avant confirmation.
- Le fallback déterministe reste pleinement fonctionnel sans clé IA (c'est le chemin par défaut de la démo et des tests).

## 10. Variables d'environnement nécessaires

```
# Optionnel — sans ces clés, NEXUS utilise le moteur déterministe (jamais indisponible).
OPENAI_API_KEY=sk-...            # ou
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_MODEL=gpt-4o-mini         # optionnel (défaut)
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # optionnel (défaut)
```
Ces clés doivent rester côté serveur (jamais `NEXT_PUBLIC_`).

## 11. Limites restantes

- **Pas de Supabase live dans ce sandbox** : les routes API renvoient 503 sans `.env.local` ; la preuve fonctionnelle est exécutée au niveau moteur/agent avec un fake DB au même contrat (RLS simulé par scoping workspace_id). Les tests RLS réels existent déjà (`onboarding-rls.test.mjs`).
- **Tool calling multi-tours borné** : le modèle peut proposer des outils supplémentaires sur un second tour (validés et exécutés), mais pas une boucle de N itérations ouvertes — par conception (fiabilité, timeouts).
- **Mémoire de session** : côté client (sessionHistory) + résolution référentielle serveur ; pas de persistance inter-onglets.
- **Test `migration-logic.test.mjs`** pré-existant : nécessite `@electric-sql/pglite` absent de `package.json` (non lié à ce travail).
- L'audit des mutations repose sur les triggers DB existants (migration 015), pas sur une insertion applicative.

## 12. Prochaine étape recommandée

1. **Brancher un vrai projet Supabase** (`.env.local`) et valider A→Z via l'UI : requête → plan → confirmation → mutation → vérification, en live.
2. **Étendre la mémoire de session côté serveur** (store léger par session, TTL), pour les références multi-tours plus riches (« celle d'avant-hier »).
3. **Activer le tool-calling natif** (`tools` + `tool_calls` OpenAI, `tools` Anthropic) en gardant la validation serveur actuelle comme porte d'entrée unique.
4. **Notifications proactives** : envoyer les signaux « nécessitent votre attention » sur les canaux existants (notifications) quand la détection dépasse un seuil.
