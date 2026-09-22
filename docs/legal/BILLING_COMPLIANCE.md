# Facturation internationale — activation interdite sans validation

**HUMAN_ACTION_REQUIRED + LEGAL_REVIEW_REQUIRED.** Aucun paiement réel, aucune souscription Stripe réelle, aucun webhook réel constatés.

## Séparation des responsabilités
Pays/entité du marchand ≠ pays du client ≠ devise du prix ≠ taxe ≠ méthode de paiement. Le catalogue stocke montant en unités mineures, devise, intervalle, type base/régional, pays éventuel, fournisseur, identifiant prix, dates d'effet et état d'approbation. Les deux anciens tarifs USD sont maintenant **draft**, pas des offres activées. Remise annuelle publicitaire retirée. Pas de conversion FX créant un prix commercial.

La page officielle Stripe Global consultée intégralement le 22/09/2026 ne liste pas le Bénin parmi les pays d'ouverture directe affichés : https://stripe.com/global. Les possibilités Connect/payouts ou réseau étendu ne sont pas une preuve qu'une société béninoise peut ouvrir et exploiter ce compte marchand. Faire confirmer le cas réel par Stripe ; ne pas inventer une société étrangère ou utiliser le pays du client pour contourner l'éligibilité. Conserver Kkiapay/FedaPay comme alternatives à qualifier, pas comme intégrations déjà existantes.

## Code livré
Contrat fournisseur neuf méthodes ; adapter Stripe officiel serveur (`server-only`), idempotency keys transport, URLs retour same-origin, souscription initiale incomplete, upgrade pending_if_incomplete, remboursement montant/devise contrôlés. Signature sur bytes bruts avec SDK et fenêtre 300 s, refus test/live mélangés, types d'événements normalisés. Source technique : https://docs.stripe.com/webhooks/signature. Tests utilisent exclusivement fixtures hermétiques, aucune API externe.

`getBillingProviderStatus()` reste indisponible, `/api/billing/upgrade` ne facture pas. Pages retour n'accordent rien et ne prétendent pas connaître une transaction. La state machine pure ne doit être invoquée que par le service de confiance ; une chaîne « server_verified_provider » fournie par HTTP n'est jamais une preuve.

## Avant activation
1. Autorisation marchande, bénéficiaires effectifs/KYC, banque, méthodes et devises.
2. Catalogue approuvé et prix provider créés ; unité par workspace/utilisateur définie, taxes incluses/exclues, dates, essai, renouvellement.
3. Conditions achat, rétractation/annulation selon client B2B/B2C et droit applicable ; facture conforme, identité fiscale, remboursements/litiges.
4. **Code restant** : ledger transaction serveur, mapping customer/subscription/workspace, événement durable unique(provider,event_id), signature avant parse, corrélation montant/devise/price/account/mode, protection hors ordre, transaction SQL atomique receipt+entitlements, retries/dead-letter/reconciliation, audit non modifiable par membres.
5. Validation d'ACTIVE/TRIALING/PAST_DUE/CANCELLED/EXPIRED et droits par périodes via backend ; jamais par query param ou checkout.session.completed seul.
6. Scénarios sandbox : duplicate, replay, signature fausse, 3DS/pending, timeout après débit, facture échouée, annulation fin de période, refund partiel, mise à jour hors ordre, crash avant commit.

Les étapes 4–6 ne deviennent pas résolues par l'ajout de secrets. `BillingEventStore` n'est qu'une frontière typée ; **aucun store transactionnel ni endpoint webhook de production n'a été livré**.
