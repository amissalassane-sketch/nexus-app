# Tiers et sous-traitants — inventaire à contractualiser

**LEGAL_REVIEW_REQUIRED.** Aucune signature DPA, région de stockage, certification ou liste de sous-traitants ultérieurs n'a été vérifiée dans cette session. Être nommé dans le code ≠ être connecté.

| Tiers | Données potentielles / finalité | État constaté | Action préalable |
|---|---|---|---|
| Supabase | Auth, DB workspace, Storage, logs | Bibliothèques/config attendues ; déploiement inaccessible | Contrat, région, backup, RLS, export/suppression et journaux |
| Hébergeur Next/Vercel ou self-host | HTTP, cookies/headers, exécution API, logs | Déploiement référencé mais protégé SSO | Identifier vrai opérateur/config, région, log retention, DPA |
| OpenAI | Question, contexte compact, historique/preferences | Code ; clé non vérifiée | Contrat compte, modèle autorisé, training/retention/transferts/budgets |
| Anthropic | Même périmètre, fournisseur alternatif | Code ; clé non vérifiée | Même revue ; vérifier disponibilité réelle du modèle configuré |
| Google | Gmail/Calendar OAuth et données consenties | OAuth partagé ; Calendar lecture seulement | Consent screen/scopes, vérification Google si applicable, contrat, refresh/revoke |
| GitHub / Notion / Slack / Linear | OAuth identité/workspace/token ; futur contenu | OAuth/code uniquement, adapters données absents | Conditions API, permissions minimales, politiques de conservation/revocation |
| Stripe | Client, subscription, invoice, payment metadata | SDK transport non activé | Éligibilité entité marchande et compte, contrat, taxes, ledger/webhooks |
| Kkiapay / FedaPay | Futurs paiements locaux | NOT_IMPLEMENTED | Éligibilité/contrat, adapter, signatures, réconciliation ; pas d'inférence depuis client BJ |
| Fournisseur email de Supabase | Adresse et messages auth | Pas audité à distance | SMTP/délivrabilité, région, secrets, durée |

Registre opérateur à compléter : entité contractante, service exact, rôle responsable/sous-traitant, région primaire/réplica, sous-traitants, catégorie sensible, finalité, base, mécanisme transfert, durée, droit d'audit, incident/contact, date de validation. Séparer app OAuth enregistrée, utilisateur consentant, compte marchand et client payeur.
