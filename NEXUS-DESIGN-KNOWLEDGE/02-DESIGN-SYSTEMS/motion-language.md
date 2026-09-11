# NEXUS Motion Language [CONFIRMED — extrait de src/app/globals.css]

## Principe directeur

Le mouvement NEXUS est **fonctionnel avant d'être esthétique** : chaque animation existe pour communiquer un changement d'état (apparition, disparition, transition d'écran, chargement, vérification d'action IA), jamais pour "faire joli" sans rôle. C'est visible dans le nommage des keyframes : `task-enter`, `task-exit`, `signal-enter`, `verification-pulse`, `trace-draw` — chacun porte un nom d'usage, pas un nom d'effet (`bounce`, `wobble`).

## Easings [CONFIRMED]

| Token | Courbe | Usage |
|---|---|---|
| `--ease-nexus` | `cubic-bezier(0.22,1,0.36,1)` | Easing par défaut de tout le produit — "rapide, précis, doux, confiant" (commentaire source) |
| `--ease-out-expo` | `cubic-bezier(0.16,1,0.3,1)` | Sorties/entrées plus marquées (tracé du 404, transitions amples) |
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | Transitions neutres |
| `--ease-emphasized` | = `ease-nexus` | Alias sémantique pour les moments à souligner |
| `--ease-decelerate` | `cubic-bezier(0,0,0,1)` | Élément qui arrive et se pose |
| `--ease-accelerate` | `cubic-bezier(0.3,0,1,1)` | Élément qui part |
| `--ease-spring-soft` | `cubic-bezier(0.34,1.26,0.64,1)` | Rebond doux, réservé aux micro-feedbacks (jamais aux transitions de page) |

## Durées [CONFIRMED]

| Token | Valeur | Usage |
|---|---|---|
| `--duration-micro` | 120ms | Hover, toggle, feedback instantané |
| `--duration-micro-long` | 160ms | Sortie de petit élément |
| `--duration-small` | 200ms | Transition de surface (carte, bouton) |
| `--duration-small-long` | 240ms | Entrée de composant avec texte |
| `--duration-medium` | 280ms | Entrée de panneau/carte de contenu |
| `--duration-medium-long` | 340ms | Panneau latéral, sheet |
| `--duration-large` | 400ms | Transition de page complète |

**Règle issue de la loi de Doherty (`01-CORE-PRINCIPLES/laws-of-ux.md`)** : tout ce qui est perçu comme un feedback direct de l'utilisateur (clic, hover, sélection) doit rester sous 200ms. Au-delà, l'utilisateur perçoit un délai, pas un feedback.

## Catalogue d'animations nommées [CONFIRMED, non exhaustif]

- **Entrée générique** : `fade-in`, `scale-in`, `list-in`, `pop-in`, `intelligence-state-in` — utilisées pour badges, listes, cartes, états vides/erreur.
- **Panneaux et sheets** : `panel-in/out` (translation latérale, desktop), `sheet-in/out` (translation verticale, mobile) — le Modal (`ui/modal.tsx`) choisit l'un ou l'autre selon le breakpoint, jamais les deux en même temps.
- **Toast** : `toast-in/out` — translation verticale courte, jamais de rebond.
- **Domaine métier** : `task-enter/exit` (apparition/retrait d'une tâche dans une liste), `signal-enter` (arrivée d'un signal Intelligence), `verification-pulse` (boucle infinie discrète pendant qu'une action IA est vérifiée côté serveur) — ce sont des animations **spécifiques au vocabulaire produit NEXUS**, à ne jamais remplacer par un fade générique : elles permettent à l'utilisateur de repérer *quel type* de changement vient de se produire sans lire le texte.
- **Feedback d'erreur** : `feedback-shake` (classe utilitaire, cf. `Button` en `error`) — seul cas où un mouvement "physique" (secousse) est toléré, car il communique un refus, pas une réussite.
- **Chargement** : `shimmer` (boucle infinie sur skeleton), spinner SVG inline dans `Button`.

## Accessibilité du mouvement [CONFIRMED]

- `@media (prefers-reduced-motion: reduce)` est déjà présent à ~15 endroits distincts dans `globals.css`, gelant les animations décoratives tout en préservant les changements d'état essentiels (ex. le focus doit rester visible, la disparition d'un élément doit rester perceptible même sans transition).
- `@media (scripting: none)` (pas de JS) a un traitement dédié à plusieurs endroits — le mouvement ne doit jamais être la seule façon de faire fonctionner une interaction ; le no-JS fallback doit rester utilisable.
- `@media (hover: hover) and (pointer: fine)` vs `@media (hover: none), (pointer: coarse)` distinguent explicitement les interactions "au survol" (desktop) des interactions tactiles — **aucune fonctionnalité ne doit dépendre exclusivement du survol** sur un écran tactile.

## Règle pour l'agent

Avant d'ajouter une nouvelle animation :
1. Vérifier si un keyframe existant dans `globals.css` répond déjà au besoin (liste ci-dessus).
2. Si un nouveau keyframe est nécessaire, le nommer par **usage produit** (`xxx-enter`, `xxx-pulse`), pas par effet visuel.
3. Toujours prévoir la variante `prefers-reduced-motion: reduce` dans le même changement.
4. Respecter la durée du tableau ci-dessus selon la catégorie de l'élément animé — ne jamais improviser une durée en dehors de l'échelle.
