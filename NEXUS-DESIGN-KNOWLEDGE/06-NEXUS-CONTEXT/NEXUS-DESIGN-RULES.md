# NEXUS DESIGN RULES

Règles opérationnelles, à vérifier avant toute modification visible utilisateur. Chaque règle indique son statut de preuve.

## Couleur

1. **[CONFIRMED]** Toute couleur utilisée doit exister comme token dans `globals.css` — jamais de hex/rgba en dur dans un composant.
2. **[CONFIRMED]** Le violet/lavande est réservé au signal "intelligence" (badges IA, focus, halo de sévérité) — jamais utilisé comme couleur décorative de section, de bouton générique ou de fond de page.
3. **[CONFIRMED]** Les couleurs sémantiques (success/warning/danger/info) ne portent jamais seules le sens — toujours accompagnées d'un label texte ou d'une icône distincte (`StatusDot` applique déjà ce contrat).
4. **[CONFIRMED]** Un seul CTA `primary` (fond blanc plein) par écran/section visible — les actions secondaires utilisent `secondary`/`ghost` (contrat documenté dans `button.tsx`).
5. **[CONFIRMED]** Contraste minimum WCAG AA : 4.5:1 texte normal, 3:1 grand texte et composants graphiques — mesuré et documenté dans `globals.css` pour la ramp actuelle. Toute nouvelle combinaison texte/fond doit être vérifiée avec la même rigueur avant merge.

## Typographie

6. **[CONFIRMED]** `display`/`display-lg`/`display-xl` sont réservés aux pages publiques — jamais utilisés dans le shell applicatif authentifié.
7. **[CONFIRMED]** Hiérarchie de titres stricte : un seul h1 par page, pas de saut de niveau (h1 → h3 sans h2).
8. **[INFERRED]** Les libellés de bouton et de navigation doivent rester courts et univoques (moins de ~24 caractères visibles) pour ne pas tronquer sur mobile — cohérent avec les `truncate` déjà appliqués systématiquement dans `nav-config`/`workspace-sidebar`.

## Spacing & densité

9. **[CONFIRMED]** La grille change de **nombre de colonnes** par device class, pas seulement de largeur de conteneur — respecter la table de `docs/DESIGN-SYSTEM-RESPONSIVE.md` / `NEXUS-TOKENS.md`.
10. **[CONFIRMED]** Marges de page : 16px mobile, 24px tablette, 32px desktop ; gouttière constante à 16px.
11. **[INFERRED]** Le dashboard et les vues de travail (tasks/projects/goals) visent une densité "dense mais respirable" façon Linear — jamais le vide généreux de la landing page (audience et intention différentes, voir `03-UX-REFERENCES/fluent-design.md`).

## Radius

12. **[CONFIRMED]** Chaque radius est nommé par usage de composant, pas par taille abstraite — un nouveau composant doit réutiliser le radius de sa famille (`card`, `dropdown`, `panel`...) ou en créer un nommé par usage, jamais piocher une valeur arbitraire.

## Mouvement

13. **[CONFIRMED]** Toute animation doit avoir un rôle nommé (état système, pas décor) et respecter la durée de sa catégorie (voir `02-DESIGN-SYSTEMS/motion-language.md`).
14. **[CONFIRMED]** Toute nouvelle animation doit avoir sa contrepartie `prefers-reduced-motion: reduce` dans le même changement.
15. **[CONFIRMED]** Aucune fonctionnalité ne doit dépendre exclusivement du survol (`:hover`) — toujours un équivalent tactile/clavier.

## Composants

16. **[CONFIRMED]** Ne jamais dupliquer un composant `ui/` existant — étendre ses props si un nouveau besoin apparaît, sauf si le nouveau besoin change fondamentalement le contrat d'accessibilité du composant (dans ce cas, documenter pourquoi un nouveau composant est nécessaire).
17. **[CONFIRMED]** `IconButton` impose un `label` accessible — aucune icône seule cliquable sans nom accessible n'est tolérée.
18. **[CONFIRMED]** Aucune donnée affichée dans le shell, le dashboard ou les listes ne doit être fabriquée/placeholder — toujours une vraie requête Supabase scoping RLS, même en état de chargement (utiliser un skeleton, pas une fausse donnée).

## Accessibilité

19. **[CONFIRMED]** Skip link présent en premier élément focusable du shell — ne jamais le retirer.
20. **[CONFIRMED]** Cible tactile minimale 44×44px sur mobile pour tout contrôle primaire ; 32px toléré uniquement pour un contrôle secondaire desktop avec pointeur précis.
21. **[CONFIRMED]** Jamais de `window.confirm()`/`window.alert()` natif pour une action destructrice — toujours `ConfirmDialog`.
22. **[CONFIRMED]** `role="alert"` réservé à ce qui doit interrompre un lecteur d'écran ; `role="status"` pour le reste.

## Contenu et ton

23. **[CONFIRMED]** Jamais de message d'erreur technique brut affiché à l'utilisateur — toujours traduit par la couche d'erreurs humaines (`schema-errors.ts`, `plan-errors.ts`, `auth-errors.ts` ou équivalent).
24. **[CONFIRMED]** Jamais de bouton désactivé sans expliquer pourquoi (texte adjacent ou `title` explicite).

## Intelligence / IA

25. **[CONFIRMED]** Toute mutation proposée par l'agent doit être confirmée par l'utilisateur avant exécution, puis vérifiée par relecture après écriture.
26. **[CONFIRMED]** Le niveau de confirmation exigé est proportionnel au risque de l'action (create = léger, update = medium, delete = confirmation renforcée obligatoire).
27. **[CONFIRMED]** L'assistant ne doit jamais répondre à partir de données non lues réellement dans le workspace — zéro hallucination de fait métier.
28. **[NEEDS DECISION]** Aucune UI de gestion visible des préférences mémorisées par l'IA n'existe encore — à concevoir explicitement avant de l'exposer à l'utilisateur, pas à improviser.

## Gouvernance

29. **[CONFIRMED]** Une décision de design déjà actée (voir `NEXUS-DESIGN-DECISIONS.md`) ne doit jamais être remplacée silencieusement par une préférence esthétique ponctuelle — toute évolution doit être documentée avec sa justification.
30. **[CONFIRMED]** Deux bundles de charte graphique historiques (`design/NEXUS-FINAL-BRAND-BUNDLE/`, `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/`) contiennent des valeurs différentes de l'implémentation réelle — ne jamais les utiliser comme référence sans vérifier `globals.css` en premier.
