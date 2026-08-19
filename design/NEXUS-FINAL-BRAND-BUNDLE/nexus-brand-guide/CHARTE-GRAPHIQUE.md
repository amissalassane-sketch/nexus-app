# NEXUS — CHARTE GRAPHIQUE OFFICIELLE
**V3.0 Pill Atelier + Logo Interlacé Blanc — 16 août 2026**

## LOGO OFFICIEL — NE PAS MODIFIER

Dossier `logo/` contient le logo FINAL unique:

- `NEXUS-MASTER-WhiteOnBlack.png` = **MASTER** — ton image originale exacte
- `NEXUS-MASTER-WhiteOnTransparent.png` — même forme sur transparent (usage UI)
- `NEXUS-MASTER-BlackOnWhite.png` — inversion noire sur blanc (light mode)
- `app-icon-dark-1024.png` — App icon fond #0A0A0A + logo blanc padding 20%

**Forme:** N interlacé sharp 45°, épaisseur 18-20%, gap central 8% où 2 pièces s'entrelacent sans se toucher. C'est le concept "Everything important, connected".

**Règles:**
- Minimum 16px favicon lisible
- Clear space 25% hauteur autour
- INTERDIT: arrondir, remplir gap, gradient, outline, glow, rotation 3D, couleur autre que blanc #FFFFFF ou noir #0A0A0A
- Sidebar: 28x28 flat white
- Login: 48px flat white centré
- App Icon: 60% du carré, padding 20%

## COULEURS

**Base (issu de ton screenshot dropdown):**
- bg.base #0A0A0A + dot grid radial rgba(255,255,255,0.035) 1px / 20px
- bg.subtle #111111 (sidebar)
- bg.surface #171717 (dropdown, inputs, cards — comme ta ref)
- bg.surface-2 #1C1C1C hover

**Borders:** JAMAIS gris solide, toujours blanc opacité:
- subtle rgba(255,255,255,0.06)
- default rgba(255,255,255,0.08) — partout
- strong rgba(255,255,255,0.12)

**Text:**
- primary #F5F5F5
- secondary #8F8F8F
- tertiary #5A5A5A

**Accent:**
- primary #FFFFFF pill CTA
- badge #EDE8FF lavande pâle cercle interne Create button
- lavender #E9E4FF focus ring seulement

**Semantic 10% bg:**
- success #7ADE9B, warning #E8C574, danger #FF7A7A, info #8AA8FF

## TYPOGRAPHIE

Inter 600 -0.03em pour NEXUS wordmark, body 13.5px/21px -0.01em 400, h1 20px/28px -0.02em 550, mono 11.5px pour dates

## RADIUS

- pill 9999px = TOUS les CTA primaires (Create, New Task, Sign In, Upgrade)
- md 10px = inputs, nav items
- lg 16px = dropdowns (comme ta ref), cards
- 2xl 24px = login card, pricing cards

## COMPOSANTS SIGNATURES (ressources)

**Create Button (ton screenshot):**
- 36px height pill radius 9999px bg white #FFFFFF fg #0A0A0A padding 4px 14px 4px 4px
- Badge interne 28x28 cercle bg #EDE8FF + plus 16px stroke 1.75
- Texte 13px 500
- Shadow 0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.24)
- Hover scale 1.01

**Dropdown Menu (ton screenshot exact):**
- Width 240px user menu, radius 16px, bg #171717, border 0.08, shadow 0 8px 24px rgba(0,0,0,0.48)
- Padding 6px, items 36px radius 10px gap 10px icon 18px stroke 1.5 fg #5A5A5A text 13.5px #8F8F8F
- Hover bg rgba(255,255,255,0.06) fg #F5F5F5
- Active bg rgba(255,255,255,0.08) + left line white 2px x 14px (visible sur Profile dans ta capture)

**Sidebar:** 220px transparente sans border-right, items 32px radius 10px, active bg white fg black pill

**TopBar:** 56px fixed blur 12px bg #0A0A0A/80 border-bottom 0.06, right Create pill + avatar 32px

## PAGES

- Login: 400px radius 24px bg #111111 border 0.08 + logo 48px
- Dashboard: Focus Block 16px + stats pills 28px + 2 cols
- Pricing /upgrade: hero 32px + cards 320px radius 24px + glow lavender radial 20% blur

## USAGE POUR IA

Donne à l'IA ce dossier `nexus-brand-guide/` + `NEXUS-FINAL-DA-COMPLETE.md`. Elle doit:
1. Utiliser uniquement `logo/nexus-final.png` (WhiteOnTransparent) comme logo
2. Jamais recréer le N, utiliser PNG tel quel
3. Appliquer tokens exacts ci-dessus
4. Respecter pill + 16px + dot grid + left line active

— Fin charte.
