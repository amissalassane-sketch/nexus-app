# Cartographie des données — constat de code

**IMPLEMENTED ≠ déployé. LEGAL_REVIEW_REQUIRED.** Propriétaire opérateur à nommer pour chaque ligne. Régions effectives inconnues.

| Données / lieu | Finalité / accès | Destination / état | Suppression / export constatés |
|---|---|---|---|
| Supabase Auth, profiles | Identité, connexion, profil ; utilisateur/admin autorisé | Supabase, région à vérifier | Profil modifiable ; suppression globale non implémentée |
| workspaces, workspace_members | Organisation/permissions ; membres actifs RLS | PostgreSQL | Cascades existent, orchestration complète non prouvée |
| tasks/projects/goals/notes/events/reminders | Collaboration ; workspace RLS et contrôles applicatifs | PostgreSQL, sous-ensemble en contexte IA | CRUD selon rôle ; pas d'export global |
| files + bucket nexus-files | Fichiers privés, chemin workspace, upload ; métadonnées+Storage | Supabase Storage | Suppression objets/métadonnées dans UI ; aucune garantie purge backups |
| intelligence_memory | Question récente, références, préférences explicites ; user + workspace | PostgreSQL ; contexte pour fournisseur IA si configuré | Export/suppression limités ; exclusion lecture après 90 j d'inactivité ; purge bornée non planifiée |
| ai_memories historique / autres tables IA | Mémoire vectorielle historique, signaux/missions/requêtes | PostgreSQL ; usages variables selon module | Ne sont PAS couverts par la purge intelligence_memory |
| intelligence_request_log, activities, audit/admin | Diagnostic, traçabilité | PostgreSQL / logs de déploiement | Durées/jobs incomplets ; éviter prompts/token/secrets dans traces |
| integration_connections / credentials | États, scopes, tokens OAuth chiffrés AAD | PostgreSQL ; fournisseur lors d'échange/sync | Suppression locale ; révocation distante manquante ; ACL membres à durcir |
| integration_items, sync_runs | Normalisation, provenance, fraîcheur, sync | PostgreSQL ; seul Calendar lecture a un adapter | Contexte transversal incomplet ; retention non implémentée |
| workspace_subscriptions | Plan/état backend | PostgreSQL | Écriture privilégiée existante ; ledger provider absent |
| Paiements Stripe | Transport serveur uniquement | Aucune route active d'encaissement | Aucun paiement ou événement réel constaté |
| user_regional_preferences | Formatage de présentation, non pays légal du workspace | PostgreSQL, RLS user | API GET/PUT ; suppression SQL own possible, pas de bouton dédié |
| LocalStorage / SessionStorage | Apparence, onboarding, recent IDs, animation | Navigateur | Effacement navigateur ; cache mémoire global retiré à l'ouverture Intelligence |

## Flux IA observé
Session → membre actif → snapshots DB workspace → contexte compact + question/historique/préférences → OpenAI **ou** Anthropic si configuré → validation de structure/outils → proposition → confirmation → exécution serveur scoped + relecture. NEXUS Engine en fallback. Le prompt peut avoir été transmis avant un timeout. Les références de sources dérivent des données chargées, mais ne garantissent pas la vérité de chaque phrase générée.

## Frontières à fermer
1. Tables de credentials/statuts/logs encore inscriptibles par membres : source d'audit pas suffisamment autoritaire.
2. Historique envoyé par le navigateur, contenu notes/documents/messages : non fiable comme instruction ; tests d'injection supplémentaires requis.
3. Pas de pipeline extraction/chunk/index ; ne jamais envoyer un fichier entier par défaut pour combler ce manque.
4. Pays légal workspace : modèle TypeScript séparé seulement, stockage/édition administrative **non livrés**. Les préférences utilisateur ne changent jamais ce champ.
5. Vérifier export multi-workspace : autorisation sur chaque ressource et masquage des données de tiers ; l'export mémoire livré ne couvre pas ce besoin.
