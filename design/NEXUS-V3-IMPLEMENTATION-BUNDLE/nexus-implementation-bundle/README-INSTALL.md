# NEXUS V3 - BUNDLE D'INSTALLATION - LM ARENA (sans upload zip)

Tu ne pouvais pas uploader le zip sur LM Arena. Voici le bundle prêt à copier-coller dans ton VS Code local.

## 1. Copie le DA complet
Le fichier de référence unique est dans ce workspace:
- `/home/user/NEXUS-FINAL-DA-COMPLETE.md` → donne-le à ton agent Cursor/VS Code comme SYSTEM PROMPT
- `/home/user/NEXUS-FINAL-FINAL-LOGO-LOCKED-SPEC.md` → logo officiel interlacé, ne pas modifier

## 2. Logo Pack
Dossier `/home/user/nexus-final-logo-pack/` contient:
- MASTER WhiteOnBlack (ton image originale)
- WhiteOnTransparent, BlackOnTransparent, BlackOnWhite (même forme, inversion couleur seulement)
- app-icon-dark-1024.png etc + favicon-32/16

Actions à faire dans ton vrai projet NEXUS:
```bash
rm -rf public/logo/*
mkdir -p public/logo
cp NEXUS-MASTER-WhiteOnTransparent.png public/logo/nexus.png
cp NEXUS-MASTER-BlackOnTransparent.png public/logo/nexus-black.png
cp app-icon-dark-1024.png app/icon.png
cp app-icon-dark-512.png app/icon-512.png
cp favicon-32.png app/favicon.ico
# ou public/favicon.ico selon ta structure
```

## 3. Tokens - Remplace ces 2 fichiers

**tailwind.config.ts** → copie contenu de `/home/user/nexus-implementation-bundle/tailwind.config.ts`

**app/globals.css** → copie contenu de `/home/user/nexus-implementation-bundle/app/globals.css`
- Ajoute le dot grid body::before
- Fond #0A0A0A

## 4. Composants shadcn à écraser

Copie ces fichiers (emplacements standards App Router):
- `components/ui/button.tsx` → version pill white + variant create avec badge #EDE8FF
- `components/ui/dropdown-menu.tsx` → version 16px radius bg #171717 border 8% + left white line active
- Tu dois aussi adapter `input.tsx` -> height 40px radius 10px bg #171717 border 8%
- `card.tsx` -> bg #111111 border 6% radius 16px

## 5. Layout

J'ai créé:
- `components/layout/TopBar.tsx` → 56px fixed blur + Create pill + avatar 32px + dropdown 240px exactement comme ta capture
- `components/layout/Sidebar.tsx` → 220px transparente, active pill blanc #FFFFFF fg #0A0A0A

Dans `app/(dashboard)/layout.tsx`:
```tsx
import { TopBar } from "@/components/layout/TopBar"
import { Sidebar } from "@/components/layout/Sidebar"
export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <TopBar />
      <Sidebar />
      <main className="ml-[220px] mt-[56px] p-8 max-w-[1240px]">{children}</main>
    </div>
  )
}
```

## 6. Pages critiques

- Login: copie `app/page-login.tsx` → `app/(auth)/login/page.tsx`
- Upgrade: `app/upgrade/page.tsx` → nouvelle route /upgrade avec pricing cards 24px radius + glow lavender

## 7. Dashboard inspiré de ta ref + concepts

Structure:
- Header greeting 30px 500
- Focus Block radius 16px bg #111111 border 8%
- Stats en pills 28px radius 9999px
- Grid Active Projects + Tasks Due + Team Activity + Performance (comme dans nexus-v2-dashboard-concept.png)

## 8. Vérif

```bash
npm run dev
# vérifie:
# - TopBar Create pill blanc avec badge lavande?
# - Dropdown 16px avec ligne blanche left active?
# - Sidebar 220px transparent active blanc pill?
# - Dot grid visible sur #0A0A0A?
# - Logo interlacé blanc 28px partout pas modifié?
# - Login card 24px radius logo 48px?
```

## 9. Si tu utilises Cursor / Copilot Agent

Prompt à donner à l'agent local:
> Lis NEXUS-FINAL-DA-COMPLETE.md et NEXUS-FINAL-FINAL-LOGO-LOCKED-SPEC.md comme source unique de vérité. Applique full redesign Pill Atelier: bg #0A0A0A + dot grid, border rgba(255,255,255,0.08), pill white CTA avec badge #EDE8FF, dropdown 16px bg #171717 avec active left line 2x14px blanche, sidebar 220px transparente active pill blanc, logo N interlacé blanc exact de public/logo/nexus.png jamais modifié, login 24px radius, pricing /upgrade avec glow lavender. Ne touche pas à Supabase logic. Remplace tout l'ancien UI.

Tu veux que je zip ce bundle et te donne un lien de téléchargement local? Dis moi et je génère le zip.

