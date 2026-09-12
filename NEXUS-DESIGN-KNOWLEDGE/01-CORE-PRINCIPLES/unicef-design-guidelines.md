# UNICEF Design System — principes extraits pour NEXUS

Source : [unicef/design-system](https://github.com/unicef/design-system) (`design-guidelines.md`, licence ouverte, projet public UNICEF).

Ce système cible des applications d'entreprise à forte densité d'information, sur des connexions parfois faibles, pour des utilisateurs de tous niveaux techniques. C'est une référence de **sobriété et d'accessibilité radicale**, pertinente pour NEXUS qui est aussi un outil de travail dense (tâches, projets, signaux), pas un produit grand public ludique.

**Règle du dossier `01-CORE-PRINCIPLES` : on extrait des principes transférables, jamais l'identité visuelle UNICEF (bleu institutionnel, logo, ton de marque).**

## Principes retenus

1. **Design frugal, jamais un frein.** Chaque écran doit rester rapide même en connexion faible et sur du matériel modeste. → Pour NEXUS : préférer CSS/keyframes natifs à des librairies d'animation lourdes partout (déjà le cas : `framer-motion` est présent mais le mouvement de fond passe par des `@keyframes` CSS), ne charger le rendu 3D (`three`, `@react-three/fiber`) que sur les écrans qui en ont réellement besoin (Intelligence), jamais en bloquant le answer path.
2. **Explicite pour tous les niveaux de compétence technique.** Toujours associer un label texte à une icône dans les zones d'action critiques ; préférer plus de mots à une ambiguïté. → Vérifiable dans NEXUS : `IconButton` de `src/components/ui/button.tsx` **impose** un `label` (accessible name obligatoire) — ce principe est déjà appliqué au niveau du composant, pas seulement en discipline d'usage.
3. **Accessible pour tous, sans exception.** L'accessibilité n'est pas une fonctionnalité optionnelle. → Voir `07-DESIGN-INTELLIGENCE/accessibility-standards.md` pour la déclinaison NEXUS.
4. **Moins de design, mais mieux.** Ne pas ajouter d'ornement qui ne porte pas d'information. → Cohérent avec la direction "Pill Atelier Noir" de NEXUS : surfaces quasi-noires, bordures découvertes plutôt qu'annoncées (`border-subtle` à 6% d'opacité blanche).
5. **Cohérence systématique** du style visuel, du vocabulaire et des parcours plutôt que réinventer une convention par écran.
6. **La couleur ne porte jamais seule le sens.** Toujours doubler un statut coloré (succès/alerte/erreur) d'un label texte ou d'une icône distincte, pour les utilisateurs daltoniens. → Déjà respecté dans `StatusDot` (`src/components/ui/badge.tsx`) qui accole systématiquement un point de couleur et un label texte.
7. **Contraste WCAG AA minimum** : 4.5:1 texte normal, 3:1 grand texte et composants d'UI graphiques (bordures de champs, icônes fonctionnelles). NEXUS applique déjà ce seuil et documente les ratios mesurés dans `globals.css` (voir commentaire "DESIGN AUDIT — CONTRAST PASS").
8. **Éviter les boutons désactivés sans explication.** Un bouton grisé sans contexte est une source de confusion ("pourquoi je ne peux pas cliquer ?"). Quand un état désactivé est nécessaire, l'accompagner d'un texte court expliquant la condition manquante. → À vérifier systématiquement dans les revues NEXUS (ex. `IntegrationCard` désactive son CTA avec `title="This provider is not configured in this deployment"` — bon pattern, à généraliser).
9. **Rationaliser les popups/modales**, en particulier sur mobile et tablette où elles sont plus intrusives — préférer une désocclusion progressive (sheet, panneau latéral) à une fenêtre modale bloquante quand c'est possible.
10. **Hiérarchie de titres stricte** (h1 → h2 → h3 sans saut), un seul h1 par page, libellés courts et univoques — directement applicable aux pages NEXUS qui empilent `Panel`/`SectionHeader` (`text-h1`, `text-h2`, `text-h3` sont déjà des tokens distincts dans `globals.css`).

## Ce qu'on NE prend PAS d'UNICEF

- Palette de couleurs de marque (bleu UNICEF, rouge, orange institutionnels) — non pertinente pour l'identité NEXUS.
- Ton éditorial humanitaire/institutionnel.
- Layout Bootstrap spécifique du design system UNICEF (grid, composants Sketch).

## Application directe à NEXUS

- Formulaires NEXUS (auth, création de tâche/projet) : ne jamais désactiver un bouton de soumission sans dire pourquoi (champ manquant, limite de plan atteinte) — cf. `src/lib/plan-limits.ts` qui a déjà cette logique de limites ; l'UI doit toujours l'exposer en texte.
- Le Command Menu et la Sidebar utilisent déjà icône + label ensemble (`NavItem`, `Command`), jamais une icône seule pour une action destructive ou de navigation primaire.
- Les signaux de l'Intelligence Engine (`src/lib/intelligence/engine.ts`) doivent rester lisibles sans dépendre de la couleur du badge de sévérité (le texte du signal doit porter le sens à lui seul).
