# NEXUS COMPONENTS — inventaire et conventions

**Statut : [CONFIRMED]** sauf mention contraire. Source : `src/components/ui/*` et usages associés dans `src/components/layout`, `src/components/dashboard`, etc.

## Principe d'architecture des composants

- `src/components/ui/` = primitives **sans logique métier**, réutilisables partout.
- `src/components/<domaine>/` (dashboard, intelligence, integrations, landing, onboarding, auth, profile...) = composants de page qui **consomment** les primitives `ui/` et portent la logique métier.
- Un composant = un fichier ; export nommé (pas de `default export` pour les primitives partagées).
- `src/lib/cn.ts` : utilitaire maison de fusion de classes (pas de `clsx`/`tailwind-merge` en dépendance — choix délibéré de zéro dépendance supplémentaire pour cette fonction).

## Inventaire des primitives (`src/components/ui/`)

| Composant | Rôle | Points d'attention |
|---|---|---|
| `Button`, `ButtonLink`, `IconButton` | Bouton système, 5 variants (`primary/secondary/ghost/danger/icon`), 4 tailles, états `loading/success/error` intégrés | `IconButton` impose un `label` accessible ; `IconButton` interdit d'exister sans nom accessible |
| `Card`, `SectionHeader`, `Panel` | Surfaces de contenu | `Panel` gère en-tête + corps + pied optionnels ; `interactive` sur `Card` ajoute hover/active |
| `Badge`, `CountBadge`, `StatusDot` | Étiquettes de statut/compte | `StatusDot` associe toujours point de couleur + label texte |
| `Modal` | Dialogue modal, sheet mobile / dialog desktop selon breakpoint | Gestion de focus (restitution au fermer), `Escape`, verrouillage du scroll body |
| `ConfirmDialog` | Confirmation d'action destructrice, construit sur `Modal` | **Seul chemin autorisé** pour confirmer une suppression — jamais `window.confirm()` |
| `Dropdown`, `DropdownLabel`, `DropdownLink`, `DropdownSeparator` | Menu contextuel | Contrôlé ou non-contrôlé (`open`/`onOpenChange` optionnels) |
| `Toast`, `ToastProvider`, `useToast` | Notification éphémère | 4 tons (`success/danger/info/warning`), auto-dismiss avec timer visible |
| `Input`, `Textarea`, `Select`, `Field`, `Checkbox` | Contrôles de formulaire | `Field` impose un `label` texte (jamais placeholder seul) |
| `PasswordInput` | Champ mot de passe avec bascule visibilité | Construit sur `Input` |
| `NavItem`, `SectionLabel`, `MobileNavItem` | Navigation | `NavItem` affiche un indicateur actif en barre **lavande** verticale (`bg-lavender`) — c'est un des rares usages de l'accent intelligence en dehors de l'IA elle-même : `[INFERRED]` il agit ici comme signal de "position actuelle dans le système", pas de "ceci vient de l'IA" — nuance à connaître avant de restreindre davantage l'usage de la lavande |
| `EmptyState`, `ErrorState`, `Alert`, `Progress`, `ListRow` | États de contenu | Voir `05-COMPONENT-PATTERNS/empty-loading-error-states.md` |
| `PageHeader` | En-tête de page standard (titre + actions) | À utiliser pour toute nouvelle page de premier niveau du shell |
| `PageSkeleton` (+ variantes) | Squelette de chargement respectant la mise en page finale | |
| `Tabs` | Onglets | |
| `Divider` | Séparateur | |
| `CreateButton` | Bouton de création signature (pill + badge interne) | Composant "signature" identifié dans les chartes historiques — vérifier cohérence visuelle avec `accent-badge` |
| `NexusGrid` | Fond de grille décoratif (landing) | Décoratif, `pointer-events-none` attendu |
| `NexusAuthBackground`, `BlackholeHeroSection`, `CanvasRevealEffect`, `SignInFlow1` | Effets visuels spécifiques (auth, landing) | Composants d'atmosphère, ne portent pas de logique de formulaire |

## Composants de domaine notables

| Domaine | Fichier(s) clé | Rôle |
|---|---|---|
| Layout | `app-shell.tsx`, `topbar.tsx`, `workspace-sidebar.tsx`, `nav-config.ts` | Shell applicatif — voir `05-COMPONENT-PATTERNS/navigation-and-shell.md` |
| Dashboard | `kpi-grid.tsx`, `active-projects.tsx`, `briefing-panel.tsx`, `priority-queue.tsx`, `upcoming-panel.tsx` | Vue d'ensemble, toutes les valeurs viennent de vraies requêtes |
| Intelligence | `intelligence/*`, `nexus-intelligence/*` | UI + scène 3D de l'assistant — voir `04-AI-DESIGN-SYSTEMS/` |
| Integrations | `integration-hub.tsx`, `integration-icon.tsx` | Voir `NEXUS-INTEGRATIONS.md` |
| Onboarding | `onboarding-provider.tsx`, `guided-tour.tsx`, `checklist.tsx`, `contextual-tip.tsx`, `help-center.tsx`, `welcome-screen.tsx`, `spotlight.tsx` | Un seul canal de guidance actif à la fois (tour **ou** checklist/tip/aide), jamais deux simultanément — règle produit documentée dans `PRODUCT_UX_REWORK_REPORT.md` |
| Mobile | `mobile-home/mobile-overview.tsx` | Hiérarchie d'écran mobile dédiée, pas un rétrécissement du desktop |
| Motion | `motion/intelligence-states.tsx`, `motion/page-transition.tsx`, `motion/use-reduced-motion.ts` | Hook `useReducedMotion` à utiliser avant toute animation `framer-motion` |
| Command | `command-menu.tsx` | Voir `05-COMPONENT-PATTERNS/command-center.md` |

## Composants candidats à réutiliser plutôt qu'à recréer

Avant de créer un nouveau composant, vérifier s'il existe déjà une primitive qui couvre le besoin :
- Besoin d'un état vide/erreur → `EmptyState`/`ErrorState`, jamais un nouveau bloc ad hoc.
- Besoin de confirmer une action → `ConfirmDialog`, jamais un nouveau modal de confirmation dédié.
- Besoin d'un menu contextuel → `Dropdown`, jamais un `<div>` positionné en absolu fait main.
- Besoin d'afficher une progression → `Progress`, jamais une barre stylée sans rôle ARIA.
- Besoin d'un badge de statut → `Badge`/`StatusDot`, jamais un `<span>` coloré ad hoc.

## Composants potentiellement incohérents ou à surveiller `[INFERRED]`

- `tailwind.config.js` à la racine suggère un environnement de prototypage de composants séparé de l'app (`index.html`) — si des composants y sont un jour développés, vérifier qu'ils sont bien portés dans `src/components/ui/` avant utilisation réelle, pas laissés à vivre en double.
- Le dossier `design/*/nexus-implementation-bundle/components/ui/` contient des versions **alternatives** de `avatar`, `badge`, `card`, `button`, `dropdown-menu`, `input` — ce sont des propositions de conception historiques, **pas** des composants actifs de l'application. Ne jamais les importer directement ; s'ils contiennent une bonne idée, la porter consciemment dans `src/components/ui/` en la confrontant aux conventions réelles (tokens, accessibilité) déjà en place.

## Composants manquants identifiés `[NEEDS DECISION]`

- Pas de composant `RetryableErrorState` générique (voir `05-COMPONENT-PATTERNS/empty-loading-error-states.md`).
- Pas de composant de gestion visible des préférences mémorisées par l'IA (voir `04-AI-DESIGN-SYSTEMS/memory-and-context.md`).
- Pas de Storybook/catalogue visuel des composants — toute revue de cohérence visuelle doit donc se faire par lecture de code, pas par navigation d'un catalogue.
