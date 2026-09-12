# BoardUI — principes retenus pour NEXUS

Source : dépôt open source `boardui` (composants livrés en source, pas en dépendance), analysé en lecture — code et documentation, jamais republiés tels quels.

BoardUI se décrit comme un design system pour "interfaces agentiques" : chat, indicateur de réflexion, journal d'agent, composeur, à côté des tables et cartes classiques d'un dashboard. C'est le système le plus proche du domaine de NEXUS (produit avec une couche IA au centre) parmi les huit ressources fournies — **NEXUS ne doit pas en copier les tokens, noms de composants ou la palette**, seulement les décisions structurelles.

## Ce qui est transférable

- **Tokens sémantiques obligatoires, jamais de couleur brute.** BoardUI interdit explicitement `text-gray-500`/`bg-white`/hex en dur dans un composant — chaque couleur passe par un token nommé par rôle (`text-primary`, `background-secondary-hover`, etc.), ce qui rend le dark mode automatique plutôt qu'une surcouche `dark:`. C'est exactement la Règle Couleur #1 déjà en place dans `NEXUS-DESIGN-RULES.md` ("toute couleur doit exister comme token dans `globals.css`") — ce point ne change rien à NEXUS, il **confirme par convergence externe** que la règle existante est la bonne discipline, pas une contrainte arbitraire.
- **Typographie composite, jamais empilée.** Plutôt que `text-sm font-medium leading-5` recomposé à chaque usage, BoardUI impose des utilitaires composites (`text-title-2-medium`, `text-body-regular`) qui fixent taille/poids/interligne/tracking ensemble. À vérifier dans NEXUS : si des classes Tailwind de typographie sont recomposées à la main à plusieurs endroits au lieu de réutiliser les tokens `text-h2`/`text-body`/`text-caption` déjà définis dans `globals.css`, c'est une dérive à corriger au fil de l'eau, pas un chantier dédié.
- **"Composants d'abord" comme règle d'agent, pas seulement de développeur humain.** BoardUI écrit noir sur blanc dans son `AGENTS.md` : avant de construire à la main un élément, vérifier s'il existe déjà sous `components/`, et l'installer plutôt que d'écrire un sosie. NEXUS a le même risque (149 composants dans `src/components/ui`) sans reformulation aussi explicite dans son propre `AGENTS.md` — voir `04-AI-DESIGN-SYSTEMS/machine-legible-design-systems.md` pour la recommandation concrète.
- **Focus visible non négociable et documenté comme token, pas comme détail.** `focus-visible:ring-2 ring-border-focus-ring` est cité explicitement dans les règles d'agent de BoardUI — cohérent avec le choix déjà fait par NEXUS de documenter la mesure de contraste de son propre anneau de focus dans `globals.css`.

## Ce qu'on NE prend PAS

- Les noms de tokens exacts de BoardUI (`background-primary-default`, `chart-1`…`chart-5`) — vocabulaire propriétaire à son système, pas à réutiliser tel quel.
- Son moteur de composants (`react-aria-components` + `@remixicon/react`) — NEXUS a déjà fait le choix `lucide-react` + primitives maison ; changer de fondation n'est pas justifié par cette seule référence.
- Le vocabulaire produit ("agent log", "composer") — à ne pas importer dans le vocabulaire NEXUS (Projects/Tasks/Goals/Intelligence) sans décision produit explicite.
