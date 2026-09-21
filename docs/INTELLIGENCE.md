# NEXUS Intelligence — operating layer existant

## Architecture réelle

API query : session → membership actif → mémoire (workspace,user) → snapshot tâches/projets/objectifs + activités/dépendances → contexte/résolution des références → intent → tools en lecture → planner → modèle optionnel → réponse vérifiée/structurée → mémoire, missions, signaux.

`agent.ts` orchestre ; `engine/advanced` produisent le raisonnement déterministe ; `intent/planner` classent et planifient ; `context-builder/references` construisent les références ; `tools` valide les propositions ; `actions` exécute les mutations confirmées et vérifie le résultat. `memory`, `signals/signal-store/signal-api` et `mission` gèrent la persistance.

Le modèle ne reçoit pas un client SQL. Les tools de lecture utilisent le snapshot scoped. Les mutations passent par l'API action, pas par une sortie modèle directement exécutable. Les étapes de mission repassent par le même exécuteur.

**Limite de périmètre** : le contexte actuel couvre tâches, projets, objectifs, activités, dépendances, préférences, mémoire récente, signaux et missions. Les tables notes/events/files et le vector store historique ne sont pas une intégration automatique au contexte : leur retrieval contrôlé reste à concevoir/tester. Pas de certification de compréhension du calendrier ou de toutes les notes.

## Mémoire : deux générations distinctes

| Stockage | Contenu effectif | Scope / contrôle |
|---|---|---|
| intelligence_memory (023) | une ligne state JSON + preferences par utilisateur/workspace ; état récent, références, plans/actions, préférences explicites | unique(user_id,workspace_id), RLS owner + membre actif ; suppression autorisée par policy, pas d'écran de gestion complet certifié |
| intelligence_signals (024) | preuves, score, confiance, statut et entités concernées | workspace/user ; mutations scoped |
| intelligence_missions (025) | objectif, étapes, contexte, progression, statut | workspace/user ; confirmation des actions |
| ai_memories (003) | memory_type, content, source_type/source_id, importance [0,1], embedding, expires_at, created_at/updated_at | workspace + user ; moteur vectoriel historique, pas celui de memory.ts |
| ai_conversations / ai_messages (003) | conversations/messages et métadonnées IA | contrats SQL historiques, pas preuve de journalisation de chaque requête actuelle |
| ai_context_snapshots (003) | context_type/context_data, workspace/conversation, created_at | pas de cycle de rétention démontré dans la route query |
| ai_usage (003) | provider/model, tokens entrée/sortie, estimated_cost, request_type | table historique ; pas de comptage réservé ou budget atomique branché |

Short-term = références et tour récent ; long-term = préférences explicitement demandées et futur retrieval ai_memories ; task/project context = snapshot des entités autorisées, pas copie illimitée ; workspace memory partagée n'est pas équivalente à la mémoire privée utilisateur.

**Contrat cible non encore appliqué partout** : type, source, scope, confidence, importance, created_at, updated_at, expires_at et mécanisme de suppression. `ai_memories` n'a pas actuellement de colonne confidence ; les préférences structurées ont key/value/source/createdAt, pas tous ces champs. Ne pas présenter cette cible comme une migration déjà livrée. Définir rétention explicite par type, exclusion secrets, suppression utilisateur et invalidation des références supprimées avant retrieval partagé.

## Erreurs et fallback

- Lectures mémoire/mission/signals et snapshots API : SQL error → exception typée, jamais vide par défaut. 42501 → NOT_AUTHORIZED/403 ; autres erreurs SQL → INTELLIGENCE_UNAVAILABLE/503 avec message public neutre.
- Absence de ligne réussie reste EMPTY (null ou []). Un résultat non autorisé filtré par RLS peut être vide sans erreur : le test du membership et la RLS restent nécessaires.
- Save mémoire/mission : échec UPDATE arrête le flux avant INSERT. Échecs d'écriture signals vérifiés. Ne pas annoncer des identifiants de signaux comme persistés si l'insert n'a pas retourné toutes les lignes attendues.
- L'écran initial refuse désormais un snapshot partiellement échoué, pas seulement trois lectures échouées simultanément.
- Recompute workspace dispatché avant le contrôle d'id mission.
- Modèle absent, timeout ou sortie invalide : raisonnement déterministe existant, `provider=nexus-engine`, `agent.usedFallback=true`. C'est une réponse calculée, pas une liste vide. L'API modèle renvoie encore null pour plusieurs causes et ne détaille pas la cause précise au client : télémétrie à améliorer.
- Une erreur de transport non PostgREST reste une erreur générique 500 ; aucune promesse de classification exhaustive. Mutations et persistance mémoire ne sont pas une transaction unique.

## Usage et coût — présent vs spécifié

Présent : fournisseur serveur OpenAI/Anthropic optionnel ; sortie query max_tokens=1600, timeout par tentative 10 s, au plus deux tentatives ; enrichissement signals max_tokens=600, timeout 8 s. Il existe des tests de fallback/timeout. Ces plafonds par appel ne constituent **pas** un plafond de facture ou de concurrence.

**RED : pas de réservation persistante, quota par plan ou budget monétaire opposable installé.** Les compteurs ai_usage modifiables via insert membre ne sont pas une source fiable de coût. Ne pas activer un usage payant illimité sous prétexte que les tests passent.

### Spécification de garde à implémenter (pas des limites actuellement appliquées)

Valeurs techniques proposées à valider avec le catalogue et les prix du fournisseur :

| Plan effectif SQL | Requêtes IA/workspace/jour UTC | Requêtes/user/minute | Concurrence/workspace | Réservation tokens entrée+sortie/jour |
|---|---:|---:|---:|---:|
| FREE | 10 | 2 | 1 | 60 000 |
| PRO | 100 | 10 | 2 | 600 000 |
| TEAM | 500 | 30 | 5 | 3 000 000 |

- Quotas attachés au workspace et à auth.uid(), jamais à un plan envoyé par client. Réservation atomique transactionnelle et idempotente AVANT tout appel payant ; vérifier membership actif et get_workspace_plan.
- Ledger dédié inaccessible en écriture aux rôles client. Pas de compteur en mémoire de fonction Vercel. Réservation par tentative, y compris retries et enrichissement signals ; considérer chaque chemin appelant fetch provider.
- Réserver coût maximal à partir d'un catalogue serveur de modèles autorisés/versionnés, tokens entrée max et sortie max. Plafond monétaire workspace et plafond global administrateur **obligatoires**, à fixer avant activation ; monnaie/devise explicitement définies. Modèle inconnu ou tarif absent → fail closed.
- Budget épuisé → 429 (quota) ou fallback déterministe explicitement étiqueté ; infrastructure de budget indisponible → 503, aucun appel payant. Annulation/timeout après envoi garde une provision conservatrice jusqu'à réconciliation.
- Finalisation enregistre tokens réellement rapportés, coût, provider request id, modèle, statut, latency et reservation id ; aucun prompt ou secret dans les logs financiers par défaut. Nettoyage des réservations expirées sans recréditer une dépense inconnue.
- Bornes d'entrée proposées : requête 4 000 caractères, 10 tours de contexte normalisés, 8 000 tokens d'entrée par tentative ; refuser ou résumer explicitement, ne pas tronquer silencieusement des données opérationnelles. Les grandes listes workspace exigent pagination/synthèse mesurée.
- Tests obligatoires : dépassement FREE, changement PRO→FREE expiré, courses simultanées, multi-instance, replay, panne DB avant provider (zéro fetch), timeout après acceptation, retries comptés, signal refresh abusif, fake usage client sans effet, réservations user/workspace étrangers refusées.

## Tools : inventaire extrait du registre

Tous les READ sont limités au snapshot autorisé ; WRITE/DESTRUCTIVE exigent membership, RLS, validation de références et confirmation serveur. Les NAVIGATE n'effectuent aucune mutation serveur. Audit durable des mutations requis pour certification ; la trace agent et la mémoire ne sont pas un journal append-only complet. Aucun tool EXTERNAL actuellement enregistré.

| Nom | Classe | But | Input | Output / effet | Confirmation | Audit requis |
|---|---|---|---|---|---|---|
| get_workspace_overview | READ | Compact totals, operating health and the single next best action for the active workspace. | aucun | ToolResult / aucune écriture | non | trace opérationnelle |
| get_projects | READ | List the workspace projects with status, progress, due date and open/overdue/blocked task counts. | status:string | ToolResult / aucune écriture | non | trace opérationnelle |
| get_project | READ | Read one project (by id or by name) with its tasks. | id:string, query:string | ToolResult / aucune écriture | non | trace opérationnelle |
| get_tasks | READ | List tasks; filter by all/open/overdue/blocked/due_today/due_this_week/done. | filter:string | ToolResult / aucune écriture | non | trace opérationnelle |
| get_task | READ | Read one task (by id or by title) with its dependencies. | id:string, query:string | ToolResult / aucune écriture | non | trace opérationnelle |
| get_goals | READ | List active workspace goals with progress and target dates. | aucun | ToolResult / aucune écriture | non | trace opérationnelle |
| get_activity | READ | Recent audited workspace activity (created/updated/deleted events). | limit:number | ToolResult / aucune écriture | non | trace opérationnelle |
| get_blocked_tasks | READ | Tasks currently in blocked status, with project and blocker info. | aucun | ToolResult / aucune écriture | non | trace opérationnelle |
| get_overdue_tasks | READ | Open tasks past their due date. | aucun | ToolResult / aucune écriture | non | trace opérationnelle |
| get_priorities | READ | Ranked priority list of open tasks with scored reasons. | limit:number | ToolResult / aucune écriture | non | trace opérationnelle |
| search_workspace | READ | Search tasks and projects by name/title. | query:string (required) | ToolResult / aucune écriture | non | trace opérationnelle |
| create_task | WRITE | Propose creating a task. Executed server-side after confirmation. | title:string (required), priority:string, dueDate:string, projectId:string, description:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| update_task | WRITE | Propose updating a task (priority/status/due date/title). Confirmation-gated. | taskId:string, query:string, priority:string, status:string, dueDate:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| complete_task | WRITE | Propose marking a task done. Executed server-side after confirmation. | taskId:string, query:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| move_task | WRITE | Propose rescheduling a task to a new due date. | taskId:string, query:string, dueDate:string (required) | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| delete_task | DESTRUCTIVE | Propose deleting a task. Destructive. Always requires explicit human confirmation. | taskId:string, query:string | proposition puis mutation vérifiée | oui + confirmDeletion | oui, durable à compléter |
| create_project | WRITE | Propose creating a project. Executed server-side after confirmation. | name:string (required), dueDate:string, description:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| update_project | WRITE | Propose updating a project (name/status/progress/due date). | projectId:string, query:string, status:string, progress:number, dueDate:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| delete_project | DESTRUCTIVE | Propose deleting a project and all its tasks. Destructive. Always requires explicit human confirmation. | projectId:string, query:string | proposition puis mutation vérifiée | oui + confirmDeletion | oui, durable à compléter |
| create_goal | WRITE | Propose creating a goal. Executed server-side after confirmation. | title:string (required), targetDate:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| update_goal | WRITE | Propose updating a goal (title/status/progress/target date). | goalId:string, query:string, status:string, progress:number, targetDate:string | proposition puis mutation vérifiée | oui | oui, durable à compléter |
| delete_goal | DESTRUCTIVE | Propose deleting a goal. Destructive. Requires explicit confirmation. | goalId:string, query:string | proposition puis mutation vérifiée | oui + confirmDeletion | oui, durable à compléter |
| open_project | NAVIGATE | Deep link to a project page. | id:string | href / navigation locale | non | trace opérationnelle |
| open_task | NAVIGATE | Deep link to the task board, focused on one task. | id:string | href / navigation locale | non | trace opérationnelle |
| open_tasks | NAVIGATE | Deep link to the task board. | aucun | href / navigation locale | non | trace opérationnelle |
| open_intelligence | NAVIGATE | Deep link to the Intelligence console. | aucun | href / navigation locale | non | trace opérationnelle |
| open_activity | NAVIGATE | Deep link to the activity log. | aucun | href / navigation locale | non | trace opérationnelle |
