# Billing — contrat implémenté et frontière paiement

## Autorité unique des droits

`get_workspace_plan(uuid)` dans 20260915220000 résout : statut `active`, plan FREE/PRO/TEAM, période NULL (indéfinie historique) ou `current_period_end >= now()`. Sinon FREE. `get_owner_plan(uuid)` résout les capacités propriétaire selon le même contrat. Les triggers appliquent les limites ; le frontend n'est pas une frontière de sécurité.

`src/lib/billing/subscription-state.ts` est le miroir TypeScript (`effectivePlanOf`, `displayStatusOf`). Settings/Upgrade utilisent ce contrat. L'en-tête du détail workspace admin utilise maintenant ce miroir. Les badges dans l'historique sont explicitement des **plans stockés**, pas des droits courants.

La migration additive **20260921190000_admin_effective_plans.sql** remplace les corps de `admin_workspaces_list`, `admin_subscriptions_list` et `admin_overview`, sans modifier les signatures ni les abonnements. Résolveur canonique pour listes, filtres, tri et compteurs. La liste subscriptions affiche `expired` pour une ligne active dont la période est échue. Les ACL admin sont réaffirmées ; la migration est testée deux fois de suite.

| Abonnement stocké | Plan effectif | Statut affiché subscriptions | Limites |
|---|---|---|---|
| absent | FREE | implicit_free | FREE |
| PRO/TEAM actif, période courante | PRO/TEAM | active | plan effectif |
| actif, période échue | FREE | expired | FREE |
| cancelled | FREE | cancelled | FREE |
| past_due | FREE | past_due | FREE |
| expired | FREE | expired | FREE |
| trialing | FREE | trialing | FREE |

Les opérations `set_workspace_plan`, upgrade/downgrade/cancel/expire et le sweep sont définis dans le contrat 20260915220000 : service_role uniquement, refus d'un contexte JWT utilisateur, verrou workspace, index unique partiel sur la ligne active. Ne pas les exposer au navigateur ou aux tools IA.

Limites actuelles (workspaces / projects / active tasks / goals / members) : FREE 1/2/100/3/1 ; PRO 5/10/1000/20/5 ; TEAM 20/50/5000/100/20. Voir plan-limits.ts et tests SQL de parité.

## Paiement : interface présente, exécution absente

`BillingProvider` (`lib/billing/provider.ts`) définit checkout idempotent, vérification webhook sur octets bruts, annulation du renouvellement et consultation de facture. DTOs distincts pour facture, événement vérifié et checkout. Aucun secret ne doit traverser ces types.

`getBillingProviderStatus()` retourne **available=false, provider=null**. `/api/billing/upgrade` vérifie session, plan demandé et rôle owner/admin, puis retourne 501 avec code `PAYMENT_PROVIDER_NOT_CONFIGURED`. Le champ historique `error` reste pour compatibilité ; `ok/code/message` rendent l'indisponibilité explicite. Pas de fournisseur présélectionné, de fausse URL checkout ou de paiement simulé.

## Architecture à implémenter AVANT le paiement réel — spécification, non fonctionnalités existantes

1. Choisir Stripe/Kkiapay/FedaPay/autre selon pays, devises, modèle récurrent, remboursements et frais. Catalogue de prix **serveur**, pas montant soumis par le client.
2. Tables transaction et inbox webhook séparées des droits : contraintes uniques `(provider, event_id)` et clé d'idempotence transaction. Journal immuable, index workspace/date. RLS lecture limitée, écritures backend exclusivement.
3. Checkout crée une transaction pending avec workspace/acteur/plan validés. Le retour navigateur ne prouve jamais le paiement.
4. Webhook : signature, fenêtre anti-rejeu, body brut, corrélation à transaction connue, montant/devise/prix vérifiés, traitement transactionnel et idempotent. Refuser les événements non corrélés ; les métadonnées fournisseur ne sont pas une autorisation workspace.
5. Paiement confirmé → transition d'abonnement SQL ; événement dupliqué sans effet ; événements hors ordre/rétrogrades rejetés ou réconciliés. Facture séparée, liée à transaction.
6. Renouvellement prolonge une période confirmée. Annuler le renouvellement n'est pas nécessairement retirer immédiatement les droits ; politique commerciale à arrêter avant adaptateur.
7. Remboursement, chargeback, dunning, expiration : table de transitions documentée, tests de concurrence/rejeu, réconciliation planifiée et audit. Secrets webhook dans environnement serveur sécurisé.

Un provider réel nécessite une décision commerciale et des accès secrets sécurisés. Aucune simple variable d'environnement ne rend le paiement opérationnel dans le code présent.

## Addendum — global mission 2026-09-22
The international transport contract and server-only Stripe adapter now exist; checkout remains deliberately unavailable. See `docs/legal/BILLING_COMPLIANCE.md` and `docs/GLOBAL_AUDIT_FINAL_2026-09-22.md` for draft catalog, routes, state machine, tested scope and missing durable ledger/webhook processor. Setting a provider key does not activate paid access.
