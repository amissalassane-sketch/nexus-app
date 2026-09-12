# Méthodologie des design tokens — appliquée à NEXUS

Ce document explique **comment** raisonner sur les tokens de NEXUS, pas ce qu'ils valent (voir `06-NEXUS-CONTEXT/NEXUS-TOKENS.md` pour les valeurs réelles, extraites du code).

## 1. Une seule source de vérité [CONFIRMED]

`src/app/globals.css` (bloc `@theme`, Tailwind v4) est la **seule** source de tokens pour l'application Next.js. Toute classe Tailwind générée (`bg-bg-base`, `text-text-secondary`, `border-border-default`, `rounded-card`...) en dérive automatiquement.

`tailwind.config.js` à la racine est un **portage miroir** documenté comme tel dans son propre en-tête ("Ported from src/app/globals.css... so the primitives built here compile unchanged when lifted back into the app") — il sert un espace de prototypage séparé (`index.html`), pas le build applicatif réel. **Ne jamais modifier un token dans un seul des deux fichiers** : toute évolution de token doit être répercutée dans les deux, `globals.css` en premier (source), `tailwind.config.js` en miroir.

## 2. Nommage sémantique, jamais par valeur [CONFIRMED — à préserver]

Un token se nomme par son **rôle** (`--color-text-secondary`, `--color-border-focus`, `--color-danger-bg`), jamais par sa valeur chromatique ou numérique (pas de `--gray-400`, pas de `--purple-100`). C'est déjà la convention réelle du fichier et elle doit être protégée : elle permet de changer une valeur sans renommer tous ses usages, et elle rend une revue de code capable de juger l'intention ("est-ce que `danger-bg` est le bon choix ici ?") sans deviner une couleur.

## 3. Catégories de tokens dans NEXUS [CONFIRMED]

| Catégorie | Préfixe | Exemples |
|---|---|---|
| Surface | `--color-bg-*` | `bg-base`, `bg-subtle`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `bg-veil` |
| Bordure | `--color-border-*` | `border-subtle`, `border-default`, `border-strong`, `border-focus` |
| Texte | `--color-text-*` | `text-primary`, `text-secondary`, `text-tertiary`, `text-quaternary`, `text-muted` |
| Accent neutre | `--color-accent*` | `accent`, `accent-fg`, `accent-hover`, `accent-ghost`, `accent-ghost-hover`, `accent-badge` |
| Accent intelligence | `--color-lavender*` | `lavender`, `lavender-subtle`, `lavender-border` |
| Sémantique | `--color-success/warning/danger/info-*` | valeur + `-bg` (fond ~9% opacité) + `-border` (~20% opacité) |
| Typographie | `--text-*` | taille + line-height + letter-spacing + font-weight groupés par nom d'usage (`h1`, `body`, `eyebrow`...) |
| Layout | `--breakpoint-*`, `--container-page`, `--page-margin*`, `--grid-gutter`, `--chrome-*` | grille responsive par device class |
| Radius | `--radius-*` | nommé par **usage** (`input`, `nav`, `row`, `card`, `dropdown`, `panel`, `empty`, `auth`, `pill`), jamais par taille abstraite (`sm`/`md`/`lg`) |
| Ombre | `--shadow-*` | `dropdown`, `overlay`, `auth` |
| Mouvement | `--ease-*`, `--duration-*`, `--animate-*` | easing nommé par intention (`nexus`, `standard`, `emphasized`, `decelerate`, `accelerate`) |

**Point notable et à préserver** : les radius sont nommés par **contexte d'usage** (`radius-card`, `radius-dropdown`, `radius-auth`) plutôt que par taille abstraite. C'est délibérément plus contraignant qu'une échelle `sm/md/lg/xl` générique — cela empêche qu'un composant utilise "le radius qui a l'air bien" au lieu du radius qui correspond à sa famille de composant. Toute nouvelle famille de composant (ex. un nouveau type de card) doit soit réutiliser un radius existant, soit en ajouter un nommé par usage, jamais piocher une valeur arbitraire en inline.

## 4. Traçabilité des changements de token [CONFIRMED]

Le fichier `globals.css` contient déjà des commentaires "DESIGN AUDIT" qui expliquent **pourquoi** une valeur a changé et quelle mesure (contraste, occupation d'espace) l'a motivée. C'est le modèle à suivre pour toute future modification de token : un changement de valeur doit être commenté avec sa justification, pas seulement son nouveau nombre. Ce même exigence est formalisée dans `06-NEXUS-CONTEXT/NEXUS-DESIGN-DECISIONS.md`.

## 5. Where tokens must NOT be duplicated

- Jamais de couleur hexadécimale en dur dans un composant (`className="bg-[#0f0f0f]"`) — toujours passer par le token Tailwind généré (`bg-bg-surface`).
- Jamais de valeur de durée/easing en dur dans un `style` inline si un token équivalent existe (`transition-duration: 200ms` → utiliser `duration-[200ms] ease-nexus` ou la classe d'animation existante).
- Les rares valeurs "one-off" documentées en commentaire (ex. `text-[26px]` pour les KPI, `h-[46px]` de header Panel) sont tolérées **seulement** quand elles n'ont pas encore de rôle réutilisable identifié — dès qu'un même one-off apparaît 2 fois, il doit devenir un token nommé.
