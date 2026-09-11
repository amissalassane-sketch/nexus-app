# Principes d'interaction IA — synthèse externe + application NEXUS

Sources : recherche 2025-2026 sur le design d'interfaces IA (Parallel HQ "Designing Interfaces for AI Products", Nielsen Norman Group tendances 2026, "39 Principles for Designing Human-AI Interaction"). Ce fichier synthétise des principes de comportement transférables — pas une identité visuelle à copier.

## Les cinq piliers retenus

### 1. Transparence
Le système doit toujours pouvoir répondre à "pourquoi cette suggestion ?" et "quel est le niveau de confiance ?". Ne jamais faire tourner un agent multi-étapes derrière un simple spinner silencieux sur une tâche conséquente.

**Vérifiable dans NEXUS `[CONFIRMED]`** : `src/lib/intelligence/agent.ts` expose des états explicites (`thinking`, `planning`, `using_tools`, `executing`, `verifying`, `completed`, `failed`) rendus dans l'UI par `IntelligenceProcessingStates` (`components/motion/intelligence-states.tsx`). Le rapport `INTELLIGENCE_AGENT_REPORT.md` documente que "le modèle **propose**, le serveur **décide**" et que chaque réponse inclut `sources`, `confidence`, `plan`, `toolCalls`. C'est un exemple direct et déjà correct du principe "show plans and traces for multi-step work".

### 2. Contrôle et réversibilité
Accepter/rejeter/éditer/annuler doivent être des actions à faible friction (une frappe, pas un menu). Le rejet doit être quasiment gratuit.

**Vérifiable dans NEXUS `[CONFIRMED]`** : toute mutation proposée par l'agent (créer/modifier/supprimer tâche, projet, goal) passe par `POST /api/intelligence/action` avec confirmation utilisateur obligatoire (`ConfirmDialog`, `confirmDeletion` pour les suppressions à risque élevé) et vérification en lecture après écriture (read-back). C'est le pattern "governors" documenté par la littérature ("action plans shown before execution, draft modes, the AI proposes, you dispose").

### 3. Échec gracieux
L'incertitude, l'erreur, et l'escalade doivent être récupérables — jamais un cul-de-sac silencieux.

**Vérifiable dans NEXUS `[CONFIRMED]`** : `ai-provider.ts` documente un retry contrôlé (1 tentative sur erreur réseau/5xx/429, jamais sur timeout) et un mode de repli déterministe (`runAgentDeterministic`) si le fournisseur IA échoue — l'utilisateur obtient toujours une réponse utile, jamais un écran mort.

### 4. Co-création, pas verdict
Traiter la sortie de l'IA comme un brouillon révisable, pas comme une décision finale imposée.

**Application NEXUS `[INFERRED]`** : chaque signal/recommandation de l'Intelligence Engine devrait toujours s'accompagner d'une action explicite et réversible (accepter, ignorer, reporter), jamais d'une exécution automatique silencieuse d'une action à fort impact. À vérifier systématiquement pour toute nouvelle capacité IA.

### 5. Autonomie proportionnée au risque
Plus une action est conséquente et difficile à annuler, plus elle exige de contrôle humain explicite avant exécution ; les actions à faible risque et réversibles peuvent être plus automatiques.

**Vérifiable dans NEXUS `[CONFIRMED]`** : `INTELLIGENCE_AGENT_REPORT.md` documente une échelle de risque explicite par type de mutation (`create_*` = low, `update_*` = medium, `delete_*` = high avec confirmation obligatoire renforcée). C'est exactement le principe "constrain action by stakes, reversibility, and permission" — déjà implémenté, à ne jamais affaiblir lors de l'ajout d'une nouvelle capacité d'action.

## Pièges documentés à éviter

- **Sur-automatisation** : l'utilisateur se sent dépossédé de son travail si l'IA agit sans qu'il l'ait demandé ou confirmé.
- **Surcharge cognitive** : trop d'options affichées simultanément (regénérer / éditer / accepter / historique / sources / confiance...) noie le bénéfice. Prioriser un chemin par défaut clair, les options secondaires en disclosure progressive.
- **Opacité** : un comportement "boîte noire" érode la confiance plus vite qu'une réponse imparfaite mais expliquée.
- **Halluciner des données** : ne jamais laisser l'assistant inventer un fait sur le workspace. NEXUS s'en protège déjà structurellement (`context-builder.ts` ne lit que le snapshot réel de Supabase, jamais une supposition du modèle) — c'est une garantie architecturale à ne jamais contourner par un raccourci de "génération créative".

## Où consulter la déclinaison produit complète

Voir `07-DESIGN-INTELLIGENCE/ai-product-patterns.md` pour les patterns UI concrets (streaming, confirmation, undo, mémoire) et `06-NEXUS-CONTEXT/NEXUS-UX-PRINCIPLES.md` section AI Interactions pour la position produit NEXUS.
