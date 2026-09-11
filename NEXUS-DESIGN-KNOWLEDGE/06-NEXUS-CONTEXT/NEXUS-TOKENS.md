# NEXUS TOKENS — source de vérité

**Statut : [CONFIRMED]** — toutes les valeurs de ce fichier sont extraites littéralement de `src/app/globals.css` (bloc `@theme`, Tailwind v4), qui est la **seule** source de tokens active du build Next.js. `tailwind.config.js` en est un miroir de prototypage (voir `02-DESIGN-SYSTEMS/design-tokens-methodology.md`) — ne jamais le citer comme référence divergente.

Nom du système : **"NEXUS V3 — Pill Atelier Noir"** (nom déclaré dans l'en-tête du fichier source).

---

## Couleurs

### Surfaces
| Token | Valeur | Usage |
|---|---|---|
| `bg-base` | `#000000` | Fond racine de l'application |
| `bg-subtle` | `#080808` | Sidebar, zones légèrement distinctes du fond racine |
| `bg-surface` | `#0f0f0f` | Cards, inputs, dropdowns |
| `bg-surface-2` | `#151515` | Hover de surface, niveau d'élévation supérieur |
| `bg-surface-3` | `#1c1c1c` | Élévation maximale (rare) |
| `bg-veil` | `rgba(255,255,255,0.02)` | Wash de 2% pour cadrer une section sans créer un bloc décoratif |

### Bordures — "discovered, never announced" (citation du code)
| Token | Valeur |
|---|---|
| `border-subtle` | `rgba(255,255,255,0.06)` |
| `border-default` | `rgba(255,255,255,0.08)` |
| `border-strong` | `rgba(255,255,255,0.14)` |
| `border-focus` | `rgba(255,255,255,0.22)` |

### Texte — ramp recalculée pour AA sur toutes les surfaces réelles
| Token | Valeur | Contraste mesuré (sur `#0f0f0f`, la surface la plus fréquente) |
|---|---|---|
| `text-primary` | `#f2f2f2` | 15.0:1 |
| `text-secondary` | `#b0b0b0` | 8.9:1 |
| `text-tertiary` | `#9c9c9c` | 7.0:1 |
| `text-quaternary` | `#868686` | 5.3:1 |
| `text-muted` | `#6b6b6b` | non garanti AA — **réservé aux éléments non-lisibles par construction** (lignes désactivées, séparateurs décoratifs), jamais pour du texte porteur d'information |

Ordre de lecture (`[CONFIRMED]`, commentaire source) : primary = l'affirmation principale, secondary = le corps, tertiary = la ligne de support, quaternary = la métadonnée — "discreet but never illegible".

### Accent neutre (blanc)
| Token | Valeur | Usage |
|---|---|---|
| `accent` | `#ffffff` | Action primaire — un seul CTA primaire par écran (règle documentée dans `button.tsx`) |
| `accent-fg` | `#000000` | Texte sur accent |
| `accent-hover` | `#e6e6e6` | Hover de l'accent |
| `accent-badge` | `#ede8ff` | Badge interne du bouton Create (teinte lavande très pâle) |
| `accent-ghost` / `accent-ghost-hover` | `rgba(255,255,255,0.05)` / `0.09` | Hover neutre sur boutons ghost/icônes |

### Accent Intelligence — violet/lavande, **usage restreint** [CONFIRMED — contrainte produit déjà respectée dans le code]
| Token | Valeur |
|---|---|
| `lavender` | `#e9e4ff` |
| `lavender-subtle` | `rgba(233,228,255,0.1)` |
| `lavender-border` | `rgba(233,228,255,0.22)` |

Citation du code source : *"Intelligence accent — restrained violet/blue-white, used sparingly."* Ce token signale spécifiquement ce qui vient de l'intelligence NEXUS (badges IA, focus ring, halo de sévérité) — **ne jamais l'étendre à une décoration générale de l'UI**. C'est la contrainte demandée explicitement pour la direction artistique NEXUS, et elle est déjà respectée dans le code existant.

### Sémantique (désaturée, discrète)
| Token | Couleur | Fond (~9%) | Bordure (~20%) |
|---|---|---|---|
| `success` | `#6fcf97` | `rgba(111,207,151,0.09)` | `rgba(111,207,151,0.2)` |
| `warning` | `#dcb463` | `rgba(220,180,99,0.09)` | `rgba(220,180,99,0.2)` |
| `danger` | `#e87b7b` | `rgba(232,123,123,0.09)` | `rgba(232,123,123,0.2)` |
| `info` | `#7f9dee` | `rgba(127,157,238,0.09)` | `rgba(127,157,238,0.2)` |

Toutes les couleurs sémantiques sont volontairement désaturées (pas de vert/rouge/jaune saturés façon feu de signalisation) — cohérent avec l'identité "Pill Atelier Noir" qui refuse tout ce qui ressemble à un dashboard générique criard.

---

## Typographie

Police : **Inter Variable** (`--font-sans`, via `var(--font-inter)`, auto-hébergée en `woff2`), fallback système. Mono : **Geist Mono Variable** (`--font-mono`), utilisé pour les chiffres/dates/labels techniques.

| Token | Taille | Line-height | Letter-spacing | Poids | Usage |
|---|---|---|---|---|---|
| `display-xl` | 58px | 1.03 | -0.04em | 500 | Landing uniquement |
| `display-lg` | 40px | 1.08 | -0.035em | 500 | Landing uniquement |
| `display` | 34px | 38px | -0.035em | 500 | Réservé aux pages publiques — **jamais utilisé dans l'application** (citation du code : "Display is reserved for public pages; application screens never use it.") |
| `xl` | 20px | 28px | -0.02em | 600 | Titres de section marquants |
| `h1` | 22px | 28px | -0.025em | 600 | Titre de page (app) |
| `h2` | 16px | 24px | -0.015em | 600 | Titre de panneau |
| `h3` | 14px | 20px | -0.01em | 600 | Sous-titre, en-tête de carte |
| `h4` | 13px | 18px | -0.01em | 600 | Palier intermédiaire (ladder public) |
| `lead` | 15.5px | 26px | -0.011em | 400 | Paragraphe d'intro landing |
| `body` | 13.5px | 21px | — | 400 | Texte courant de l'app |
| `body-medium` | 13.5px | 21px | — | 500 | Variante emphase |
| `small` | 12.5px | 18px | — | — | Texte secondaire |
| `caption` | 11.5px | 16px | — | — | Métadonnée |
| `button` | 13px | 20px | — | 500 | Libellé de bouton |
| `mono` | 11.5px | 16px | — | — | Dates, identifiants |
| `eyebrow` | 10.5px | 14px | +0.1em | 500 | Sur-titre en majuscules |

Échelle publique documentée dans le code (`globals.css`, commentaire) : `EYEBROW 10.5 → H4 13 → H3 14 → LEAD 15.5 → H2 16 → XL 20 → H1 22 → DISPLAY-LG 40 → DISPLAY-XL 58`.

---

## Layout & grille responsive

| Token | Valeur |
|---|---|
| `--container-page` | 1148px (**conteneur unique** — remplace 3 valeurs auparavant divergentes : 1080/1120/1180) |
| `--page-margin` | 16px (mobile) |
| `--page-margin-md` | 24px (tablet) |
| `--page-margin-lg` | 32px (desktop) |
| `--grid-gutter` | 16px, constant à tous les paliers |
| `--chrome-nav-bar` | 56px |
| `--chrome-tab-bar` | 56px |

### Breakpoints (déclarés en totalité pour garantir l'ordre de cascade — voir `docs/DESIGN-SYSTEM-RESPONSIVE.md`)
| Nom | Valeur | Signification |
|---|---|---|
| `xs` | 480px | Mobile paysage |
| `sm` | 640px | Défaut Tailwind |
| `md` | 768px | Tablette portrait |
| `tablet` | 834px | Tablette paysage |
| `lg` | 1024px | Laptop — **seuil d'apparition de la sidebar 248px**, volontairement non aligné sur 834px (voir justification dans `docs/DESIGN-SYSTEM-RESPONSIVE.md`) |
| `xl` | 1280px | Défaut Tailwind |
| `wide` | 1440px | Desktop |
| `2xl` | 1536px | Défaut Tailwind |

### Grille par device class
| Palier | Conteneur | Colonnes | Marge | Gouttière | Colonne |
|---|---|---|---|---|---|
| Mobile | 360px | 4 | 16px | 16px | 70px |
| Tablet | 768px | 8 | 16px | 16px | 82px |
| Desktop | 1148px | 12 | 16px | 16px | 81px |

Principe directeur : **le nombre de colonnes change, pas seulement la largeur du conteneur** — garde une carte à peu près à la même taille physique sur un téléphone et sur un laptop.

---

## Radius — nommé par usage, jamais par taille abstraite [CONFIRMED — règle à préserver]

| Token | Valeur | Usage |
|---|---|---|
| `radius-xs` | 4px | Micro-éléments (badge, pastille) |
| `radius-input` | 8px | Champs, boutons, nav items |
| `radius-nav` | 8px | Éléments de navigation |
| `radius-row` | 8px | Lignes de liste |
| `radius-card` | 12px | Cards |
| `radius-dropdown` | 12px | Menus déroulants |
| `radius-panel` | 14px | Panneaux, sheets |
| `radius-empty` | 12px | États vides |
| `radius-auth` | 16px | Cartes d'authentification |
| `radius-pricing` | 16px | Cartes de pricing |
| `radius-pill` | 9999px | Pills (CTA primaires, badges arrondis complets) |

---

## Ombres

| Token | Valeur | Usage |
|---|---|---|
| `shadow-dropdown` | `0 10px 30px -8px rgba(0,0,0,0.7)` | Menus flottants |
| `shadow-overlay` | `0 24px 60px -12px rgba(0,0,0,0.8)` | Modales |
| `shadow-auth` | `0 20px 50px -20px rgba(0,0,0,0.9)` | Cartes d'auth |

Sur fond quasi-noir, l'élévation se lit surtout par le **contraste de surface** (`bg-surface` → `bg-surface-2` → `bg-surface-3`), l'ombre venant renforcer, pas porter seule la hiérarchie (voir `03-UX-REFERENCES/material-design.md`).

---

## Mouvement

Voir `02-DESIGN-SYSTEMS/motion-language.md` pour le détail complet (easings, durées, catalogue d'animations nommées).

---

## Ce qui n'est PAS un token officiel

- Toute valeur hexadécimale ou rgba en dur dans un composant qui duplique une valeur ci-dessus est une **dette**, pas un nouveau token — elle doit être remplacée par la classe Tailwind générée.
- Les valeurs des chartes graphiques `design/NEXUS-FINAL-BRAND-BUNDLE/` et `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/` (ex. `#0A0A0A`, `#8F8F8F`, radius `10px`/`16px`/`24px`) sont des **spécifications antérieures ou externes**, non synchronisées avec `globals.css` après les passes d'audit de contraste. Elles ne doivent **pas** être utilisées comme source de vérité tant qu'elles n'ont pas été explicitement réconciliées — voir `NEXUS-BRAND.md`.
