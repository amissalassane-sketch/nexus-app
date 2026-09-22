# Conservation et purge

**Politique technique proposée, validation légale et opérateur requise avant déploiement.** Aucun SLA global de suppression, aucune durée de sauvegarde vérifiée.

| Catégorie | Règle de ce patch | Exécution réelle | Reste à décider |
|---|---|---|---|
| intelligence_memory | 90 jours depuis updated_at ; nouvelles requêtes ignorent une mémoire périmée | Lecture applicative + RPC batch 1000, test SQL local | Installer migration, planifier quotidiennement, alerter en cas de retard |
| OAuth state cookie | 10 min, liaison session/workspace/provider/redirect ; consommation callback | Code audit précédent | Vérifier navigateur HTTPS et callback réel |
| Mémoire IA navigateur | Pas de nouvelle persistance localStorage ; suppression ancienne clé à l'ouverture | Code client | Anciens appareils non revisités gardent l'ancienne clé jusqu'à effacement |
| Préférences / onboarding / récents | Conservés jusqu'à suppression locale ou utilisateur parent | Aucun TTL global | Définir durée et purge, purger récents au logout si nécessaire |
| Documents et objets dérivés | Pas de TTL/pipeline global | Suppression UI, rollback d'upload si métadonnées refusées | Política workspace, legal holds, objets orphelins, export et preuves de suppression |
| Activités, signaux, missions, logs IA, sync | **Pas de nouvelle purge** | Durées non uniformes | Limites par finalité et jobs à implémenter |
| Finances/factures | Ledger non implémenté | Rien à purger via ce patch | Obligations comptables/fiscales et opposition à suppression à valider |
| Backups / copies fournisseurs | Inconnue | Non vérifiée | Contrat, régions, cycles, restauration et retraitement des demandes d'effacement |

## Job réellement fourni
`supabase/migrations/20260922220000_global_preferences_retention.sql` ajoute `purge_inactive_intelligence_memory()`. SECURITY DEFINER, search_path fixe, exécution refusée PUBLIC/anon/authenticated, autorisée service_role. Verrou `FOR UPDATE SKIP LOCKED`, batch maximal 1000, `updated_at < now() - interval '90 days'`.

`scripts/purge-inactive-memory.mjs` est un lanceur opérateur : sans `--execute`, il ne supprime rien. Avec configuration secrète `SUPABASE_URL` (ou NEXT_PUBLIC_SUPABASE_URL) et `SUPABASE_SERVICE_ROLE_KEY`, appelle la RPC par HTTPS, timeout 30 s, journalise uniquement nombre/état. **Pas exécuté contre une base réelle ; pas de cron installé.** Pas de purge de l'historique ai_memories, Storage, provider ou backups.

Runbook : staging d'abord ; seed de deux mémoires synthétiques (>90 j et récente) ; exécuter job ; vérifier disparition ancienne/conservation récente ; alerter si job absent >24 h ou batch plein plusieurs jours ; conserver preuve sans contenu personnel. Invoquer plusieurs lots sous supervision si arriéré. Une suppression mémoire pendant une requête IA en vol peut être suivie d'une réécriture : désactivation/version d'effacement atomique reste à implémenter.
