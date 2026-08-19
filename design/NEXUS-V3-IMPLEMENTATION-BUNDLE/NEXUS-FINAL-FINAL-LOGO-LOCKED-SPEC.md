# NEXUS — FINAL FINAL LOGO LOCKED — NO MODIFICATIONS
**Date: 16 août 2026**
**Logo: White Interlaced N on Black (image.png fourni)**
**STATUT: C'EST LE LOGO OFFICIEL. NE PAS MODIFIER. NE PAS RECREER. NE PAS REDESSINER.**

> "Take this one for the final final real logo that a i prefer it's the best logo take this and dont change it dont modify this is the NEXUS logo"

Message reçu. Ce document verrouille EXACTEMENT ton image.

---

## 1. LE FICHIER MAÎTRE

**Source unique:** `/home/user/uploads/image.png` et copié dans `/home/user/nexus-final-logo-pack/NEXUS-MASTER-WhiteOnBlack.png`

- Fond: #121212 très sombre (proche #0A0A0A V2) — pas pure black, dark charcoal
- Logo: Blanc pur #FFFFFF, forme interlacée
- Résolution: 1024x1024-like carré centré
- Aucun gradient, aucun chrome, aucun effet 3D. Plat, net, architectural

**C'est le seul logo autorisé.** Toutes les autres versions générées avant (chrome, etc.) sont DEPRECATED.

---

## 2. ANATOMIE EXACTE (description sans modification)

Le N est construit comme 2 pièces entrelacées se croisant:

- **Forme:** Pas un N typographique. C'est un N "split" / "interlaced" / "overlapped"
- **Barres verticales:** Largeur ≈ 18-20% de la hauteur du N, bords droits coupés à 45°
- **Diagonale:** Coupée en 2 segments avec un gap central de ≈ 8% de la largeur — c'est le "point de connexion" NEXUS — les 2 moitiés ne se touchent pas, elles s'entrelacent
- **Gap central:** Espace négatif en forme de bande diagonale qui traverse le N — c'est le concept "Everything important, connected" incarné: 2 systèmes qui se traversent sans se toucher
- **Angles:** Tous les angles sont 45° ou 90°, pas d'arrondi. Très architectural, très précis, comme Linear
- **Poids:** Bold, heavy, stable — fonctionne à 16px car épaisseur reste lisible

**Ne pas redessiner en arrondi. Ne pas adoucir. Garder 45° sharp.**

---

## 3. VARIANTES AUTORISÉES — MÊME FORME, SEULEMENT COULEUR/FOND CHANGE

Forme = TOUJOURS identique, pixel perfect de ton PNG. Seule la couleur change pour s'adapter au fond.

1.  **WhiteOnBlack (MASTER):** Blanc #FFFFFF sur #0A0A0A / #121212 — usage par défaut dark mode
    - Fichier: `NEXUS-MASTER-WhiteOnBlack.png`
    - Usage: Login, Top bar dark, Sidebar dark, Marketing dark, App Icon dark

2.  **BlackOnWhite:** Noir #0A0A0A sur Blanc #FFFFFF — même forme inversée
    - Fichier: `NEXUS-MASTER-BlackOnWhite.png` (généré sans resynthèse, juste inversion)
    - Usage: Light mode futur, print, docs clairs

3.  **WhiteOnTransparent:** Blanc sur transparent
    - Fichier: `NEXUS-MASTER-WhiteOnTransparent.png`
    - Usage: Superposition sur image, header transparent, favicon base

4.  **BlackOnTransparent:** Noir sur transparent
    - Fichier: `NEXUS-MASTER-BlackOnTransparent.png`
    - Usage: Light surfaces

**INTERDIT de créer:** version gradient, version colorée, version avec ombre interne, version outline.

---

## 4. TAILLES & CLEAR SPACE — RÈGLES FINALES

- **Clear space:** Minimum 25% de la hauteur du logo autour. Ne jamais coller au bord.
- **Minimum size:**
  - 16px → lisible grâce à épaisseur 18% (testé: favicon-16.png reste N)
  - Ne pas descendre sous 14px
- **Maximum:** Infini vectorisé, mais garder sharp

**App Icons générés (forme intacte, juste mise dans carré avec padding):**
- `app-icon-dark-1024.png` — fond #0A0A0A, logo blanc centré padding 20% — pour `/app/icon.png`, PWA, App Store
- `app-icon-dark-512.png`, `180`, `120`, `60`, `32`, `16`
- `app-icon-light-1024.png` — fond blanc, logo noir #0A0A0A — pour light OS
- `favicon-32.png` / `favicon-16.png` — flat dark

Padding app icon: 20% de la taille totale (logo = 60% du carré). Ne pas mettre 80% (trop gros).

---

## 5. INTÉGRATION DANS NEXUS V2 PILL ATELIER

Ton logo est PARFAIT avec la direction V2 que tu as validée (pill blanc + border rgba 8% + dot grid).

- **Top Bar 56px:** Logo 28x28 `WhiteOnTransparent`, pas de container, left aligned. Wordmark "NEXUS" à côté Inter 13px 600 tracking -0.03em #F5F5F5. Gap 10px.
- **Sidebar 220px:** Même logo 24x24 + NEXUS. Active nav = pill blanc #FFFFFF fg #0A0A0A (contraste fort avec logo blanc — ok).
- **Login Card 400px radius 24px:** Logo **MASTER 48px** centré en haut. Pas chrome, pas de shadow. Flat white. C'est plus premium que chrome car ça matche ton UI.
- **Favicon:** `favicon-32.png` + `favicon-16.png` — utiliser dark version.
- **Loading / Empty states:** Logo 32px opacity 60% pulsing, pas rotation.
- **/upgrade pricing page:** Logo 32px top-left header, pas plus gros — le pricing doit rester sobre.

**Pourquoi ce flat blanc > chrome pour NEXUS:** Chrome faisait "3D marketing". Ton flat interlaced est architectural, intemporel, comme le Wordmark de Linear ou Vercel. Il vieillit jamais.

---

## 6. WORDMARK FINAL

- Texte: "NEXUS"
- Font: Inter 600 (pas 700), tracking -0.03em, uppercase
- Couleur: #F5F5F5 sur dark, #0A0A0A sur light
- Jamais en dégradé, jamais en chrome
- Toujours à côté du symbole, jamais en dessous sauf hero login (optionnel sans wordmark)

---

## 7. DO & DON'T — LOI

**DO:**
- Utiliser PNG master tel quel, sans retracer
- Garder gap central visible (c'est le concept)
- Resizer avec LANCZOS sharp, pas blur
- Garder fond #0A0A0A pour dark

**DON'T — SOUS AUCUN PRÉTEXTE:**
- Ne pas arrondir les angles du N
- Ne pas remplir le gap central
- Ne pas ajouter gradient, glass, blur, glow
- Ne pas étirer, ne pas pencher, ne pas skew
- Ne pas mettre sur fond coloré (lavande, etc.) — seulement #0A0A0A ou #FFFFFF
- Ne pas créer version outline / stroke
- Ne pas animer en rotation 3D

---

## 8. PACK LIVRÉ À L'AGENT VS CODE

Dossier `/home/user/nexus-final-logo-pack/`:

- `NEXUS-MASTER-WhiteOnBlack.png` — MASTER officiel (213KB) — ton original
- `NEXUS-MASTER-BlackOnWhite.png` — inversion exacte forme
- `NEXUS-MASTER-WhiteOnTransparent.png` — transparent 9.5KB
- `NEXUS-MASTER-BlackOnTransparent.png`
- `app-icon-dark-1024.png` → copier vers `public/icon-1024.png` et `app/icon.png`
- `app-icon-dark-512.png`, `180`, `120`, `60`, `32`, `16` → PWA icons
- `app-icon-light-1024.png`, `512`, `180` → light mode OS
- `favicon-32.png`, `favicon-16.png` → `app/favicon.ico` (convertir)

**Instruction pour agent:**
```
cp nexus-final-logo-pack/NEXUS-MASTER-WhiteOnTransparent.png public/logo/nexus.png
cp nexus-final-logo-pack/app-icon-dark-1024.png app/icon.png
cp nexus-final-logo-pack/favicon-32.png public/favicon-32.png
```

Composant React `NexusLogo.tsx`:
```tsx
import Image from 'next/image'
import logo from '@/public/logo/nexus.png' // transparent white
export const NexusLogo = ({ size=28 }: { size?: number }) => (
  <Image src={logo} alt="NEXUS" width={size} height={size} style={{ imageRendering: 'pixelated' ? undefined : 'auto' }} />
)
```
Ne pas recréer en SVG sauf tracé pixel-perfect identique (mieux rester PNG pour garantie forme).

---

## 9. VALIDATION FINALE

- Shape = exactement image.png que tu as envoyé
- Couleur = blanc #FFFFFF sur #0A0A0A
- Angle = 45° sharp
- Gap central = préservé (concept connexion)
- Premium = flat architectural, pas effet 3D
- Intégration V2 = parfait avec pill white Create button + border 8% + dot grid

**Ce logo est NEXUS. Il ne doit plus changer.**

— Fin de spec FINAL FINAL.
