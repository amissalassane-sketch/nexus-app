# Shopify Polaris — principes retenus pour NEXUS

Source : documentation publique Polaris (Shopify).

## Ce qui est transférable

- **Sections "When to use / when not to use" pour chaque pattern** : Polaris est reconnu pour cette qualité documentaire précise. C'est le modèle suivi dans `05-COMPONENT-PATTERNS/` de cette base : chaque pattern NEXUS doit préciser son contexte d'usage valide et ses contre-indications, pas seulement son apparence.
- **Contenu et ton comme partie du design system**, pas comme une couche ajoutée après le visuel — Polaris documente des règles d'écriture UI aussi précisément que des règles de composant. NEXUS a déjà cette sensibilité (`COPY_REWRITE_REPORT.md` documente une passe de copy complète sur tout le produit) — ce standard doit continuer à s'appliquer à tout nouveau texte d'interface.
- **Empty states, onboarding et feature flags comme patterns de premier ordre**, pas comme afterthought — exactement la catégorie de composants que documente `05-COMPONENT-PATTERNS/empty-loading-error-states.md` dans cette base.
- **Design pensé pour un contexte métier précis (commerce)**, pas générique — rappel que NEXUS doit documenter ses patterns pour *son* contexte (tâches, projets, intelligence), pas les emprunter tels quels d'un produit e-commerce.

## Ce qu'on NE prend PAS

- La palette et l'iconographie Shopify (vert Shopify, style d'icône spécifique au commerce : produits, commandes, expéditions) — sans rapport avec le domaine NEXUS.
- Les composants spécifiques au commerce (sélecteurs de variantes produit, cartes de commande) — non transférables tels quels.
