# IBM Carbon — principes retenus pour NEXUS

Source : documentation publique Carbon Design System (IBM).

## Ce qui est transférable

- **Accessibilité et gouvernance documentées par composant** : chaque composant Carbon a sa propre page d'accessibilité (rôle ARIA attendu, comportement clavier, contraste). NEXUS doit viser la même granularité pour ses primitives `ui/` : chaque nouveau composant devrait documenter en tête de fichier son contrat clavier/aria, pas seulement son intention visuelle (déjà en partie fait, ex. `IconButton` impose un label).
- **Grille flexible pensée pour l'UI d'entreprise dense** : Carbon documente une grille 2x adaptable pour des interfaces à beaucoup de données. NEXUS a sa propre grille par device class (`docs/DESIGN-SYSTEM-RESPONSIVE.md`) — le principe transférable est de **documenter la grille comme un contrat**, pas seulement comme un artefact CSS.
- **Data visualization accessible par défaut** : les graphiques Carbon intègrent motifs/texture en plus de la couleur pour rester lisibles en daltonisme. Pertinent pour `src/components/charts/` — vérifier que les graphiques NEXUS (recharts) n'encodent jamais une distinction uniquement par teinte.
- **Modèle de contribution clair** : un changement de design system passe par une revue documentée, pas par une préférence ponctuelle — aligné avec la règle NEXUS du "Design Decision Log" (`06-NEXUS-CONTEXT/NEXUS-DESIGN-DECISIONS.md`) qui interdit qu'une décision importante soit remplacée silencieusement.

## Ce qu'on NE prend PAS

- L'identité visuelle IBM (bleu IBM, typographie IBM Plex) — étrangère à NEXUS.
- Le degré de densité "enterprise lourd" de Carbon (formulaires très chargés, nombreux composants de configuration visibles simultanément) — NEXUS vise une densité plus proche de Linear (dense mais respirable), pas une densité façon console d'administration IBM.
