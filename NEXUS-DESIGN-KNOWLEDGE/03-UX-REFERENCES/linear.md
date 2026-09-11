# Linear — principes retenus pour NEXUS

Source : analyses publiques du produit Linear (revues produit, retours d'utilisateurs, déclarations publiques de l'équipe).

Linear est la référence la plus proche de l'ambition produit de NEXUS (outil de travail sombre, rapide, orienté clavier, avec une identité visuelle retenue) — mais **NEXUS ne doit pas devenir un clone visuel de Linear**. Ce fichier documente des principes de comportement, pas des composants ou une palette à reproduire.

## Ce qui est transférable

- **La vitesse perçue est une décision de design, pas seulement d'ingénierie** : UI optimiste, squelettes de chargement, cache agressif. NEXUS a déjà `page-skeleton.tsx` et des transitions de page dédiées (`motion/page-transition.tsx`) — le principe à renforcer : toute mutation initiée par l'utilisateur (créer une tâche, cocher un signal) doit refléter le changement **immédiatement** dans l'UI, avant confirmation serveur, avec un mécanisme de retour arrière propre en cas d'échec.
- **Clavier-first pour l'audience professionnelle** : raccourcis découvrables (visibles au survol), apprenables (souvent une seule touche), composables. NEXUS a déjà `⌘K`/`Ctrl+K` et `hooks/use-command-key.ts` — l'axe d'amélioration documenté ailleurs (`05-COMPONENT-PATTERNS/command-center.md`) est d'étendre la découvrabilité des raccourcis (les afficher en regard des actions, pas seulement dans une aide cachée).
- **Densité d'information élevée, mais qui reste "propre"** grâce à un espacement cohérent et une palette désaturée — la couleur ne sert que la sémantique de statut, jamais la décoration. C'est très proche de la position déjà prise par NEXUS ("jamais de dashboard gris" mais aussi jamais de couleur décorative hors fonction).
- **Adapter le modèle d'interaction à l'audience** : Linear a raison pour les développeurs (clavier), aurait tort pour un public non technique. NEXUS s'adresse à des utilisateurs de productivité générale (pas uniquement développeurs) — cela justifie de garder à la fois un chemin clavier complet **et** un chemin tactile/souris pleinement équivalent, jamais l'un en option dégradée de l'autre. C'est déjà visible dans le double dimensionnement des boutons (`sm:h-8` desktop vs `h-9` tactile).
- **Aveu explicite du point faible de Linear : le mobile est un après-coup.** C'est un contre-exemple direct et utile : NEXUS a fait le choix inverse et documenté (`MOBILE_UX_PHASE_REPORT.md`, `PHASE6-MOBILE-EXPERIENCE-REPORT.md`) de traiter mobile comme un citoyen de première classe, avec sa propre hiérarchie d'écran (`mobile-home/mobile-overview.tsx`) plutôt qu'un rétrécissement du desktop. **Ne jamais régresser ce choix** en ajoutant une fonctionnalité "desktop only" sans plan mobile explicite.

## Ce qu'on NE prend PAS

- La palette exacte de Linear, ses radius, sa typographie (police, tracking) — propriétaires à son identité de marque.
- Les noms de fonctionnalités Linear (Cycles, Triage) — vocabulaire produit spécifique à son domaine (issue tracking), à ne pas réutiliser tel quel dans le vocabulaire NEXUS (Projects/Tasks/Goals/Intelligence).
- Toute reproduction de layout ou composant Linear pixel pour pixel.
