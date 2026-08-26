# NEXUS Intelligence — Phase 2 : Mémoire & Compréhension Contextuelle

**Branche** : `arena/01a03d08-nexus-app` · **Date** : 2026-08-26
**Périmètre** : uniquement Intelligence et ses primitives. Auth, bootstrap workspace, RLS, dashboard : intacts.

---

## 1. Fichiers modifiés

### Nouveaux
| Fichier | Rôle |
|---|---|
| `src/lib/intelligence/memory.ts` | Mémoire de travail structurée : état court (lastItems ordonnés, lastTarget, lastAction proposée/exécutée/échouée, pendingConfirmation, ids supprimés), préférences persistantes explicites, persistance Supabase (read/save), reconstruction d'historique après refresh, mises à jour pures après tour / mutation. |
| `src/lib/intelligence/references.ts` | Resolver de références naturelles : ordinaux (« la deuxième »), pronoms (« celle-ci », « cette tâche-là »), « précédent », suffixes verbaux (« reporte-la », « mets-la en urgente »), « pareil », « pourquoi ? », « celui de vendredi » — avec garde anti-hallucination (ambigu → clarification, supprimé → « n'existe plus »). |
| `supabase/migrations/023_intelligence_memory.sql` | Table `intelligence_memory` (une ligne par user×workspace), RLS complète. |
| `supabase/tests/intelligence-memory.test.mjs` | 115 assertions Phase 2. |
| `scripts/demo-memory-scenario.ts` | Preuve fonctionnelle du scénario de fin de phase (`npm run demo:memory`). |

### Modifiés
| Fichier | Changement |
|---|---|
| `src/lib/intelligence/types.ts` | Types mémoire (`IntelligenceMemoryState`, `MemoryEntityRef`, `IntelligencePreference`, `ReferenceResolution`, `MemoryTrace`) ; `AgentRunResult.memory`. |
| `src/lib/intelligence/agent.ts` | Intégration mémoire dans la boucle : `resolveAgentContext` (résolution → historique effectif → early-exits clarification/supprimé/répétition), `buildEffectiveHistory` (refresh/autre onglet), `memoryFromSessionHistory` (fallback client), trace `agent.memory`. |
| `src/lib/intelligence/intent.ts` | `resolvedTarget` optionnel dans `classifyIntent` (priorité sur la cible mémoire pour les intentions référentielles) ; MOVE élargi (« reporte-la », « à vendredi » sans « pour »). |
| `src/lib/intelligence/advanced.ts` | `resolvedTarget` optionnel dans `reasonWorkspace`/`reasonWorkspaceCore` ; branches COMPLETE/MOVE/UPDATE/DELETE utilisent la cible résolue. |
| `src/lib/intelligence/ai-provider.ts` | Rappel des préférences explicites dans le prompt IA (jamais de clé côté client). |
| `src/app/api/intelligence/query/route.ts` | Lecture de la mémoire (DB d'abord, cache client ensuite), extraction de préférence explicite, résolution vérifiée (`verify: true`), passage mémoire au runAgent, `updateMemoryAfterTurn` + `saveMemory`, renvoi de l'état mémoire. |
| `src/app/api/intelligence/action/route.ts` | Après mutation : succès vérifié → `applyActionSuccess` (executed + verified + id réel, invalidation si suppression) ; échec → `applyActionFailure` (failed, jamais executed). |
| `src/components/intelligence/intelligence-ask.tsx` | Cache local (`localStorage`) de l'état mémoire : survit au refresh/autres onglets, envoyé comme point de départ, mis à jour depuis les réponses API et le fallback local. |
| `package.json` | Scripts `test:intelligence-memory`, `demo:memory` ; `test:agent` étendu. |

## 2. Architecture retenue

```
User Request
 ↓
API route → readMemory (table intelligence_memory, RLS user×workspace)
 ↓
Memory Retrieval   (état compact : ≤ 8 entités, 1 dernière action, 5 ids supprimés)
 ↓
Reference Resolution (references.ts — mémoire d'abord, snapshot pour vérifier)
   ├─ résolu    → resolvedTarget injecté dans intent + reasonWorkspace
   ├─ ambigu    → clarification (jamais de supposition)
   └─ supprimé  → « Cette tâche n'existe plus. »
 ↓
Intent Classification (resolvedTarget prioritaire)
 ↓
Tool Selection → Tool Execution → Planner
 ↓
Response
 ↓
Memory Update (updateMemoryAfterTurn : proposition ≠ exécution)
```

**Règles strictes** :
- La mémoire **ne crée jamais une entité** : seuls des ids issus d'une lecture réelle ou d'une mutation vérifiée sont stockés.
- Une action proposée est enregistrée `proposed` + `pendingConfirmation` — jamais `executed`.
- `executed` n'est écrit qu'après le read-back serveur (`verified: true`).
- Un échec est enregistré `failed` — jamais `executed`.
- Une suppression **invalide la référence** (`deletedEntityIds` + retrait des lastItems) ; le resolver répond « n'existe plus ».
- Source de vérité : ligne serveur par (user, workspace). Le cache `localStorage` du client n'est qu'un miroir de démarrage (fallback offline).

**Références résolues** (testées) : `celle-ci`, `celle-là`, `cette tâche(-là)`, `ce projet`, `celui dont on parlait`, `la première`, `la deuxième`, `le dernier`, `les deux premières`, `la deuxième tâche`, `le deuxième projet`, `le projet précédent`, `la tâche précédente`, `reporte-la`, `supprime-la/les`, `mets-la en urgente`, `pareil`, `fais la même chose`, `pourquoi ?`, `celui de vendredi`, `Finalement annule`.

## 3. Migrations ajoutées

**`supabase/migrations/023_intelligence_memory.sql`**
- Table `intelligence_memory` : `id`, `user_id`, `workspace_id`, `state jsonb`, `preferences jsonb`, timestamps, `unique (user_id, workspace_id)`.
- Index sur `workspace_id`.
- RLS : select/insert/update/delete limités à `user_id = auth.uid() AND is_active_workspace_member(workspace_id)` — isolation stricte par utilisateur et workspace.
- Aucune donnée d'un autre workspace lisible ; le client n'accède jamais à cette table (routes serveur uniquement).

## 4. Tests ajoutés

**`supabase/tests/intelligence-memory.test.mjs` — 115 assertions, 0 échec**
- Références : ordinaux, pronoms, « précédent », suffixes verbaux, « pareil », « pourquoi », « celui de vendredi », « les deux premières », non-hijack (« supprime les doublons » → none).
- Ambiguïté : jamais de supposition → clarification avec question ; requêtes normales → none.
- Entités supprimées/périmées : `verify` serveur → `deleted` ; sans `verify` (fallback client) → résolution conservée (la mutation est de toute façon re-scopée côté serveur).
- Dérivation mémoire : seuls des ids réels sont mémorisés ; les ids inconnus sont ignorés.
- Proposition ≠ exécution : `proposed`, `verified:false`, `pendingConfirmation`.
- Succès vérifié : `executed` + `verified:true` + id réel + pendingConfirmation effacée.
- Échec : `failed`, jamais `verified`.
- Suppression : invalidation + « n'existe plus » sur référence ultérieure.
- Préférences : extraction explicite (« souviens-toi que… », « remember that… »), pas de préférence sur phrase temporaire, upsert.
- `buildEffectiveHistory` : reconstruction après refresh, historique client prioritaire, vide sans rien.
- **Scénario complet §13** : 3 priorités → « Passe la deuxième en urgente » (résout t2 exactement) → « Et reporte-la à vendredi » (même cible, date 2026-08-28) → « Finalement annule » (même cible, risque haut) → chaque mutation confirmée + vérifiée → mémoire reflète l'état → référence supprimée → clarification.
- Persistance : `saveMemory`/`readMemory` (upsert single-row), résolution après refresh depuis la ligne relue.
- Multi-workspace : aucune fuite de mémoire A vers B ; id étranger rejeté par `verify` et par la couche de mutation.
- Sécurité : id forgé → `deleted` côté serveur + mutation rejetée ; delete sans `confirmDeletion` rejeté.
- Observabilité : `agent.memory.{retrieved, referenceResolved, entity, action}` (dev uniquement).

## 5. Lint

`npx eslint src/lib/intelligence/ src/app/api/intelligence/ src/components/intelligence/intelligence-ask.tsx`
→ **0 erreur, 0 warning.**

## 6. Tests Intelligence

| Suite | Résultat |
|---|---|
| `test:intelligence` (6 capacités, synonymes, dépendances) | 70/70 ✅ |
| `test:intelligence-agent` (Phase 1 — intentions, mutations, isolation, timeout) | 57/57 ✅ |
| `test:intelligence-agent-v2` (Phase 1 — outils, scénarios A–H, retry, fallback) | 116/116 ✅ |
| `test:intelligence-memory` (Phase 2 — nouveau) | 115/115 ✅ |
| `test:onboarding` (non-régression) | 37/37 ✅ |
| `tsc --noEmit` | ✅ |

## 7. Tests de l'agent

`npm run test:agent` (les 4 suites ci-dessus) → **358/358 ✅** + démo `npm run demo:memory` (scénario §13, 14 critères) ✅ + `npm run demo:agent` (Phase 1) ✅.

## 8. Build

`npm run build` → **compilation + 41 pages générées, succès.**

## 9. Ce qui a réellement été vérifié / ce qui n'a pas pu l'être

**Vérifié (réellement exécuté dans ce sandbox)**
- Résolution des références (toutes les formes listées au §2), ambiguïté → clarification, entité supprimée → « n'existe plus ».
- Scénario complet §13 de bout en bout, y compris mutations exécutées + read-back vérifié via la couche serveur (fake DB au même contrat, RLS simulé par scoping `workspace_id`) et mise à jour mémoire après chaque étape.
- Persistance serveur (upsert, lecture après « refresh »), isolation multi-workspace, id forgé rejeté.
- Compilation TS, lint, 358 assertions, build de production.

**Non vérifié (limites de l'environnement)**
- **Aucune base Supabase réelle dans ce sandbox** : la migration `023` n'a pas été appliquée à une base live, et les routes API renvoient 503 sans `.env.local`. Le comportement RLS de la table `intelligence_memory` n'a donc pas été exercé contre Postgres réel (il suit exactement le même pattern RLS que les tables existantes, qui lui est couvert par `onboarding-rls.test.mjs`).
- Les tests `onboarding-rls.test.mjs` et `migration-logic.test.mjs` (pré-existants, hors Intelligence) nécessitent `@electric-sql/pglite` absent de `package.json` — non lié à cette phase.
- Comportement multi-onglets *réel* dans un navigateur (deux onglets simultanés) non testé de bout en bout ; le mécanisme est couvert par la persistance serveur (source de vérité partagée) + cache local.

## 10. Preuve fonctionnelle

`npm run demo:memory` exécute le scénario de fin de phase et affiche, étape par étape : la résolution exacte de « la deuxième » → « Finish homepage » (t2), la conservation de la cible sur « Reporte-la à vendredi » et « Finalement annule », la vérification serveur de chaque mutation, l'invalidation après suppression (« Finish homepage n'existe plus. »), la persistance après refresh, la clarification sur référence ambiguë, et le rejet d'une mutation cross-workspace.
