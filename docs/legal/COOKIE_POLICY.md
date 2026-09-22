# Cookies, stockage et consentement

Audit source 22/09/2026 ; contrôler le trafic du déploiement avant publication. **LEGAL_REVIEW_REQUIRED** pour qualification/exemptions selon territoire.

| Catégorie | Code constaté | Activation / durée |
|---|---|---|
| Nécessaire | Supabase `sb-*-auth-token` et code-verifier ; cookie state OAuth | Auth/session/PKCE ; expiry auth et flags effectifs à vérifier ; state OAuth 10 min |
| Préférences | `nexus.theme.v1` | Choix explicite Dark/Light/System, navigateur uniquement, jusqu'à effacement |
| Préférences | `nexus:onboarding:${userId}` | État onboarding par utilisateur, persistant ; revue durée nécessaire |
| Préférences | `nexus.command-recents` | Identifiants récents, pas de texte complet ; clé globale à revoir/purger au logout |
| Préférences | `nexus:launch-seen` | SessionStorage, durée onglet |
| Ancien cache sensible | `nexus.intelligence.memory.v1` | Plus lu/écrit ; supprimé à l'ouverture Intelligence. Effacer stockage sur appareils non revisités |
| Analytics | CustomEvent onboarding, console développement | Aucun transport réseau analytics trouvé ; pas de statistique marketing collectée par ce code |
| Marketing | Aucun script identifié | Non implémenté/non activé |

Aucune CMP de production attestée. Pas de bannière factice demandant une autorisation pour des trackers absents. Si analytics ou marketing nécessitant consentement sont ajoutés : aucun chargement/pixel/SDK avant choix valide ; accepter/refuser accessibles équivalents ; préférence granulaire ; retirer aussi facilement ; journal de consentement minimal ; droit applicable à valider. Les préférences demandées par l'utilisateur et cookies d'auth doivent être qualifiés correctement, pas tous assimilés à du marketing.

Le contrôleur doit publier identité/contact, finalité/destinataires/durée et instructions navigateur. Vérifier les cookies réellement envoyés (SameSite, Secure, expiry, visibilité JS) : la documentation ne doit pas promettre HttpOnly si le client Supabase a besoin de sessions lisibles côté navigateur.
