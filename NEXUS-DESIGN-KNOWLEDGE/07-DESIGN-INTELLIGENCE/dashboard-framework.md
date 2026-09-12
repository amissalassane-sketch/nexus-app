# NEXUS — Dashboard Framework

## Composition réelle actuelle `[CONFIRMED, src/components/dashboard/*, src/app/(app)/dashboard/page.tsx]`

- `KpiGrid` — métriques clés, chacune cliquable vers sa vue filtrée réelle (pas un simple chiffre statique).
- `BriefingPanel` — synthèse générée par le moteur d'intelligence déterministe.
- `PriorityQueue` — ce qui mérite l'attention immédiate.
- `ActiveProjects` — projets en cours avec leur état réel.
- `UpcomingPanel` — échéances proches.

## Principe directeur `[CONFIRMED + INFERRED]`

Le dashboard répond en premier écran à **"qu'est-ce qui compte maintenant ?"**, pas seulement "voici toutes mes données". C'est la même hiérarchie que celle documentée pour `MobileHome` (`PHASE6-FINAL-REPORT.md`) : où j'en suis → qu'est-ce qui nécessite mon attention → quelle est la prochaine meilleure action → contexte de support. Un dashboard qui empile des widgets sans hiérarchie d'attention contredit ce principe.

## Règles de contenu

- **Chaque nombre affiché vient d'une vraie requête Supabase scoping RLS** — jamais un exemple statique, jamais un placeholder "0" qui prétendrait être une vraie donnée en attendant le chargement (utiliser un skeleton à la place).
- **Chaque KPI mène quelque part** (`href` sur `KpiItem`) — un chiffre affiché sans action de suivi possible est une occasion manquée, pas une simple donnée informative.
- **La densité du dashboard doit rester "dense mais respirable"** (référence Linear/Fluent, `03-UX-REFERENCES/`) — pas le vide généreux de la landing, pas la surcharge d'une console d'administration.

## Grille responsive du dashboard

- `grid-cols-2` (mobile) → `sm:grid-cols-3` → `xl:grid-cols-6` pour `KpiGrid` — le nombre de colonnes suit la logique générale de la grille NEXUS (changer de colonnes, pas seulement la largeur).
- Sur mobile, le dashboard cède la place à `MobileHome` qui réordonne les mêmes informations selon une hiérarchie d'écran dédiée, pas un simple empilement vertical du dashboard desktop.

## Checklist spécifique dashboard

- [ ] Le nouveau widget répond-il à une vraie question utilisateur ("qu'est-ce qui compte maintenant ?"), ou ajoute-t-il de l'information sans hiérarchie ?
- [ ] Le widget a-t-il un état vide honnête (pas de "0" trompeur pendant le chargement) ?
- [ ] Le widget mène-t-il vers une action ou une vue de suivi réelle ?
- [ ] Le widget a-t-il un équivalent pensé pour `MobileHome`, pas seulement un rétrécissement automatique ?
- [ ] La donnée provient-elle d'une vraie requête, jamais d'un exemple codé en dur ?
- [ ] Le nouveau widget respecte-t-il la densité du reste du dashboard (même famille de `Card`/`Panel`, mêmes tailles de police) ?
