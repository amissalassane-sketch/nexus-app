# NEXUS — Design Review Checklist

Checklist exploitable par l'agent avant de livrer toute modification visible utilisateur. À dérouler dans l'ordre — chaque section renvoie vers le document de référence détaillé.

## 0. Avant de commencer

- [ ] Ai-je lu `06-NEXUS-CONTEXT/NEXUS-DESIGN-SYSTEM.md` et les fichiers liés pertinents à cette modification ?
- [ ] Ai-je vérifié qu'un composant existant (`06-NEXUS-CONTEXT/NEXUS-COMPONENTS.md`) ne couvre pas déjà ce besoin ?
- [ ] Ai-je vérifié qu'un pattern existant (`05-COMPONENT-PATTERNS/`) ne s'applique pas déjà à ce cas ?
- [ ] Si cette modification touche une décision déjà actée (`NEXUS-DESIGN-DECISIONS.md`), ai-je une raison documentée de la faire évoluer plutôt que de la contourner silencieusement ?

## 1. VISUAL

- [ ] **Hiérarchie** : un seul point focal principal par écran/section ; le texte respecte l'ordre `primary → secondary → tertiary → quaternary` selon son rôle réel (pas son apparence désirée).
- [ ] **Contraste** : toute paire texte/fond nouvelle atteint 4.5:1 (texte normal) ou 3:1 (grand texte / composants graphiques) — vérifier sur la surface réelle où l'élément apparaîtra (`bg-base`/`bg-subtle`/`bg-surface`/`bg-surface-2`/`bg-surface-3`), pas seulement sur noir pur.
- [ ] **Alignement** : les éléments s'alignent sur la grille de colonnes du breakpoint courant (`NEXUS-TOKENS.md`), pas sur des valeurs de pixel arbitraires.
- [ ] **Spacing** : les espacements utilisés existent déjà dans l'échelle Tailwind du projet (`gap-*`, `p-*`, `m-*`) — pas de valeur `px-[13px]` inventée sans raison documentée.
- [ ] **Typographie** : la taille/poids/tracking utilisés correspondent à un token `text-*` existant (`NEXUS-TOKENS.md`) ; `display*` n'apparaît jamais dans le shell applicatif.
- [ ] **Densité** : cohérente avec le contexte (dense pour dashboard/tasks/projects, plus aérée pour landing/pricing) — voir `NEXUS-UX-PRINCIPLES.md` §2.
- [ ] **Cohérence** : le nouvel élément ressemble à ses pairs existants (même famille de radius, même style de bordure, même comportement de hover) — pas une variation stylistique isolée.
- [ ] **Couleur** : aucune couleur en dur, tout passe par un token ; la lavande n'est utilisée que pour un signal d'intelligence ou de focus, jamais en décoration (`NEXUS-BRAND.md`).

## 2. UX

- [ ] **Clarté** : un utilisateur qui voit cet élément pour la première fois comprend son rôle sans info-bulle obligatoire.
- [ ] **Affordance** : un élément cliquable a l'air cliquable (curseur, hover, état actif) ; un élément non cliquable n'imite pas ces signaux.
- [ ] **Feedback** : toute action produit un retour perceptible sous ~200ms ; toute opération plus longue affiche un état de chargement nommé, pas un gel silencieux.
- [ ] **Navigation** : la nouvelle destination est déclarée dans `nav-config.ts` si c'est une page de premier niveau ; le fil d'ariane et le Command Menu la reflètent automatiquement.
- [ ] **Friction** : le nombre de clics/étapes pour l'action principale est minimal ; toute étape supplémentaire est justifiée par la prévention d'erreur, pas par accident de conception.
- [ ] **Erreurs** : chaque état d'erreur possible a un message humain et une action de sortie ; aucun message technique brut n'est exposé.
- [ ] **États** : vide / chargement / erreur / succès sont tous prévus, pas seulement le "happy path".

## 3. PRODUCT

- [ ] **Utilité réelle** : cette fonctionnalité résout un besoin identifié, pas une opportunité esthétique sans valeur d'usage.
- [ ] **Cohérence avec NEXUS** : le vocabulaire, le ton et le comportement correspondent à l'identité déjà établie (`NEXUS-BRAND.md`) — pas un emprunt non digéré à un autre produit.
- [ ] **Valeur utilisateur** : la fonctionnalité aide l'utilisateur à agir plus vite ou avec plus de confiance sur son travail réel — pas seulement à "avoir l'air intelligent".
- [ ] **Complexité ajoutée** : la nouvelle option/écran ne multiplie pas les choix visibles simultanément sans nécessité (loi de Hick, `01-CORE-PRINCIPLES/laws-of-ux.md`).
- [ ] **Cohérence avec le workflow** : la fonctionnalité s'intègre au parcours existant (dashboard → intelligence → projets/tâches → activité) plutôt que de créer un silo isolé.

## 4. TECHNICAL

- [ ] **Responsive** : testé mentalement (ou réellement) aux paliers mobile/tablette/desktop de `NEXUS-TOKENS.md` — pas seulement au breakpoint de développement par défaut.
- [ ] **Performance** : pas de dépendance lourde ajoutée pour un effet mineur ; le rendu 3D/animations coûteuses reste limité aux écrans qui en ont besoin.
- [ ] **Accessibilité** : voir `accessibility-standards.md` — focus visible, clavier complet, contraste, cibles tactiles, labels, `aria-live` pour le contenu dynamique pertinent.
- [ ] **Composants réutilisables** : la modification étend un composant `ui/` existant plutôt que d'en dupliquer un nouveau, sauf raison documentée.
- [ ] **Maintenabilité** : le nouveau code suit les conventions de nommage et d'architecture déjà en place (`NEXUS-COMPONENTS.md`).
- [ ] **Données réelles** : rien n'est fabriqué/placeholder dans le rendu final — tout vient d'une vraie requête ou d'un état de chargement honnête.

## 5. AI (si la modification touche une capacité IA)

- [ ] Toute mutation proposée par l'IA passe par confirmation puis vérification par relecture (`NEXUS-DESIGN-DECISIONS.md` D-013/D-014).
- [ ] Le niveau de friction de confirmation est proportionnel au risque réel de l'action.
- [ ] Aucune donnée n'est inventée par l'assistant — tout provient du snapshot réel du workspace.
- [ ] L'état de traitement affiché est honnête et nommé, pas un indicateur générique.
- [ ] Voir `ai-product-patterns.md` pour le détail complet.

## 6. Sortie

- [ ] `git diff` relu intégralement — aucun fichier hors périmètre modifié par erreur.
- [ ] Aucun token/couleur/animation en dur qui duplique un token existant.
- [ ] Toute décision de design significative nouvellement prise est ajoutée à `NEXUS-DESIGN-DECISIONS.md`.
