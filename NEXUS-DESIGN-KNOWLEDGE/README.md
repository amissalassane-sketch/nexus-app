# NEXUS-DESIGN-KNOWLEDGE — index

Base de connaissances design pour NEXUS. Objectif : aider à prendre de meilleures décisions UX/UI, produit, interaction, responsive, accessibilité, architecture visuelle et direction artistique — jamais transformer NEXUS en clone d'un autre produit.

## Comment utiliser cette base (à chaque tâche de design/UI sur NEXUS)

1. Lire `ANALYSIS-REPORT.md` si le contexte général du projet n'est pas encore assimilé.
2. Consulter `06-NEXUS-CONTEXT/NEXUS-DESIGN-SYSTEM.md` comme point d'entrée vers les tokens, règles, composants, principes UX, intégrations, marque et décisions.
3. Vérifier `06-NEXUS-CONTEXT/NEXUS-COMPONENTS.md` et `05-COMPONENT-PATTERNS/` avant de créer un nouveau composant.
4. Consulter `07-DESIGN-INTELLIGENCE/design-review-checklist.md` avant de livrer toute modification visible utilisateur.
5. Pour une inspiration externe, passer par `03-UX-REFERENCES/` et `01-CORE-PRINCIPLES/` — jamais copier une identité de marque, toujours extraire un principe (méthode détaillée dans `07-DESIGN-INTELLIGENCE/competitive-analysis-framework.md`).
6. Toute décision de design significative nouvellement prise doit être ajoutée à `06-NEXUS-CONTEXT/NEXUS-DESIGN-DECISIONS.md`.

## Structure

```
01-CORE-PRINCIPLES/       Principes génériques transférables (UNICEF, Laws of UX)
02-DESIGN-SYSTEMS/        Méthodologie des tokens NEXUS, motion, iconographie
03-UX-REFERENCES/         Analyses de systèmes externes (principes only, jamais l'identité)
04-AI-DESIGN-SYSTEMS/     Principes d'interaction IA, mémoire et contexte
05-COMPONENT-PATTERNS/    Patterns de composants réutilisables documentés
06-NEXUS-CONTEXT/         Source de vérité NEXUS (tokens, règles, composants, UX, marque, intégrations, décisions)
07-DESIGN-INTELLIGENCE/   Checklists et frameworks exploitables par l'agent
ANALYSIS-REPORT.md        Rapport d'analyse initial du repository (lecture seule, avant modification)
```

## Statut de preuve utilisé dans tous les fichiers

- `[CONFIRMED]` — vérifié directement dans le code du repository.
- `[INFERRED]` — déduit d'un pattern observé, cohérent mais non littéralement écrit dans le code.
- `[NEEDS DECISION]` — absent du code, nécessite une décision produit/design explicite ; ne jamais inventer une réponse à sa place.

## Règle fondamentale (rappel)

NEXUS peut s'inspirer de systèmes existants pour en extraire des principes, patterns, structures et bonnes pratiques — jamais reproduire leur branding, identité visuelle, composants propriétaires ou textes. Le résultat final reste toujours propre à NEXUS.
