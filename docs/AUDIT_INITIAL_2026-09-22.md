# NEXUS — matrice initiale, avant corrections

Audit du checkout b1717d5, branche arena/01a0cab9-nexus-app, 22 septembre 2026. Inventaire : 635 fichiers suivis, 39 migrations. Les rapports historiques ne sont pas des preuves de fonctionnement. Inspection des routes App Router/API, bibliothèques, providers, composants ciblés, définitions SQL/RLS/RPC, tests et configuration. Revue ciblée, pas certification ligne par ligne ni audit intrusif de production.

## Environnement observé

Aucun `.env.local`, aucune variable applicative Supabase, OpenAI, OAuth ou chiffrement dans le processus. `.env.example` contient des placeholders. Les tokens GitHub du sandbox servent uniquement aux opérations du dépôt et ne sont pas des credentials NEXUS. Aucune base distante interrogée, aucun compte fournisseur connecté, aucun paiement initié. Secrets Vercel : HUMAN VERIFICATION REQUIRED. Le connecteur Vercel n'est pas proposé dans cet environnement ; les métadonnées de déploiement restent consultables par GitHub.

| Provider | Code / architecture | Configuration locale / credentials | OAuth / callback | Connexion / synchronisation réelle / données / actions | Tests existants | Blocages initiaux |
|---|---|---|---|---|---|---|
| OpenAI (+ Anthropic alternatif) | REST, abstraction, fallback NEXUS Engine | Absents | Sans objet | Non vérifiés | Mocks dans suites agent | HUMAN BLOCKER clé/modèle + Supabase ; santé verte sur simple présence de clé ; usage/coûts incomplets |
| Gmail | Registre + OAuth générique + tables | Absents | Routes communes présentes, pas configurées | Non vérifiés ; aucun adapter données/action | Contrats génériques | HUMAN BLOCKER client Google/consentement ; adapter absent, scopes write anticipés |
| Google Calendar | Seul adapter de lecture ; événements normalisés, conflits/créneaux purs | Absents | Routes communes présentes, pas configurées | Non vérifiés ; sync manuelle limitée à 50 événements ; pas de branchement Intelligence | Transport mocké | HUMAN BLOCKER ; refresh absent, pagination absente, disponibilité incomplète |
| GitHub | Registre + OAuth générique | Absents (GH_TOKEN sandbox n'est pas une connexion app) | Routes présentes | Non vérifiés ; aucun adapter | Exchange mocké | HUMAN BLOCKER ; adapter absent, scope repo large |
| Notion | Registre + OAuth générique | Absents | Routes présentes ; échange générique form incompatible avec format spécifique attendu | Non vérifiés ; aucun adapter | Absence de configuration testée | HUMAN BLOCKER ; adapter absent, protocole à corriger |
| Slack | Registre + OAuth générique | Absents | Routes présentes ; chemin bot_access_token et scope search à revoir | Non vérifiés ; aucun adapter | Erreur HTTP 200 mockée | HUMAN BLOCKER ; adapter absent, distinction bot/user absente |
| Linear | Registre + OAuth générique | Absents | Routes présentes ; scopes issues:* suspects, à valider fournisseur | Non vérifiés ; aucun adapter | Contrat registre | HUMAN BLOCKER ; adapter absent |
| Drive / Outlook / Teams / Jira | Registre phase 2 + OAuth générique | Absents | Routes communes seulement | Non vérifiés ; aucun adapter | Contrats génériques | HUMAN BLOCKER + implémentation fournisseur manquante |
| Documents | Upload/download/delete Supabase, métadonnées | Supabase absent | Sans objet | Aucun upload réel vérifié ; extraction/chunk/index/OCR absents | Structure/SQL limites | HUMAN BLOCKER Supabase ; pipeline documentaire absent |
| Billing | Plans, abonnements SQL/RLS, interface provider interchangeable | Aucun adapter choisi/configuré | Sans objet | Checkout 501 ; aucun paiement | Unitaires + SQL hermétiques | Implémentation provider/webhooks/ledger absente avant même les credentials |
| Webhooks | Enum automation + interface billing | Absente | Aucune route webhook | Aucun envoi/réception vérifié | Contrats d'interface seulement | Architecture exécutable manquante |
| Thèmes | Palette sombre + tokens sémantiques | Dark statique | Sans objet | Light/System absents | Tests structure visuelle | Pas de gestionnaire de thème |

## Constats prioritaires avant modification

1. `src/lib/admin/health.ts` : AI = operational si clé présente, sans appel provider.
2. `src/lib/integrations/connections.ts` : `last_sync_at` avancé après échec, erreurs de DB ignorées, scopes demandés présentés comme accordés, état connected écrit avant credentials.
3. Callback OAuth : nonce cookie non lié à user/workspace/provider, pas PKCE ; workspace recalculé au retour ; messages externes recopiés dans URL.
4. `integration_credentials` / `integration_sync_runs` : FK connection et workspace indépendantes. RLS par workspace, sans invariant relationnel entre les deux. Tous les membres peuvent écrire des états/audits ; ce ne sont pas des preuves infalsifiables d'une opération serveur.
5. Chiffrement AES-GCM existant, sans AAD liant token et contexte, ni rotation versionnée ; ciphertext accessible via REST aux membres. Pas d'isolation personnelle au sein d'un même workspace : modèle partagé.
6. Fonctions SECURITY DEFINER workers 005 : pas de révocations trouvées pour les RPC de consommation/mutation de queue ; même risque à examiner sur helpers AI/automations anciens.
7. UI intégrations : notice connected basée sur query string ; absence de reconnect ; sync offerte aux adapters absents ; affirme consommation Intelligence inexistante.
8. `api/intelligence/query` : charge NEXUS tasks/projects/goals/activities/dependencies/notes/events, pas providers externes ni documents. `context-builder` compactPrompt surtout projets/tâches/objectifs. Sources LLM insuffisamment vérifiées.
9. IA : colonnes tokens présentes, non remplies ; coût absent ; request log best effort non attendu et status toujours ok ; timeout fetch ne couvre pas nécessairement le body.
10. Fichiers : limite client 10 MiB, bucket/SQL 50 MiB ; suppression storage ignorée après suppression metadata ; pas antivirus/MIME serveur/OCR/parseur.
11. Modal : Escape et focus initial présents, mais pas de confinement Tab. Couleur admin text-3 et muted à mesurer. Pas de preuve WCAG 2.2 AA.
12. Privacy : promesses de suppression via Settings et backup 30 jours non corroborées par infrastructure observée. Validation juridique humaine indispensable.

## Décision de correction

Corrections additives et ciblées : statut vérifiable, sécurité OAuth, exactitude des runs et lecture Calendar, invariants SQL/RPC, exposition honnête dans Admin/UI, tests hermétiques. Ne pas inventer neuf adapters, un paiement, un pipeline documentaire ou une conformité globale. Les travaux restant à construire seront explicitement conservés comme blocages, et non renommés READY/CONNECTED/PRODUCTION READY.
