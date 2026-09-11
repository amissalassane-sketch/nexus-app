# NEXUS — UI Quality Checklist

Checklist resserrée, pensée pour une revue rapide d'un composant ou d'un écran isolé (par opposition à `design-review-checklist.md` qui couvre l'ensemble Visual/UX/Product/Technical d'une fonctionnalité).

## Tokens et valeurs

- [ ] Aucune couleur hex/rgba en dur — uniquement des classes Tailwind générées par `globals.css` (`bg-*`, `text-*`, `border-*`).
- [ ] Aucune durée/easing en dur qui duplique `--duration-*`/`--ease-*` existant.
- [ ] Radius choisi dans la liste nommée par usage (`NEXUS-TOKENS.md`), jamais une valeur arbitraire.
- [ ] Typographie choisie dans l'échelle `text-*` existante ; `display*` absent du shell applicatif.

## États d'interaction (à vérifier pour CHAQUE élément interactif)

- [ ] `hover` défini (desktop) ET équivalent tactile (`active:`) défini (mobile) — jamais l'un sans l'autre.
- [ ] `focus-visible` visible et distinct (ring lavande ou équivalent), jamais supprimé sans remplacement.
- [ ] `disabled` a une opacité réduite ET une explication textuelle si la raison n'est pas évidente.
- [ ] `loading` bloque l'interaction répétée (double-submit) et affiche un indicateur clair.
- [ ] Cible tactile ≥ 44×44px sur mobile pour tout contrôle primaire ; 32px minimum absolu pour un contrôle secondaire desktop.

## Composant

- [ ] Ce composant existe-t-il déjà dans `src/components/ui/` sous un nom différent ? (chercher avant de créer)
- [ ] Le composant a-t-il une seule responsabilité claire, ou mélange-t-il présentation et logique métier qui devrait vivre dans `lib/` ?
- [ ] Les props sont-elles typées strictement (TypeScript), avec des unions plutôt que des booléens multiples ambigus ?
- [ ] Le composant fonctionne-t-il sans JavaScript pour son état de base (`@media (scripting: none)`) quand c'est pertinent (contenu, pas interaction complexe) ?

## Mouvement

- [ ] L'animation ajoutée a-t-elle un nom d'usage (pas un nom d'effet) ?
- [ ] La variante `prefers-reduced-motion: reduce` est-elle présente dans le même changement ?
- [ ] La durée correspond-elle à la catégorie de l'élément (`02-DESIGN-SYSTEMS/motion-language.md`) ?

## Contenu

- [ ] Aucun texte de remplissage "Lorem ipsum" ou placeholder factice dans le rendu final.
- [ ] Aucun message d'erreur technique brut visible par l'utilisateur.
- [ ] Les libellés de bouton sont des verbes d'action clairs ("Create task", pas "Submit" générique).
- [ ] Le ton reste cohérent avec le reste du produit (direct, factuel, jamais survendu — cf. `COPY_REWRITE_REPORT.md`).

## Icônes

- [ ] `strokeWidth={1.75}` pour toute icône Lucide fonctionnelle, sauf exception justifiée.
- [ ] Taille choisie dans les paliers en usage (12–13 / 14–15 / 16–17px selon contexte, `02-DESIGN-SYSTEMS/iconography.md`).
- [ ] Icône purement décorative → `aria-hidden="true"`.
- [ ] Icône seule cliquable → `aria-label` obligatoire (utiliser `IconButton`).
- [ ] Logo de marque tierce → `simple-icons`, monochrome `currentColor`, jamais un emoji de substitution.

## Responsive

- [ ] Testé (au moins mentalement) à 360/768/1024/1440px.
- [ ] Le nombre de colonnes s'adapte au device class, pas seulement la largeur.
- [ ] Aucun texte tronqué de façon illisible aux paliers étroits (utiliser `truncate` + `title`/`aria-label` si nécessaire).
- [ ] Aucune fonctionnalité qui dépend exclusivement du survol sur un contexte tactile.
