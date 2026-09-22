# NEXUS — audit global international et corrections

**22 septembre 2026 · branche `arena/01a0cab9-nexus-app`**
Rapport de la mission élargie, à lire avec les preuves dans `docs/audit-2026-09-22/`. Le rapport `NEXUS_AUDIT_FINAL_2026-09-22.md` décrit la tranche précédente et reste un historique, pas l'état final de cette mission.

## 1. Verdict et périmètre réellement atteint

**Fondations renforcées ; mission partiellement réalisée ; NEXUS n'est pas déclaré PRODUCTION_READY.** Les 37 phases demandées ne sont pas toutes terminées. Le code livré couvre des fondations internationales, un transport Stripe non activé, des contrôles privacy limités, des corrections IA/dates, Dark/Light/System et un dossier légal/UX. Les intégrations complètes, le pipeline documentaire, la facturation transactionnelle et les budgets/observabilité IA complets restent des travaux de développement, pas de simples secrets manquants.

Aucun commit, push, merge de PR, déploiement, migration distante, paiement, OAuth réel ou purge de données réelles effectué. La décision de merge reste à l'utilisateur.

## 2. Méthode et audit préalable

Architecture Next 16.3.5 / React 19 / Supabase conservée. Lecture des instructions du dépôt, documentation Next installée, routes/layout/settings, contrats billing/entitlements, Calendar/tasks, mémoire/query IA, RLS, stockage local, textes légaux, puis `GLOBAL_AUDIT_INITIAL.md` avant nouveaux edits. Inventaire antérieur conservé ; inventaire cumulatif et hashes des **41 migrations présentes** dans `global-change-inventory.md`.

États distincts : NOT_IMPLEMENTED, IMPLEMENTED, CONFIGURED, READY, CONNECTED, SYNCING, VERIFIED, PRODUCTION_READY, HUMAN_ACTION_REQUIRED, LEGAL_REVIEW_REQUIRED. Une vérification locale est toujours qualifiée ; elle ne vaut pas connexion fournisseur ou preuve de production. Production inaccessible : **HUMAN VERIFICATION REQUIRED**.

## 3. Ce qui fonctionne avec preuve locale

- Compilation, type-check, lint et suite `npm test` complets, après réinstallation des dépendances.
- Helpers monnaie/fuseaux/contexte et règles de refus billing : tests exécutés.
- RLS owner des préférences et mémoire, suppression propre au user, révocation membre, ACL et limites de purge : vraie exécution SQL PGlite, pas Supabase hébergé.
- SDK Stripe : calcul/vérification HMAC réels sur fixtures hermétiques ; méthodes de transport testées avec doublures sans réseau. Pas de charge réelle.
- Pages publiques : Dark/Light rendus, sélection/persistance du thème et changement système mesurés dans Chromium ; contrôles HTTP non configurés mesurés.

Cela ne prouve pas les parcours authentifiés sur une base réelle.

## 4. Implémenté seulement, sans validation live

Préférences régionales GET/PUT et UI ; mémoire GET/DELETE et export partiel ; provenance timezone des événements ; transport Stripe neuf méthodes ; state machine et frontière de store financier ; nouvelle migration ; job de purge opérateur. Les API privées ont été vérifiées en refus non configuré, et leurs frontières unitaires/SQL testées, mais pas le parcours de succès avec une session Supabase réelle.

Le modèle `WorkspaceRegionalContext` existe en TypeScript seulement : stockage/édition administrative des champs légaux workspace non livrés. La façade entitlements nommée existe, mais les futures features non approuvées restent à false ; elle ne remplace pas les guards SQL existants et n'est pas une nouvelle offre commerciale.

## 5. Configuré n'est pas connecté

Noms d'environnement, registry OAuth, callbacks, SDK et pages sont présents. Les secrets applicatifs requis ne sont pas disponibles/vérifiés dans ce sandbox. **CONFIGURATION EXPECTED**, pas « CONFIGURED en production ». Aucun paramètre Stripe ne déclenche automatiquement un checkout. Les réglages APDP, DPA et éligibilité marchande ne sont pas des variables techniques pouvant être devinées.

## 6. Connexions réellement constatées

**Aucune connexion applicative externe réellement vérifiée** : ni OpenAI/Anthropic, ni les six services OAuth, ni stockage Supabase réel, ni paiement. Le moteur NEXUS local n'est pas une connexion OpenAI. Le précédent relevé de métadonnées d'un déploiement réussi ne prouve pas le fonctionnement de l'app : l'URL consultée était protégée par Vercel SSO.

## 7. Ce qui demeure invérifiable

- **REAL-WORLD VERIFICATION BLOCKED: absence de configuration Supabase réelle, comptes de test et accès au déploiement.** Auth/RLS/Storage/UI hébergés et nouvelles migrations non attestés.
- **REAL-WORLD VERIFICATION BLOCKED: absence de clés de projets IA autorisés et modèles validés.** Réponses, latence, tokens/coûts réels non mesurés.
- **REAL-WORLD VERIFICATION BLOCKED: absence d'apps OAuth configurées, consentements utilisateurs et comptes de test.** Callbacks/granted scopes/refresh/données réels non attestés ; plusieurs fonctionnalités manquent aussi dans le code.
- **REAL-WORLD VERIFICATION BLOCKED: aucun compte marchand éligible vérifié, aucun prix approuvé et aucun processor webhook transactionnel.** Des clés seules ne résoudront pas ce blocage.
- Retention cron, sauvegardes, DPA, formalités APDP, accessibilité authentifiée et réponse aux droits : **HUMAN VERIFICATION REQUIRED**.

## 8. Internationalisation et contexte

Ajout `src/lib/global/{country,locale,currency,timezone,formatting,regional-policy,payment-availability,integration-availability,context}.ts`.

User : country nullable, locale, timezone IANA, currency, dateFormat, numberFormat, weekStart, measurementSystem. Workspace : champs distincts workspaceCountry/Locale/Timezone/Currency au niveau modèle. Le helper de voyage ne modifie jamais le pays légal workspace. Douze pays de préférence et huit locales proposés ; ce n'est pas une couverture mondiale exhaustive ni une matrice d'éligibilité marchande.

`/settings/regional` sauvegarde les préférences de l'utilisateur et affiche un exemple. **Adoption des préférences dans toutes les pages non réalisée**, root lang encore en, traduction complète non livrée, onboarding EN/FR existant conservé. La page le dit explicitement. Aucune géolocalisation ou conversion automatique du pays légal.

## 9. Fuseaux et dates

Temporal polyfill : instants avec offset/Z obligatoires, date-only distincte, rejet DST des heures ambiguës et inexistantes par défaut, désambiguïsation explicite possible dans le helper, bornes de journée 23/24/25 heures.

Tests Cotonou (`Africa/Porto-Novo`), Paris, New York, Tokyo ; transitions mars/octobre/novembre 2026. Calendar remplace les additions de jours en 86 400 000 ms par des jours civils ; valide avant de passer en état saving ; conserve `source_timezone` pour les nouveaux enregistrements/modifications. Les instants existants restent inchangés, ancienne timezone source inconnue/null. L'UI précise « browser timezone » ; elle n'applique pas encore la préférence régionale sauvegardée.

Affichage du champ de date des tâches stabilisé sur UTC pour éviter le décalage du jour saisi. **Reste** : clarifier civil date vs instant dans les anciennes tâches, harmoniser filtres today/overdue et tous reminders/automations/missions/notifications/sync/audit. Aucun constat de cohérence UTC globale automatique.

## 10. Devises et catalogue

Formatage Intl de XOF/EUR/USD/GBP/NGN/GHS/JPY, exposants mineurs 0 ou 2, refus montants non entiers sûrs/devise inconnue. Les exemples ne sont pas des cours FX.

Prix USD 19/49 antérieurement affichés déplacés dans `pricing-catalog.ts` comme **draft non approuvés** avec intervalle, taxe, fournisseur, dates d'effet et prix provider. La sélection commerciale exige approbation, période, devise, fournisseur, prix unique et taxe revue ; aucun prix régional synthétisé. Remise annuelle 25 % et assertion d'unité par utilisateur retirées ; boutons marketing renommés pour comparer, pas démarrer un paiement. Les prix payants billing restent non activés.

## 11. Billing, états, entitlements et webhooks

- Contrat neuf opérations : createCustomer/createCheckout/createSubscription/cancelSubscription/updateSubscription/getSubscription/getInvoice/refund/verifyWebhook.
- Stripe `server-only`, SDK officiel, timeout/retry bornés, clés d'idempotence transport, URLs retour same-origin, metadata transaction, création incomplete, upgrade pending_if_incomplete, refund montant/devise vérifiés.
- Normalisation payment.succeeded/failed, subscription.created/updated/cancelled, invoice.paid/failed ; signature raw bytes, tolérance 300 s, refus mélange live/test. checkout.session.completed ne prouve pas un paiement.
- Kkiapay/FedaPay : **NOT_IMPLEMENTED** ; registry de disponibilité seulement, pas de faux adapter.
- FREE/TRIALING/CHECKOUT/PAYMENT_PENDING/ACTIVE/PAST_DUE/PAYMENT_FAILED/CANCELLED/EXPIRED : state machine **pure, non persistée et non branchée au lifecycle SQL existant**. Aucun nouveau droit payé par frontend.
- `/plans`, `/billing`, `/billing/checkout`, `/billing/payment-required`, `/billing/payment-pending`, `/billing/payment-failed`, `/billing/success`, `/billing/cancel` existent ; alias de comparaison/billing ou pages d'état honnêtes, pas un checkout opérationnel. Une URL success affiche « Payment not verified ».
- **Non livré** : endpoint webhook, stockage durable event/ledger, unique provider/event, corrélation complète, transaction atomique entitlements, ordre/replay/retries/reconciliation/audit. `BillingEventStore` est une interface, pas une implémentation. Les anciens guards fail-closed sont conservés.

## 12. IA, supervision et vérité des réponses

Suppression du cache localStorage IA non isolé et de sa restauration côté serveur ; état navigateur limité au composant monté, remount à changement de workspace. Une requête ne reprend que la mémoire serveur user/workspace. Notice IA visible et liée au textarea ; explication fournisseurs/fallback/erreurs possibles.

Création classée medium ; modification/clôture/déplacement/suppression high ; lecture/navigation low. Toute mutation continue d'exiger confirmed avant DB ; suppression exige confirmDeletion. Tests historiques de classification actualisés et tests de refus avant accès DB ajoutés. Preview UI existante, mais liaison signée preview/payload/version/expiration et consommation unique absentes.

OpenAI/Anthropic/fallback existants conservés. Coûts/tokens fiables, quotas par user/workspace/plan/provider, tests live, traçage exhaustif et politique de modèles régionale **non réalisés**. Les références viennent des objets chargés, pas d'une garantie que chaque phrase est factuellement vérifiée.

## 13. Documents

Stockage privé + métadonnées + limite taille/fichiers/permissions existants. **Pas de pipeline complet PDF/DOCX/TXT/MD/CSV/XLSX/images** : extraction, OCR, structuration, chunks, index, retrieval ACL, citations pages/cellules, analyses et purge des dérivés restent absents. Aucun fichier intégral n'a été envoyé à un provider pour simuler l'analyse. Architecture et limites documentées dans `GLOBAL_DOCUMENTS_OBSERVABILITY.md`.

## 14. Six intégrations et scénario retour de vacances

Audit **20 points × 6 providers** : `GLOBAL_INTEGRATIONS_AUDIT.md`. OAuth commun et Calendar read adapter hérités ; Gmail/GitHub/Notion/Slack/Linear data adapters, refresh/revoke distant et orchestration complète manquent. Google demande seulement gmail.readonly ou calendar.readonly ; GitHub repo reste large et doit être revu.

Sept états existants distingués : disconnected, connecting, connected, syncing, stale, error, reauth_required. Aucun état connected/syncing créé artificiellement. Normalisation/provenance/fraîcheur sont partielles ; permissions et graphe transversal non terminés. Scénario vacances testé localement sur NEXUS seulement dans les suites héritées ; **aucune synthèse multi-fournisseurs réelle démontrée**.

## 15. UX et microcopy

`GLOBAL_UX_AUDIT.md` documente quinze lois avec composant, problème, justification, correction/reste et impact attendu. `UX_WRITING.md` fixe les différences entre proposal/saved/verified, configured/connected, erreur/vide, export mémoire/export total, retour paiement/preuve.

Corrections concrètes : settings séparés, aperçu mémoire repliable, checkbox de suppression explicite, erreurs actionnables, catalogue draft visible, faux succès paiement interdit, suppression de « Most Popular » non mesuré, précision du timezone. Les améliorations attendues ne sont pas présentées comme métriques d'usage mesurées.

## 16. Accessibilité et thèmes

Dark/Light/System avec bootstrap avant paint, synchronisation aux changements OS, persistance locale et tokens surface/texte/bordure/états/chart/admin. Contraste du bouton admin light corrigé par un foreground sémantique, étendu aux pages reset/forgot-password.

**16 checks Chromium/axe** : /login, /pricing, /privacy, /admin/login × 1440/390 px × Dark/Light ; **0 violation automatique, 0 overflow** après corrections. Les scans ont été réexécutés après correction du blocage HMR qui empêchait l'hydratation locale. Sept assertions d'interaction passent : Light, reload, System dark, bascule OS light, focus clavier, retrait remise non approuvée, redirection privacy non authentifiée.

Incompletes color-contrast subsistent : Dark login 10/9, pricing 55/14, privacy 28/3 ; Light login 10/10, pricing 55/14, privacy 27/2 (desktop/mobile). Admin login 0 incomplete. **WCAG2.2AA non certifiée** : chart/AI/app/billing/admin authentifiés, lecteurs d'écran, contrastes non déterminés, langues, zoom et toutes modales nécessitent revue réelle.

## 17. Privacy, données et conservation

`/settings/privacy` : lecture/export JSON/suppression **de sa mémoire du workspace actif uniquement**. No-store, auth/membership/RLS, contrôle Origin/Host sans confiance en x-forwarded-host, JSON ≤4 KiB, confirmation et liaison au workspace prévisualisé. Pas d'export complet, suppression compte, traitement opposition/restriction ou désactivation durable de la mémoire.

Mémoire inactive >90 j exclue des lectures IA ; RPC de purge batch 1000 service_role-only + lanceur opérateur `scripts/purge-inactive-memory.mjs`. Test SQL effectif ; appel distant et scheduling **non effectués**. Sans `--execute`, script vérifié sans suppression. La politique est une proposition technique à valider, pas une durée légale universelle.

Limites explicites : requêtes IA déjà en vol peuvent recréer la mémoire ; anciens appareils peuvent garder l'ancienne clé jusqu'à ouverture/effacement ; logs, ai_memories historique, Storage, fournisseurs et backups hors périmètre de cette purge.

## 18. Légal et international

Sept documents livrés : `docs/legal/{PRIVACY,DATA_MAP,RETENTION,AI_TRANSPARENCY,THIRD_PARTY_PROCESSORS,BILLING_COMPLIANCE,COOKIE_POLICY}.md`.

Sources officielles APDP, Stripe, Commission européenne consultées, avec URLs/dates dans les documents. Stripe Global consulté intégralement : aucune inférence d'éligibilité marchande béninoise depuis pays du client ou Connect payouts. APDP : formalités et principes à faire déterminer pour les traitements réels. RGPD : analyse de portée et de rôle conditionnelle. AI Act article 50 : information interaction, marquage et certains disclosures à distinguer ; application depuis 2 août 2026 et cas limités à examiner, pas « toute l'IA conforme ».

Pages publiques averties comme brouillons ; promesses non prouvées de suppression globale immédiate, backups 30 jours, DPA signés et absence de transfert sur timeout corrigées. **Identité légale/contact/contrats/formalités non validés ; LEGAL_REVIEW_REQUIRED.** Pas de consent banner factice : pas de transport analytics/marketing trouvé ; toute future activation doit avoir son gating approprié.

## 19. Sécurité et observabilité

`SECURITY.md` distingue protections et blockers. Corrections privacy/CSRF/cache, server-only Stripe, RLS/ACL purge, restrictions de thème et preview ajoutées sans désactiver la protection frame production. `allowedDevOrigins` inclut le preview et localhost/127.0.0.1 pour permettre l'hydratation/HMR du navigateur d'audit.

**Risque majeur hérité non résolu :** tables de credentials/statuts/runs/logs modifiables par membres, donc pas encore source d'audit autoritaire. Uniformité rate limits/CSRF, CSP, scans fichiers, validation origines auth derrière proxy, budgets IA, requestId/correlationId généralisés et monitoring opérationnel restent à faire. La migration précédente réduit des risques FK/ACL mais n'établit pas une isolation complète certifiée.

## 20. Livrables, fichiers, routes, migrations et dépendances

Inventaire exhaustif **cumulatif** : `global-change-inventory.md` (inclut travaux non committés de la tranche précédente, pas uniquement cette mission).

Principaux ajouts : global/* ; billing/{payment-contract,pricing-catalog,state-machine,webhook-processing,adapters,entitlements} ; privacy/request ; theme/* ; composants privacy/regional/theme ; API settings ; routes billing/plans/settings ; documents légaux/UX/sécurité et tests.

Principaux edits : layout/globals/footer, landing pricing, billing provider/plans, Calendar/tasks, intelligence ask/view/query/memory/intent/actions/tools, Settings, pages public privacy/cookies/legal layout, admin auth boutons, next.config, fixtures et assertions de tests devenues obsolètes.

Nouvelle migration de cette mission : **`20260922220000_global_preferences_retention.sql`** — events.source_timezone nullable, user_regional_preferences RLS, index et purge service-role. Migration précédente conservée **`20260922210000_nexus_audit_hardening.sql`** — durcissement intégrations/ACL/télémétrie. Toutes deux uniquement vérifiées localement ; aucune application distante. Installer après revue avant d'utiliser Calendar écritures/préférences sur staging.

Dépendances ajoutées : `@js-temporal/polyfill`, `stripe`, `server-only`, lockfile actualisé. Aucun binaire navigateur ou dataset massif ajouté au dépôt. Aucun provider automatiquement activé.

## 21. Tests exécutés et résultats exacts

Dernière séquence après modifications du code :

| Commande | Résultat |
|---|---|
| npm ci | exit 0 ; audit npm de l'installation : 0 vulnérabilité signalée |
| npm run lint | exit 0 ; 0 erreur, 21 warnings |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0 |
| npm test | exit 0, suites existantes + test:global |
| git diff --check | exit 0 |

Nouvelles suites : **36 global-product + 14 stripe-transport + 1 SQL global-privacy-rls = 51 tests réussis**. Test SQL inclut refus cross-user même workspace, changement propriétaire refusé, suspension membre, ACL anon/auth/service, 1002 mémoires anciennes purgées en lots 1000 puis 2, mémoire récente conservée. Ce sont des données synthétiques locales.

Hérités : audit intégrations 20 pass / 29 skip explicitement providers non implémentés ; SQL intégrations 1 pass. Suite extra admin-auth-contract rerun : 25 pass. Tous les tests ne suivent pas un compteur global uniforme ; ne pas additionner des assertions console à des TAP comme s'il s'agissait du même métrique.

**Six suites hors npm test réexécutées, toujours exit 1** : auth-workspace-bootstrap, core-contract, lineage-reconciliation, migration-logic, onboarding-rls, workspace-bootstrap. Fixtures pgcrypto/Storage/types/helpers manquants puis cascades d'échec. Pas de preuve baseline propre pour attribuer tous ces défauts à l'antériorité ; ils restent visibles, non convertis en skips. Voir `global-extra-tests.json`.

Non exécutés : harness HTTP auth-flow dédié (fixture/stub distinct non monté, pas un HUMAN BLOCKER de credentials), screen reader, test complet authentifié, sandbox/live OAuth/providers/paiement, DB/Storage hébergés. Signatures Stripe : tests hermétiques uniquement. Smoke : API privacy/regional 503 non configurées, cross-origin delete 403, JSON régional invalide 400, billing upgrade 503, health 200 **avec supabaseConfigured:false** — pas une preuve de santé fonctionnelle.

Preuves persistées : `global-final-commands.json`, `global-test-results.md`, `global-accessibility-public-pages.json`, `global-browser-interactions.json`, `global-http-smoke.json`, `global-extra-tests.json`. Le serveur temporaire de test a été arrêté.

## 22. Risques, priorités et travail restant

**P0 avant utilisateurs/données/paiements réels** : renforcer ACL credentials/status/audit ; compléter ledger/webhooks/corrélation atomique ; valider identité/contrats/éligibilité/obligations légales ; appliquer et vérifier migrations en staging ; tests isolation/auth/storage réels.

**P1** : refresh/revoke + adapters six sources ; pipeline documents ; budget/usage/coût IA et rate limits distribués ; politique d'effacement atomique et droits complets ; contexte légal workspace persistant et adoption régionale sur tous les domaines ; revue authentifiée a11y des deux thèmes.

**P2** : i18n complète, tax/FX informatif séparé des prix, observabilité cross-service et alertes, purge des autres familles de données, accessibilité manuelle exhaustive. Aucun élément de cette liste n'est déclaré terminé par un fichier d'interface ou de documentation.

## 23. HUMAN ACTION REQUIRED — procédures exactes

Ne transmettre aucun secret dans le chat, Git ou une capture. Utiliser des comptes et données de staging ; aucun achat réel sans décision explicite.

### H1 — Environnement, auth et migrations
- **Where:** Supabase staging → Settings/API et Auth/URL Configuration ; hébergeur → environnement serveur staging.
- **What to create:** projet de test, deux comptes et deux workspaces ; sauvegarde et plan d'application de la lineage ; domaine HTTPS canonique.
- **What credential:** URL/public publishable key, clé de chiffrement intégrations de 32 octets générée de manière sûre ; permissions opérateur DB.
- **Where to put it:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL, NEXUS_INTEGRATION_ENCRYPTION_KEY dans gestionnaire d'environnement, jamais clé de chiffrement NEXT_PUBLIC ; .env.local ignoré pour local.
- **How to verify:** health, auth/email/reset, migrations comparées puis appliquées après revue, RLS deux users, source_timezone, prefs, endpoints privacy ; reconnecter tokens legacy incompatibles.
- **What LM Arena can test afterward:** CRUD régional/mémoire authentifié, refus cross-tenant, upload/download/delete, parcours et rôles réels sur staging.

### H2 — OpenAI et/ou Anthropic
- **Where:** console officielle du fournisseur, projet dédié NEXUS staging.
- **What to create:** projet, clé restreinte, budget opérateur, liste de modèles accessibles et politique de données approuvée.
- **What credential:** API key réelle et identifiant modèle autorisé du fournisseur choisi.
- **Where to put it:** OPENAI_API_KEY/OPENAI_MODEL ou ANTHROPIC_API_KEY/ANTHROPIC_MODEL, serveur uniquement.
- **How to verify:** question synthétique non sensible, statut/latence réels, refus/budget/fallback ; vérifier compte/contrat/retention/transferts. OpenAI prioritaire si les deux clés présentes.
- **What LM Arena can test afterward:** comportement provider réel et fallback ; le budget applicatif multidimensionnel/coût détaillé exige encore du développement.

### H3 — Gmail et Calendar
- **Where:** Google Cloud Console → projet, APIs, OAuth consent screen et OAuth client Web.
- **What to create:** client de staging, utilisateurs de test, APIs Gmail/Calendar et consent screen avec scopes lecture seuls actuellement utilisés.
- **What credential:** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ; consentement interactif du propriétaire du compte.
- **Where to put it:** secrets serveur et redirects exacts `${NEXT_PUBLIC_SITE_URL}/api/integrations/callback/gmail` et `/google-calendar`.
- **How to verify:** state/callback, refus de consentement, scopes réellement accordés ; tester événements synthétiques, pagination et timezone. Vérification Google si nécessaire avant diffusion.
- **What LM Arena can test afterward:** OAuth réel et Calendar read ; Gmail data adapter, refresh/revoke et écritures restent à développer.

### H4 — GitHub
- **Where:** GitHub → Settings/Developer settings → application OAuth de staging.
- **What to create:** app et organisation/dépôt de test ; revoir le scope repo large et l'option GitHub App avant prod.
- **What credential:** GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET ; autorisation organisation/utilisateur si requise.
- **Where to put it:** serveur ; callback `${NEXT_PUBLIC_SITE_URL}/api/integrations/callback/github`.
- **How to verify:** origine, consentement réel et permissions accordées, jamais assimiler repo à read-only.
- **What LM Arena can test afterward:** OAuth/callback réel ; lecture/sync/actions dépôt nécessitent encore l'adapter.

### H5 — Notion
- **Where:** Notion → console des intégrations → intégration OAuth de staging.
- **What to create:** intégration, capabilities lecture et pages de test explicitement partagées.
- **What credential:** NOTION_CLIENT_ID/NOTION_CLIENT_SECRET, consentement et partage réels.
- **Where to put it:** serveur ; callback `${NEXT_PUBLIC_SITE_URL}/api/integrations/callback/notion`.
- **How to verify:** échange Basic+JSON, workspace autorisé, pages effectivement accessibles et restrictions.
- **What LM Arena can test afterward:** OAuth réel ; extraction/lecture/index Notion non implémentés à compléter.

### H6 — Slack
- **Where:** Slack API → application de test, OAuth & Permissions.
- **What to create:** app, workspace/channels de test, scopes de lecture actuellement déclarés et installation approuvée.
- **What credential:** SLACK_CLIENT_ID/SLACK_CLIENT_SECRET ; consentement admin/utilisateur selon workspace.
- **Where to put it:** serveur ; callback `${NEXT_PUBLIC_SITE_URL}/api/integrations/callback/slack`.
- **How to verify:** consentement, token bot top-level, handling ok:false, scopes réels ; ne pas demander chat:write pour une feature absente.
- **What LM Arena can test afterward:** OAuth réel ; conversations/thread search et send restent non implémentés.

### H7 — Linear
- **Where:** Linear → Settings/API → application OAuth de staging.
- **What to create:** client, workspace/issues de test, scope read et redirect exact.
- **What credential:** LINEAR_CLIENT_ID/LINEAR_CLIENT_SECRET ; consentement du compte.
- **Where to put it:** serveur ; callback `${NEXT_PUBLIC_SITE_URL}/api/integrations/callback/linear`.
- **How to verify:** PKCE/échange/scopes réels et durée token ; expiration ne doit pas être masquée par un statut connected ancien.
- **What LM Arena can test afterward:** OAuth réel ; adapter issues, refresh/revoke et sync à construire.

### H8 — Paiements, entité marchande et prix
- **Where:** conseil juridique/comptable, console commerciale Stripe ou Kkiapay/FedaPay et support fournisseur.
- **What to create:** validation écrite d'éligibilité de l'entité réelle, compte sandbox approuvé, catalogue/unité/taxe/conditions/annulation ; équipe de développement pour ledger/webhooks avant activation.
- **What credential:** clés de test et secret de signature de l'endpoint une fois celui-ci réellement construit ; jamais clé réelle inventée ou pays marchand falsifié.
- **Where to put it:** secret manager serveur. Le transport reçoit explicitement secretKey/webhookSecret/siteOrigin/expectedLiveMode ; **aucun env flag actuel ne l'active**. Ne pas prétendre qu'un endpoint webhook existe déjà.
- **How to verify:** revue pays/entité séparée du client/devise, reçus sandbox, signatures/replay/duplicates/hors ordre/retries/refund/annulation et transaction SQL de droits ; pas de double paiement sur timeout.
- **What LM Arena can test afterward:** parcours sandbox seulement après développement du processor et consentement ; Kkiapay/FedaPay nécessitent leur adapter complet.

### H9 — Juridique, APDP, droits et AI Act
- **Where:** dirigeant/responsable de traitement, conseil compétent, APDP (portail officiel service.apdp.bj), responsables contrats fournisseurs.
- **What to create:** identité/contact vérifiés, registre traitements/transferts, qualification responsable/sous-traitant, bases et durées, formalités applicables, DPA, analyse territoriale RGPD/AI Act et processus droits/incidents.
- **What credential:** aucun secret technique ; habilitation légale, documents signés et justificatifs officiels pertinents, pas une certification inventée.
- **Where to put it:** coffre documentaire interne ; publier uniquement les mentions validées, remplacer placeholders et définir un canal confidentiel surveillé.
- **How to verify:** approbation juridique écrite, preuves de formalités si applicables, exercice d'une demande fictive et analyse des obligations art50 par rôle/sortie.
- **What LM Arena can test afterward:** cohérence technique/texte, visibilité des notices et workflow implémenté ; pas délivrer un avis ou certificat de conformité.

### H10 — Retention et sauvegardes
- **Where:** Supabase staging et scheduler sécurisé choisi par l'opérateur.
- **What to create:** validation règle 90 j, job quotidien, supervision du backlog/échecs et runbook sauvegarde/restauration.
- **What credential:** service_role dédié au job selon capacités de la plateforme et URL Supabase réelle ; restreindre l'accès au secret.
- **Where to put it:** SUPABASE_SERVICE_ROLE_KEY et SUPABASE_URL dans secrets du scheduler ; invoquer le script avec --execute uniquement après revue. Jamais dans navigateur.
- **How to verify:** données synthétiques ancienne/récente, suppression bornée et conservation récente, refus auth/anon, alertes, régions/durées réelles backups ; étendre jobs autres données séparément.
- **What LM Arena can test afterward:** job staging, droits, compte et reprise ; pas prouver les suppressions provider/backups sans accès et journaux autorisés.

### H11 — Accès de validation, UX/a11y et fonctionnalités restantes
- **Where:** staging et environnement de tests ; produit, QA, sécurité, accessibilité.
- **What to create:** jeux synthétiques autorisés, comptes owner/admin/member/viewer, fixtures auth HTTP complètes, matrice clavier/screen reader/themes/langues et backlog documents/intégrations/budgets.
- **What credential:** comptes de test gérés via canaux sûrs et autorisation d'accès au déploiement protégé ; aucun mot de passe dans chat/Git.
- **Where to put it:** gestionnaire de secrets / provisioning des tests ; règles d'accès au déploiement administrées par propriétaire.
- **How to verify:** parcours réels dans deux workspaces, erreurs/timeouts, preview modifiée, révocation et suppression en concurrence, contrastes incomplets, états billing, restauration, six harnesses SQL réparés.
- **What LM Arena can test afterward:** E2E staging et correctifs sur preuve ; aucune activation/merge automatique ni promesse d'achever des adapters absents par configuration seule.

## 24. Matrice finale et décision

**Portée de Verified :** les mentions « local » ne signifient jamais provider live ni déploiement vérifié. « Non attesté » ne déduit pas l'état d'un environnement distant inaccessible. Tous les PRODUCTION_READY restent refusés faute de chaîne complète de preuves.

| Feature | Code | Config | Credentials | Connected | Verified | Production Ready | Human Action |
|---|---|---|---|---|---|---|---|
| OpenAI | IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Local/fallback seulement | Non | H1 H2 H9 |
| Gmail | IMPLEMENTED OAuth ; data NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Contrats locaux seulement | Non | H1 H3 + adapter |
| Calendar | IMPLEMENTED OAuth/read | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Local adapter/DST ; pas live | Non | H1 H3 + refresh/revoke |
| GitHub | IMPLEMENTED OAuth ; data NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Contrats locaux seulement | Non | H1 H4 + adapter/scopes |
| Notion | IMPLEMENTED OAuth ; data NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Contrats locaux seulement | Non | H1 H5 + adapter |
| Slack | IMPLEMENTED OAuth ; data NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Contrats locaux seulement | Non | H1 H6 + adapter |
| Linear | IMPLEMENTED OAuth ; data NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Contrats locaux seulement | Non | H1 H7 + adapter |
| Documents | IMPLEMENTED stockage ; analyse NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER Supabase | Non attesté | Contrats locaux ; pas upload réel | Non | H1 H9 H11 + pipeline |
| Stripe | IMPLEMENTED transport serveur | Activation bloquée | HUMAN BLOCKER | Non attesté | SDK/fixtures locaux ; pas paiement | Non | H8 + ledger/processor |
| Kkiapay | NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Non | Non | H8 + adapter |
| FedaPay | NOT_IMPLEMENTED | CONFIGURATION EXPECTED | HUMAN BLOCKER | Non attesté | Non | Non | H8 + adapter |
| Webhooks | IMPLEMENTED signature/contrat ; processor NOT_IMPLEMENTED | Pas d'endpoint actif | HUMAN BLOCKER | Non attesté | HMAC raw bytes local ; pas event réel | Non | H8 + store atomique |
| Privacy | IMPLEMENTED contrôles mémoire limités | Migration attendue | HUMAN BLOCKER pour E2E | Non attesté en DB distante | SQL local + refus HTTP | Non | H1 H9 H10 H11 |
| AI Transparency | IMPLEMENTED notice/docs | LEGAL_REVIEW_REQUIRED | Sans objet pour notice | Sans objet | Code/contrats locaux ; pas conformité art50 | Non | H9 H11 |
| Accessibility | IMPLEMENTED partiel | HUMAN VERIFICATION REQUIRED | Comptes QA requis | Sans objet | 16 scans publics ; incompletes persistants | Non | H11 |
| Dark Theme | IMPLEMENTED | Défaut local | Sans objet | Sans objet | 8 scans publics locaux | Non | H11 surfaces authentifiées |
| Light Theme | IMPLEMENTED + System | Préférence navigateur | Sans objet | Sans objet | 8 scans publics + interactions | Non | H11 surfaces authentifiées |
| Internationalization | IMPLEMENTED fondations/préférences | Migration/adoption attendues | Supabase pour persistance | Non attesté | Helpers/SQL locaux ; UI non traduite partout | Non | H1 H9 H11 + adoption |
| Timezones | IMPLEMENTED helpers/Calendar partiel | Browser zone ; préférence non généralisée | Sans objet pour helpers | Sans objet | 4 zones + DST locaux | Non | H1 H11 + tous domaines |
| Currency | IMPLEMENTED 7 devises/catalogue draft | Prix/taxes non approuvés | HUMAN BLOCKER paiements | Non attesté | Formatage minor-unit local | Non | H8 H9 + catalogue validé |

**Décision recommandée :** revue de code et staging contrôlé, pas lancement public ni encaissement. Commencer par P0 sécurité/base/légal, puis chaîne de paiement ou première verticale d'intégration complète ; valider chaque capacité de bout en bout avant de la déclarer CONNECTED, VERIFIED ou PRODUCTION_READY. Aucune PR fusionnée.
