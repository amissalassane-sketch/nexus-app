# NEXUS BRAND

## Positionnement `[CONFIRMED, extrait des métadonnées et du copy réel]`

NEXUS se présente comme un **Personal Operating System** / "Operational Intelligence for Modern Teams" (`src/app/layout.tsx`, métadonnées). Promesse centrale telle qu'écrite dans le code : *"NEXUS reads the work already in your workspace and surfaces what is drifting, blocked or at risk — and what to do next."* Le positionnement est délibérément **anti-chat générique** : *"It reads the work, not the chat."* — l'assistant ne demande pas à l'utilisateur de tout ré-expliquer, il observe le travail déjà présent.

Conséquence directe pour le design : l'identité visuelle doit renforcer cette idée de lecture/observation silencieuse plutôt que de conversation bavarde — d'où l'usage restreint et fonctionnel de la couleur d'intelligence (voir plus bas), et l'intégration de l'IA dans les workflows plutôt que dans un chatbot isolé (voir `NEXUS-UX-PRINCIPLES.md` §20).

## Nom du design system `[CONFIRMED]`

**"NEXUS V3 — Pill Atelier Noir"**, déclaré littéralement dans `src/app/globals.css` et `tailwind.config.js`. À utiliser tel quel dans toute communication interne sur le design system — ne pas renommer sans décision explicite consignée dans `NEXUS-DESIGN-DECISIONS.md`.

## Logo `[CONFIRMED — asset verrouillé]`

`src/components/nexus-logo.tsx` documente littéralement en commentaire : *"NEXUS logo — LOCKED ASSET. The mark is the white interlaced architectural 'N'... It is rendered from the master PNG, never redrawn: no gradient, no chrome, no rounded corners, no filled central gap, no geometry change."*

- `NexusLogo` affiche l'image maîtresse (`public/logo/nexus.png` en variante blanche, `nexus-black.png` en variante noire) — **jamais un recalque SVG**, toujours le PNG fourni.
- Tailles verrouillées dans le code : **28px dans l'UI courante, 48px sur les écrans d'authentification.** Ne pas introduire une troisième taille sans raison documentée.
- `NexusWordmark` = logo + texte "NEXUS" (Inter 600, `tracking-[0.08em]`, majuscules) — c'est le composant utilisé par la sidebar et le shell.
- Les chartes historiques (`design/*/nexus-brand-guide/CHARTE-GRAPHIQUE.md`) ajoutent des règles de protection cohérentes avec ce commentaire : interdiction d'arrondir, de remplir le espace central, d'ajouter un dégradé, un contour, un glow, une rotation 3D, ou une couleur autre que blanc/noir. **Ces interdictions sont déjà respectées par l'implémentation actuelle (rendu PNG brut, deux variantes de couleur seulement) et doivent le rester.**
- Toute future modification du logo doit passer par un nouvel export PNG maîtrisé, jamais par une recréation CSS/SVG du symbole.

## Réconciliation des chartes graphiques historiques `[CONFIRMED — divergence identifiée]`

Deux documents `CHARTE-GRAPHIQUE.md` existent dans `design/NEXUS-FINAL-BRAND-BUNDLE/` et `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/` (contenu identique entre les deux). Ils décrivent des valeurs qui **ne correspondent plus** à l'implémentation réelle après les passes d'audit de contraste documentées dans `globals.css` :

| Aspect | Charte historique | Implémentation réelle (`globals.css`) | Verdict |
|---|---|---|---|
| Fond de base | `#0A0A0A` | `#000000` | **L'implémentation réelle fait foi.** |
| Texte secondaire | `#8F8F8F` | `#b0b0b0` | Réel plus clair — issu de la passe de contraste AA documentée. **L'implémentation réelle fait foi.** |
| Texte tertiaire | `#5A5A5A` | `#9c9c9c` | Écart important — probablement daté d'avant l'audit AA. **L'implémentation réelle fait foi.** |
| Radius inputs/nav | `md 10px` | `--radius-input: 8px` | **L'implémentation réelle fait foi.** |
| Radius dropdown | `16px` | `--radius-dropdown: 12px` | **L'implémentation réelle fait foi.** |
| Bordure "strong" | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.14)` | Écart mineur. **L'implémentation réelle fait foi.** |

**Règle de gouvernance** : `src/app/globals.css` est la seule source de vérité de token. Les bundles `design/` sont conservés comme **archive historique de direction artistique et d'intention** (composants "signature" : Create Button, Dropdown Menu, Sidebar, TopBar, mise en page Login/Dashboard/Pricing) — utiles pour comprendre *l'intention* derrière un composant, jamais pour en extraire une valeur numérique qui contredirait `globals.css`. Si une future revue de marque souhaite réaligner ces bundles sur l'implémentation réelle, ce serait une modification de documentation d'archive, pas une modification de l'application.

## L'accent lavande — statut protégé `[CONFIRMED — contrainte explicite du brief respectée par le code]`

Le violet/lavande (`--color-lavender: #e9e4ff`) est **la seule couleur d'accent liée à l'intelligence** dans tout le système. Citation du code : *"Intelligence accent — restrained violet/blue-white, used sparingly."* Usages confirmés :
- Halo de focus des champs de formulaire (`shadow` lavande à 14% d'opacité).
- Ring de focus visible (`focus-visible:ring-lavender-border`) sur les contrôles interactifs.
- Barre active de `NavItem` dans la sidebar (indicateur de position, pas de badge IA).
- Badges/éléments liés directement à des capacités d'intelligence (signaux, cartes d'analyse).

**Règle de marque non négociable** : ne jamais étendre la lavande à une couleur de section décorative, à un dégradé de fond de page, ou à un habillage de landing qui la ferait dominer visuellement. Elle doit rester perceptible comme un signal, jamais comme un thème de couleur généralisé — c'est explicitement la contrainte demandée pour NEXUS ("le violet peut être utilisé comme accent... mais il ne doit pas envahir toute l'interface").

## Ce qui constitue l'identité NEXUS protégée (à ne jamais dériver d'un produit tiers)

- Le nom "Pill Atelier Noir" et sa palette de surfaces quasi-noires.
- Le nom des sections produit : Overview, Intelligence, Projects, Tasks, Goals, Activity, Notifications, Integrations, Settings, Billing, Plans (`nav-config.ts`) — vocabulaire propre à NEXUS, jamais remplacé par un vocabulaire emprunté à un concurrent (ex. ne pas renommer "Goals" en "OKRs" façon un autre produit sans décision produit).
- Le ton éditorial déjà audité (`COPY_REWRITE_REPORT.md`) : direct, factuel, jamais survendu ("It reads the work, not the chat").
- La séparation stricte entre ce que l'IA propose et ce que le système exécute (jamais d'automatisation silencieuse à fort impact).

## Ce qui reste ouvert `[NEEDS DECISION]`

- Réconciliation formelle (ou archivage explicite) des bundles `design/*` avec une note indiquant qu'ils sont historiques — actuellement aucun fichier ne signale explicitement leur statut d'archive aux futurs contributeurs humains ou agents.
