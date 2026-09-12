# Comment appliquer ce paquet à nexus-app

Ce zip contient uniquement les fichiers **modifiés ou ajoutés** cette session — pas le repo entier. Copie chaque fichier au même chemin relatif dans ton dépôt (ils remplacent les fichiers existants correspondants, sauf les 4 `.md` qui sont nouveaux).

## Fichiers modifiés (à remplacer tels quels)
- `src/components/auth/login-form.tsx`
- `src/components/auth/signup-form.tsx`
- `src/components/auth/confirm-error.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`

Corrections : `transition-all` → propriétés explicites, `spellCheck={false}` sur les champs email, ajout d'un bouton afficher/masquer le mot de passe sur login/signup, correction de la coquille "Forget" → "Forgot".

**Avant de merger : lance `npm run build` et `npm run lint` de ton côté.** Je n'ai pas pu compiler ces changements dans mon environnement (pas d'accès réseau, pas de `node_modules`) — les modifications sont volontairement mécaniques et à faible risque, mais vérifie quand même.

## Fichiers nouveaux (à ajouter)
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/boardui.md`
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/democrito.md`
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/speyer-ui.md`
- `NEXUS-DESIGN-KNOWLEDGE/04-AI-DESIGN-SYSTEMS/machine-legible-design-systems.md`
- `WEB_INTERFACE_GUIDELINES_AUDIT_REPORT.md` (à la racine du repo, à côté des autres `*_REPORT.md`)

## À lire en premier
`WEB_INTERFACE_GUIDELINES_AUDIT_REPORT.md` — le résumé complet : ce qui a été corrigé, ce qui a été seulement documenté (et pourquoi), et ce qui reste à auditer.
