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

---

## Décisions encore ouvertes (à trancher, pas à deviner)

- **Priorité d'implémentation réelle des intégrations** (quelle intégration connecter en premier) — voir `NEXUS-INTEGRATIONS.md`.
- **Architecture d'une UI de gestion des préférences mémorisées par l'IA** — voir `04-AI-DESIGN-SYSTEMS/memory-and-context.md`.
- **Statut d'archive explicite des bundles `design/NEXUS-FINAL-BRAND-BUNDLE/` et `design/NEXUS-V3-IMPLEMENTATION-BUNDLE/`** — actuellement non signalé comme historique dans le repo lui-même.
- **Existence future de Notes, Files, Calendar comme fonctionnalités produit** — non confirmées dans le code actuel, à concevoir en cohérence avec les patterns déjà établis si elles sont demandées.
