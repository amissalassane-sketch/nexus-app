# NEXUS — audit technique, vérifications et blocages

**Date : 22 septembre 2026 · dépôt : `amissalassane-sketch/nexus-app`**
**Branche : `arena/01a0cab9-nexus-app` · base : `b1717d5`**
Aucun merge, push, paiement, consentement OAuth, mutation de production ou credential fournisseur réel créé pendant cet audit.

## 1. Verdict

**Non : le périmètre complet demandé n'est pas aujourd'hui une infrastructure fonctionnelle vérifiée de bout en bout.** Le dépôt possède un socle NEXUS conséquent, des protections d'accès, un moteur Intelligence déterministe, deux clients LLM, une plateforme de stockage OAuth et un adapter Calendar de lecture. Mais neuf providers n'ont aucun adapter de données ; même Calendar n'est pas alimenté dans Intelligence. Le pipeline documentaire, les paiements/webhooks exécutables et Light/System manquent.

**Aucune connexion applicative externe réelle n'a été vérifiée pendant cette session.** Cela ne prouve pas qu'aucun compte n'existe dans une production inaccessible. Cela signifie que nous n'avons ni lu ses tables, ni exécuté une synchronisation réelle, ni obtenu une réponse provider authentifiée.

- **Vérifié localement** : compilation/build, suite `npm test`, contrats OAuth avec transports injectés, chiffrement/authentification du contexte, politiques SQL dans PGlite, logique Calendar sur fixtures, refus HTTP lorsque la configuration manque, quelques surfaces publiques dans Chromium.
- **Seulement implémenté** : appels OpenAI/Anthropic, stockage fichiers et comptes OAuth, données Calendar via REST, contrats de plans/subscriptions et interface de paiement.
- **Configuré mais non connecté** : aucun service applicatif observable dans ce sandbox. Les variables de production sont **inconnues**, pas déclarées absentes.
- **Connecté et vérifié** : aucun provider NEXUS. L'accès GitHub utilisé par l'agent pour lire le dépôt et les métadonnées de déploiement n'est **pas** la connexion GitHub de l'application.
- **PRODUCTION READY** : **non démontré**, et blocages de code/sécurité connus ci-dessous. Des credentials seuls ne suffiront pas.

### Sens précis des états

`IMPLEMENTED` = chemin de code présent. `CONFIGURED` = paramètres requis présents dans un environnement donné, sans preuve de validité. `READY` = prérequis d'une opération identifiée satisfaits, pas une preuve de succès. `CONNECTED` = échange OAuth réellement terminé et credentials stockés pour un compte. `SYNCING` = opération en cours. `VERIFIED` = résultat observé d'un test identifié, daté, dans un environnement identifié. `PRODUCTION READY` exige en plus sécurité, exploitation, conformité validée et tests de déploiement. Un contrat mocké valide une branche logicielle, **pas** le provider réel.

## 2. Preuves et limites de l'audit

- [Matrice initiale avant corrections](AUDIT_INITIAL_2026-09-22.md).
- [Inventaire routes, bibliothèques, tests et chaque migration](audit-2026-09-22/inventory.md).
- [Résultats locaux et échecs des suites supplémentaires](audit-2026-09-22/test-results.md).
- [Résultats Chromium + axe, 8 combinaisons page/viewport](audit-2026-09-22/accessibility-public-pages.json).

Inventaire de 635 fichiers suivis au départ, 39 migrations initiales, puis une migration additive. La revue est ciblée sur les chemins demandés et leurs frontières. **Ce n'est pas une certification de chaque ligne ni un pentest exhaustif.** Les anciens rapports présents dans le dépôt ne sont pas utilisés comme preuves de connexions ou de déploiement des migrations.

Les seuls noms de variables inspectés dans le processus montrent l'absence de configuration applicative Supabase/LLM/OAuth/chiffrement. Aucune valeur de secret n'est reproduite dans ce rapport. `.env.example` décrit une configuration attendue ; les placeholders ne sont pas des credentials.

## 3. Matrice finale demandée

**« Non vérifiée » n'est ni « connectée » ni « inexistante en production ».** « Absents ici » décrit seulement le sandbox. Les codes B/H renvoient à des explications précises plus bas.

| Fonctionnalité | Code | Config | Credentials | Connectée réellement | Testée | Fonctionnelle | Blocage |
|---|---|---|---|---|---|---|---|
| OpenAI | Client REST + fallback | Non ici ; prod inconnue | Absents ici | Non vérifiée | Mocks agent/fallback ; pas live | Fallback local validé ; OpenAI live non vérifié | H1/H2 ; B-AI |
| Gmail | OAuth commun ; adapter absent | Non ici | Absents ici | Non vérifiée | Contrats OAuth mockés, pas données live | Non pour messages/threads/actions | H1/H3 ; B-ADAPTER |
| Google Calendar | OAuth + adapter lecture | Non ici | Absents ici | Non vérifiée | REST mocké, pagination, erreurs, SQL | Lecture locale simulée validée ; E2E réel non vérifié | H1/H3 ; B-SYNC/B-CONTEXT |
| GitHub | OAuth commun ; adapter absent | Non ici | Absents ici ; token du sandbox exclu | Non vérifiée | Contrats mockés | Non pour repos/issues/PR/actions | H1/H4 ; B-ADAPTER |
| Notion | OAuth corrigé ; adapter absent | Non ici | Absents ici | Non vérifiée | Échange Basic/JSON mocké | Non pour pages/blocks/search/actions | H1/H5 ; B-ADAPTER |
| Slack | OAuth bot corrigé ; adapter absent | Non ici | Absents ici | Non vérifiée | OAuth v2 mocké ; erreurs HTTP 200 | Non pour channels/messages/actions | H1/H6 ; B-ADAPTER |
| Linear | OAuth/scopes/PKCE corrigés ; adapter absent | Non ici | Absents ici | Non vérifiée | Contrats mockés | Non pour issues/projects/actions | H1/H7 ; B-ADAPTER |
| Documents | Stockage/métadonnées ; pipeline absent | Non ici | Supabase absent ici | Stockage réel non vérifié | Structure/SQL ; pas upload réel | Non pour analyse documentaire | H1 ; B-DOC |
| Billing | Plans/SQL + interface provider | Pas d'adapter installé | Aucun credential paiement utilisé | Aucun paiement vérifié | Unitaires/SQL ; refus HTTP | Plans locaux testés ; paiement non fonctionnel | B-BILLING puis H8 |
| Webhooks | Enum automation/interface billing seulement | Non | Aucun secret webhook configuré ici | Non : aucune route implémentée | Contrat d'interface, pas signature réelle | Non | B-WEBHOOK puis H8 |
| Dark mode | Tokens et interface sombre | Oui dans le code | Sans objet | Sans objet | Structure + 8 checks browser publics | Oui sur les surfaces locales observées ; non exhaustif | H10 pour revue complète |
| Light mode | Non | Non | Sans objet | Sans objet | Absence constatée | Non | B-THEME : implémentation manquante |
| Accessibility | Protections partielles + corrections | Partielle | Sans objet | Sans objet | axe public/desktop/mobile, structure ; pas screen reader | Partielle ; WCAG AA non certifiée | B-A11Y/H10 |

### Explication de chaque « Non » / blocage de code

- **B-ADAPTER** : aucune fonction d'accès/normalisation de données fournisseur pour Gmail, GitHub, Notion, Slack, Linear, Drive, Outlook, Teams ou Jira. La route de sync retourne 501 pour ces providers après recherche d'une connexion. Cela ne se résout pas avec un secret.
- **B-SYNC** : refresh token stocké mais jamais consommé automatiquement ; pas de scheduler de sync, curseur incrémental durable, retry/backoff exécuté, verrou distribué avec expiration ni reprise automatique d'un run bloqué. Reconnect requis après expiration. Calendar traite au maximum dix pages de 50 entrées, avec timeout global ; au-delà, refuse de déclarer une sync complète.
- **B-CONTEXT** : `/api/intelligence/query` ne charge pas les intégrations ni les fichiers. Les types du graphe de contexte ne constituent pas un branchement effectif. Pas de récupération/déduplication réelle inter-providers.
- **B-AI** : health live détaillée, télémétrie complète tokens/coûts/erreurs, budgets/rate limit applicatifs et vérification des affirmations LLM restent incomplets. Les logs ne mesurent pas toutes les tentatives ni toutes les erreurs.
- **B-DOC** : pas d'extracteur PDF/DOCX/TXT/MD/CSV/XLSX, OCR, structuration de brief, chunking, index de documents ou retrieval/citations pages-sections.
- **B-BILLING** : aucun adapter concret, catalogue de prix provider, ledger de transactions/événements, confirmation provider, factures ni renouvellement connecté. `/api/billing/upgrade` refuse honnêtement. `PAYMENT_PENDING`/`PAYMENT_FAILED` ne sont pas modélisés comme transactions.
- **B-WEBHOOK** : aucune route de réception/livraison, signature exécutée, anti-replay, corrélation/idempotence persistante, queue de retry ou traitement de subscription. Les méthodes TypeScript sont des interfaces seulement.
- **B-THEME** : pas de sélection Dark/Light/System, persistance, écoute système ni palette Light. Aucune inversion artificielle ajoutée.
- **B-A11Y** : audit navigateur limité aux pages publiques ; clavier/modal authentifié, lecteurs d'écran, zoom et contrastes complexes demandent une revue complémentaire. Axe a laissé des contrastes « incomplete » ; zéro violation automatique n'est pas zéro défaut.

## 4. Intégrations : douze niveaux de preuve

Références : `src/lib/integrations/{providers,connections,crypto,oauth-state,view}.ts`, routes `src/app/api/integrations/**`, migration context-platform + migration hardening.

| Provider ID | 1 Code | 2 Architecture | 3 Config locale | 4 Credentials locaux | 5 OAuth | 6 Callback | 7 Connexion réelle | 8 Sync | 9 Données récupérées | 10 Actions externes | 11 Tests | 12 Blocage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gmail | Registre/OAuth | Tables communes | Absente | Absents | Implémenté, pas configuré | Route, console non vérifiée | Non vérifiée | Pas d'adapter | Aucune réelle observée | Aucune implémentée | Mocks communs | H3 + B-ADAPTER |
| google-calendar | Registre/OAuth/lecture | Tables + REST | Absente | Absents | Implémenté, PKCE | Route, console non vérifiée | Non vérifiée | Manuelle codée, pas live | Fixtures événements seulement | Écriture absente | Mocks + calculs | H3 + B-SYNC/B-CONTEXT |
| github | Registre/OAuth | Tables communes | Absente | Absents | Implémenté | Route, console non vérifiée | Non vérifiée | Pas d'adapter | Aucune réelle observée | Aucune implémentée | Mocks communs | H4 + B-ADAPTER |
| notion | Registre/OAuth | Tables communes | Absente | Absents | Basic/JSON corrigé | Route, console non vérifiée | Non vérifiée | Pas d'adapter | Aucune réelle observée | Aucune implémentée | Mocks Basic/JSON | H5 + B-ADAPTER |
| slack | Registre/OAuth bot | Tables communes | Absente | Absents | v2 access_token corrigé | Route, console non vérifiée | Non vérifiée | Pas d'adapter | Aucune réelle observée | Aucune implémentée | Mocks 200/erreurs | H6 + B-ADAPTER |
| linear | Registre/OAuth | Tables communes | Absente | Absents | read + PKCE corrigés | Route, console non vérifiée | Non vérifiée | Pas d'adapter | Aucune réelle observée | Aucune implémentée | Mocks communs | H7 + B-ADAPTER |
| google-drive | Registre phase 2 | Tables communes | Absente | Absents | Générique + PKCE | Route générique | Non vérifiée | Pas d'adapter | Aucune | Aucune | Mocks communs seulement | H3 + B-ADAPTER |
| outlook | Registre phase 2 | Tables communes | Absente | Absents | Générique non validé live | Route générique | Non vérifiée | Pas d'adapter | Aucune | Aucune | Mocks communs seulement | Console Microsoft + adapter |
| teams | Registre phase 2 | Tables communes | Absente | Absents | Générique non validé live | Route générique | Non vérifiée | Pas d'adapter | Aucune | Aucune | Mocks communs seulement | Console Microsoft + adapter |
| jira | Registre phase 2 | Tables communes | Absente | Absents | Générique non validé live | Route générique | Non vérifiée | Pas d'adapter | Aucune | Aucune | Mocks communs seulement | Console Atlassian/protocole + adapter |
| webhooks | Déclaration catalogue | Enum/interface | Absente | Absents | Sans objet | Pas de route webhook | Non | Non | Aucune | Aucune | Aucun transport webhook | B-WEBHOOK |

### OAuth et permissions

- Start : `GET /api/integrations/{id}/connect`. Callback : `GET /api/integrations/callback/{id}`. Tous les chemins requièrent session et workspace actif.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, TTL 600 s. Cookie désormais authentifié/chiffré, lié au nonce, user, workspace, provider et redirect URI ; expiration vérifiée côté serveur.
- PKCE S256 ajouté pour Gmail, Calendar, Drive et Linear. Pas implémenté pour les autres providers : ne pas prétendre une couverture PKCE totale.
- Origine callback canonique `NEXT_PUBLIC_SITE_URL`, HTTPS obligatoire en production. Aucun callback déclaré dans une console distante n'a été inspecté.
- Reconnexion remplace l'unique connexion `(workspace_id, provider_id)` et réinitialise l'ancienne date de sync. Pas de multi-compte par provider.
- Disconnect supprime les lignes/ciphertexts via cascade ; **ne révoque pas l'autorisation chez le provider**. Révocation manuelle à prévoir.
- Gmail/Calendar ne demandent plus de scopes write anticipés. Slack : bot scopes de lecture, pas `search:read` utilisateur ni `chat:write` ; recherche utilisateur toujours non implémentée. Linear : `read`, pas les scopes `issues:read/projects:read` précédents. Notion : capacités de console, pas `scope` dans l'URL ; échange Basic+JSON.
- GitHub `repo` reste un accès large, y compris write côté GitHub. Le texte le signale ; migration vers GitHub App à permissions fines recommandée avant exploitation.
- Scopes réellement retournés par le provider persistés séparément des scopes demandés. Si non retournés : liste vide + « non rapportés », jamais une autorisation inventée.

Formats recoupés avec les documentations publiques le 22/09/2026 (lecture de documentation, **pas test live**) :
- https://developers.notion.com/reference/create-a-token
- https://docs.slack.dev/reference/methods/oauth.v2.access/
- https://linear.app/developers/oauth-2-0-authentication

### Stockage et états

`integration_connections` : `workspace_id`, `provider_id`, `connected_by`, state, account_label, scopes, timestamps et erreurs. **Pas de `user_id` propriétaire privé ni `provider_account_id` stable.** Google/GitHub ne récupèrent pas actuellement un profil provider pour renseigner systématiquement le compte.

`integration_credentials` : access/refresh chiffrés, expiration, workspace, connection. AES-256-GCM existait ; contexte authentifié AAD ajouté (workspace/provider/authorizer). Les anciennes valeurs sans contexte ne sont plus déchiffrées : reconnexion nécessaire. Une rotation avec key IDs/migration de ciphertexts n'existe pas.

`integration_sync_runs` : résultats, compteurs, timestamps et erreurs ; ajout request ID, durée, retry count. Contraintes composites empêchent de rattacher une credential/run au workspace d'une autre connexion.

Sept états couverts côté TypeScript/UI : DISCONNECTED, CONNECTING, CONNECTED, SYNCING, STALE, ERROR, REAUTH_REQUIRED. DISCONNECTED est l'absence de ligne, pas une valeur enum. STALE est dérivé après 24 h sans sync complète. CONNECTING n'est pas persisté dès la sortie vers le provider, seulement pendant la sauvegarde. Une opération stoppée en SYNCING n'a pas encore de récupération automatique.

**Limite de sécurité majeure restante :** RLS autorise les membres du workspace à écrire des états/credentials chiffrés/runs et leur propre request log depuis PostgREST. Le chiffrement protège le token et son contexte, mais ne rend pas ces statuts ni métriques infalsifiables. Avant production, séparer les écritures privilégiées par un canal serveur de confiance, avec vérification d'acteur/role, sans exposer de clé service au navigateur. Ne pas utiliser les compteurs actuels comme preuve de paiement, preuve de consentement ou audit immuable.

### Données et actions, provider par provider

- Gmail : messages, threads, attachments, search, metadata et drafts **non implémentés** comme adapter. Envoi/archivage également absents.
- Calendar : liste paginée d'événements d'un calendrier (primary par défaut), IDs/titres/dates/localisation/liens/all-day ; dédup par ID. Pas de liste de calendriers, attendees, freebusy provider, create/update/delete. Créneaux/conflits = heuristiques UTC sur les événements lus, **pas garantie de disponibilité réelle**.
- GitHub : repositories/issues/PR/comments/commits/status et create/update **absents**.
- Notion : pages/databases/blocks/search/create/update **absents**.
- Slack : channels/messages/threads/search/files/draft/send **absents**.
- Linear : issues/projects/comments/status/due dates/create/update **absents**.

Le chemin réellement câblé est **UI → API → session/workspace → credential chiffrée → adapter Calendar → Google REST → événements normalisés → compteurs de run**. La partie **base de contexte → Intelligence** ne suit pas. Les autres providers s'arrêtent au stockage OAuth.

## 5. Tests des intégrations : couverture réelle

| Cas demandé | Preuve disponible après corrections | Limite |
|---|---|---|
| OAuth start | URL/state/scopes testés pour les dix providers | Helpers, pas login navigateur chez le provider |
| Callback | Validation tentative, échange et stockage testés séparément | Pas de parcours callback complet authentifié HTTP/provider |
| Invalid state | Nonce, cookie absent/altéré, autre user/workspace/provider/URI, expiration | Fixtures locales |
| Expired token | Refus avant appel adapter | Pas refresh automatique |
| Refresh token | Extraction et stockage chiffré testés | Exécuteur absent, tests marqués SKIP |
| Revoked permission | 401/403 mockés, REAUTH_REQUIRED | Aucune révocation live |
| Provider API error | HTTP 400/401/403/429/500 OAuth + Calendar 500 | Adapters absents hors Calendar |
| Rate limit | 429 classé | Pas backoff/scheduler complet |
| Timeout | AbortController mock, TIMEOUT distinct de RATE_LIMITED | Pas test réseau fournisseur |
| Successful sync | Calendar mock + recordSyncRun mock + règles SQL | Aucune sync réelle |
| Failed sync | Erreurs provider/credential/écriture, pas de date de succès avancée | Pas parcours complet authentifié |
| Reconnect | Upsert, scopes, chiffrement, effacement ancienne sync | Pas compte réel |
| Disconnect | Filtres workspace/provider et cascade SQL exécutés | Révocation provider absente |
| Unauthorized workspace | RLS réelle PGlite, INSERT/UPDATE/DELETE et FK | Pas RLS du projet hébergé |
| Cross-user isolation | Deux utilisateurs/deux workspaces + utilisateur suspendu + anon | Un même workspace reste volontairement partagé |

**REAL-WORLD VERIFICATION BLOCKED:** absence des variables Supabase et des clients OAuth applicatifs dans le sandbox ; aucune session NEXUS autorisée, aucun compte de test ayant donné son consentement. Pour les adapters absents, le code manque aussi : ce n'est pas uniquement un HUMAN BLOCKER.

## 6. Cross-source Intelligence et documents

`context-graph.ts`, `recovery.ts`, `tools.ts` offrent types, règles et calculs. Le scénario retour de vacances est testable sur snapshots NEXUS. La route query lit tasks/projects/goals/activities/dependencies et métadonnées notes/events, dans le workspace actif. Pas d'emails, mentions Slack, PR, issues Linear ou texte Notion réellement récupérés. Pas de déduplication sémantique de données externes observée.

Les listes de sources de la réponse HTTP sont désormais reconstruites à partir du contexte NEXUS chargé, au lieu d'accepter aveuglément une liste fournie par le modèle. **Cela ne garantit pas que chaque phrase narrative LLM est factuellement correcte.** Hallucinations, prompt injection, qualité des citations et liens proposés restent à tester adversarialement.

Pipeline documentaire :

| Étape | État |
|---|---|
| UPLOAD | Composant client + bucket `nexus-files` + metadata ; non exercé sur Storage réel |
| VALIDATE | Limite UI 10 MiB ; limites bucket/SQL historiques 50 MiB ; pas validation de signature binaire/MIME fiable ni antivirus |
| EXTRACT | Absent pour PDF/DOCX/TXT/MD/CSV/XLSX/images ; OCR absent |
| STRUCTURE | Absente : pas schéma de brief normalisé |
| CHUNK / INDEX | Absents pour documents ; anciennes tables de mémoire IA ne constituent pas un index documentaire |
| RETRIEVE | Pas recherche du contenu documentaire dans query |
| AI ANALYSIS | Absente pour le contenu uploadé |

Donc résumer un fichier, extraire livrables/contraintes/échéances/inconnues, trouver contradictions, créer tâches/plan à partir du brief ou comparer deux documents n'est **pas** vérifié ni implémenté end-to-end. Aucun numéro de page ou référence documentaire ne doit être inventé.

Correction fichiers : échec de lecture cesse le chargement infini ; la suppression Storage est contrôlée avant d'annoncer le succès. Les deux suppressions Storage/SQL restent non atomiques : si le second appel échoue, une metadata sans objet peut subsister et doit être traitée. Un GC/réconciliateur manque.

## 7. OpenAI / fallback / Admin Intelligence

- `OPENAI_API_KEY`, `OPENAI_MODEL` utilisés côté serveur ; OpenAI prioritaire sur Anthropic. Sans modèle explicite, défaut `gpt-4o-mini`. Le modèle doit être validé dans le projet client, pas présumé disponible.
- REST chat completions, réponse structurée, timeout et une tentative supplémentaire sur erreurs transitoires. Pas de backoff véritable ni respect complet de Retry-After. Le timeout existant de l'IA ne garantit pas de borner toute la lecture du body.
- NEXUS Engine sert de fallback ; suites agent existantes valident des branches de succès/échec mockées.
- Nouvelle page `/admin/intelligence`, vérification admin dans la page et protection RPC. Affiche configuration, modèle, compteurs réellement renvoyés, et **CONFIGURED · NOT VERIFIED** ou NOT_CONFIGURED. Aucune clé affichée.
- L'ancienne santé « operational si clé présente » devient **not_measured**. Aucun probe payant lancé automatiquement.
- Request log query désormais attendu ; modèle renseigné lorsque cohérent avec le provider choisi, fallback identifié lorsque moteur utilisé avec provider configuré. Cela ne distingue pas encore toutes les causes du fallback.
- Colonnes token existantes toujours non instrumentées bout-en-bout ; agrégat SQL retourne NULL, pas zéro inventé. Coûts non mesurés. Ni INVALID_KEY, QUOTA_EXCEEDED, RATE_LIMITED, DEGRADED, ERROR, OPERATIONAL daté ne sont persistés comme état provider fiable.
- Logs d'exception AI/OAuth principaux expurgés ; les autres logs historiques DB restent à revoir pour ne pas recopier de valeurs métier. Aucun audit global de redaction n'est revendiqué.

## 8. Billing, webhooks, admin control plane

Plans (`/pricing`, `/upgrade`) ≠ gestion locale (`/settings/billing`) ≠ checkout (aucun installé). La route d'upgrade retourne 501 quand Supabase/auth sont valides mais qu'aucun provider n'existe ; avec config locale absente, refus 503 observé. Aucun Stripe hardcodé ajouté. Interface `BillingProvider` interchangeable ; les commentaires historiques FedaPay ne sont pas une intégration.

Les statuts SQL actuels sont active/cancelled/expired/past_due/trialing ; FREE est un plan, non un statut de paiement. Les règles d'entitlement fail-closed et mutations privilégiées sont testées par suites SQL. Une subscription active attribuée administrativement **n'est pas une preuve de paiement**.

À construire : transactions PAYMENT_PENDING/PAYMENT_FAILED, corrélation checkout/provider, ledger unique provider/event_id, signature sur raw body, traitement transactionnel et replay idempotent, remboursement/annulation/renouvellement, invoices, UI Payment Required/Pending/Failed/Success liée à preuves provider.

Admin existant : Overview, Users, Workspaces, Activity, Security, Audit Log, Subscriptions ; Intelligence ajouté. Organizations, Revenue, Payments, Invoices, Usage détaillé, System Health dédié, Errors, Incidents, Sessions, Integrations détaillées et Settings restent des entrées planned. Overview comporte des probes DB/Auth/Storage ; leur code n'a pas été exercé contre les services de production. Un listing Storage vide ne prouve pas les droits read/write/delete de tous les objets.

Les agrégats sont issus de tables/RPC et non de chiffres de démonstration, mais leur sémantique et leur falsifiabilité sont importantes : connexion stockée ≠ accès provider vérifié, plan payé ≠ transaction encaissée, zéro erreur loguée ≠ absence de panne.

## 9. UX laws / writing — sans redesign

| Fichier / composant | Problème ou observation | Principe | Correction / suite | Impact |
|---|---|---|---|---|
| integration-platform.tsx | Reconnect absent lorsque token expiré | Jakob's Law | Ajout Reconnect nommé par provider | Parcours de réparation familier |
| integration-platform.tsx / summary permissions | Zone interactive très compacte | Fitts's Law | Cible min 44 px | Ouverture plus simple au toucher |
| integration-platform.tsx | Dix providers, beaucoup de capacités planned | Hick's Law | État planned explicite ; filtrage recommandé, non ajouté | Réduit les attentes erronées ; tri reste à faire |
| integration-platform.tsx | Scopes et capacités nombreuses | Miller's Law | Details conserve divulgation progressive ; scopes accordés séparés | Réduit confusion permission/capacité |
| files-manager.tsx / sync UI | Chargement après read error ; refresh non pris en compte | Doherty Threshold | Arrêt loading sur erreur ; actions bloquées pendant refresh | Feedback plus déterministe ; latence réelle non garantie |
| integrations/page.tsx | Variables serveur présentées à l'utilisateur final | Tesler's Law | Explication exacte conservée ; séparation vue opérateur recommandée | Prérequis moins obscurs, reste technique |
| admin/health.ts | Badge vert basé uniquement sur clé | Aesthetic-Usability Effect | NOT MEASURED au lieu d'operational | Le visuel ne sur-vend plus la fiabilité |
| integration-platform.tsx | Bouton sync pour adapter inexistant | Choice Overload | Action désactivée « Sync not implemented » | Évite des erreurs inutiles |
| files-manager.tsx | Succès annoncé malgré suppression Storage non contrôlée | Peak-End Rule | Vérification du retour Storage avant succès | Fin de parcours plus honnête |
| sync route | SYNCING peut rester bloqué après arrêt du serveur | Zeigarnik Effect | Message de reprise/reconnect ; récupération worker à construire | État incomplet visible ; problème non totalement résolu |
| integration-platform.tsx | Permissions demandées confondues avec accordées | Law of Proximity | Informations distinctes près du compte et des actions | Meilleure compréhension du consentement |
| providers.ts | Vocabulaire connected/data available confondu | Law of Similarity | Libellés cohérents OAuth vs sync vs planned | Cohérence des cartes |
| OAuth exchange/crypto | Payloads invalides et base64 permissif | Postel's Law, limitée par sécurité | Validation stricte sur frontière de confiance | Ne pas « accepter largement » des preuves de sécurité |
| Integrations page | Promesses cross-source sans chemin réel | Occam's Razor | Texte limité aux fonctionnalités effectives | Moins d'affirmations inutiles |
| onboarding / integration descriptions | Utilisateur pressé peut manquer les longs prérequis | Paradox of the Active User | Explications dans l'action et états ; revue onboarding complète restante | Moins de dépendance à une documentation longue |

Writing : messages explicites timeout/reconnect/unconfigured ; suppression de la promesse « Intelligence reads through adapter at query time ». Notice de connexion issue de l'URL désormais recoupée avec la ligne de DB, pas affichée sur simple `?connected=gmail`. Il reste des messages génériques ailleurs (erreurs globales), une mention générique irréversible de ConfirmDialog peu adaptée à reconnect, et des promesses légales à réviser. **Pas de réécriture totale revendiquée.**

## 10. Accessibilité et thèmes

- Modal : Escape, focus initial/restauration existaient ; boucle Tab/Shift+Tab et aria-describedby ajoutés. Test structurel ajouté ; pas de validation navigateur de tous les dialogues/nesting.
- Texte tertiaire Admin relevé de `#6e6e76` à `#9999a1`, identité sombre conservée. Les valeurs muted/opacity et fonds translucides ailleurs exigent encore des mesures contextuelles.
- Chromium réel + axe : `/login`, `/pricing`, `/privacy`, `/admin/login`, 1440×1000 et 390×844, reduced-motion activé : **8 checks, 0 violation automatique détectée, 0 overflow horizontal**.
- **Incomplets axe** : color-contrast sur Pricing (57 nœuds desktop, 15 mobile), Privacy (32 desktop, 3 mobile). Ces contrastes ne sont pas déclarés conformes.
- Clavier réel sur écrans authentifiés, lecteur d'écran, zoom 200/400 %, cibles avec exceptions WCAG 2.5.8, ordre de focus, mode contraste forcé et animation sans reduced-motion : non couverts dans cette session.
- Dark possède des tokens sémantiques et un rendu local. Light/System n'existent pas. Ne pas qualifier une palette unique de gestionnaire de thème.

## 11. Privacy / legal / security

### Registre des données observables dans le code

| Données | Finalité/source | Stockage / accès | Conservation / suppression / export | Tiers / IA |
|---|---|---|---|---|
| Gmail OAuth + metadata compte/scopes | Autoriser accès Google ; contenu email non ingéré actuellement | Tables intégrations, tokens AES-GCM, membres workspace pour ciphertext | Indéfini tant que connexion ; cascade disconnect ; pas export dédié | Google reçoit OAuth ; emails non envoyés au LLM dans ce build |
| Calendar OAuth + événements en transit | Lecture de plage REST | Tokens en DB ; événements normalisés en mémoire, compteurs sync en DB | Runs effacés par cascade connexion ; pas archive événements | Google ; pas branchement LLM |
| Slack / GitHub / Linear / Notion | Grant OAuth et état ; pas données provider récupérées par adapter | Même modèle partagé par workspace | Disconnect local ; grants provider à révoquer séparément ; pas purge TTL | Provider concerné ; pas cross-source IA effectif |
| Drive / Outlook / Teams / Jira | Architecture future ; grants possibles via route générique non vérifiée | Même plateforme si handshake aboutit | Idem ; politiques à définir avant activation | Provider concerné |
| Documents | Pièces jointes projets/workspace | Bucket privé + table files ; RLS membres | Suppression manuelle ; pas réconciliation automatique ; download unitaire, pas export global | Supabase Storage ; pas extraction/modèle actuellement |
| NEXUS tâches/projets/activité/notes/events | Organisation et contexte | Tables workspace + RLS | CRUD existant ; pas cycle global retention/export démontré | Contexte sélectionné transmis au LLM configuré |
| Mémoire Intelligence/préférences/missions/signaux | Continuité des échanges | Tables mémoire récentes scoped user/workspace ; anciennes tables AI ont un modèle workspace différent | Durée politique non établie ; purge globale/export non démontrés | Certaines préférences/historique inclus dans prompt |
| Logs IA/sync/admin | Diagnostic et audit | DB/logs runtime ; ACL différentes | Pas politique TTL/archivage complète démontrée | Hébergeur, Supabase ; données personnelles minimisables |

### Risques et validation humaine

1. **Bloquant confiance serveur** : écritures membres sur tables de connexions/runs/request logs ; distinguer télémétrie client et preuve serveur. Chiffrement AAD ne remplace pas une ACL de mutation.
2. **Corrigé dans migration seulement, pas en production** : FK tenant composites + révocation des anciens helpers workers/agrégats non autorisés. Les helpers qui avaient déjà une vérification d'appartenance sont conservés.
3. Isolation intégrations **workspace**, pas boîte mail privée par user. Décider explicitement qui peut connecter/déconnecter, quelles données peuvent être partagées avec les autres membres et quel consentement recueillir.
4. Pas de rotation versionnée de clé ; perte de clé = reconnect. Pas de refresh automatique, revocation endpoint ou preuve de suppression provider.
5. Absence de limite applicative globale pour appels IA/OAuth/sync ; évaluer quotas, taille de body, input validation et anti-abus. Entitlements SQL ne constituent pas un rate limiter réseau.
6. Les vieux logs DB bornés peuvent inclure des messages bruts ; borne en caractères ≠ redaction. Définir allowlist de champs partout.
7. LegalContactBox contient `[LEGAL ENTITY NAME]`, `[LEGAL CONTACT EMAIL]`, `[BUSINESS ADDRESS]`. Politique Privacy §9 annonce self-service deletion et backups 30 jours sans preuve d'infrastructure correspondante. La cascade SQL ne supprime pas automatiquement tous les objets Storage, backups ou grants OAuth. **Ne pas publier ces promesses comme vérifiées.**
8. DPA/sous-traitants, localisation et transferts, bases légales, Google restricted scopes/verification, Slack/Notion policies, durées de rétention, procédure droits RGPD et responsable légal : **validation juridique humaine requise**.
9. Les tests RLS locaux ne prouvent pas les GRANT/policies effectivement installés sur le projet hébergé. Review d'une exportation de schéma réelle requise avant déploiement.

Aucune affirmation « 100 % légal », « totalement sécurisé » ou « WCAG certifié ».

## 12. Observabilité

| Champ / mécanisme | Intégrations | IA |
|---|---|---|
| Request ID / corrélation | Ajout aux sync runs ; response success porte l'ID ; pas traçage distribué complet | Pas request/correlation ID bout-en-bout |
| Provider / opération | provider_id + route sync ; pas journal complet OAuth | provider/surface query ; autres surfaces incomplet |
| Durée | Ajout duration_ms et vrai started_at au run | Latence agent, pas toutes les étapes provider |
| Statut / erreur | status/error_code ; TIMEOUT séparé ; erreurs OAuth nettoyées | fallback/ok partiels, catégories provider détaillées absentes |
| Retry count | Champ à 0, aucun retry de sync exécuté | Retry fetch existant, compteur non journalisé |
| Sync timestamp | last_sync_at uniquement sur succès complet | Sans objet |
| Tokens / coûts | Aucun token en payload de journal applicatif | Tokens mesurés non renseignés ; coûts absents |

Ne pas logger clés API, refresh/access tokens ni body provider. Les compteurs ne deviennent pas des métriques de confiance tant que leur écriture n'est pas réservée au serveur.

## 13. Vérification déploiement

- `next.config.ts` inspecté : standalone hors Vercel, headers de sécurité, dev origins e2b/run.app. L'exception iframe ajoutée ne s'applique qu'en **development** ; X-Frame-Options reste en production.
- Pas de `vercel.json` ni de liaison `.vercel` utilisable observée. Le connecteur Vercel est non proposé dans cette session.
- GitHub deployments : Production ID **6589447137**, commit `b1717d5eeef3579ba0b5d71a26425a17d00b9d05`, statut **success**, description « Deployment has completed », statut daté **2026-09-22T15:44:04Z**. Preview ID **6589211194**, commit `1ea00195b8165b08575404dfe82343b1b3a3ed7b`, également répertorié ; son comportement applicatif n'a pas été testé.
- URL Production retournée : `https://nexus-intelligence-gqmiwhprr-amissalassane-6379s-projects.vercel.app`. Tentative `/api/health` : accès protégé **Vercel SSO** via l'outil de lecture ; curl direct a échoué au TLS dans ce réseau.
- **Un deployment GitHub success ne prouve pas un service provider opérationnel.** Aucun secret Production/Preview/Development lu, aucune migration distante appliquée, aucune donnée utilisateur consultée.
- **CONFIGURATION EXPECTED** : `.env.example`, projet Supabase distinct pour tests, domaines/callbacks spécifiques aux environnements. **HUMAN VERIFICATION REQUIRED** pour présence et validité des secrets et de leur portée.

## 14. Modifications effectuées

- OAuth : nouveaux helpers `oauth-state.ts`, binding des tentatives, expiration, origine canonique, PKCE Google/Linear, échange Notion, token Slack, scopes Linear et réduction write Google/Slack ; erreurs expurgées.
- Credentials : AAD de contexte et validation stricte des encodages ; legacy à reconnecter. Pas de clé hardcodée.
- Lifecycle : scopes accordés, état connecting avant sauvegarde des tokens, refus des erreurs de lecture DB, stale, last successful sync, erreurs d'écriture contrôlées, claim de sync optimiste.
- Calendar : pagination bornée, dedup ID, TIMEOUT, détection pagination incomplète, calculs UTC corrigés pour journées entières et événements traversant les horaires.
- UI : affichage sans fausse notice URL, connexion/sync/Intelligence distinguées, reconnect, permissions, sync non implémentée désactivée, compte des états connected corrigé.
- Intelligence : sources HTTP reconstruites depuis les sources chargées ; logs attendus/plus honnêtes ; exception principale expurgée.
- Admin : route **ajoutée** `/admin/intelligence` ; navigation et santé corrigées ; agrégat tokens inconnu ≠ 0. Aucun provider supplémentaire réellement connecté.
- Files : lecture/chargement et suppression erreurs contrôlées.
- Accessibilité : focus trap modal, aria-describedby, cible permissions, contraste Admin.
- Configuration : `.env.example` complété ; exception iframe uniquement dev pour preview.
- Tests : `integrations-hardening.test.mjs`, `integrations-rls.test.mjs`, `npm run test:audit` inclus dans `npm test`. Deux tests structurels anciens actualisés (page Admin désormais existante, ancien chemin `integration-hub.tsx` absent).
- Documentation : matrice initiale, présent rapport, inventaire, sorties de test et résultats axe.

### Migration

`20260922210000_nexus_audit_hardening.sql` uniquement, additive/transactionnelle :
1. Colonnes request_id/duration_ms/retry_count sur runs.
2. Unicité `(id, workspace_id)` et FK composites credentials/runs.
3. Révocation PUBLIC/anon/authenticated des helpers workers et agrégats non protégés identifiés ; service_role uniquement. Fonctions absentes ignorées via catalogue.
4. Agrégat tokens sans coalesce zéro.

**Pré-déploiement :** si anciennes lignes incohérentes existent, la FK fait échouer la migration ; investiguer, ne pas réassigner/supprimer silencieusement. Aucune migration historique réécrite. Le schéma déployé doit être sauvegardé et testé en staging. Reconnecter les tokens legacy après déploiement du code AAD.

## 15. Tests exécutés et tests impossibles/non exécutés

### Commandes demandées

- `npm ci` : succès, 0 vulnérabilité signalée au moment de l'installation.
- `npm run lint` : succès, **0 erreur, 21 warnings** (notamment directives eslint inutilisées et variables de tests).
- `npx tsc --noEmit` : succès.
- `npm run build` : succès, `/admin/intelligence` incluse ; build sans credentials applicatifs, donc pas preuve de fonctionnement authentifié.
- `npm test` : succès après correction de deux attentes structurelles obsolètes et de l'ancien chemin de composant. Contient tests unitaires, freemium/subscriptions/admin SQL, mobile/landing/creation/guide/typography/icons, lineage hermétique, domaines/intelligence, nouvelles suites audit.
- Nouvelle suite hardening : **20 tests réussis, 29 explicitement SKIP**, zéro échec. Les SKIP correspondent aux dix checks réels sans credentials, dix refresh executors absents et neuf adapters de sync absents.
- Nouvelle suite SQL intégrations : **1 scénario SQL réussi**, couvrant de multiples assertions de RLS/tenant/user/suspension/cascade/ACL/NULL usage. Ni mock PostgREST ni base hébergée : moteur PostgreSQL PGlite.
- `admin-auth-contract.test.mjs` hors npm test : **25 réussis**.

### Échecs conservés, non cachés

Six fichiers hors de `npm test` ont été exécutés et échouent :
- `auth-workspace-bootstrap.test.mjs` : pgcrypto/vector/Storage manquants dans son fixture ; puis cascades d'erreurs et transaction abortée.
- `core-contract.test.mjs` : pgcrypto absent, puis helpers canoniques manquants.
- `lineage-reconciliation.test.mjs` : pgcrypto absent.
- `migration-logic.test.mjs` : schéma storage.buckets absent et extensions/fixtures incomplets, puis transaction abortée.
- `onboarding-rls.test.mjs` et `workspace-bootstrap.test.mjs` : arrêt sur pgcrypto absent.

Cela empêche de dire « tous les fichiers de test du dépôt passent ». Ces échecs ne sont pas convertis en SKIP silencieux ; il faut réparer ces harnesses ou les exécuter sur Supabase local complet avec extensions.

### HTTP et navigateur

Sur serveur Next local réel sans config : health 200 avec `supabaseConfigured:false` ; intégrations/start/sync, Intelligence et Billing renvoient **503** ; `/integrations` et `/admin/intelligence` redirigent vers login. Ce sont des refus constatés, pas des connexions.

Chromium/axe : résultats §10. Le téléchargement CDN du navigateur et apt ont d'abord échoué ; le navigateur a finalement tourné avec un binaire npm temporaire et ses bibliothèques embarquées. Aucun outil navigateur temporaire ni binaire ajouté au dépôt.

**Non exécuté :** `auth-flow.test.mjs` complet avec serveur/stub d'auth préconfiguré (harness distinct non monté dans cette session), vrais OAuth/refresh/revocation/provider data, vrais uploads Supabase, vraies factures/webhooks, écrans authentifiés navigateur avec workspace réel, tests screen reader/Light/System et vérification RLS hébergée. Le harness auth local manquant est une limitation de cette session, **pas** une demande de credentials humains. Les tests providers live sont, eux, des HUMAN BLOCKER.

## 16. Actions humaines exactes

**Ne jamais envoyer des secrets dans le chat ni les committer.** Utiliser paramètres d'environnement/gestionnaire de secrets. Valeurs listées ci-dessous = noms et provenance, jamais valeurs fabriquées. Limiter initialement à un projet et comptes de test.

### H1 — Supabase et environnements

**HUMAN ACTION REQUIRED**
1. Aller dans Supabase → projet NEXUS de staging → Project Settings/API, puis Vercel → projet → Settings → Environment Variables.
2. Préparer un projet de test et deux comptes dans deux workspaces ; sauvegarder/exporter le schéma déployé et comparer la lineage de migrations avant application.
3. Renseigner l'URL publique et la publishable key réelles, le domaine canonique HTTPS, et une clé de chiffrement aléatoire 32 octets générée dans un gestionnaire sûr.
4. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXUS_INTEGRATION_ENCRYPTION_KEY` : environnement staging/Preview d'abord. `.env.local` ignoré en Git pour Development. Ne pas exposer la clé de chiffrement via NEXT_PUBLIC.
5. Vérifier `/api/health`, auth NEXUS, table migrations, FK/ACL/RLS et les deux workspaces. Appliquer la nouvelle migration après examen, puis reconnecter les comptes legacy ; sauvegarder la clé hors du dépôt.
6. Arena pourra tester auth réelle, refus cross-workspace, stockage/chiffrement, API intégrations, parcours UI, fichier upload/download/delete. Aucun paiement ne sera lancé sans accord explicite.

### H2 — OpenAI

**HUMAN ACTION REQUIRED**
1. Aller dans OpenAI Platform → projet dédié NEXUS → clés API, modèles disponibles et limites d'usage.
2. Créer une clé serveur restreinte pour staging ; définir budget et politique de données approuvée.
3. Obtenir une clé réelle et choisir un identifiant de modèle accessible au projet.
4. Stocker `OPENAI_API_KEY` et `OPENAI_MODEL` dans l'environnement serveur, jamais frontend/chat. Redéployer.
5. Se connecter à NEXUS, poser une question sur des tâches non sensibles connues, comparer réponse/provider/fallback ; lire `/admin/intelligence`. Une présence de clé ne suffit pas.
6. Arena pourra exercer une requête autorisée, vérifier attribution/fallback, erreurs contrôlées et absence d'exposition. Mesure de coûts complète et health détaillée nécessitent encore du code.

### H3 — Gmail / Calendar / Drive

**HUMAN ACTION REQUIRED**
1. Aller dans Google Cloud Console → APIs & Services / Google Auth Platform.
2. Créer/configurer une application OAuth Web, écran de consentement, utilisateurs de test ; activer les API utiles. Examiner les exigences de validation des scopes Gmail avant publication.
3. Obtenir Client ID/Client Secret ; enregistrer exactement `https://VOTRE-DOMAINE/api/integrations/callback/gmail`, `/google-calendar`, `/google-drive` pour les providers retenus (remplacer VOTRE-DOMAINE, ne pas copier littéralement).
4. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` côté serveur ; H1 et origine canonique cohérentes. Préférer apps séparées par environnement.
5. Cliquer Connect depuis NEXUS avec un compte test et lire le consentement. Pour Calendar, créer un événement non sensible daté dans la fenêtre ±7 jours, puis Sync now et contrôler le nombre/le run.
6. Arena pourra tester callback, invalid state, lecture Calendar et reauth après révocation de test. **Gmail/Drive ne liront pas de données tant que leurs adapters n'existent pas.**

### H4 — GitHub

**HUMAN ACTION REQUIRED**
1. Aller dans GitHub → Settings → Developer settings → OAuth Apps (ou décider de construire un GitHub App à permissions fines).
2. Créer une app de staging pour le modèle OAuth actuellement implémenté, avec compte/repo de test.
3. Client ID/Client Secret réels et callback `https://VOTRE-DOMAINE/api/integrations/callback/github` ; examiner le scope large repo.
4. `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` côté serveur. Ne pas réutiliser le token GitHub du sandbox comme connexion utilisateur.
5. Autoriser l'app depuis Connect GitHub, vérifier ligne et scopes rapportés ; aucune sync de repo n'est promise.
6. Arena pourra tester handshake/stockage/disconnect. Lecture repos/PR/issues/actions exigera d'abord un adapter et ses tests.

### H5 — Notion

**HUMAN ACTION REQUIRED**
1. Aller dans Notion → My integrations / Developer portal.
2. Créer une intégration publique OAuth de test, avec lecture seule ; partager uniquement une page test lors du consentement.
3. Client ID/secret et redirect URI `https://VOTRE-DOMAINE/api/integrations/callback/notion`. Capacités réglées dans la console.
4. `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` côté serveur.
5. Connect Notion puis consentement ; vérifier échange, compte workspace retourné et stockage ; ne pas conclure à une page récupérée.
6. Arena pourra tester Basic/JSON et persistence live ; pages/blocks/search demandent encore un adapter.

### H6 — Slack

**HUMAN ACTION REQUIRED**
1. Aller dans Slack API → Your Apps → OAuth & Permissions, dans un workspace de test.
2. Créer/configurer une app bot ; aligner les scopes de lecture sur `providers.ts`, sans search utilisateur ni envoi non implémenté.
3. Client ID/secret et redirect `https://VOTRE-DOMAINE/api/integrations/callback/slack`.
4. `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` côté serveur.
5. Installer via Connect Slack avec approbation de l'administrateur du workspace ; vérifier permissions et réponse OAuth v2.
6. Arena pourra vérifier handshake et stockage. Channels/messages/search/send restent bloqués par l'absence d'adapter et, pour search, de flow utilisateur dédié.

### H7 — Linear

**HUMAN ACTION REQUIRED**
1. Aller dans Linear → Settings → API → OAuth Applications.
2. Créer une application test, scope `read`, comptes/équipe de test.
3. Client ID/secret et callback `https://VOTRE-DOMAINE/api/integrations/callback/linear`.
4. `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` côté serveur.
5. Connect Linear, vérifier PKCE, stockage d'expiration/refresh et consentement ; ne pas laisser croire au refresh automatique.
6. Arena pourra vérifier handshake ; issues/projects/actions nécessitent l'adapter, puis un exécuteur de refresh avec rotation.

Phase 2 Outlook/Teams/Jira : **HUMAN ACTION REQUIRED**, mais d'abord spécifier et valider le flow exact. Aller dans Microsoft Entra App registrations (Outlook/Teams) ou Atlassian Developer Console (Jira), créer une app test, obtenir les IDs/secrets et enregistrer le callback du provider. Variables exactes : `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `TEAMS_CLIENT_ID`, `TEAMS_CLIENT_SECRET`, `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` (noms complets dans `.env.example`). Les scopes/tenant/audience/ressources doivent être revus avant activation ; Arena ne pourra confirmer que le handshake, pas des adapters inexistants.

### H8 — Billing / webhooks

**HUMAN ACTION REQUIRED**
1. Choisir une plateforme réelle compatible avec pays, devises, fiscalité et société, puis ouvrir sa console sandbox.
2. Valider le choix, créer compte marchand/test et catalogue de prix ; **faire implémenter adapter + ledger + endpoint webhook avant de chercher à « activer » un checkout**.
3. Obtenir les clés sandbox, IDs de prix et secret de signature. Les noms d'env précis dépendront de l'adapter choisi ; aucun nom fictif n'est prescrit ici.
4. Stocker uniquement côté serveur dans staging ; callback/webhook vers l'endpoint réellement implémenté, pas une route imaginée.
5. Exécuter checkout sandbox autorisé, vérifier signature, transaction/corrélation, double livraison, échec, annulation et invoice. Distinguer paiement test et encaissement réel.
6. Arena pourra tester le provider sandbox et replays après implémentation. Actuellement, seuls les refus et règles locales de plans sont testables.

### H9 — Production / privacy / sécurité

**HUMAN ACTION REQUIRED**
1. Aller dans Vercel → projet → Deployments/Environment Variables et Supabase → SQL/Storage/Auth ; faire intervenir le responsable légal/sécurité.
2. Préparer un accès de vérification autorisé à un Preview protégé, un jeu de données non sensible et une revue des ACL/consentements/rétentions.
3. Confirmer présence/portée des variables sans les recopier dans le chat ; renseigner entité légale, adresse, contact validés et durées réellement contractuelles.
4. Variables dans Vercel ; identité/rétention dans les pages légales après validation ; ACL/migrations via déploiement revu.
5. Vérifier l'URL protégée après authentification, les migrations réellement appliquées, suppression DB+Storage+backups/grants et les journaux expurgés. Ne pas désactiver globalement les protections pour faciliter l'audit.
6. Arena pourra vérifier des routes accessibles avec autorisation, effectuer des tests isolés de staging et analyser un export de schéma sans secrets. Une validation juridique ne peut pas être automatisée.

### H10 — UX / thèmes / accessibilité

**HUMAN ACTION REQUIRED**
1. Ouvrir une Preview de staging avec utilisateur standard et administrateur de test, puis les écrans Settings/Integrations/Intelligence/Files/Billing.
2. Valider le cahier de palette Light et la sélection System ; prévoir tests clavier/lecteur d'écran et contrastes manuels.
3. Aucun credential provider requis pour concevoir les thèmes ; seules sessions de test et données non sensibles sont nécessaires aux parcours authentifiés.
4. Implémenter la variante dans les tokens et le gestionnaire de préférence, puis les tests visuels ; ne pas inverser les couleurs par filtre CSS.
5. Vérifier keyboard/focus, 200/400 %, mobile, reduced-motion, changement système, persistance et absence de flash.
6. Arena pourra automatiser contrastes détectables, captures/régressions et navigation clavier après implémentation. La validation humaine assistive reste nécessaire.

## 17. Priorités de suite

1. **P0** : durcir la frontière serveur des credentials/statuts/logs ; appliquer et vérifier migration en staging ; cadrer partage workspace vs comptes privés ; corriger promesses légales.
2. **P1** : finaliser Calendar (refresh/rotation/reauth/runs récupérables), puis une seule intégration de données à la fois avec consentement test, contract tests et preuve live.
3. **P1** : brancher le contexte externe avec attribution, permissions/fraîcheur et déduplication testées ; ne pas afficher les sources non lues.
4. **P1** : observabilité AI réelle (provider attempts, tokens/coûts, budgets, health datée) avant exploitation payante.
5. **P2** : document pipeline sécurisé, billing concret/webhooks, Light/System, audit authentifié WCAG et remise en état des anciennes suites hors npm test.

**Conclusion : les corrections rendent plusieurs états et frontières plus fiables, mais ne transforment pas une architecture partielle en produit connecté et vérifié.** Les preuves locales, absences d'implémentation, credentials manquants et vérifications humaines sont volontairement séparés.
