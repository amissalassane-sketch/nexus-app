# Atlassian Design System — principes retenus pour NEXUS

Source : documentation publique Atlassian Design System.

## Ce qui est transférable

- **Tokens nommés par rôle sémantique, pas par valeur** (`color.text.brand` plutôt que `blue-700`). NEXUS applique déjà ce principe dans `globals.css` (`--color-text-primary`, `--color-border-subtle`, `--color-success` plutôt que des noms de teinte bruts) — **règle à ne jamais régresser** : tout nouveau token doit être nommé par fonction, jamais par sa valeur RVB.
- **Patterns d'entreprise éprouvés à grande échelle** : empty states, onboarding, feature flags documentés comme des patterns de produit à part entière, applicables à travers plusieurs surfaces d'un même produit (Jira, Confluence, Trello). Le même besoin existe pour NEXUS : un pattern d'empty state doit se comporter de façon identique sur Dashboard, Projects, Tasks, Goals, Intelligence.
- **Unification d'un portefeuille de produits sous un langage commun** sans effacer les besoins spécifiques de chaque produit — pertinent si NEXUS étend son offre (mobile natif, extension navigateur, intégration Slack) : le design system doit rester la même source, décliné, jamais dupliqué avec des variantes divergentes.

## Ce qu'on NE prend PAS

- L'identité visuelle Atlassian (bleu Atlassian, mascotte, ton "collaboratif" très illustré) — étrangère à la direction "premium, minimaliste, technologique" de NEXUS.
- La densité d'options de configuration typique de Jira — NEXUS vise une simplicité plus proche de Linear.
