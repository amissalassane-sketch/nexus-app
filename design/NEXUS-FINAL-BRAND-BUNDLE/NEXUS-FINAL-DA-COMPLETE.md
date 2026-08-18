# NEXUS — DIRECTIVE ARTISTIQUE FINALE COMPLÈTE
**Version Finale 3.0 — Pill Atelier + Logo Interlacé Verrouillé**
**Date: 16 août 2026**
**Statut: DOCUMENT UNIQUE DE RÉFÉRENCE — REMPLACE TOUTES LES V1/V2**

Ce fichier regroupe:
- Analyse des ressources fournies (dropdown Create + avatar + logo chrome initial + logo interlacé final)
- Identité de marque
- Logo FINAL non modifiable (N blanc interlacé)
- Palette, typo, radius, composants, pages, payment
- Implémentation pour agent VS Code

---

## 0. RESSOURCES FOURNIES — CE QUE J'AI COMPRIS

### Ressource 1: Screenshot Dropdown (Create + Profile menu)
- Fond #0A0A0A presque noir avec dot grid subtil (20px grille, opacity 0.035)
- Bouton Create pill blanc #FFFFFF 36px height, radius 9999px, avec badge interne #EDE8FF lavande pâle 28x28 + plus icon 16px
- Dropdown 240px width, radius 16px, bg #171717, border rgba(255,255,255,0.08), shadow 0 8px 24px rgba(0,0,0,0.48)
- Item 36px height radius 10px, icon 18px stroke 1.5px, text 13.5px, hover bg rgba(255,255,255,0.06), active bg 8% + petite ligne verticale blanche 2x14px à gauche (visible dans ta capture sur Profile)
- Avatar 32px top right, déclencheur du menu
- Esthétique: Linear / Attio / Superhuman — premium, monochrome, calme

### Ressource 2: Logos
- Tu as d'abord proposé N chrome 3D métallique → direction hardware premium
- Puis tu as verrouillé FINAL: **N blanc interlacé plat sur noir**, forme à 45° sharp, avec gap central en diagonale, 2 pièces qui s'entrelacent sans se toucher
- C'est le meilleur: architectural, intemporel, lisible à 16px favicon, concept "Everything important, connected" incarné par le gap/entrelacement
- Consigne: **Ne pas modifier la forme**

### Conclusion DA: 
NEXUS V3 = **Pill Atelier Noir** (depuis ressource 1) + **Logo Interlacé Blanc** (ressource 2). Tout ce qui crée = pill blanc, tout ce qui contient = card 16px border blanche 8%, logo = flat blanc interlacé, jamais chrome, jamais gradient.

---

## 1. BRAND CHARACTER

**NEXUS V3 IS:**
- Hardware-like, précis, architectural
- Calme, monochrome, confident
- Pill pour créer, sharp 45° pour le logo
- Dot grid texture subtile comme texture d'atelier
- Interlacé = connexion sans fusion

**NEXUS V3 IS NOT:**
- Template Tailwind radius 8px partout
- Gradient néon / glassmorphism
- SaaS bleu #3B82F6 générique
- Chrome 3D partout (chrome seulement envisagé puis abandonné)

Adjectifs: Précis, Central, Calme, Intelligent, Sobre, Confiant, Architectural

---

## 2. LOGO FINAL — VERROUILLÉ — NE PAS MODIFIER

**Fichier source MASTER:** `/home/user/uploads/image.png` → copié dans `/home/user/nexus-final-logo-pack/NEXUS-MASTER-WhiteOnBlack.png`

**Description exacte (ne pas redessiner):**
- N blanc #FFFFFF pur, épaisseur ≈ 18-20% hauteur, angles 45° sharp, pas d'arrondi
- Coupé en 2 au centre en diagonale avec gap ≈ 8% largeur — les 2 moitiés s'entrelacent, ne se touchent pas
- Bounding box carrée, N occupe 78% largeur, 82% hauteur
- Concept: 2 systèmes qui se traversent, connexion NEXUS

**Variantes autorisées (même forme, couleur seulement):**
- WhiteOnBlack: blanc sur #0A0A0A — usage par défaut dark
- BlackOnWhite: noir #0A0A0A sur blanc #FFFFFF — light mode (généré: `NEXUS-MASTER-BlackOnWhite.png`)
- WhiteOnTransparent: `NEXUS-MASTER-WhiteOnTransparent.png` — UI superposée
- BlackOnTransparent: `NEXUS-MASTER-BlackOnTransparent.png`

**App Icons (forme intacte, padding 20%):**
- `app-icon-dark-1024.png` (fond #0A0A0A logo blanc) → `/app/icon.png`
- `512,180,120,60,32,16` et light variants
- `favicon-32.png`, `16.png`

**Règles usage:**
- Clear space: 25% hauteur logo minimum autour
- Minimum: 16px (favicon) — reste lisible
- Top Bar: logo 28x28 flat transparent
- Sidebar: 24-28x28 + wordmark "NEXUS" Inter 13px 600 -0.03em #F5F5F5
- Login: MASTER 48px centré
- Ne pas: arrondir, remplir gap, gradient, outline, rotation 3D, mettre sur fond coloré

**Wordmark:** Inter 600 tracking -0.03em uppercase "NEXUS" blanc #F5F5F5 / noir #0A0A0A, jamais dégradé

Pack complet: `/home/user/nexus-final-logo-pack/`

---

## 3. COLOR SYSTEM — SOFT DARK ATELIER (issu de ta screenshot)

**Base:**
- `bg.base`: #0A0A0A — noir principal
- `bg.dot`: radial-gradient rgba(255,255,255,0.035) 1px / 20px 20px — grille pointée partout
- `bg.subtle`: #111111 — sidebar
- `bg.surface`: #171717 — dropdown, inputs, cards (comme ta ref)
- `bg.surface-2`: #1C1C1C — hover
- `bg.surface-3`: #232323 — pressed

**Borders (clé de ta ref):** Jamais gris solide, toujours blanc à opacité
- `border.subtle`: rgba(255,255,255,0.06)
- `border.default`: rgba(255,255,255,0.08) — utilisé partout
- `border.strong`: rgba(255,255,255,0.12)
- `border.focus`: rgba(255,255,255,0.20)

**Text:**
- `text.primary`: #F5F5F5 (92%)
- `text.secondary`: #8F8F8F (56%)
- `text.tertiary`: #5A5A5A (35%)
- `text.quaternary`: #3A3A3A

**Accent:**
- `accent.primary`: #FFFFFF — tous les CTA pill
- `accent.fg`: #0A0A0A
- `accent.badge`: #EDE8FF — cercle interne Create button (lavande pâle)
- `accent.hover`: #E8E8E8
- `accent.ghost`: rgba(255,255,255,0.06)
- `accent.ghost-hover`: rgba(255,255,255,0.10)
- `accent.lavender`: #E9E4FF — focus ring uniquement, 4% usage max

**Semantic désaturés (10% bg):**
- success #7ADE9B bg rgba(122,222,155,0.10) border 20%
- warning #E8C574 bg rgba(232,197,116,0.10)
- danger #FF7A7A bg rgba(255,122,122,0.10)
- info #8AA8FF bg rgba(138,168,255,0.10)

**Light futur:** bg #F6F5F3, surface #FFF, border rgba(0,0,0,0.08), text #0A0A0A, primary #0A0A0A

---

## 4. TYPOGRAPHIE

- Primary: **Inter**  — Fallback Geist Sans / SF Pro
- Mono: Geist Mono / JetBrains Mono pour dates, counts, badges

Échelle:
- display greeting: 30px/32px/-0.03em/500
- h1: 20px/28px/-0.02em/550
- h2: 16px/24px/-0.015em/550
- h3: 14px/20px/-0.01em/550
- label-mono: 11px/16px/0.06em/500/uppercase/mono/secondary
- body: 13.5px/21px/-0.01em/400
- body-medium: 13.5px/21px/-0.01em/500
- small: 12.5px/18px/-0.005em/400
- caption: 11.5px/16px/400/secondary
- button: 13px/20px/-0.01em/500
- mono: 11.5px/16px/mono

Premium = plus petit et plus serré que V1 (14px → 13.5px, 600 → 550).

---

## 5. RADIUS & SPACING — PILL ECONOMY

Inspiré direct de ta ref (Create pill + dropdown 16px)

- `pill`: 9999px — **TOUS les boutons primaires** (Create, New Task, Sign In, Get Started, Upgrade, Tabs actives)
- `radius-md`: 10px — inputs, nav items
- `radius-lg`: 16px — dropdowns (comme ta ref), cards
- `radius-xl`: 20px — empty states
- `radius-2xl`: 24px — login card, pricing cards, onboarding
- Spacing base: 4px, échelle 4,8,12,16,20,24,32,40,48,64
- Dot grid: 20px, opacity 0.035, partout sur bg.base

---

## 6. COMPOSANTS — PIXEL PERFECT D'APRÈS TES RESSOURCES

### A. Create Button (signature, issu de ton screenshot)
- Height 36px, radius 9999px, bg #FFFFFF fg #0A0A0A, padding 4px 14px 4px 4px
- Interne: badge 28x28 cercle bg #EDE8FF + icon plus 16px stroke 1.75 #0A0A0A, gap 10px texte "Create" 13px 500
- Hover scale 1.01 bg #E8E8E8, active 0.98, shadow 0 2px 8px rgba(0,0,0,0.24) + border 1px rgba(255,255,255,0.08)
- Variantes texte: "New Task", "New Project", "Create" même structure

### B. Dropdown Menu (exactement ta capture)
- Width 240px user menu, 280px create menu
- Bg #171717, border 1px rgba(255,255,255,0.08), radius 16px, shadow 0 8px 24px rgba(0,0,0,0.48) + inset 1px rgba(255,255,255,0.06)
- Padding 6px
- Item: height 36px radius 10px padding 0 10px gap 10px, icon 18px stroke 1.5 fg #5A5A5A, text 13.5px 400 fg #8F8F8F
- Hover: bg rgba(255,255,255,0.06) fg #F5F5F5 icon #F5F5F5
- Active: bg rgba(255,255,255,0.08) fg #F5F5F5 + left indicator bar 2px width 14px height radius full bg #FFFFFF absolute left 2px (visible dans ta capture sur Profile)
- Separator 1px rgba(255,255,255,0.06) margin 6px 8px
- Animation: scale 0.98→1 + translateY 4px→0 + fade 200ms cubic-bezier(0.2,0.8,0.2,1) origin top-right

### C. Buttons
- Primary pill défini ci-dessus
- Secondary: height 36px pill, bg transparent border rgba(255,255,255,0.08) fg #8F8F8F hover bg rgba(255,255,255,0.06) fg #F5F5F5
- Icon button: 32x32 radius full fg tertiary hover bg 6%

### D. Inputs
- Height 40px (44px login), radius 10px, bg #171717 border rgba(255,255,255,0.08) fg #F5F5F5 placeholder #3A3A3A padding 0 12px
- Focus border rgba(255,255,255,0.16) + ring 0 0 0 3px rgba(233,228,255,0.16)

### E. Cards
- Bg #111111, border rgba(255,255,255,0.06), radius 16px, padding 20px, hover border 0.10 bg #171717

### F. List Rows
- Height 44px, radius 10px, margin-bottom 2px, hover bg #171717, active bg #1C1C1C + left line 2x14px blanc

---

## 7. LAYOUT GLOBAL — TOP BAR + SIDEBAR FINE

De ta ressource: top bar avec Create + Avatar

- **Top Bar:** Height 56px fixed, width full, bg #0A0A0A 80% + backdrop-blur 12px, border-bottom 1px rgba(255,255,255,0.06). Left: logo 28x28 flat + wordmark NEXUS. Right: Create pill + avatar 32px radius full border 2px #1C1C1C qui ouvre dropdown user (240px 16px radius).
- **Sidebar:** Width 220px, bg transparent (sur base), PAS de border-right (plus léger), padding 16px 12px top 80px. Items: height 32px radius 10px icon 18px stroke 1.5 text 13px secondary 56%, hover bg rgba(255,255,255,0.06). Active = bg #FFFFFF fg #0A0A0A pill shape radius 10px font 500. Workspace selector: 44px radius 16px bg #111111 border 0.08.
- **Main:** margin-left 220px margin-top 56px padding 32px 40px max-width 1240px centered, fond dot grid

---

## 8. PAGES

### Login / Signup
- Bg #0A0A0A + dot grid 20px opacity 0.05
- Card 400px radius 24px bg #111111 border 0.08 padding 32px shadow 0 16px 40px rgba(0,0,0,0.48)
- Logo MASTER 48px flat white centré margin-bottom 24px
- Title 20px 550, sub 13px secondary
- Inputs 44px radius 10px
- Primary button 44px pill full width white
- OAuth secondary pill border 0.08

### Dashboard
- Header greeting 30px 500 -0.03em + date mono 11px uppercase
- Focus Block (Niveau 1): radius 16px bg #111111 border 0.08 padding 20px label mono 11px, liste urgents dot 6px + titre 13.5px
- Stats ligne: pills 28px bg #111111 border 0.06 radius 9999px mono 11.5px
- 2 colonnes left 2/3 right 1/3 gap 24px, cards 16px radius
- Active Projects table: header mono, rows 48px

### Tasks / Projects / Goals
- Header h1 20px + count mono + Create pill variant
- Toolbar filtres: pills 28px radius 9999px border 0.08 active white
- Tasks rows 44px radius 10px checkbox 18px radius 6px border 0.16 checked bg white
- Projects grid cards 16px icon 36px radius 12px bg #171717 progress bar 4px track 8% fill white
- Goals cards 20px radius progress 4px white

### Notifications
- Max-width 640px centered, items 56px radius 10px hover #171717, unread dot 6px white ou lavender
- Empty "Aucune notification. C'est calme ici."

### Settings
- Tabs: bar bg #111111 radius 9999px padding 4px tabs 32px pill active white
- Sections cards 24px padding radius 16px gap 24px

### Payment / Upgrade (nouvelle page /upgrade)
- Layout 960px centered padding 80px 32px
- Fond dot grid + radial glow lavender 20% blur 200px top center derrière hero
- Hero: label pill small "Upgrade" bg lavender-subtle + title 32px 500 -0.03em "Build your system, without limits." + sub 15px secondary 480px max
- Pricing cards 320px radius 24px bg #111111 border 0.08 padding 28px
- Pro featured: border rgba(233,228,255,0.24) + outer glow 0 0 0 1px rgba(233,228,255,0.12) bg #151517
- Price Display 36px 500 + /mo mono 12px
- Features 13px secondary check 16px white
- CTA pill white 40px full width
- Toggle annual pill switch 36px height radius full bg #171717 border 0.08 thumb white pill

---

## 9. MOTION

- Duration: 140ms hover, 200ms dropdown/modal
- Easing: cubic-bezier(0.2,0.8,0.2,1) doux
- Dropdown: translateY 4px→0 + scale 0.98→1 + fade
- Pill button: scale 1→1.02 hover, 0.98 active

---

## 10. IMPLEMENTATION NOTES — POUR AGENT VS CODE

**Fichiers:**
- `nexus-final-logo-pack/NEXUS-MASTER-WhiteOnTransparent.png` → `public/logo/nexus.png`
- `app-icon-dark-1024.png` → `app/icon.png`, `public/icon-1024.png`
- `favicon-32.png`, `16.png` → `app/favicon.ico`
- Tokens Tailwind:
  ```
  bg.base #0A0A0A, subtle #111111, surface #171717, surface-2 #1C1C1C
  border: rgba(255,255,255,0.08)
  text.primary #F5F5F5 secondary #8F8F8F tertiary #5A5A5A
  accent.primary #FFFFFF fg #0A0A0A badge #EDE8FF
  radius: pill 9999, md 10, lg 16, 2xl 24
  dot grid: radial rgba(255,255,255,0.035) 1px / 20px
  focus ring: 0 0 0 1px #0A0A0A, 0 0 0 3px rgba(233,228,255,0.24)
  ```

**Ordre:**
1. Borders → rgba blanc 8%
2. Dot grid global sur bg.base
3. Boutons primary → pill 9999 + badge interne lavande pour Create
4. Dropdown → 240px 16px bg #171717 spec exacte ressource
5. Top Bar 56px + Sidebar 220px transparent active pill blanc
6. Cards 16px, login 24px, pricing 24px
7. Logo MASTER partout: 28px UI flat, 48px login, app icon 1024
8. Page /upgrade avec pricing cards + glow lavender

**Ne pas casser Supabase, RLS, auth.**

---

## 11. RECOMMENDED FINAL DIRECTION

**Identité:** Pill Atelier Noir — Tout ce qui crée = pill blanc avec badge lavande #EDE8FF. Tout ce qui contient = card 16px border blanche 8% sur noir #0A0A0A dot grid. Logo = N interlacé blanc flat architectural, gap central = connexion.

**Palette:** #0A0A0A base, #111/#171/#1C surfaces, border rgba 8%, texte #F5F5F5/#8F/#5A, accent white + badge lavande.

**Logo:** Ta dernière image exacte, forme interlacée, blanc sur #0A0A0A, jamais modifiée. Usage 28px UI flat, 48px hero.

**Formes:** Pill 9999 CTA, 16 cards, 24 login/pricing, 10 inputs.

**Signature UI:** Create pill + dropdown 16px avec left white line active + dot grid + N interlacé.

**Test:** User voit NEXUS et dit "c'est le plus propre que j'ai vu, je retiens ce N coupé et ce bouton pill blanc". Designer dit "border 8% + dropdown 16px + left line + N interlacé = NEXUS, nulle part ailleurs".

— Fin DA Complète Finale.
