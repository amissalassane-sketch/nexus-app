# NEXUS — AI Product Patterns

Déclinaison opérationnelle de `04-AI-DESIGN-SYSTEMS/`. Ce fichier liste les patterns UI concrets attendus pour toute nouvelle capacité IA dans NEXUS.

## 1. L'IA n'est jamais un simple bouton

**Règle `[CONFIRMED, contrainte respectée par le code existant]`** : NEXUS intègre l'IA dans le dashboard (briefing, priorités), l'Intelligence (assistant + moteur de signaux), l'onboarding (détection d'interaction réelle), et le Command Menu — jamais un bouton "✨ Ask AI" isolé sans lien avec le contexte de travail affiché. Toute nouvelle capacité IA doit s'insérer dans un flux de travail existant (créer une tâche, revoir un projet, comprendre un signal), pas exister comme fonctionnalité à part détachée du reste du produit.

## 2. Streaming et états de traitement

- Utiliser des libellés d'état honnêtes et spécifiques ("Understanding your workspace…", "Checking related tasks…"), jamais des points génériques.
- Pour un agent multi-étapes, afficher la progression réelle (étapes complétées, outils utilisés, données consultées, actions en attente d'approbation) — ne jamais faire tourner un agent conséquent derrière un spinner muet.
- Respecter `prefers-reduced-motion` pour toute animation de progression.

## 3. Confirmation et undo

- Toute action proposée par l'IA reste une **proposition** jusqu'à confirmation utilisateur explicite.
- Le niveau de friction de confirmation est proportionnel au risque (`NEXUS-DESIGN-DECISIONS.md` D-014) : create = légère, update = medium, delete = confirmation renforcée obligatoire (`confirmDeletion`).
- Une action exécutée doit être vérifiée par relecture serveur avant d'annoncer un succès à l'utilisateur — ne jamais afficher "Fait !" avant confirmation réelle.
- Prévoir, quand c'est pertinent, un chemin d'annulation immédiate après exécution (pas seulement une modification manuelle a posteriori) — `[NEEDS DECISION]` : un mécanisme d'undo générique post-exécution n'est pas confirmé dans le code exploré ; à concevoir explicitement si demandé, en cohérence avec le modèle de vérification déjà en place.

## 4. Transparence

- Chaque réponse structurée de l'assistant peut exposer `sources`, `confidence`, `plan` — cohérent avec le principe "montrer pourquoi", pas seulement "montrer quoi".
- Ne jamais masquer qu'une réponse vient d'un mode de repli déterministe plutôt que du fournisseur IA distant si cette distinction affecte la confiance que l'utilisateur peut placer dans la réponse — `[INFERRED]`, à valider en décision produit si un indicateur visuel de "mode dégradé" est jugé nécessaire.

## 5. Contrôle utilisateur

- L'utilisateur doit toujours pouvoir accepter, éditer, ignorer ou reformuler une suggestion sans naviguer un menu profond — un clic ou une frappe doit suffire pour chaque option.
- Le rejet d'une suggestion IA doit être aussi simple que son acceptation (jamais de confirmation supplémentaire pour *ignorer* une suggestion).

## 6. Mémoire

Voir `04-AI-DESIGN-SYSTEMS/memory-and-context.md` pour les règles dures déjà en place (jamais d'entité inventée, jamais d'action "exécutée" non vérifiée, jamais de suppression oubliée). Toute UI qui affiche un état lié à la mémoire de conversation doit respecter ces règles à la lettre.

## 7. Erreurs et repli

- Un échec du fournisseur IA distant doit basculer vers un mode déterministe qui répond quand même utilement — jamais un écran mort.
- Une seule tentative de nouvelle requête automatique sur erreur réseau/5xx/429, jamais sur timeout (évite de doubler l'attente perçue sur un vrai blocage).

## 8. Ce qu'il ne faut jamais faire

- Exécuter une mutation à fort impact sans confirmation, même si la confiance du modèle est "élevée".
- Répondre à partir d'une supposition non vérifiée sur l'état réel du workspace.
- Utiliser la couleur lavande de façon disproportionnée pour signaler "quelque chose d'IA" au point de dominer visuellement l'écran (`NEXUS-BRAND.md`, D-005).
- Créer une deuxième interface de chat parallèle à `intelligence-ask.tsx` pour un nouveau cas d'usage IA sans raison — étendre l'existant si le besoin est compatible.
