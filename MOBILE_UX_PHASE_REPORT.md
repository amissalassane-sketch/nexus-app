# NEXUS — PHASE MOBILE UX · Rapport final

Date : 2026-08-26
Branche : `arena/01a03df9-nexus-app`
Base : `1bef74c` (master) — Phase mobile UX appliquée sur la branche de session Arena (le nom de branche du cahier des charges, `arena/01a03d08-nexus-app`, ne pouvait pas être utilisé : cette session est liée à `arena/01a03df9-nexus-app`, tout le travail y a été committé).

Périmètre respecté : uniquement UX/UI/responsive/touch/navigation/mobile/perf frontend. Aucun changement sur Auth, RLS, modèle Supabase, moteur Intelligence, agent loop, Memory/Signal/Mission engines, APIs métier, logique de mutation, permissions ou règles de confirmation.

---

## 1. Audit initial

Audit réel du code existant (lecture intégrale des composants concernés, pas de supposition) :

- **Shell applicatif** : `src/components/layout/app-shell.tsx`, `workspace-sidebar.tsx`, `topbar.tsx`, `ui/navigation.tsx`, `nav-config.ts`.
- **Pages** : dashboard, `(app)/app/intelligence`, tasks, projects, goals, activity, notifications, integrations, settings, upgrade.
- **Intelligence** : `intelligence-ask.tsx`, `intelligence-view.tsx`, `mission-panel.tsx`, `signal-card.tsx`, `signal-detail.tsx`, `proactive-signals-panel.tsx`, health/briefing/priority/forecast panels, canvas réseau.
- **UI** : button, input, modal, dropdown, feedback, toast, card, page-header, create-button.
- **Gestionnaires métier** : task-manager, project-manager, goal-manager.
- **Globals** : `globals.css` (tokens Tailwind v4, motion, `prefers-reduced-motion` déjà globalement géré).
- **PWA** : aucune infrastructure existante (pas de manifest, pas de service worker).

Le projet avait déjà une base mobile honnête (bottom nav 4 entrées + drawer, header compact, toast au-dessus de la nav, listes non-tableaux). L'audit visait donc à durcir et compléter plutôt qu'à reconstruire.

## 2. Problèmes détectés

| # | Problème | Gravité |
|---|---|---|
| 1 | `viewport-fit=cover` absent → `env(safe-area-inset-*)` toujours à 0 sur iOS : header, drawer et sheets passaient sous la notch / l'indicateur d'accueil | Haute |
| 2 | Header mobile sans titre de page (wordmark à la place) ; icônes de 28–32px seulement | Moyenne |
| 3 | Drawer : header/footer sans safe-area ; items de nav de 34px | Moyenne |
| 4 | `window.confirm()` natif pour les suppressions (Tasks/Projects/Goals) — chrome navigateur, mauvais sur mobile, non stylé | Moyenne |
| 5 | Modal : panneau centré `p-4` pouvant dépasser l'écran sur petit téléphone ; boutons d'action en bas de scroll | Moyenne |
| 6 | Intelligence Ask : champ **mono-ligne** (`<input>`), pas de multi-ligne ; trace agent et outils rendus en chaîne horizontale qui devient un mur de texte sur mobile | Haute (priorité) |
| 7 | Signaux : CTA de 28px (h-7), toggle "Why" de 12px de haut | Moyenne |
| 8 | "Mark as read" (notifications) visible **uniquement au hover** → inaccessible au tactile | Haute |
| 9 | Dropdowns à largeur fixe (244–248px) sans clamp viewport (débordement possible à 320px) | Basse |
| 10 | Pas de manifest / d'icônes installables (préparation PWA inexistante) | Basse (préparation) |
| 11 | `/manifest.webmanifest` redirigé vers /login par le proxy middleware (bug découvert en test) | Haute pour la prépa |
| 12 | Toast mobile sans safe-area bottom | Basse |
| 13 | Aucune protection contre l'inflation de texte iOS au changement d'orientation | Basse |
| 14 | Boutons primaires de 36px (h-9) partout — sous la zone tactile confortable | Moyenne |

Points déjà corrects (confirmés, non modifiés) : scroll `main` unique + body `overflow-x:hidden`, `prefers-reduced-motion` global, bottom nav avec `pb-[env(safe-area-inset-bottom)]`, listes tasks/projects en lignes (pas de tableaux), états loading/empty/error complets, Mission Panel vertical, cartes signal avec preuves repliables, `min-w-0`/`truncate` largement utilisés.

## 3. Composants modifiés

| Fichier | Changement |
|---|---|
| `src/app/layout.tsx` | `viewportFit: "cover"`, metadata `appleWebApp` |
| `src/app/manifest.ts` (nouveau) | Manifest web app (standalone, icônes, shortcuts) |
| `public/icons/icon-180/512.png` (nouveaux) | Icônes installables issues du brand bundle |
| `src/proxy.ts` | Matcher exclut les assets statiques + `webmanifest` de l'auth middleware |
| `src/app/globals.css` | `-webkit-text-size-adjust`, `overscroll-behavior-x`, token `sheet-in` |
| `src/components/layout/app-shell.tsx` | Header mobile (titre de page, targets ≥40px, safe-area), drawer safe-area, footer drawer |
| `src/components/layout/workspace-sidebar.tsx` | Targets drawer ≥40px (recherche, create) |
| `src/components/ui/navigation.tsx` | `MobileNavItem` (labels, pressed state), `NavItem` 40px en drawer |
| `src/components/ui/dropdown.tsx` | Clamp `max-w-[calc(100vw-24px)]`, items 36px mobile, pressed state |
| `src/components/command-menu.tsx` | Hints clavier masqués < `sm` |
| `src/components/ui/toast.tsx` | Safe-area bottom |
| `src/components/ui/modal.tsx` | **Bottom sheet** < `sm` (grip, header/body/footer, scroll interne, safe-area) ; dialog centré conservé ≥ `sm` |
| `src/components/ui/confirm-dialog.tsx` (nouveau) | Confirmation applicative (remplace `window.confirm`) |
| `src/components/task-manager.tsx` | Ligne mobile : titre + méta (priorité/statut/échéance), actions toujours visibles, ConfirmDialog |
| `src/components/project-manager.tsx` | ConfirmDialog, targets |
| `src/components/goal-manager.tsx` | ConfirmDialog, targets |
| `src/components/ui/button.tsx` | Tailles +1 pas < `sm` (md 40px, lg 44px, icon 36px), pressed states |
| `src/components/ui/create-button.tsx` | 40px mobile |
| `src/components/notification-center.tsx` | "Mark as read" visible au tactile |
| `src/components/intelligence/intelligence-ask.tsx` | **Composer multi-ligne** (Enter=envoi, Shift+Enter=retour ligne, `enterKeyHint=send`, auto-grow) ; **trace agent et outils en accordéons** avec résumé |
| `src/components/intelligence/intelligence-view.tsx` | Filtres sévérité 36px mobile |
| `src/components/intelligence/mission-panel.tsx` | Label "Prochaine meilleure action", lisibilité étapes |
| `src/components/intelligence/signal-card.tsx` | CTA ≥36px mobile, toggle preuves tactile |
| `src/components/intelligence/signal-detail.tsx` | Safe-areas haut/bas du panneau mobile |
| `scripts/test-mobile-ux.mjs` (nouveau) + `package.json` | Suite de tests structurels (`npm run test:mobile`) |

## 4. Architecture mobile retenue

Mobile-first *sans* être mobile-only :

- **`lg` (1024px)** reste la frontière shell : ≥ lg → sidebar 248px fixe + topbar ; < lg → header mobile + bottom nav + drawer.
- Hiérarchie de scroll unique : `page → contenu → overlay (drawer/sheet)` ; chaque overlay gère son propre scroll interne, jamais de scroll imbriqué dans le contenu.
- **Safe areas systématiques** : header, drawer, bottom nav, modales/sheets, signal detail, toasts (via `env(safe-area-inset-*)`, rendu effectif par `viewport-fit=cover`).
- **Taille tactile** : contrôles importants ≥40px (44px pour les actions de mission/intelligence), révélations hover doublées d'un état visible au tactile, `active:` partout.

## 5. Navigation mobile

- Bottom nav : **Home, Intelligence, Projects, Tasks** + bouton "More" (drawer) — aucune entrée supprimée ; Goals/Activity/Notifications/Integrations/Settings/Billing/Plans restent dans le drawer.
- Drawer : fermeture par ✕, scrim (clic extérieur), `Escape`, et automatiquement à la navigation (`onNavigate={closeNav}`).
- Header mobile : bouton menu (40px), **titre de page courant** (breadcrumb), recherche, notifications, aide, avatar — le tout ≥40px de zone tactile.
- Le drawer rend la sidebar complète (workspace switcher, recherche, create, groupes, plan) : rien n'est inaccessible.

## 6. Intelligence mobile

- **Composer** : textarea multi-ligne auto-agrandissable (jusqu'à ~5 lignes), Enter = envoi, Shift+Enter = nouvelle ligne, `enterKeyHint="send"` (clavier mobile), bouton "Ask NEXUS" ≥44px, bouton d'envoi inline conservé.
- **États agent** (réflexion/outils/plan/exécution/vérification/terminé) : la trace reste authentique (étapes réelles du serveur) mais devient un **accordéon** : résumé toujours visible (« x/y étapes · Terminé »), détail repliable ligne par ligne avec libellés d'état.
- **Outils consultés** : idem, chips repliables avec compteur.
- Preuves/métriques/plan/items/action : inchangés fonctionnellement, dispositions déjà adaptées (grid 2 colonnes mobile, truncate).
- Chargement : indicateur honnête conservé + bouton Cancel ≥ zone tactile.

## 7. Mission mobile

- Panneau vertical conservé (étapes empilées, aucune timeline horizontale) : statut, titre, raison (bloquée/échec), progression en barre.
- Bloc "Prochaine meilleure action" : label explicite, action « Continuer » / « Débloquer » ≥44px, « Annuler » ≥44px.
- Titre d'étape agrandi (13px/19px) pour la lisibilité.

## 8. Signals mobile

- Carte : niveau (badge sévérité), titre, raison courte, preuves repliables (« Pourquoi ? » en zone tactile ≥40px), action principale ≥36px — aucun hover requis.
- Panneau "Needs your attention" : inchangé fonctionnellement, cibles tactiles déjà ≥44px, confirmation inline conservée.

## 9. Forms / modals

- **Modal → bottom sheet** sur téléphone : pleine largeur, coins hauts arrondis, grip visuel, `max-h-[92dvh]` (jamais au-delà de l'écran), header + footer épinglés, corps scrollable (`overscroll-contain`), safe-area bottom ; **dialog centré inchangé** au-dessus de `sm`.
- Confirmations : `ConfirmDialog` applicatif (danger explicite, actions 44px) — la règle de confirmation métier (approbation humaine explicite avant mutation) est identique.
- Champs : déjà en colonne < `sm` (grids `sm:grid-cols-3`), hauteurs 40px+, labels toujours présents.

## 10. Touch interactions

- Boutons : `md` 40px / `lg` 44px / icon 36px sur mobile (desktop inchangé).
- États `active:` (feedback pressé) ajoutés sur header, nav, dropdowns, cartes signal, boutons icon.
- Aucune action fonctionnelle ne dépend plus du hover : "Mark as read" corrigé ; actions de lignes Tasks/Projects/Goals toujours visibles < `sm`.

## 11. Animations

- Token `sheet-in` (slide-up 280ms, ease NEXUS) pour les sheets mobiles ; animations existantes conservées (fade/panel/scale).
- `prefers-reduced-motion` déjà global (durées ~0) — conservé ; aucune animation décorative ajoutée.

## 12. Performance

- Aucune dépendance ajoutée (pas de lib d'animation, pas de stack de test lourde).
- Le canvas Intelligence (`IntelligenceNetwork`, 2D canvas, dynamic import, interaction désactivée sur pointer coarse) n'est chargé que sur la page Intelligence de l'app ; les scènes three.js restent limitées aux pages publiques.
- Modifications CSS/classes uniquement (pas de re-render ajouté) ; le composer réagit à `query` seulement pour l'auto-grow.

## 13. Accessibility

- Focus visible global conservé ; `aria-expanded` sur accordéons et drawer ; `aria-label` sur tous les contrôles icon ; `enterKeyHint` et `role` existants conservés.
- Contraste : aucune couleur modifiée.
- Reduced motion : géré globalement.
- Le titre du header est annoncé (`aria-live="polite"`).

## 14. Desktop non-régression

- Vérifié par construction : tous les changements sont derrière des variantes `sm:`/`lg:` ou `style` safe-area (env() = 0 sur desktop sans notch).
- Sidebar/topbar desktop intacts ; Modal centré ≥ `sm` identique (padding/spacing conservés) ; tailles de boutons desktop inchangées (`sm:h-9`, `lg:h-9`, etc.).
- Build + lint + typecheck passent (ci-dessous).

## 15. Tests exécutés

- `npm run test:mobile` (nouveau, `node scripts/test-mobile-ux.mjs`) : **45/45 checks** — viewport-fit, safe-areas (header/drawer/bottom nav/modal/signal detail/toast), complétude du modèle de nav mobile, absence de `window.confirm`, hover-only actions, composer multi-ligne + accordéons, bottom sheet, clamps dropdown, reduced-motion, PWA sans service worker.
- `npx tsc --noEmit` : OK.
- `npx eslint src --max-warnings=0` : OK.
- Vérifications runtime du serveur de production : `/` et `/login` 200 ; `/manifest.webmanifest` 200 avec JSON valide (après correction du matcher proxy) ; `/icons/icon-512.png` 200 `image/png`.

## 16. Build

`npm run build` : **succès** (Next.js 16.3.1), routes générées incluant `/manifest.webmanifest` et `/apple-icon.png`.

## 17. Ce qui a été réellement vérifié

- Build, lint, typecheck.
- Tests structurels 45/45.
- Serveur de production démarré : manifest, icônes, pages publiques servies correctement (le matcher proxy a été corrigé suite à un test réel).
- Révision ligne à ligne des composants modifiés (JSX, classes, breakpoints, safe-areas, états).
- Logique métier inchangée : diff limité au frontend ; aucune modification `supabase/`, `src/lib/intelligence/` (moteurs), `src/lib/auth*`, APIs.

## 18. Ce qui n'a pas pu être vérifié

- **Rendu visuel réel du shell authentifié** : l'app exige une session Supabase ; aucune instance ni jeu de credentials n'étant disponibles dans le sandbox, le shell (header mobile, drawer, bottom nav, Intelligence, Mission, Signals) n'a pas pu être inspecté dans un navigateur avec données réelles.
- **Screenshots multi-appareils (320→1440) et test au doigt réel** : aucun navigateur headless/playwright installé dans le projet ; conformément au périmètre, aucune stack de test lourde n'a été installée. La validation repose sur les invariants structurels + l'analyse statique.
- **PWA installée** : le manifest est servi et valide, mais l'installation réelle (Add to Home Screen / standalone) n'a pas été testée sur appareil.

## 19. Commits créés

1. `78aba23` feat(mobile): PWA-ready shell — manifest, viewport-fit, safe-area foundation
2. `35c1f1e` feat(mobile): dedicated mobile shell — page title header, safe-area drawer, thumb-first nav
3. `eb519ae` feat(mobile): bottom-sheet modals, in-app confirmations, touch-first controls
4. `2f62ffe` feat(mobile): intelligence, mission and signal mobile experience
5. `65f825d` test(mobile): add structural responsive-interaction coverage

Commits atomiques et poussables sur `arena/01a03df9-nexus-app`.

## 20. Recommandation pour la prochaine phase

Valider cette phase sur appareils réels (iPhone récents, Android moyens, 320–430px, portrait/paysage) avec un outil de test E2E visuel (Playwright + WebKit mobile) **une fois qu'un environnement Supabase de test est disponible** — c'est le seul maillon qui n'a pas pu être exécuté ici. Ensuite, la phase naturelle suivante est l'**expérience installable complète** : service worker de pré-cache (assets + shell), stratégie offline pour Intelligence/Mission, et audit Lighthouse PWA. Le responsive et le manifest sont prêts ; il ne restera qu'à ajouter la couche offline sans toucher aux moteurs métier.

---

**PHASE MOBILE UX TERMINÉE**

**PROCHAINE PHASE À ABORDER :
[à déterminer après validation de cette phase]**
