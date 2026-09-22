# Global mission — audit préalable (22 septembre 2026)

État initial de cette mission : corrections du précédent audit conservées, sans commit/merge. Réinspection des routes, Settings, layout/themes, dates Calendar/tasks, catalogues pricing, contrats billing/entitlements, mémoire/query IA, RLS et analytics. L'inventaire exhaustif des chemins/migrations et les limites de la revue précédente restent dans `audit-2026-09-22/inventory.md` et `NEXUS_AUDIT_FINAL_2026-09-22.md`. Aucun credential applicatif nouveau constaté. Inventaire ≠ preuve d'une migration appliquée.

| Domaine | État initial | Preuve / défaut | Décision |
|---|---|---|---|
| Global | NOT_IMPLEMENTED | Pas de src/lib/global ; i18n EN/FR seulement onboarding | Ajouter modèles séparés utilisateur/workspace, validation et formatage |
| Fuseaux | IMPLEMENTED partiel | timestamptz et ISO utilisés ; Calendar dépend du timezone navigateur, calculs jours en 24h ; tâches date-only ambiguës | Helpers DST avec tests ; corriger validation Calendar sans réinterpréter les anciennes dates |
| Devises/prices | Contradictoire | Landing 19/49 USD codés dans composant ; settings dit tarifs à venir | Catalogue versionné indépendant UI ; prix commerciaux non convertis automatiquement |
| Billing | Interface, checkout désactivé | Pas adapter ni webhook exécutable, état frontend ne donne pas droits | Transport Stripe séparé, contrat élargi, state machine testée ; activation bloquée tant que ledger/éligibilité non validés |
| Entitlements | Existant | PLAN_LIMITS/FEATURES + SQL guards | Conserver ; ajouter façade nommée, ne pas vendre une capacité absente |
| IA | IMPLEMENTED / non connectée | Fallback testé ; coûts et health détaillée incomplets | Ajouter primitives de suivi/états ; ne pas inventer métriques |
| Mémoire/privacy | Risque | Cache localStorage global sans user/workspace et restauration serveur depuis client | Supprimer restauration non fiable et cache persistant ; centre privacy avec scope honnête |
| Documents | Stockage seulement | Aucun parser/index/retrieval | Documenter blocage, ne pas créer de faux pipeline |
| Intégrations | OAuth + Calendar lecture | Absence neuf adapters et refresh | Conserver corrections ; aucun compte réellement connecté |
| Thèmes | Dark seul | .dark forcé et couleurs natives hardcodées | Ajouter gestion Dark/Light/System et palette dédiée ; mesurer surfaces disponibles |
| Legal | LEGAL_REVIEW_REQUIRED | Placeholders légaux ; promesses suppression/backup non prouvées | Dossier légal fondé sur architecture + sources officielles ; corriger promesses factuellement fausses |
| Tracking | Pas de réseau analytics identifié | CustomEvent local, localStorage, auth cookies, fonts self-hosted | Catégoriser, aucun consent banner factice |
| Sécurité | Partielle | RLS existante, confiance des métriques membres insuffisante | Ne pas ouvrir mutation financière ; document SECURITY + tests nouvelles frontières |

Travaux de cette mission : fondations internationales, transport Stripe non activé, thèmes, privacy utilisateur limitée, documentation juridique/UX, tests. La construction d'adapters complets pour tous les providers et d'un pipeline documentaire complet reste distincte de ces fondations ; ne sera pas déclarée réalisée sans preuve.
