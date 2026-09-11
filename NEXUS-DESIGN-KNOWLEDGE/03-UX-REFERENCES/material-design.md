# Google Material Design (M3) — principes retenus pour NEXUS

Source : documentation publique Material Design 3 (m3.material.io) et analyses associées.

## Ce qui est transférable

- **Sept dimensions de système** (couleur, typographie, forme, mouvement, interaction, layout, élévation) traitées comme un tout cohérent plutôt que comme des choix indépendants. Utile comme **grille de vérification** avant de livrer une nouvelle interface NEXUS : est-ce que la couleur, la forme (radius), le mouvement et l'élévation racontent la même histoire, ou se contredisent-ils ?
- **Motion intentionnel et signifiant** : une animation doit clarifier une relation spatiale ou un changement d'état, jamais décorer. NEXUS applique déjà ce principe : chaque keyframe dans `globals.css` a un rôle nommé (`task-enter`, `signal-enter`, `verification-pulse`) plutôt qu'un effet générique.
- **Élévation comme hiérarchie, pas comme décoration** : plus un élément est "proche" de l'utilisateur (modale, menu flottant, tooltip), plus son ombre est prononcée. NEXUS suit cette logique avec une échelle à 3 paliers (`shadow-dropdown` < `shadow-overlay`), délibérément sobre plutôt que d'imiter le Material elevation à 5 niveaux — le fond quasi-noir de NEXUS rend les ombres portées moins lisibles que sur Material (fond clair), donc NEXUS s'appuie davantage sur le contraste de surface (`bg-surface` → `bg-surface-2` → `bg-surface-3`) que sur l'ombre pour signaler l'élévation.
- **Adaptive layout** : un composant doit se redistribuer selon l'espace disponible plutôt que simplement rétrécir. Cohérent avec la doc `docs/DESIGN-SYSTEM-RESPONSIVE.md` de NEXUS qui change le nombre de colonnes plutôt que la largeur de conteneur seule.
- **Accessibilité et réactivité intégrées à chaque composant**, pas ajoutées après : chaque interaction (tap, swipe, clic) doit produire un retour immédiat et clair.

## Ce qu'on NE prend PAS

- Le langage visuel "matériel/papier" (cartes qui se soulèvent physiquement, ombres portées marquées, couleur dynamique extraite du fond d'écran utilisateur) — étranger à l'identité "Pill Atelier Noir" de NEXUS qui est plate et sombre par conception.
- La palette de couleurs Material (rôles `primary`/`secondary`/`tertiary` avec teintes dynamiques) — NEXUS a son propre vocabulaire sémantique (`success`/`warning`/`danger`/`info`/`lavender`).
- Les formes Material (coins très arrondis façon "squircle", boutons FAB circulaires) — NEXUS utilise une hiérarchie de radius plus resserrée et directionnelle (voir `NEXUS-TOKENS.md`).
