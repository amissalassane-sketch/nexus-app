# Pattern — États vides, chargement, erreur, succès [CONFIRMED, src/components/ui/feedback.tsx + page-skeleton.tsx]

## Composants existants (à réutiliser, jamais dupliquer)

| Composant | Rôle | Fichier |
|---|---|---|
| `EmptyState` | Aucune donnée à afficher (liste vide, résultat de recherche vide) | `ui/feedback.tsx` |
| `ErrorState` | Échec de chargement d'une ressource, avec `role="alert"` | `ui/feedback.tsx` |
| `Alert` | Message contextuel inline (danger/success/warning/info), `role="alert"` pour danger, `role="status"` pour le reste | `ui/feedback.tsx` |
| `Progress` | Barre de progression avec `role="progressbar"` + `aria-valuenow/min/max` | `ui/feedback.tsx` |
| `ListRow` | Ligne de liste interactive standard | `ui/feedback.tsx` |
| `PageSkeleton` (et variantes) | Squelette de chargement qui préserve la mise en page finale | `ui/page-skeleton.tsx` |
| `Button` avec `loading`/`success`/`error` | États de bouton auto-portés (spinner, check animé, secousse) | `ui/button.tsx` |

## Règles de contenu (pas seulement de composant)

- **`EmptyState` doit toujours avoir une action claire** quand une action existe pour sortir de l'état vide (créer le premier projet, créer la première tâche) — jamais un simple "Rien ici" sans porte de sortie. Voir l'usage dans `IntegrationHub` (`Reset filters` quand la recherche ne donne rien).
- **`ErrorState`/`Alert` de type danger ne doivent jamais afficher un message technique brut** (stack trace, code d'erreur SQL). NEXUS a une couche dédiée (`src/lib/schema-errors.ts`, `src/lib/plan-errors.ts`, `src/lib/auth-errors.ts`) qui traduit les erreurs internes en messages humains — toute nouvelle surface d'erreur doit passer par une traduction équivalente, jamais afficher `error.message` directement à l'utilisateur.
- **Le skeleton doit avoir la même forme que le contenu réel** (mêmes proportions de carte/ligne), pas un rectangle générique — c'est déjà le principe de `page-skeleton.tsx` ("skeletons preserve layout").
- **Un état de succès doit être visible mais bref** : le pattern `Button success` anime un check puis revient à l'état normal — ne jamais laisser un état de succès permanent qui masquerait un changement d'état suivant.

## Accessibilité déjà correcte à préserver

- `role="alert"` uniquement pour ce qui doit interrompre un lecteur d'écran (erreur bloquante) ; `role="status"` pour une information non bloquante — ne jamais inverser les deux.
- `Progress` expose `aria-valuenow/min/max` — toute nouvelle barre de progression (ex. upload de fichier, avancement d'onboarding) doit reprendre ce composant plutôt qu'une div stylée.

## Pattern manquant `[NEEDS DECISION]`

Il n'existe pas de composant "Retry" générique standardisé (bouton "Réessayer" avec état de nouvelle tentative en cours) — chaque écran qui gère un échec réseau semble le refaire localement. Si cette répétition est confirmée dans une future revue de code, envisager un composant `RetryableErrorState` composé au-dessus de `ErrorState` + `Button loading` plutôt que de multiplier les implémentations ad hoc.
