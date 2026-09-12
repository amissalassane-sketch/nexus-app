# Design systems lisibles par machine — ce que NEXUS n'a pas encore

Source : synthèse de quatre dépôts open source (`arkite-ui`, `boardui`, `democrito`, `uikit`/Bloomneo) et du rapport `state-of-ai-in-design-systems` (étude de terrain sur 21 design systems open source, juillet 2026). Principes extraits, aucun contenu republié tel quel.

## Le constat qui traverse les quatre systèmes

Indépendamment les uns des autres, quatre des six design systems fournis ont convergé vers la même solution à un même problème : **un agent de code qui ne lit que le code source finit par deviner des composants au lieu d'utiliser les bons.** Leur réponse commune :

- Un fichier `AGENTS.md` (ou équivalent) avec des règles "toujours faire / jamais faire", explicitement écrit pour un agent, pas pour un humain qui parcourt une doc.
- Un `llms.txt` (convention [llms.txt](https://llmstxt.org/)) qui indexe chaque export, chaque exemple, chaque pattern composé — régénéré automatiquement à chaque build pour ne jamais dériver du code réel.
- Pour democrito et arkite-ui spécifiquement : un manifeste structuré (`registry.json`) qui liste chaque composant/page avec quand l'utiliser et quand ne pas l'utiliser.

Le rapport `state-of-ai-in-design-systems` confirme que ce n'est pas une coïncidence entre quatre projets isolés mais une tendance mesurée sur 21 systèmes actifs : la majorité expose déjà au moins une affordance pour qu'un agent construise avec le système plutôt qu'à côté de lui.

## Où se situe NEXUS aujourd'hui

**[CONFIRMED]** NEXUS a déjà un `AGENTS.md` à la racine, et `CLAUDE.md` s'y réfère directement (`@AGENTS.md`) — la moitié de la convention est déjà là.

**[CONFIRMED]** NEXUS n'a ni `llms.txt`, ni manifeste structuré de ses 149 composants. `NEXUS-COMPONENTS.md` (dans cette base de connaissances) joue ce rôle mais **en langage humain narratif**, pas comme un index régénéré automatiquement à chaque build — il peut donc dériver du code réel au fil des changements, exactement le problème que les quatre systèmes ci-dessus ont cherché à éliminer par régénération automatique.

## Recommandation concrète, par ordre de coût croissant

1. **[NEEDS DECISION — faible coût]** Ajouter à `AGENTS.md` une section "composants d'abord" explicite dans le style de BoardUI : avant de créer un nouvel élément d'UI, vérifier son existence dans `src/components/ui/` et `NEXUS-COMPONENTS.md`, ne jamais dupliquer. NEXUS a déjà cette règle dans `NEXUS-DESIGN-RULES.md` #16 — la nouveauté serait de la dupliquer dans `AGENTS.md`, à l'endroit qu'un agent de code lit en premier, pas seulement dans la base de connaissances design.
2. **[NEEDS DECISION — coût moyen]** Générer un `llms.txt` minimal à la racine du repo : une liste plate des exports de `src/components/ui/*.tsx` (nom, props principales, une ligne d'usage), régénérée par un script plutôt qu'écrite à la main, pour qu'elle ne puisse pas dériver silencieusement.
3. **[NEEDS DECISION — coût plus élevé, dépend du point 2]** Un manifeste JSON structuré à la arkite-ui/democrito (composant → quand l'utiliser → quand ne pas l'utiliser) — seulement si le point 2 montre l'usage réel par les sessions d'agent qui suivent ; ne pas construire cette couche avant d'avoir mesuré le besoin.

Aucun de ces trois points n'a été implémenté dans cette session : le point 1 touche `AGENTS.md` (fichier de gouvernance du projet, à valider par un humain avant modification) et les points 2-3 nécessitent un script exécuté dans l'environnement réel du projet (accès à tous les fichiers sources, capacité de build) que cette session n'a pas.
