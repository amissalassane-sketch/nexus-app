# Microsoft Fluent — principes retenus pour NEXUS

Source : documentation publique Fluent 2 (Microsoft).

## Ce qui est transférable

- **Cinq piliers : Light, Depth, Motion, Material, Scale** — traduits pour NEXUS en : contraste maîtrisé (Light), hiérarchie de surfaces (Depth), animation fonctionnelle (Motion), matérialité cohérente de composant (Material), adaptation à l'échelle de l'écran (Scale).
- **"Productive elegance"** : typographie claire et espacement cohérent pour des applications professionnelles denses en données — exactement le contexte de NEXUS (tableaux de tâches, listes de projets, panneaux de signaux). Fluent rappelle qu'un outil de productivité ne doit pas sacrifier la densité utile au profit d'un vide esthétique disproportionné — un équilibre à garder en tête dans le dashboard NEXUS (dense mais jamais confus), à ne pas confondre avec la générosité d'espace justifiée sur la landing page (audience et intention différentes).
- **Accessibilité "inclusive by default"** dans chaque primitive plutôt qu'en option — même principe que Primer, réaffirmé ici parce qu'il est répété dans presque tous les systèmes matures : c'est un signal qu'il s'agit d'un standard de facto, pas d'un choix stylistique isolé.
- **Navigation Rail minimaliste** pour le changement de contexte de haut niveau — cohérent avec la sidebar de workspace NEXUS (`workspace-sidebar.tsx`) qui reste étroite (248px) et concentrée sur la navigation, sans se transformer en second panneau de contenu.
- **Cohérence multi-plateforme via des tokens partagés, du code différent par plateforme** — pertinent pour NEXUS si une app mobile native est envisagée un jour : les tokens de `globals.css` devraient rester la source, même si l'implémentation change de techno.

## Ce qu'on NE prend PAS

- Les matériaux "Mica"/"Acrylic" (flou translucide profond façon Windows) — NEXUS utilise un flou plus discret et ponctuel (`backdrop-blur` sur la topbar et les modales), pas un langage matière généralisé.
- L'esthétique Windows (coins de fenêtre, chrome de système d'exploitation) — hors sujet pour une web app.
