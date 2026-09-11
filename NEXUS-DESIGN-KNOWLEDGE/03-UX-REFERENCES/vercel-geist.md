# Vercel / Geist — principes retenus pour NEXUS

Source : Geist Design System (Vercel), documentation publique et analyses de design (`vercel.com`, système Geist Sans/Mono).

## Ce qui est transférable

- **La compression comme identité typographique** : tracking négatif progressif qui se relâche à mesure que la taille de police diminue (fort en display, neutre en corps de texte). NEXUS applique déjà ce principe : `--text-display-xl--letter-spacing: -0.04em` (58px) descend à `-0.015em` pour `h2` (16px) et 0 pour `body` — voir `globals.css`. **Principe à préserver** : plus le texte est petit, moins on resserre — jamais l'inverse.
- **Le vide comme signal de confiance** : un espacement généreux entre sections communique la maîtrise, pas la paresse. Applicable aux pages publiques NEXUS (landing, pricing) plus qu'au dashboard, qui doit rester dense pour un usage de travail répété.
- **Ombre-comme-bordure** : `box-shadow` à décalage nul remplace une bordure CSS classique pour un liseré ultra-fin et cohérent quel que soit le fond. NEXUS utilise une approche proche mais inversée : des bordures blanches à opacité très faible (`border-subtle: rgba(255,255,255,0.06)`) plutôt que des ombres, ce qui fonctionne mieux sur fond quasi-noir (une ombre claire serait peu visible sur du noir). **Ne pas copier littéralement la technique Vercel (pensée pour fond clair) — garder la solution bordure-opacité de NEXUS qui répond au même besoin sur fond sombre.**
- **Poids de police discipliné** : jamais de `bold` (700) sur le corps de texte, 600 réservé aux titres. NEXUS suit une discipline similaire (`h1`–`h3` en 600, `body` en 400).
- **Pas de couleur d'accent décorative** : les couleurs de statut (ex. workflow) ne doivent servir qu'à leur fonction sémantique, jamais en décor. Directement aligné avec la contrainte NEXUS sur le violet/lavande réservé à l'intelligence.
- **Rythme d'espacement resserré puis un saut délibéré** (échelle Vercel : ...16px puis 32px, sans 20/24) — l'idée transférable n'est pas la valeur exacte mais la discipline : peu de paliers, des sauts assumés plutôt qu'une échelle continue arbitraire. NEXUS a sa propre échelle (voir `NEXUS-TOKENS.md`), à ne pas remplacer par celle de Vercel.

## Ce qu'on NE prend PAS

- La palette claire (fond blanc, texte quasi-noir `#171717`) — NEXUS est un système sombre par identité ("jamais de dashboard gris").
- La police Geist Sans elle-même en tant qu'asset (propriétaire Vercel) — NEXUS utilise Inter Variable, déjà auto-hébergée.
- Les couleurs de marque du workflow Vercel (Ship Red, Preview Pink, Develop Blue).
