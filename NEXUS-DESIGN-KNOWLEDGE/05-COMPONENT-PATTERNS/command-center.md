# Pattern — Command Center (⌘K) [CONFIRMED, src/components/command-menu.tsx]

## Quand l'utiliser
Le Command Menu est le point d'entrée clavier vers **tout** le produit : navigation, création, recherche d'entité (projet/tâche/goal). Ne pas créer de deuxième palette de commande parallèle pour un sous-domaine (ex. une palette dédiée juste aux tâches) — étendre `ALL_NAV_ENTRIES` / la logique existante plutôt que dupliquer le pattern.

## Contrat déjà en place
- **Ouverture** : `⌘K`/`Ctrl+K`, la touche `/`, un bouton sidebar/topbar, ou l'événement custom `nexus:open-command` (permet à n'importe quel composant de déclencher la palette sans lui donner de dépendance directe).
- **Catégories fixes** : Recent → Actions → Pages → Projects → Tasks → Goals. Cet ordre place l'historique récent et les actions de création **avant** la navigation pure — hypothèse produit : l'utilisateur ouvre la palette plus souvent pour *faire* quelque chose que pour *aller* quelque part.
- **Scoring de correspondance** : préfixe > début de mot > sous-chaîne, tokens multiples tous requis. Ne jamais revenir à un simple `.includes()` naïf si un nouveau champ de recherche est ajouté ailleurs dans le produit — ce scoring est le standard de recherche NEXUS.
- **Résultats scoping data réelle** : les entités (projets, tâches, goals) sont lues depuis Supabase sous RLS — **jamais de résultat fabriqué ou de placeholder**. Toute extension de la palette (ex. rechercher aussi dans les intégrations ou les notifications) doit suivre la même règle : uniquement des données réelles de l'utilisateur.
- **Clavier** : `↑ ↓ Home End` déplacent la sélection, `Enter` exécute, `Escape` ferme. Contrat à préserver pour toute liste similaire (dropdown, résultats de recherche).
- **Style visuel** : surface calme, tuiles d'icône, mise en évidence du texte correspondant, en-têtes de groupe collants, pied de page avec statut. Monochrome — la seule touche de couleur est la ligne active.

## Anti-patterns à éviter
- Ajouter une action à la palette qui n'existe pas ailleurs dans le produit (la palette est un raccourci vers des fonctionnalités réelles, jamais une fonctionnalité exclusive cachée).
- Casser le tri des catégories pour mettre en avant une nouveauté ponctuelle — la stabilité de l'ordre est ce qui rend la palette apprenable par cœur (cf. `01-CORE-PRINCIPLES/laws-of-ux.md`, loi de Jakob).
- Afficher un résultat sans lien de navigation clair (`href`) — chaque entrée doit mener quelque part de déterministe.

## Extension recommandée `[NEEDS DECISION]`
Le rapport `PRODUCT_UX_REWORK_REPORT.md` et l'analyse Linear (`03-UX-REFERENCES/linear.md`) suggèrent d'augmenter la **découvrabilité** des raccourcis clavier associés à chaque action (les afficher en regard, pas seulement dans une aide séparée). Aucune décision de layout n'a encore été prise sur ce point — à trancher avant implémentation, pas à deviner.
