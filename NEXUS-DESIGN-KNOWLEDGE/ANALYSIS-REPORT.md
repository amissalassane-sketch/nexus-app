# NEXUS — Rapport d'analyse (Phase 1 & 2)

**Date :** 2026-09-11
**Portée :** lecture seule du repository `nexus-app` et du dossier `NEXUS-DESIGN-KNOWLEDGE/` avant toute modification.
**Statut des affirmations :** `[CONFIRMED]` = vérifié dans le code, `[INFERRED]` = déduit d'un pattern observé, `[NEEDS DECISION]` = absent du code, nécessite une décision produit.

---

## 1. Identité technique du projet [CONFIRMED]

| Aspect | Valeur | Source |
|---|---|---|
| Framework | Next.js 16.3.1, App Router | `package.json` |
| React | 19.2.8 (React Server Components) | `package.json` |
| Styling | Tailwind CSS v4 (`@theme` inline, pas de config JS active pour l'app) | `src/app/globals.css` |
| Composants | shadcn/ui config présente (`components.json`, style "new-york", baseColor "neutral"), mais la quasi-totalité des composants UI sont **faits maison** dans `src/components/ui/` (pas de génération shadcn standard visible) | `components.json`, `src/components/ui/*` |
| Icônes | `lucide-react` (icônes UI génériques) + `simple-icons` (logos de marques, intégrations) | `package.json`, `src/components/integrations/integration-icon.tsx` |
| Animation | `framer-motion` disponible, mais le mouvement principal de l'app passe par des **keyframes CSS natifs** déclarés dans `globals.css` (`@theme` + `@keyframes`), pas par des composants Motion partout | `package.json`, `globals.css` |
| 3D / visuel | `three`, `@react-three/fiber` — utilisés pour la scène "NEXUS Intelligence" (fond animé, halo neuronal) | `src/components/nexus-intelligence/scene/*` |
| Charts | `recharts` | `package.json`, `src/components/charts` |
| Backend/Auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`), RLS, migrations SQL dans `supabase/` | `package.json`, `supabase/` |
| Police | Inter Variable (texte) + Geist Mono Variable (mono), auto-hébergées en `woff2`, **pas** de CDN Google Fonts | `src/app/layout.tsx`, `src/fonts/` |
| Tests | Scripts Node custom (`scripts/test-mobile-ux.mjs`, `scripts/test-landing-design.mjs`) + tests `.test.mjs` dans `supabase/tests/` — pas de framework de test de composants (Jest/Vitest/Playwright) | `package.json` scripts |
| Config alias | `@/*` → `src/*`, alias shadcn (`@/components`, `@/components/ui`, `@/lib`, `@/hooks`) | `components.json`, `tsconfig.json` |

**Constat important :** il existe **deux systèmes de tokens Tailwind en parallèle** :
1. `src/app/globals.css` — la **source de vérité réelle**, utilisée par l'app (Tailwind v4, `@theme`), 3821 lignes, très documentée avec des commentaires "DESIGN AUDIT".
2. `tailwind.config.js` — un fichier annoté comme un **portage expérimental** ("Ported from src/app/globals.css... so the primitives built here compile unchanged when lifted back into the app"), qui semble servir à un environnement de prototypage isolé (`index.html` + `src/**`), pas au build Next.js réel (Tailwind v4 n'a pas besoin de `content` dans un fichier JS pour le projet principal).

`[INFERRED]` : `tailwind.config.js` est un espace de brouillon/atelier de composants, pas la configuration active de l'application Next.js. **Toute documentation de tokens doit citer `globals.css` comme référence**, pas `tailwind.config.js`.

---

## 2. Architecture applicative [CONFIRMED]

```
src/
  app/
    (app)/              → shell authentifié : dashboard, projects, tasks, goals,
                           app/intelligence, integrations, activity, notifications,
                           settings(+billing), upgrade
    api/                → routes serveur : auth/*, billing/*, intelligence/*, profile, health
    auth/, login/, signup/, onboarding/, forgot-password/, reset-password/, check-email/
    (public pages)      → page.tsx (landing), pricing, how-it-works, intelligence,
                           legal/acceptable-use/cookies/privacy/terms
  components/
    ui/                 → primitives (button, card, modal, toast, dropdown, input,
                           badge, tabs, navigation, feedback, page-header, page-skeleton…)
    layout/             → app-shell, topbar, workspace-sidebar, nav-config (IA centrale)
    dashboard/          → kpi-grid, active-projects, briefing-panel, priority-queue, upcoming-panel
    intelligence/ + nexus-intelligence/ → UI + scène 3D de l'assistant IA
    integrations/       → hub d'intégrations + rendu d'icônes de marque
    landing/            → 20+ sections de la page publique
    onboarding/         → tour guidé, checklist, tips contextuels, help center
    auth/, profile/, mobile-home/, motion/, spatial/, charts/, legal/, not-found/
  lib/
    intelligence/       → moteur déterministe (signaux, planner, agent, memory, tools)
    integrations/       → catalog.ts (registre des providers)
    onboarding/         → model, persistence, analytics, i18n
    supabase/, billing/, plan-limits.ts, entitlements.ts, workspace.ts, access.ts…
```

**Convention de nommage** `[CONFIRMED]` : kebab-case pour les fichiers, PascalCase pour les composants exportés, un composant = un fichier, groupes de routes Next (`(app)`) pour isoler le shell authentifié du site public. Les composants `ui/` sont des primitives sans logique métier ; la logique métier vit dans `lib/` et les composants de page.

---

## 3. Design system existant — ce qui est déjà en place [CONFIRMED]

NEXUS a **déjà** un design system nommé et documenté dans le code lui-même : **"Pill Atelier Noir"** (voir en-tête de `globals.css` et de `tailwind.config.js`), avec une évolution "V3" et des passes d'audit successives visibles dans les commentaires (`DESIGN AUDIT — contrast pass`, `DESIGN AUDIT — depth`, etc.). C'est un signal fort que le projet a déjà traversé des itérations de qualité — la knowledge base ne doit pas réinventer ces décisions mais les **documenter fidèlement et les protéger**.

Points forts déjà en place :
- Rampe de surfaces quasi-noire (jamais de gris "dashboard" plat), ramp de texte recalculée pour AA sur toutes les surfaces (contrastes mesurés en commentaire).
- Grille responsive documentée par device class (`docs/DESIGN-SYSTEM-RESPONSIVE.md`, 185 lignes, très complet) plutôt que par valeurs rondes arbitraires.
- Un seul token de conteneur (`--container-page: 1148px`) après unification de 3 valeurs auparavant divergentes.
- Accent violet/lavande **volontairement restreint** ("Intelligence accent — restrained violet/blue-white, used sparingly") — déjà aligné avec la contrainte utilisateur de ce brief.
- `prefers-reduced-motion` et `@media (scripting: none)` gérés à de nombreux endroits (48 occurrences dans `globals.css`).
- Icônes de marque déjà via `simple-icons` avec fallback documenté (Slack retiré de Simple Icons pour raison de marque → path inliné manuellement avec provenance citée).
- Historique de décisions déjà partiellement écrit sous forme de rapports Markdown à la racine (`PHASE6-FINAL-REPORT.md`, `MOBILE_UX_PHASE_REPORT.md`, `COPY_REWRITE_REPORT.md`, `PRODUCT_UX_REWORK_REPORT.md`, etc.) — ce sont des logs de chantier, pas une base de connaissances structurée : c'est précisément le vide que `NEXUS-DESIGN-KNOWLEDGE/` doit combler.

Risque identifié `[INFERRED]` : il existe **deux chartes graphiques concurrentes** dans `design/NEXUS-FINAL-BRAND-BUNDLE/` et `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/` (`CHARTE-GRAPHIQUE.md`) qui décrivent des valeurs **différentes** de celles réellement implémentées dans `globals.css` (ex. bg.base `#0A0A0A` vs `#000000` réel, text.secondary `#8F8F8F` vs `#b0b0b0` réel, radius `md 10px` vs `--radius-input: 8px` réel). Ces bundles semblent être des **spécifications de conception antérieures ou externes**, en partie dépassées par l'implémentation réelle après les passes d'audit de contraste. **Je ne les ai pas traités comme source de vérité** — voir `NEXUS-BRAND.md` pour la réconciliation.

---

## 4. NEXUS-DESIGN-KNOWLEDGE — état avant intervention

```
NEXUS-DESIGN-KNOWLEDGE/
├── 01-CORE-PRINCIPLES/
│   └── unicef-design-guidelines.md      (0 octet — vide)
└── 06-NEXUS-CONTEXT/
    ├── NEXUS-BRAND.md                   (0 octet — vide)
    ├── NEXUS-COMPONENTS.md              (0 octet — vide)
    ├── NEXUS-DESIGN-RULES.md            (0 octet — vide)
    ├── NEXUS-DESIGN-SYSTEM.md           (0 octet — vide)
    ├── NEXUS-INTEGRATIONS.md            (0 octet — vide)
    ├── NEXUS-TOKENS.md                  (0 octet — vide)
    └── NEXUS-UX-PRINCIPLES.md           (0 octet — vide)
```

Aucun dossier `02-DESIGN-SYSTEMS`, `03-UX-REFERENCES`, `04-AI-DESIGN-SYSTEMS`, `05-COMPONENT-PATTERNS`, `07-DESIGN-INTELLIGENCE` n'existait avant cette intervention — seuls les deux dossiers ci-dessus et leurs fichiers (vides) étaient présents. Il n'y avait **aucun contenu réel** : la base de connaissances était une coquille structurelle sans substance.

**Ressources manquantes identifiées avant remplissage :**
- Aucune synthèse de systèmes de référence externes (Vercel, Primer, Material, Fluent, Carbon, Polaris, Atlassian, Linear, Laws of UX).
- Aucun pattern IA documenté (assistant contextuel, streaming, confirmation, undo).
- Aucun inventaire des composants existants (`components/ui/`) et de leurs conventions.
- Aucune checklist de revue de design exploitable par un agent.
- Aucun log de décisions de design (couleur, typo, densité, navigation…).
- Aucun cadre pour la landing page, le dashboard, ou l'analyse compétitive.

C'est le travail réalisé dans cette session — voir la liste des fichiers créés en fin de mission.

---

## 5. Système de composants — inventaire rapide [CONFIRMED]

`src/components/ui/` (22 fichiers) : `badge`, `button` (+ `ButtonLink`, `IconButton`), `card` (+ `SectionHeader`, `Panel`), `chart`, `confirm-dialog`, `create-button`, `divider`, `dropdown`, `feedback` (`EmptyState`, `ErrorState`, `ListRow`, `Progress`, `Alert`…), `input`, `modal`, `navigation` (`NavItem`, `SectionLabel`, `MobileNavItem`), `page-header`, `page-skeleton`, `password-input`, `tabs`, `toast`, `nexus-grid`, `nexus-auth-background`, `blackhole-hero-section`, `canvas-reveal-effect`, `sign-in-flow-1`.

Chaque primitive documente déjà ses intentions en commentaire d'en-tête (ex. Button : "primary : white surface, black label — one per screen"). C'est une convention de documentation intégrée au code qu'il faut **respecter et prolonger**, pas contourner par des fichiers Markdown séparés qui diraient autre chose.

---

## 6. Ce que je n'ai PAS trouvé (gaps confirmés)

- Pas de Storybook ni de catalogue de composants visuel.
- Pas de design tokens exportés en JSON/Style Dictionary — uniquement CSS.
- Pas de fichier Figma/design source lié au repo (uniquement des exports PNG de logo dans `design/`).
- Pas de tests d'accessibilité automatisés (axe-core, jest-axe) — uniquement des assertions statiques (`scripts/test-mobile-ux.mjs`) qui grep le texte source pour des patterns attendus (taille de cible tactile, `prefers-reduced-motion`, absence de `confirm()` natif, etc.).
- Pas de composant "AI badge/pill" générique séparé — l'IA est intégrée nativement dans dashboard, intelligence, command menu, onboarding (conforme à la contrainte "pas juste un bouton AI").

---

## 7. Conclusion de la phase d'analyse

NEXUS n'est **pas** un projet de démonstration : c'est un produit avec une architecture d'authentification réelle (Supabase + RLS), une couche de facturation (`plan-limits.ts`, `entitlements.ts`, `billing/`), un moteur d'intelligence déterministe avec agent IA, et un historique d'audits de qualité (contraste, mobile, copy) déjà documenté dans des rapports de chantier. La knowledge base construite ci-dessous **documente ce qui existe réellement**, distingue explicitement le confirmé de l'inféré, et signale les décisions produit encore ouvertes plutôt que de les trancher arbitrairement.
