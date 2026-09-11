# NEXUS Iconography [CONFIRMED — extrait du code]

## Bibliothèques

- **`lucide-react`** — icônes fonctionnelles génériques de toute l'interface (navigation, actions, statuts). `package.json` la déclare en dépendance directe (version `^1.31.0`, notation particulière de ce fork/tag — à vérifier lors d'une mise à jour de dépendance).
- **`simple-icons`** — logos de marques réelles pour les intégrations (`google-calendar`, `github`, `notion`, `linear`, `jira` via `si*` exports). Utilisé exclusivement dans `src/components/integrations/integration-icon.tsx`.

## Règle de tracé (stroke) [CONFIRMED]

`strokeWidth={1.75}` est l'épaisseur dominante et quasi systématique (168 occurrences relevées dans `src/components`, loin devant toute autre valeur). C'est **le standard de facto** pour toute icône Lucide dans NEXUS. Exceptions observées et leur contexte :
- `strokeWidth={2}` / `{2.5}` : ponctuel, sur des icônes très petites où un trait plus épais reste lisible (à documenter au cas par cas, pas une règle générale).
- Valeurs `"1.6"`, `"0.6"`, `"5"` : tracés SVG **inline custom** (spinner, check de succès, path de marque) qui ne sont pas des icônes Lucide et suivent leur propre logique de dessin.

**Règle pour l'agent** : toute nouvelle icône Lucide ajoutée à l'UI doit utiliser `strokeWidth={1.75}` sauf justification explicite documentée en commentaire.

## Tailles [CONFIRMED]

Les tailles les plus fréquentes sont 14 et 15px (respectivement 54 et 65 occurrences), suivies de 12–13px et 16–17px. Il n'existe pas de token Tailwind dédié à la taille d'icône (`size` reste une prop numérique passée directement au composant Lucide) — la convention observée :

| Contexte | Taille typique |
|---|---|
| Icône dans badge/label compact, métadonnée | 12–13px |
| Icône dans item de nav, bouton standard, ligne de liste | 14–15px |
| Icône dans bouton large / en-tête de section | 16–17px |
| Icône décorative de grande taille (empty state, hero) | 18–20px+ |

**Règle pour l'agent** : ne pas inventer une nouvelle taille intermédiaire (ex. 15.5px) — choisir parmi les paliers déjà en usage ci-dessus selon le contexte, pour préserver une grille visuelle cohérente.

## Icônes toujours décoratives vs porteuses de sens [CONFIRMED — pattern à généraliser]

Toute icône qui n'apporte pas d'information non redondante avec le texte adjacent doit porter `aria-hidden="true"` (déjà observé massivement dans `command-menu.tsx`, `button.tsx`, `feedback.tsx`). Une icône qui est le **seul** porteur d'action (bouton icône seul) doit être enveloppée dans un composant qui impose un `aria-label`/`label` — c'est déjà le contrat de `IconButton` (`ui/button.tsx`).

## Icônes de marque (intégrations) [CONFIRMED]

Voir `06-NEXUS-CONTEXT/NEXUS-INTEGRATIONS.md` pour l'architecture complète. Règles extraites du code existant :
- Les logos de marque proviennent de `simple-icons` (`siGithub.path`, `siNotion.path`...), rendus dans un `<svg>` avec `fill="currentColor"` — la couleur de marque officielle **n'est pas utilisée** (le trait suit la couleur de texte NEXUS environnante, monochrome). C'est un choix déjà fait et cohérent avec l'identité "jamais de logo tiers en couleur qui casse l'palette NEXUS".
- Exception documentée : Slack a demandé le retrait de son logo de `simple-icons` (raison de marque) — NEXUS conserve un path SVG inliné, sourcé et daté en commentaire (`simple-icons@10.4.0`). **Ne jamais remplacer un logo de marque manquant par un emoji ou une icône générique non liée** — le pattern à suivre est celui de Slack : sourcer le path officiel ailleurs et documenter sa provenance.
- Une intégration sans logo de marque disponible (ex. "NEXUS Webhooks", qui est un concept propre au produit, pas une marque tierce) utilise une icône Lucide neutre (`Webhook`) — jamais un logo générique inventé qui prétendrait représenter une marque inexistante.

## Ce qu'il ne faut jamais faire

- Ne jamais utiliser un emoji comme substitut d'icône de marque officielle.
- Ne jamais recolorer un logo de marque tiers dans une couleur qui n'est ni la couleur de marque officielle ni le monochrome `currentColor` déjà en usage — pas de dégradé, pas de glow sur un logo tiers.
- Ne jamais mélanger deux bibliothèques d'icônes fonctionnelles dans une même famille de composants (tout ce qui n'est pas un logo de marque reste en Lucide).
