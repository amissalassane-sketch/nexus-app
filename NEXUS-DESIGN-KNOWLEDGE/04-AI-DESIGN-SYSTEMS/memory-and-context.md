# Mémoire et contexte IA — NEXUS [CONFIRMED, extrait de src/lib/intelligence/memory.ts]

## Pourquoi ce fichier

La mémoire de l'assistant est une des zones les plus sensibles d'un produit IA en matière de confiance utilisateur : si l'assistant "invente" avoir fait quelque chose, ou oublie une suppression, la confiance s'effondre immédiatement. NEXUS a déjà posé des règles strictes et explicites dans le code — ce fichier les documente pour qu'elles ne soient jamais affaiblies par une future fonctionnalité.

## Règles dures déjà en place [CONFIRMED]

Extraites littéralement de l'en-tête de `src/lib/intelligence/memory.ts` :

1. **La mémoire ne crée jamais d'entité** : chaque id stocké provient d'une vraie lecture ou d'une mutation serveur vérifiée — jamais d'un id halluciné par le modèle.
2. **Une action proposée est stockée comme "proposée", jamais comme "exécutée".** L'état `executed` exige une relecture vérifiée (`verified: true`) après la mutation réelle.
3. **Une action échouée est stockée comme "failed", jamais comme "executed".**
4. Persistance serveur : une ligne par `(user_id, workspace_id)`, protégée par RLS ; le client ne l'écrit jamais directement, seules les routes serveur le font.

## Ce que la mémoire retient [CONFIRMED]

- Les dernières entités affichées, dans l'ordre (pour résoudre "la deuxième", "celle-là").
- La dernière cible résolue (pronoms, ordinaux, accords verbaux — support FR explicite).
- Le dernier plan proposé.
- La dernière action de mutation et son état (proposée / exécutée+vérifiée / échouée).
- Une confirmation humaine en attente (distincte d'une action déjà exécutée).
- Les ids d'entités supprimées (pour invalider une référence future — l'assistant ne doit jamais essayer d'agir sur une tâche déjà supprimée).
- Des préférences explicites et durables (mémoire persistante longue durée, distincte de la mémoire de session).

## Implication design UI

- **Un état "en attente de confirmation" doit toujours être visuellement distinct** d'un état "terminé" — jamais le même badge de succès pour les deux. Voir `verification-pulse` (animation dédiée à l'attente de vérification, `globals.css`).
- **États de traitement nommés par ce qui se passe réellement**, jamais des points de chargement génériques — `IntelligenceProcessingStates` (`components/motion/intelligence-states.tsx`) affiche des libellés explicites ("Understanding your workspace…", "Checking related tasks…", "Analyzing signals…") avec un commentaire explicite dans le code : "Quick, intentional, not fake dots." C'est un principe à généraliser à **tout** futur indicateur de chargement lié à l'IA dans NEXUS : jamais un spinner nu sur une opération qui a plusieurs étapes significatives.
- **Toute référence à une entité supprimée doit être gérée explicitement** dans l'UI de conversation (ex. si l'utilisateur demande "complète-la" sur une tâche supprimée entre-temps, l'assistant doit le signaler, pas échouer silencieusement ou halluciner un remplacement).
- **La mémoire de préférences (longue durée) doit rester visible et éditable par l'utilisateur** — dès qu'une UI de gestion de préférences IA est construite, elle doit permettre de voir/effacer ce que NEXUS "retient" (cohérent avec le principe "memory controls that let users see and edit what the system remembers about them", `04-AI-DESIGN-SYSTEMS/ai-interaction-principles.md`). `[NEEDS DECISION]` : aucune UI dédiée de gestion des préférences mémorisées n'existe encore dans le code exploré — à concevoir si cette fonctionnalité devient visible utilisateur.

## Cache local vs source de vérité [CONFIRMED]

`intelligence-ask.tsx` maintient un cache local (`localStorage`, clé `nexus.intelligence.memory.v1`) qui "bootstrap le chemin offline/fallback et la continuité rapide de l'UI" — mais la ligne serveur reste la source de vérité. Règle à préserver : un cache client ne doit jamais devenir la source d'autorité sur l'état d'une action IA ; il n'existe que pour la continuité perçue (rafraîchissement de page, changement d'onglet).
