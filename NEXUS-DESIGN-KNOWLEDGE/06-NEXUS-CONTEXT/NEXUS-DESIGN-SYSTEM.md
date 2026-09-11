# NEXUS DESIGN SYSTEM — vue d'ensemble

Ce fichier est la porte d'entrée : il résume l'identité du design system NEXUS et pointe vers les documents détaillés. Pour les valeurs exactes, voir `NEXUS-TOKENS.md` ; pour les règles de comportement, `NEXUS-DESIGN-RULES.md` ; pour les composants, `NEXUS-COMPONENTS.md`.

## Identité `[CONFIRMED]`

Nom interne du système, tel que déclaré dans le code source (`src/app/globals.css`, `tailwind.config.js`) : **"NEXUS V3 — Pill Atelier Noir"**.

NEXUS est un **Personal Operating System** de productivité : un espace de travail unique pour projets, tâches, objectifs, activité, notifications et intégrations, avec une couche d'intelligence qui lit ce travail et propose des actions. L'identité visuelle doit servir cette promesse — un outil de travail sérieux avec une couche d'intelligence discrète, pas un produit ludique ni un dashboard générique.

## Les quatre piliers visuels `[CONFIRMED, déduits du code + des rapports de chantier]`

1. **Presque-noir, jamais gris-dashboard.** Toute la rampe de surface part de `#000000` et progresse par paliers très resserrés (`#080808`, `#0f0f0f`, `#151515`, `#1c1c1c`). Aucune surface n'est un gris moyen générique façon "admin panel".
2. **Bordures découvertes, pas annoncées.** Les séparations viennent de liserés blancs à très faible opacité (6% à 22% selon l'importance), jamais de bordures grises pleines et dures.
3. **L'intelligence a une couleur, et une seule : le violet/lavande, en dose contrôlée.** Ce n'est ni une couleur de marque généralisée, ni un simple bouton "AI" — c'est un signal réservé (focus, badges liés à l'IA, halo de sévérité de signal). Voir `NEXUS-BRAND.md` pour la justification complète et `NEXUS-DESIGN-DECISIONS.md` pour l'historique de cette contrainte.
4. **Le mouvement raconte un état, il ne décore pas.** Chaque animation a un nom d'usage (`task-enter`, `verification-pulse`, `signal-enter`) plutôt qu'un nom d'effet — voir `02-DESIGN-SYSTEMS/motion-language.md`.

## Où vit chaque type de connaissance

| Besoin | Document |
|---|---|
| Valeurs exactes de couleur/typo/spacing/radius/ombre | `NEXUS-TOKENS.md` |
| Règles de comportement (densité, hiérarchie, accessibilité, cohérence) | `NEXUS-DESIGN-RULES.md` |
| Inventaire des composants et conventions | `NEXUS-COMPONENTS.md` |
| Principes UX produit (feedback, erreurs, onboarding, recherche...) | `NEXUS-UX-PRINCIPLES.md` |
| Architecture des intégrations et icônes de marque | `NEXUS-INTEGRATIONS.md` |
| Identité de marque, ce qui est protégé vs négociable | `NEXUS-BRAND.md` |
| Historique des décisions et leur justification | `NEXUS-DESIGN-DECISIONS.md` |
| Checklists de revue exploitables par l'agent | `../07-DESIGN-INTELLIGENCE/*.md` |
| Principes génériques (lois UX, systèmes externes) | `../01-CORE-PRINCIPLES/`, `../03-UX-REFERENCES/` |
| Patterns de composants réutilisables documentés | `../05-COMPONENT-PATTERNS/` |
| Patterns spécifiques à l'IA | `../04-AI-DESIGN-SYSTEMS/`, `../07-DESIGN-INTELLIGENCE/ai-product-patterns.md` |

## Portée de ce design system `[CONFIRMED]`

S'applique à :
- Le shell applicatif authentifié (`(app)/*`) : dashboard, projects, tasks, goals, intelligence, integrations, activity, notifications, settings, billing, upgrade.
- Les pages publiques (landing, pricing, how-it-works, intelligence marketing, pages légales).
- Les flux d'authentification (login, signup, onboarding, reset password).

Ne couvre pas (hors périmètre de cette base) :
- L'infrastructure serveur, le schéma de base de données, les migrations SQL — documentés ailleurs (`supabase/`).
- La logique métier pure sans surface UI (ex. calcul de limites de plan) — seule son **expression visuelle** relève de ce design system.

## Statut de gouvernance

Toute proposition de changement visible utilisateur touchant à un token, un pattern ou un principe documenté ici doit :
1. Être vérifiée contre ce document et les fichiers liés avant implémentation.
2. Être ajoutée à `NEXUS-DESIGN-DECISIONS.md` si elle modifie une décision déjà prise.
3. Ne jamais remplacer silencieusement une convention existante par préférence esthétique ponctuelle.
