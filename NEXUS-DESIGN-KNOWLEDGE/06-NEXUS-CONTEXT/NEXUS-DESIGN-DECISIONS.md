# NEXUS DESIGN DECISIONS — journal

Ce fichier consigne les décisions de design **déjà prises** (extraites du code et de son historique documenté dans les rapports de chantier à la racine du repo), pour qu'elles ne soient jamais silencieusement écrasées par une préférence esthétique ponctuelle future. Chaque entrée : la décision, pourquoi, la source de preuve.

**Règle d'ajout** : toute future décision de design significative doit être ajoutée ici, avec la même structure, avant ou en même temps que son implémentation — pas après coup de mémoire.

---

### D-001 — Un seul conteneur de page (`--container-page: 1148px`)
**Pourquoi :** trois valeurs coexistaient (1080px landing/pricing, 1120px sections landing, 1180px shell applicatif), créant un saut visuel de 32px au bord du contenu en passant de la landing au dashboard.
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §1.
**Statut :** actif, ne pas réintroduire une deuxième largeur de conteneur sans fusionner d'abord dans ce token.

### D-002 — `lg:` reste à 1024px, pas 834px
**Pourquoi :** `lg:` est le seuil d'apparition de la sidebar de workspace (248px). À 834px, il resterait 586px de contenu à côté de la sidebar — moins d'espace utile qu'en mode portrait. Le référentiel de grille externe est une source, pas une fin : les nouveaux paliers (`xs`, `tablet`, `wide`) sont **ajoutés** à l'échelle existante, jamais substitués à elle.
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §2.
**Statut :** actif — écart assumé et documenté, ne pas "corriger" pour aligner littéralement sur un référentiel externe.

### D-003 — Toute l'échelle de breakpoints est redéclarée (defaults inclus)
**Pourquoi :** déclarer seulement les nouveaux paliers (`xs`/`tablet`/`wide`) aurait fait émettre Tailwind les customs avant l'échelle intégrée, cassant l'ordre de cascade (`tablet:` 834px passerait avant `md:` 768px). Redéclarer tout en bloc garantit une série triée, vérifiée à la compilation et verrouillée par assertion (`scripts/test-mobile-ux.mjs`).
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §2.
**Statut :** actif — toute modification de breakpoint doit repasser par une redéclaration complète, jamais un ajout isolé.

### D-004 — Rampe de texte recalculée pour AA sur toutes les surfaces réelles
**Pourquoi :** la ramp précédente tombait sous WCAG AA sur les surfaces réelles de l'app (`#0f0f0f`/`#151515`/`#1c1c1c`), pas seulement sur le noir pur. La nouvelle ramp garde la même identité "near-black, desaturated" mais lève chaque palier pour que les quatre niveaux passent 4.5:1 sur toutes les surfaces.
**Source :** commentaire "DESIGN AUDIT — CONTRAST PASS" dans `src/app/globals.css`.
**Statut :** actif. Toute nouvelle combinaison texte/fond doit être mesurée avec la même rigueur avant merge — ne pas assombrir un palier de texte sans revalider le contraste sur les 4 surfaces de référence.

### D-005 — L'accent lavande est réservé à l'intelligence, usage restreint
**Pourquoi :** contrainte produit explicite — l'IA ne doit pas "envahir" l'interface. Une couleur de signal qui serait partout perdrait sa fonction de signal (effet Von Restorff, `01-CORE-PRINCIPLES/laws-of-ux.md`).
**Source :** commentaire source `globals.css` ("used sparingly"), confirmé par `NEXUS-BRAND.md`.
**Statut :** actif, contrainte non négociable sans décision produit explicite et documentée ici.

### D-006 — Marges de page 16/24/32px (mobile/tablette/desktop)
**Pourquoi :** alignement sur les baselines HIG iOS et Android (16pt), avec un effet secondaire mesuré (8px de largeur utile récupérés sur un écran 320px, suffisant pour une colonne de métrique supplémentaire).
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §1.
**Statut :** actif.

### D-007 — Grille responsive par changement de colonnes, pas de largeur de conteneur seule
**Pourquoi :** garder une carte à peu près à la même taille physique sur téléphone et sur laptop plutôt que de l'étirer.
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §1, `src/app/globals.css`.
**Statut :** actif.

### D-008 — Tab bar mobile à 56px (pas 46px)
**Pourquoi :** 46px était 10px en dessous des deux référentiels de plateforme (iOS 56, Android 56) pour cinq cibles tactiles — insuffisant pour un usage confortable.
**Source :** `docs/DESIGN-SYSTEM-RESPONSIVE.md` §3.
**Statut :** actif.

### D-009 — Radius nommés par usage de composant, jamais par taille abstraite
**Pourquoi :** empêche qu'un composant utilise "le radius qui a l'air bien" au lieu du radius de sa famille — force la cohérence systémique plutôt que le jugement au cas par cas.
**Source :** structure de `--radius-*` dans `globals.css` (`input`, `nav`, `row`, `card`, `dropdown`, `panel`, `empty`, `auth`, `pill`).
**Statut :** actif.

### D-010 — Le mouvement est nommé par usage produit, jamais par effet visuel
**Pourquoi :** un mouvement doit communiquer un changement d'état réel (`task-enter`, `verification-pulse`, `signal-enter`), pas décorer — permet à l'utilisateur de reconnaître *quel type* de changement vient de se produire sans lire le texte.
**Source :** catalogue `@keyframes`/`--animate-*` dans `globals.css`.
**Statut :** actif.

### D-011 — Un seul canal de guidance actif à la fois (onboarding)
**Pourquoi :** éviter que le tour guidé, la checklist, un tip contextuel et le centre d'aide se chevauchent ou se contredisent à l'écran en même temps.
**Source :** `PRODUCT_UX_REWORK_REPORT.md` §3 ("One guidance surface at a time: tour or checklist/tip/help").
**Statut :** actif.

### D-012 — Activation définie strictement, distincte de "onboarding terminé"
**Pourquoi :** éviter de confondre "l'utilisateur a fini le tour" avec "l'utilisateur a obtenu de la valeur réelle" — deux métriques différentes pour des décisions produit différentes.
**Source :** `PRODUCT_UX_REWORK_REPORT.md` §8 ("`signup_completed` and `tour_completed` are **not** activation").
**Statut :** actif.

### D-013 — Toute mutation IA est confirmée puis vérifiée par relecture serveur
**Pourquoi :** le modèle propose, le serveur décide — élimine le risque qu'une action à impact réel soit exécutée sur la seule confiance du modèle, et garantit que l'UI n'annonce jamais un succès non confirmé par la base de données.
**Source :** `INTELLIGENCE_AGENT_REPORT.md` §6, `src/lib/intelligence/memory.ts` (règles dures documentées en en-tête).
**Statut :** actif, non négociable pour toute nouvelle capacité d'action IA.

### D-014 — Risque de mutation proportionnel au niveau de confirmation exigé
**Pourquoi :** create (réversible, faible impact) ne mérite pas la même friction qu'un delete (destructif) — sur-confirmer une action anodine crée de la friction inutile, sous-confirmer une action destructrice crée un risque réel.
**Source :** `INTELLIGENCE_AGENT_REPORT.md` §5 (tableau risque/confirmation/vérification par type d'action).
**Statut :** actif.

### D-015 — Une intégration du catalogue ne prétend jamais être connectée sans adaptateur serveur réel
**Pourquoi :** intégrité produit — ne jamais présenter une fonctionnalité comme active si elle ne l'est pas réellement, même à des fins de démonstration commerciale.
**Source :** commentaire source `src/lib/integrations/catalog.ts` ("This registry describes product direction, not fabricated connections").
**Statut :** actif, non négociable.

### D-016 — Logos de marque monochromes (`currentColor`), jamais en couleur officielle
**Pourquoi :** cohérence visuelle du hub d'intégrations avec l'identité globale quasi-noire de NEXUS — éviter que chaque carte d'intégration devienne une mini-publicité colorée pour la marque tierce.
**Source :** `src/components/integrations/integration-icon.tsx` (`fill="currentColor"`).
**Statut :** actif.

### D-017 — Mobile traité comme citoyen de première classe, hiérarchie d'écran dédiée
**Pourquoi :** décision produit explicite de ne pas traiter mobile comme un rétrécissement du desktop mais de lui donner sa propre logique d'écran (`MobileHome`) — contre-exemple assumé au défaut connu de Linear sur mobile.
**Source :** `PHASE6-FINAL-REPORT.md`, `MOBILE_UX_PHASE_REPORT.md`, `PHASE6-MOBILE-EXPERIENCE-REPORT.md`.
**Statut :** actif.

### D-018 — La rampe sombre canonicale est celle du noyau, pas une dérive chaude
**Pourquoi :** `globals.css` avait dérivé vers une rampe gris chaud (`#111110 / #171716 / #1c1c1a / #20201e`) avec des bordures gris plein, alors que le système documenté (ce fichier, `tailwind.config.js`, les tests d'accessibilité) décrit une rampe **noire** (`#000000 / #080808 / #0f0f0f / #151515 / #1c1c1c`) et des hairlines blanc-alpha 6/8/14/22 %. Le showcase peignait `#000000` en dur : trois langages de surface coexistaient. L'évolution restaure la rampe documentée et supprime tout hex de surface en dur du code produit.
**Source :** `docs/NEXUS-DESIGN-EVOLUTION-PLAN.md` §3 (D1, D2), `docs/DESIGN-EVOLUTION-REPORT.md`.
**Statut :** actif — `--color-bg-base: #000000` et `--color-accent: #ffffff` restent des contrats de test.

### D-019 — Une seule recette par primitive, et une couche monospace technique explicite
**Pourquoi :** 61 composants portaient leur propre animation d'entrée, 89 usages de `bg-bg-subtle` tenaient lieu de « carte », et la métadonnée technique était recodée à la main en `font-mono text-[10.5px]` à ~40 endroits. L'évolution fixe une recette canonique par problème (Button, Field/SearchField, Card/Panel, Badge/Tag, Row/DataList) et trois utilitaires monospace (`.mono-meta`, `.mono-token`, `.metric`).
**Source :** `docs/NEXUS-DESIGN-EVOLUTION-PLAN.md` §3 (D3, D4, D6), §4.2.
**Statut :** actif — toute nouvelle surface de liste doit passer par `Row`/`DataList`.

### D-020 — L'Admin hérite du système, il n'en invente pas un second
**Pourquoi :** le control plane portait une rampe propre (canvas clair puis sombre, `rounded-[7px]/[8px]/[10px]/[12px]`,
séparateurs `border-admin-border/60`, six hauteurs de contrôles, trois traitements de focus) et des tableaux
réimplémentés par page. L'évolution le ramène sur les fondations canoniques : rampe noire unique, radius 4/8/12/16,
une seule recette de focus, une seule implémentation de tableau (`AdminTableShell`/`AdminTableRow` +
`AdminCardList` sous `md`), et une couche monospace technique déjà définie.
**Source :** `docs/NEXUS-ADMIN-DESIGN-EVOLUTION-PLAN.md`, `docs/ADMIN-DESIGN-EVOLUTION-REPORT.md`.
**Statut :** actif — toute nouvelle surface admin passe par les primitives `src/components/admin/*` ; aucun
composant Admin-only ne remplace une primitive canonique.

### D-021 — L'interaction de survol des CTA est une capacité du Button canonique, pas un nouveau bouton
**Pourquoi :** une référence externe (KokonutUI *Slide Text Button*) proposait un bouton complet, avec son propre
style et son animation d'entrée. Seul le **principe d'interaction** a été retenu (libellé sortant par le haut,
libellé entrant par le bas, boîte clippée, 200ms ease-in-out) ; le style et l'animation d'entrée ont été rejetés.
L'interaction est implémentée une fois — un contrat CSS dans `globals.css` et un composant `SlideLabel` sans
couleur — puis exposée par trois variantes du `Button` canonique (`slide`, `slide-ghost`, `slide-intelligence`)
qui sont *exactement* les recettes existantes plus un marqueur de groupe nommé. Aucune animation d'entrée, aucun
déplacement du bouton.
**Source :** `docs/SLIDE-LABEL-IMPLEMENTATION.md`, `scripts/test-slide-text.mjs`.
**Statut :** actif — le périmètre est fermé par test (liste blanche d'adoption) : l'interaction ne doit pas se
répandre aux formulaires, aux tableaux, aux actions destructrices ni aux actions répétées. NEXUS Admin consomme
le même composant (action de navigation « Needs attention ») ; les autres contrôles Admin restent volontairement
statiques pour des raisons opérationnelles documentées.

---

## Décisions encore ouvertes (à trancher, pas à deviner)

- **Priorité d'implémentation réelle des intégrations** (quelle intégration connecter en premier) — voir `NEXUS-INTEGRATIONS.md`.
- **Architecture d'une UI de gestion des préférences mémorisées par l'IA** — voir `04-AI-DESIGN-SYSTEMS/memory-and-context.md`.
- **Statut d'archive explicite des bundles `design/NEXUS-FINAL-BRAND-BUNDLE/` et `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/`** — actuellement non signalé comme historique dans le repo lui-même.
- **Existence future de Notes, Files, Calendar comme fonctionnalités produit** — non confirmées dans le code actuel, à concevoir en cohérence avec les patterns déjà établis si elles sont demandées.
