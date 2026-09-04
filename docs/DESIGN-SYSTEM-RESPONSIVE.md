# NEXUS — Design system responsive

Application du référentiel (grille 12/8/4, breakpoints device, anatomie
iOS/Android) aux écrans réels de NEXUS : landing, dashboard, Intelligence,
onboarding, réglages.

Le référentiel est une **source**, pas une fin. Chaque règle est traduite en
une décision concrète, et là où NEXUS s'en écarte, l'écart est argumenté
plutôt que subi.

---

## 1. La grille

| Palier   | Conteneur | Colonnes | Marge | Gouttière | Colonne |
|----------|-----------|----------|-------|-----------|---------|
| Mobile   | 360px     | 4        | 16px  | 16px      | 70px    |
| Tablet   | 768px     | 8        | 16px  | 16px      | 82px    |
| Desktop  | 1148px    | 12       | 16px  | 16px      | 81px    |

Le point qui compte : **le nombre de colonnes change, pas seulement la
largeur du conteneur.** C'est ce qui garde une carte à peu près à la même
taille physique sur un téléphone et sur un portable au lieu de l'étirer.

### Décisions NEXUS

**Un seul conteneur : `--container-page: 1148px`** (`max-w-page`).

Avant, trois valeurs cohabitaient — `1080px` (page d'accueil, cartes
pricing), `1120px` (la plupart des sections landing), `1180px` (shell
applicatif). La landing et le produit n'étaient donc pas d'accord sur
l'endroit où se trouve le bord du contenu : en passant de la landing au
dashboard, le contenu sautait de 32px horizontalement. Toutes les sections
partagent maintenant le même token.

**Marges de page : 16px sur mobile** (`--page-margin`), 24 sur tablet,
32 sur desktop — les 16pt du HIG iOS et de la baseline Android.

Le shell applicatif était déjà à `px-4`. Les sections publiques étaient à
`px-5` (20px) et les pages Intelligence à `px-5` : toutes passent à 16px.
Effet secondaire utile — 8px de largeur utile récupérés sur un 320px,
soit exactement de quoi faire tenir une colonne de métrique.

**Gouttière 16px à tous les paliers** (`--grid-gutter`).

---

## 2. Breakpoints

| Nom               | Limite  | Token Tailwind |
|-------------------|---------|----------------|
| Mobile            | < 480   | *(base)*       |
| Mobile landscape  | ≥ 480   | `xs:`          |
| Tablet portrait   | ≥ 768   | `md:`          |
| Tablet landscape  | ≥ 834   | `tablet:`      |
| Laptop            | ≥ 1024  | `lg:`          |
| Desktop           | ≥ 1440  | `wide:`        |

### Deux écarts assumés

**1. `lg` reste à 1024px, pas à 834px.** La lecture littérale du palier
« tablet landscape < 1024px » voudrait que `lg:` vaille 834px. Mais `lg:`
dans NEXUS est le seuil d'apparition de la sidebar de workspace (248px).
À 834px, il resterait 586px de contenu à côté d'une sidebar de 248px —
une tablette en paysage se retrouverait avec moins de place utile qu'en
portrait. Les stops du référentiel sont donc **ajoutés** à l'échelle
existante (`xs`, `tablet`, `wide`), jamais substitués. Le shell garde la
navigation basse + drawer jusqu'à 1024px, ce qui est le bon comportement
pour une application.

**2. Toute l'échelle est redéclarée, valeurs par défaut incluses.**
Déclarer seulement les trois nouveaux stops fait émettre Tailwind les
customs **avant** l'échelle intégrée : `tablet:` (834px) se retrouvait
avant `md:` (768px) dans la feuille, et à 900px c'est le plus petit
breakpoint qui gagnait la cascade. Redéclarer `xs sm md tablet lg xl wide
2xl` en un bloc les met dans une seule série triée — vérifié à la
compilation (`480 → 640 → 768 → 834 → 1024 → 1280 → 1440 → 1536`).
Une assertion le verrouille (`scripts/test-mobile-ux.mjs`).

### Où `xs:` (480px) change vraiment quelque chose

Les rangées de métriques. Tasks/Projects/Goals étaient en 2 colonnes
jusqu'à `sm` (640px). À 480px, 4 colonnes font ~112px chacune — de quoi
afficher « Due today » sans tronquer. Le passage à 3 ou 4 colonnes se
fait donc au stop « mobile landscape » du référentiel, pas à 640px.

---

## 3. Anatomie d'écran — ce que le web reprend

```
iOS (iPhone 14 / 15 Pro Max, 393×852)   Android (360×640)
  status bar     54px                     status bar      24px
  nav bar        44px                     app bar         56px
  tab bar        56px                     bottom nav      56px
  home indicator 34px                     system nav      48px
  margin 16 · gutter 16 · 4 colonnes      margin 16 · gutter 16
```

Les parties **spécifiques à la plateforme** (status bar, home indicator,
system nav) ne sont jamais dessinées par l'application : elles viennent de
`env(safe-area-inset-*)`. C'est la seule façon correcte de gérer à la fois
un iPhone à encoche et un Android à barre gestuelle.

Les parties **dessinées par l'application** prennent la plus grande des
deux valeurs :

```css
--chrome-nav-bar: 56px;   /* app bar Android ; 44pt iOS reste confortable */
--chrome-tab-bar: 56px;   /* iOS 56 ET Android 56 — même valeur */
```

**La tab bar passe de 46px à 56px.** C'était la valeur la plus en deçà du
référentiel : 46px, c'est 10px de moins que les deux plateformes, pour cinq
cibles tactiles. `min-h-(--chrome-tab-bar)` sur `MobileNavItem` et sur le
bouton « More ».

Le header mobile (`h-14` = 56px) correspond déjà à `--chrome-nav-bar`.

---

## 4. Le bug mobile le plus grave du produit (corrigé)

Sans rapport direct avec la grille, trouvé en auditant le rendu réel :
**iOS Safari zoome toute la page quand on tape dans un champ.**

Tous les `Input` / `Textarea` / `Select` rendaient à `13.5px`
(`text-body`) ou `12.5px` (`text-small`). iOS met le viewport à l'échelle
dès que le `font-size` calculé d'un contrôle de formulaire passe sous
16px — **et ne dézoome pas** à la fermeture du clavier. L'utilisateur
reste zoomé dans un coin, header et navigation basse hors écran.

Les deux « corrections » habituelles sont toutes deux mauvaises ici :

- `maximum-scale=1` / `user-scalable=no` supprime le zoom mais aussi le
  pinch-zoom pour tout le monde — une régression d'accessibilité.
- Passer tous les champs à 16px détruit la densité 13.5px sur laquelle
  les écrans applicatifs sont dessinés.

La garde est donc **limitée aux largeurs tactiles**, et **aux contrôles de
saisie** : `input[type="range"]` est un slider de 4px de haut (un
`min-height: 36px` le transformerait en pavé) et les radios sont des pairs
visuellement masqués en 1px. Les deux sont exclus.

Écrite **hors layer** volontairement : Tailwind v4 émet ses utilitaires
dans `@layer utilities`, et une règle non-layered gagne la cascade quelle
que soit la spécificité — donc ceci bat `.text-body` sans `!important`.

---

## 5. Ce que le référentiel ne dit pas et que NEXUS applique quand même

- **Jamais de défilement horizontal.** `overflow-x: hidden` sur `body`,
  `overscroll-behavior-x: none` pour que le swipe arrière du navigateur
  ne se déclenche pas sur une liste qui défile de côté.
- **Les tableaux deviennent des blocs empilés**, jamais un scroll latéral.
  Le comparatif pricing bascule sur des blocs par offre sous 834px.
- **Pas d'action révélée au survol.** Sur `(hover: none)` / `(pointer:
  coarse)`, tout ce qui était `opacity-0 group-hover:opacity-100` est
  visible en permanence.
- **Cibles tactiles ≥ 44px** sur les actions primaires ; les contrôles
  secondaires d'une barre d'outils dense descendent à 36px, jamais moins.
- **`h-dvh`, pas `100vh`** — `100vh` inclut la barre d'URL mobile et
  pousse le bas de l'écran sous le viewport.

---

## 6. Vérification

```
npm run test:mobile    # 67 invariants structurels
npm run test:landing   # 92 invariants landing
npx tsc --noEmit
npm run lint
npm run build
```

Les invariants ne remplacent pas une passe sur appareil réel : le projet
n'a pas de navigateur headless (pas de stack de test e2e par choix), donc
les assertions vérifient les garanties au niveau source qu'une passe
manuelle supposerait acquises — marges, cibles tactiles, safe areas, ordre
des breakpoints, absence de grille 3 colonnes sur mobile.

Un vrai passage sur iPhone (Safari) et Android (Chrome) à 320 / 375 / 390 / 768
reste nécessaire avant de considérer le mobile comme validé.
