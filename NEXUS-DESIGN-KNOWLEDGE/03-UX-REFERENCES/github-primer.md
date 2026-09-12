# GitHub Primer — principes retenus pour NEXUS

Source : [primer.style](https://primer.style) (accessibilité, contribution, tokens).

## Ce qui est transférable

- **L'accessibilité comme produit d'ingénierie, pas comme couche cosmétique** : Primer intègre axe-core, la gestion de focus et les patterns ARIA directement dans ses primitives, pas en audit après coup. NEXUS doit suivre la même discipline : chaque nouveau composant `ui/` doit naître avec ses états focus/clavier/aria, pas les recevoir plus tard.
- **Jamais de placeholder comme seul label** : Primer interdit d'utiliser le texte de substitution d'un champ comme unique porteur d'information (le placeholder disparaît dès la saisie et n'est pas fiable pour les lecteurs d'écran). À vérifier systématiquement dans `src/components/ui/input.tsx` et tout formulaire NEXUS (auth, création de tâche/projet, settings).
- **Contraste : 4.5:1 texte normal, 3:1 grand texte et composants graphiques (bordures de champ, icônes fonctionnelles)**. NEXUS applique déjà ce seuil et le documente avec des mesures réelles dans `globals.css`.
- **Note utile de Primer** : les contrôles désactivés n'ont pas besoin de respecter le contraste minimal — mais (cf. UNICEF) ils doivent alors expliquer pourquoi ils sont désactivés, sans quoi l'utilisateur ne sait pas s'il s'agit d'un bug.
- **Focus toujours visible, jamais supprimé** (`outline: none` sans remplacement est interdit). NEXUS utilise déjà un `focus-visible` documenté (`globals.css` ligne 703) avec un ring `lavender-border` — cohérent avec la fonction de l'accent intelligence appliqué à un signal de clavier, pas de décoration.
- **Navigation clavier différenciée** : Tab pour se déplacer entre contrôles indépendants, flèches pour naviguer *à l'intérieur* d'un contrôle composite (liste, groupe de radio, menu). Le Command Menu de NEXUS applique déjà cette distinction (`↑ ↓ Home End` à l'intérieur de la liste, `Tab` hors du composant).
- **Documentation orientée décision** : chaque pattern documente pourquoi il existe et dans quel contexte l'utiliser — c'est le modèle suivi par `07-DESIGN-INTELLIGENCE/` de cette base de connaissances.

## Ce qu'on NE prend PAS

- Les Octicons (bibliothèque d'icônes propriétaire GitHub) — NEXUS utilise `lucide-react`.
- Les tokens de couleur GitHub (vert de succès spécifique, bleu de lien GitHub) — NEXUS a sa propre rampe sémantique désaturée.
- Le vocabulaire visuel "carte de dépôt" / "pull request" — spécifique au domaine GitHub, sans rapport avec le domaine NEXUS (tâches, projets, signaux).
