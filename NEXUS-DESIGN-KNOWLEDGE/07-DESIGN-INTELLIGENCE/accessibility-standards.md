# NEXUS — Accessibility Standards

Synthèse opérationnelle des règles d'accessibilité déjà en place dans NEXUS (`[CONFIRMED]`) et des standards externes qui les complètent (`01-CORE-PRINCIPLES/`). L'accessibilité est un standard intégré au système, pas une passe corrective a posteriori.

## WCAG — seuils de contraste

- **4.5:1** minimum pour le texte normal.
- **3:1** minimum pour le grand texte (≥18.66px, ou ≥24px) et pour les composants graphiques d'interface (bordures de champ fonctionnelles, icônes porteuses de sens).
- `[CONFIRMED]` la rampe de texte NEXUS (`text-primary/secondary/tertiary/quaternary`) est mesurée et documentée pour respecter ces seuils sur les quatre surfaces réelles de l'app (`#000000`, `#0f0f0f`, `#151515`, `#1c1c1c`) — voir `NEXUS-TOKENS.md`. `text-muted` est l'exception assumée, réservée aux éléments non porteurs d'information.
- Les contrôles désactivés ne sont pas soumis au contraste minimum, **mais** doivent alors expliquer pourquoi ils sont désactivés (texte adjacent ou `title`).

## Focus et clavier

- `[CONFIRMED]` `focus-visible` toujours présent et visible, jamais supprimé sans remplacement équivalent (`globals.css` ligne ~703, ring lavande).
- `[CONFIRMED]` Skip link vers le contenu principal, premier élément focusable du shell.
- `[CONFIRMED]` `Tab` déplace entre contrôles indépendants ; les flèches naviguent à l'intérieur d'un contrôle composite (listes, menus, Command Menu).
- `[CONFIRMED]` `Escape` ferme systématiquement modales, dropdowns, drawer, palette de commandes.
- `[CONFIRMED]` Gestion de focus dans `Modal` : focus automatique sur le premier élément interactif à l'ouverture, restitution du focus précédent à la fermeture.
- Ne jamais s'appuyer uniquement sur un raccourci clavier comme seule façon d'accomplir une action — toujours un chemin souris/tactile équivalent.

## Lecteurs d'écran / ARIA

- `[CONFIRMED]` `role="alert"` réservé aux erreurs bloquantes qui doivent interrompre la lecture ; `role="status"` pour tout le reste (non bloquant).
- `[CONFIRMED]` `role="progressbar"` avec `aria-valuenow/min/max` pour toute barre de progression (`Progress`).
- `[CONFIRMED]` `aria-hidden="true"` sur toute icône purement décorative ou redondante avec un texte adjacent.
- `[CONFIRMED]` `aria-label` obligatoire sur tout bouton icône seul (`IconButton` l'impose au niveau du composant).
- `[CONFIRMED]` `aria-live="polite"` utilisé pour les zones de contenu qui changent sans interaction directe (ex. titre de page mobile qui change lors de la navigation, `app-shell.tsx`).
- `[CONFIRMED]` `aria-current="page"` sur l'item de navigation actif (`NavItem`).
- `[CONFIRMED]` `aria-expanded` sur les déclencheurs de menu/drawer.

## Cibles tactiles

- **44×44px minimum** pour tout contrôle primaire sur mobile — vérifié structurellement par `scripts/test-mobile-ux.mjs`.
- 32px toléré uniquement pour un contrôle secondaire sur desktop avec pointeur précis (`@media (hover: hover) and (pointer: fine)`).
- Distinction explicite dans le code entre contexte tactile (`hover: none, pointer: coarse`) et contexte pointeur précis — ne jamais faire dépendre une action exclusivement du survol dans un contexte tactile.

## Mouvement

- `[CONFIRMED]` `prefers-reduced-motion: reduce` respecté à travers tout `globals.css` (~15 endroits) — toute nouvelle animation doit avoir sa contrepartie réduite dans le même changement.
- `[CONFIRMED]` `@media (scripting: none)` géré pour garantir un fallback utilisable sans JavaScript sur le contenu essentiel.

## Formulaires

- `[CONFIRMED]` `Field` impose un `label` textuel visible — jamais un placeholder comme seul porteur d'information.
- Les messages d'erreur de validation doivent apparaître près du champ concerné, pas seulement en résumé global.
- Jamais de `window.confirm()`/`window.alert()` natif — toujours `ConfirmDialog` (accessible, focus géré).

## Couleur

- `[CONFIRMED]` La couleur ne porte jamais seule le sens — toujours doublée d'un texte ou d'une icône distincte (`StatusDot` applique déjà ce contrat).
- Vérifier systématiquement qu'un daltonien (deutéranopie/protanopie/tritanopie) peut distinguer deux états uniquement par leur texte/forme, sans dépendre de la teinte.

## Checklist rapide avant merge

- [ ] Contraste vérifié sur la surface réelle d'affichage.
- [ ] Focus visible et navigable au clavier de bout en bout.
- [ ] Aucune icône seule cliquable sans nom accessible.
- [ ] Aucun dialogue natif bloquant.
- [ ] `prefers-reduced-motion` géré pour toute nouvelle animation.
- [ ] Cibles tactiles ≥44px sur mobile.
- [ ] Aucun sens porté uniquement par la couleur.
- [ ] Labels de formulaire visibles, jamais seulement en placeholder.
