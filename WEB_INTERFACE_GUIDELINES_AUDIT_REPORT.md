# Web Interface Guidelines — audit report (2026-09-12)

**Portée :** revue manuelle d'un échantillon de fichiers réels contre les [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines), croisée avec les 8 ressources de design system fournies par l'utilisateur. Pas une revue exhaustive des 149 composants — un échantillon ciblé sur les primitives (`ui/`) et le flow d'authentification (le code le plus récemment ajouté et le moins couvert par les rapports d'audit existants à la racine).

**Contrainte de session :** aucun accès réseau dans l'environnement d'exécution (pas de `npm install`/`next build`/`tsc` possibles ici, `node_modules` absent de l'archive fournie). Tous les correctifs ci-dessous sont volontairement mécaniques et à faible risque — vérifiables à la lecture, sans nécessiter de compilation. Toute recommandation plus structurelle est documentée mais **non appliquée**, pour ne pas introduire de régression invisible dans cette session.

---

## ✅ Déjà conforme (échantillon vérifié)

- `src/components/ui/button.tsx` — variants hover/active/focus/disabled/loading complets, `transition-[...]` déjà explicite (pas de `transition: all`), `IconButton` impose un `label` accessible. **Pass.**
- `src/components/ui/modal.tsx` — `overscroll-contain`, `role="dialog"` + `aria-modal`, restitution du focus à la fermeture, `env(safe-area-inset-bottom)` géré, animations transform/opacity uniquement. **Pass** (une réserve, voir plus bas).
- `src/components/ui/toast.tsx` — `aria-live="polite"` + `role="status"` présents. **Pass.**
- `src/components/ui/dropdown.tsx` — `Escape`, flèches haut/bas, `role="menu"`/`role="menuitem"` gérés. **Pass.**
- `globals.css:703` — anneau de focus global mesuré à ~7-7.9:1 de contraste, jamais supprimé sans remplacement. **Pass.**

## 🔧 Corrigé dans cette session

`src/components/auth/login-form.tsx`
- :192,210 — `transition-all duration-200` → `transition-[border-color,box-shadow,opacity] duration-200` (anti-pattern explicite des guidelines).
- :183 — ajout de `spellCheck={false}` sur le champ email.
- Ajout d'un bouton afficher/masquer le mot de passe (`Eye`/`EyeOff`, `aria-label`, `aria-pressed`) — le champ n'avait aucun moyen de vérifier ce qu'on y tape.
- Correction de copie : "Forget password?" → "Forgot password?".

`src/components/auth/signup-form.tsx`
- :186,204,222 → mêmes corrections `transition-all` (3 occurrences).
- Ajout de `spellCheck={false}` sur le champ email.
- Ajout du même toggle afficher/masquer, partagé entre le champ mot de passe et sa confirmation.

`src/components/auth/confirm-error.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`
- `transition-all duration-200` → `transition-[border-color,box-shadow,opacity] duration-200` (4 occurrences au total).
- `spellCheck={false}` ajouté sur le champ email de `forgot-password/page.tsx`.

Ces cinq fichiers partageaient tous le même style de champ "pilule" recopié-collé (border/blur/radius identiques) — les corrections ont donc été appliquées de façon identique partout où le motif apparaissait, pour ne pas laisser un écran non corrigé par oubli.

## 📋 Constaté mais non corrigé (recommandations)

### 1. Les 6 écrans du flow auth réimplémentent des inputs à la main
`login-form.tsx`, `signup-form.tsx`, `confirm-error.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-code.tsx` codent leur propre `<input>` stylé en pilule au lieu de réutiliser `Input`/`Field`/`PasswordInput` de `src/components/ui/`. C'est une violation de la Règle #16 de `NEXUS-DESIGN-RULES.md` ("ne jamais dupliquer un composant `ui/` existant"). Le style pilule semble être un choix de marque assumé pour l'auth (cohérent avec "Pill Atelier Noir"), donc la bonne réparation n'est **pas** de forcer le radius générique de `Input` par-dessus, mais d'ajouter une variante `shape="pill"` officiellement supportée par `Input`/`PasswordInput`, puis de migrer les 6 écrans vers elle. Non fait ici : modifier une primitive partagée sans pouvoir compiler pour vérifier l'impact sur ses autres appelants serait irresponsable.

### 2. `Modal` ne piège pas le focus au `Tab`
`src/components/ui/modal.tsx` restitue le focus à la fermeture et gère `Escape`, mais rien n'empêche `Tab` de faire sortir le focus clavier du panneau vers le reste de la page pendant que la modale est ouverte. Deux réparations possibles (détaillées dans `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/speyer-ui.md`) : migrer vers `<dialog>` natif, ou ajouter un piège de focus manuel dans l'`useEffect` existant. Non fait ici pour la même raison qu'au point 1.

### 3. Aucun test d'accessibilité automatisé
`ANALYSIS-REPORT.md` confirme l'absence de Jest/Vitest/Playwright dans le projet — les règles d'accessibilité de NEXUS sont excellentes mais vérifiées uniquement à l'œil. Voir `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/speyer-ui.md` pour un exemple de validateur automatique (axe-core + budget de contraste) qui pourrait faire échouer le build.

### 4. Pas de manifeste de composants lisible par machine
`AGENTS.md`/`CLAUDE.md` existent mais aucun `llms.txt`/registry structuré des 149 composants. Détaillé avec un plan en 3 étapes dans `NEXUS-DESIGN-KNOWLEDGE/04-AI-DESIGN-SYSTEMS/machine-legible-design-systems.md`.

### 5. Non vérifié faute de temps (à auditer dans une session suivante)
`verify-code.tsx`, les pages `(app)/*` (dashboard, tasks, projects, goals), `src/components/landing/*` (20+ sections), `src/components/dashboard/*`. Aucune anomalie détectée dans les fichiers vus en passant, mais ils n'ont pas reçu la même revue ligne par ligne que le flow auth.

---

## Nouveaux fichiers ajoutés à la base de connaissances

- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/boardui.md`
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/democrito.md`
- `NEXUS-DESIGN-KNOWLEDGE/03-UX-REFERENCES/speyer-ui.md`
- `NEXUS-DESIGN-KNOWLEDGE/04-AI-DESIGN-SYSTEMS/machine-legible-design-systems.md`

(arkite-ui, Nerio, uikit/Bloomneo, accessibility-in-design-system, awesome-ux-design-styles et state-of-ai-in-design-systems ont été lus et leurs enseignements pertinents intégrés par recoupement dans les quatre fichiers ci-dessus plutôt que dupliqués en fichiers séparés, pour éviter la redondance — le rapport `state-of-ai-in-design-systems` en particulier est cité comme preuve dans `machine-legible-design-systems.md`.)
