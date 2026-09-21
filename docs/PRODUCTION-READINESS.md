# Production readiness — phase suivante, 21 septembre 2026

**NOT PRODUCTION READY.** Ce bilan remplace les conclusions opérationnelles de READINESS-2026-09-21.md pour les corrections de cette phase, sans effacer les résultats historiques. Les documents ARCHITECTURE, BILLING, INTELLIGENCE et SECURITY séparent implémentation et spécification.

## Livré

- Une migration additive/idempotente 20260921190000 : plan effectif canonique pour admin directory/subscriptions/overview ; expiration visible même sans sweep ; aucune ancienne migration changée.
- En-tête workspace admin aligné sur le miroir SQL ; historique brut explicitement identifié.
- Interface de fournisseur de paiement, statut indisponible sans vendor inventé, aucun paiement simulé.
- Intelligence : erreurs de lecture/écriture propagées, snapshots incomplets refusés, erreurs de membership distinguées de l'absence, recompute global avant validation d'id, retour 403/503 typé sans détails SQL.
- Tests de ces contrats et inventaire/documentation. Le fond noir de la phase précédente est conservé.

## Tests supplémentaires et classification des échecs

Aucun test supprimé ou désactivé. Les assertions anciennes sur le badge PRO expiré ont été **remplacées par des assertions plus strictes** : FREE effectif, statut expired, filtres et totaux cohérents, concordance Overview et directory. Leur attente précédente contredisait le contrat SQL et la mission demandée.

| Suite | Classification / résultat |
|---|---|
| admin-auth-contract | PASS, 24 assertions |
| bridge-lineage-hermetic | PASS dans npm test ; moteur PGlite, extensions vector/storage émulées explicitement |
| auth-workspace-bootstrap | BROKEN FIXTURE / UNSUPPORTED INFRASTRUCTURE : extensions/storage historiques non préparés |
| workspace-bootstrap, onboarding-rls | UNSUPPORTED INFRASTRUCTURE : pgcrypto absent du moteur de test |
| core-contract, lineage-reconciliation | BROKEN FIXTURE / STALE EXPECTATION : anciennes lignées et prérequis ; pas une preuve que les helpers SQL réels manquent |
| migration-logic | BROKEN FIXTURE : rôles/storage/extensions absents ; la nouvelle migration transactionnelle provoque ensuite un état aborted après ces échecs préalables |
| auth-flow | Ancien E2E attend /check-email et auth passwordless ; parcours complet non certifié. Exécution sans serveur/stub = ENVIRONMENT BLOCKER, pas régression produit |

La remise en état complète de ces fixtures/attentes reste un travail d'ingénierie, pas une demande d'authentification humaine. Ne pas qualifier toute la couverture de verte parce que npm test passe.

## SUPABASE PRODUCTION CHECKLIST — non exécutée à distance

Project ref aperçu dans le check GitHub Supabase Preview : `jsjtpiuzwgnthknizopw`. **Indication issue de métadonnées GitHub, pas connexion authentifiée ni preuve que c'est le projet production attendu.** Confirmer avant tout lien.

- [ ] Accès autorisé via intégration/environnement sécurisé ; `supabase link --project-ref <ref-confirmé>`.
- [ ] `supabase migration list --linked` : comparer versions 001–029 et timestamps, en particulier 029, 20260920150000, 20260920160000 et 20260921190000. Ne jamais marquer une migration appliquée par supposition.
- [ ] Export/diff schéma attendu vs réel ; vérifier types ENUM historiques et absence de modifications manuelles non versionnées. Utiliser staging/backup avant correction.
- [ ] Exécuter `supabase/diagnostics/production-contract.sql` (lecture seule) pour signatures/retours/search_path/ACL, RLS/policies, contraintes, indexes et triggers.
- [ ] Helpers : is_workspace_member(uuid), is_active_workspace_member(uuid,uuid default auth.uid()), can_manage_workspace(uuid,uuid default auth.uid()), propriétaire ; usages cohérents. RPC admin et billing présents, grants et checks non contournables.
- [ ] Tables core/AI/automations/worker conservées ; storage.buckets/objects, accès public vs privé, policies et extensions pgcrypto/vector réels.
- [ ] Triggers signup/profil/workspace/membership/subscription : nouvel utilisateur et utilisateur existant ; interruption et reprise ; aucun doublon ; concurrence avec plusieurs connexions réelles.
- [ ] Deux workspaces/deux comptes + utilisateur suspendu/invité ; isolation lecture ET mutation ; USER→DENIED et ADMIN→ALLOWED avec rôle révoqué refusé.
- [ ] FREE aux bornes/dépassement, PRO/TEAM actif, expired/past_due/cancelled, période NULL et limite exacte ; admin/settings/upgrade = droits SQL.
- [ ] Auth dashboard : Site URL, redirect allowlist exacte /auth/callback et /auth/confirm, confirmation email, SMTP, templates, recovery/magic-link, expirations tokens et limites anti-abus. Ni mots de passe ni tokens dans un rapport.
- [ ] Migration nouvelle appliquée via procédure contrôlée après review/dry-run ; reload schema cache si requis ; tests read-only post-déploiement des RPC admin. Aucun db push effectué dans cette session.

## Vercel

CLI `whoami` : nouveau login requis. Projet non lié localement ; aucune variable ou politique cloud authentifiée inspectée. L'URL connue échoue en TLS depuis ce sandbox. **Deployment Protection UNKNOWN**, aucun écran d'authentification Vercel observé. Ne pas désactiver la protection.

Checklist opérateur : projet et intégration GitHub corrects, branche production master, preview de la branche de session, framework Next.js, version Node/build command compatibles, variables Supabase publiques et NEXT_PUBLIC_SITE_URL production/preview correctes, clés IA uniquement serveur, domaine production canonique, certificat TLS, logs, Deployment Protection et utilisateurs autorisés. Succès du check preview ≠ QA de production.

## UX, mobile, performance

Les tests structurels existants et le shell noir #000000 restent en place. Les écrans loading/empty/error existent mais aucune certification navigateur authentifiée aux largeurs **360, 390, 430, 768, 1024, 1440** n'est produite. Tester navigation/sidebar, tableaux admin, formulaires auth/billing, console IA, modals, focus/keyboard/toasts et overflow horizontal avec vrais comptes autorisés. Pas de captures avec fake data présentées comme données de production.

Mesures bundles/Web Vitals/SQL/latence modèle non réalisées à distance ; aucune optimisation revendiquée sans mesure. Éviter de contourner les optimisations Next/Vercel.

## Décision

GREEN local : compilation/tests standard, séparation admin testée, correctif plan effectif, distinction erreurs/vide sur les chemins ciblés.
YELLOW : fixtures historiques, audit API non exhaustif, mémoire et audit durable incomplets, QA responsive/performance sans navigateur réel.
RED : paiement non implémenté ; coût IA spécifié mais pas de garde persistante branchée.
BLOCKED : base réelle, auth/email réels, réglages Vercel, TLS et QA production.

## Actions humaines réellement nécessaires

1. Authentifier Vercel et autoriser/linker le bon projet Supabase via les mécanismes sécurisés — jamais coller un secret dans le chat.
2. Confirmer domaine canonique et accès QA autorisé sous Deployment Protection ; diagnostiquer TLS depuis un réseau autorisé.
3. Fournir comptes de test autorisés utilisateur/admin et service mail testable ; approuver une migration contrôlée après staging/backup.
4. Décider fournisseur/prix/devise et plafonds financiers IA avant intégration commerciale. Les limites proposées dans INTELLIGENCE.md ne sont pas des promesses produit.
5. Examiner la PR ; aucun merge automatique.

Les autres tâches de code restantes (garde IA, fixtures, webhook ledger, audit durable) sont explicitement des travaux d'ingénierie non terminés, pas des faux blockers humains.

## Certification locale

Résultats finaux ajoutés ci-dessous après exécution des commandes. Les résultats distants ne seront jamais remplacés par les résultats locaux.

| CHECK | RESULT | EVIDENCE | BLOCKER |
|---|---|---|---|
| npm ci | PASS | installation verrouillée, exit 0 | — |
| npm test | PASS | 2255 assertions/tests réussis, 0 échoué ; somme des résumés des suites | couverture additionnelle non verte |
| npm run lint | PASS | 0 erreur, 21 warnings préexistants | — |
| npx tsc --noEmit | PASS | exit 0 | — |
| npm run build | PASS | build Next 16.3.5 initial de cette phase ; dernier code vérifié aussi avec VERCEL=1 | pas une QA distante |
| VERCEL=1 npm run build | PASS | dernier code, Turbopack, exit 0 | — |
| git diff --check | PASS | exit 0 | — |
| npm audit | PASS | 0 vulnérabilité signalée | portée dépendances seulement |
| admin-auth-contract supplémentaire | PASS | 24 assertions | — |
| six anciennes suites SQL | FAIL | logs de prérequis/fixtures, voir classification | non corrigées intégralement |
| ancien auth-flow E2E | BLOCKED | ECONNREFUSED 127.0.0.1:3000 sans serveur/stub requis | pas de preuve auth réelle |
| Supabase distant | BLOCKED | CLI : aucun project ref lié | authentification/projet à confirmer |
| Vercel paramètres/logs | BLOCKED | CLI : nouveau login requis | accès autorisé |
| production HTTP | BLOCKED | SSL_ERROR_SYSCALL avant réponse HTTP | TLS/réseau ; protection inconnue |
| mobile/performance navigateur | BLOCKED | pas de session réelle et preuve navigateur | comptes et accès QA |
