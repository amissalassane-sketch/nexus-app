# Cycle intégrations — six fournisseurs, vingt points

Sources : `src/lib/integrations/{providers,connections,oauth-state,crypto,view}.ts`, routes `/api/integrations`, migration context platform et audit hardening. Code OAuth partagé, **zéro connexion réelle vérifiée**. Les contrats sont mock-testés, pas attestés par fournisseurs. C = code partagé, P = partiel, N = absent, B = test réel bloqué.

| # / point | Gmail | Calendar | GitHub | Notion | Slack | Linear |
|---|---|---|---|---|---|---|
| 1 Registry/config | C | C | C | C | C | C |
| 2 App OAuth réelle | B | B | B | B | B | B |
| 3 Credentials réels | B | B | B | B | B | B |
| 4 Scopes déclarés | lecture | lecture | repo large, read:user, notifications | read_content à configurer app | lecture channels/groups/users | read |
| 5 Consentement/granted scopes | C/B | C/B | C/B | C/B | C/B | C/B |
| 6 Origin/callback binding | C | C | C | C | C | C |
| 7 State signé, scoping, TTL | C | C | C | C | C | C |
| 8 PKCE | C/B | C/B | N | N | N | C/B |
| 9 Exchange/token error format | C/B | C/B | C/B | Basic+JSON/B | ok:false/B | C/B |
| 10 Chiffrement/AAD/token isolation | C/B | C/B | C/B | C/B | C/B | C/B |
| 11 Refresh automatique | N | N | N | N | N | N |
| 12 API read adapter | N | C/B | N | N | N | N |
| 13 Pagination/timeouts | N | C/B bornée | N | N | N | N |
| 14 Normalisation/provenance | contrat seul | P | contrat seul | contrat seul | contrat seul | contrat seul |
| 15 Dédup items | N | C/B provider event ID | N | N | N | N |
| 16 Sync CAS/counters/cursor | partagé non activé | P/B | partagé non activé | partagé non activé | partagé non activé | partagé non activé |
| 17 Fraîcheur sur succès réel | modèle | C/B | modèle | modèle | modèle | modèle |
| 18 Mutations externes + confirmation | N | N | N | N | N | N |
| 19 Disconnect local / revoke distant | C/N | C/N | C/N | C/N | C/N | C/N |
| 20 Tests réels / autonomie worker | B/N | B/N | B/N | B/N | B/N | B/N |

Google demandé : gmail.readonly et calendar.readonly séparément. Pas de gmail.send/modify/calendar.events dans scopes actuellement demandés. Les descriptions de capacités d'écriture sont marquées planned ; ne pas solliciter permissions d'envoi avant feature et confirmation. GitHub `repo` donne des permissions larges y compris écriture : revue alternative GitHub App nécessaire. Notion partage des pages/config de capabilities et consentement provider ne se réduisent pas à la chaîne de scope.

## États
Préserver les états de connexion existants (voir catalogue/view), et distinguer état OAuth / sync / données / test. Une ligne DB « connected » reste une observation applicative, non une preuve cryptographique d'intégrité tant que l'ACL d'écriture membre n'est pas durcie. Aucune simulation de « sync successful » n'a été créée pour l'audit.

## Retour de vacances
**Démontrable localement seulement sur données NEXUS :** snapshot → retard/blocage/priorités → références → proposition → confirmation → action NEXUS + relecture. **Non démontré :** Gmail + Calendar + GitHub + Notion + Slack + Linear → graphe commun avec permissions/fraîcheur → dédup sémantique intersources → citations de chaque assertion → propositions de réponses externes.

Implémentation restante : adapters read, incremental cursors/checkpoints, refresh/revoke, normalisation versionnée et permission snapshot, résolution identité cross-source, citations par segment, invalidation après révocation, budget retrieval, orchestration worker bornée et logs de rejet. Scénario staging : engagements contradictoires, doublons cross-source, source supprimée, token expiré, source vide, timezone DST et action modifiée après preview ; ne jamais affirmer qu'un mail a été envoyé tant que provider + read-back ne le prouvent.
