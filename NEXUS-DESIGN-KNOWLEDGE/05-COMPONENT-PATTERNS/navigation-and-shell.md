# Pattern — Navigation et shell applicatif [CONFIRMED, src/components/layout/*]

## Source unique de l'information architecture

`src/components/layout/nav-config.ts` est **l'unique** déclaration de la structure de navigation (`NAV_GROUPS`, `NAV_FOOTER`, `ALL_NAV_ENTRIES`, `MOBILE_NAV`, `TITLES`, `breadcrumbFor`, `isNavActive`). La sidebar, la navigation mobile, le fil d'ariane et le Command Menu la consomment tous — **règle absolue : ajouter une destination se fait une seule fois dans ce fichier, jamais en dur dans un composant de layout**. Toute nouvelle page du shell authentifié doit être déclarée ici avant d'être reliée ailleurs.

## Structure de la sidebar [CONFIRMED]
- Groupe **Primary** (sans label visible) : Overview, Intelligence — les deux destinations "vue d'ensemble", accessibles en premier.
- Groupe **WORK** : Projects, Tasks, Goals — avec compteur live (`count: NavCountKey`) résolu par le shell depuis Supabase.
- Groupe **WORKSPACE** : Activity, Notifications (compteur accentué), Integrations.
- **Footer** séparé : Settings, Billing, Plans — délibérément hors des groupes principaux car ce sont des destinations de configuration, pas de travail quotidien.

## Shell responsive [CONFIRMED]
- **Desktop (`lg:` ≥ 1024px)** : sidebar fixe 248px + Topbar.
- **Mobile/tablette (< 1024px)** : header 56px (`--chrome-nav-bar`) avec menu hamburger → drawer, + barre de navigation basse à 4 destinations (`MOBILE_NAV` = les 4 premières entrées de `ALL_NAV_ENTRIES` : Overview, Intelligence, Projects, Tasks) + accès "More" vers le drawer pour le reste. Règle documentée dans `PHASE6-FINAL-REPORT.md` : **1 geste** pour les 4 actions/destinations principales, **2 gestes maximum** pour atteindre n'importe quelle autre destination du produit.
- **Skip link** (`Skip to content`) présent en premier élément focusable de l'arbre — ne jamais le retirer lors d'une refonte de shell.
- **`NexusSpatialField`** : couche visuelle de fond, `pointer-events-none`, positionnée derrière tout le contenu — ne doit jamais intercepter un clic, un scroll, une sélection de texte ou une boîte de dialogue. Toute nouvelle couche décorative de fond doit respecter la même contrainte.

## Sécurité de la donnée affichée [CONFIRMED]
Tous les compteurs de la sidebar (`ShellCounts`), le plan (`ShellPlan`), l'utilisateur (`ShellUser`) et le workspace (`ShellWorkspace`) sont **résolus côté serveur via Supabase et transmis en props** — le shell "ne calcule, n'invente ni ne défaut jamais un nombre" (commentaire source). Toute nouvelle donnée affichée dans le shell doit suivre le même contrat : provenir d'une vraie requête, jamais d'un placeholder codé en dur "pour la démo".

## États de workspace [CONFIRMED]
`ShellWorkspace.status` peut valoir `"ready" | "preparing" | "failed"` — le shell doit pouvoir représenter un workspace en cours de bootstrap ou en échec, pas seulement l'état nominal. Toute nouvelle vue qui dépend du workspace doit gérer ces trois états, pas seulement le cas heureux.

## Anti-patterns à éviter
- Dupliquer une liste de navigation en dur dans un composant plutôt que d'importer `nav-config.ts`.
- Ajouter une destination dans la sidebar sans réfléchir à son équivalent mobile (`MOBILE_NAV` ou drawer) — toute nouvelle route de premier niveau doit être positionnée consciemment dans l'un des deux, jamais oubliée sur mobile par défaut.
- Faire dépendre une action de navigation uniquement du survol (`hover`) sans équivalent tactile — cf. `01-CORE-PRINCIPLES/laws-of-ux.md` et les media queries `hover`/`pointer` déjà en place dans `globals.css`.
