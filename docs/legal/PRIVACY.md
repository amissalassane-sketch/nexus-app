# Privacy — projet fondé sur le code, 22 septembre 2026

**LEGAL_REVIEW_REQUIRED. Ce dossier n'est ni un avis juridique ni une politique publiable sans validation.**

## Responsable et finalités
Identité légale, adresse, pays d'établissement, représentant éventuel, contact droits et responsable de sécurité : **HUMAN BLOCKER, non fournis**. NEXUS peut être responsable pour ses comptes/facturation et sous-traitant des contenus des clients ; qualification contractuelle à valider, pas une conclusion automatique.

Finalités observées : authentification ; collaboration workspace ; recherche ; stockage de fichiers ; mémoire/contexte et assistance IA ; connexions OAuth ; diagnostic et administration. Pas de transport publicitaire ni d'analytics tiers identifié dans le code consulté. Cela ne prouve pas l'absence d'un script ajouté dans le déploiement.

## Bénin et transferts
Le Code du numérique béninois et les formalités APDP doivent être examinés pour les traitements concernés. La fiche officielle rappelle les formalités des articles 405/407 et les dispenses de l'article 410 ; déclaration, autorisation ou avis dépendent du traitement. Ne pas transformer ce rappel en autorisation déjà obtenue. Source officielle consultée le 22/09/2026 : [2](https://archive.apdp.bj/wp-content/uploads/2021/11/Fiche.Pratique.Mise-en-conformite_Pt_OK_Validee.pdf). Portail actuel : https://service.apdp.bj/.

Faire valider : licéité, finalité, proportionnalité/minimisation, exactitude, transparence, durée, confidentialité/sécurité, droits, sous-traitance, transferts et formalités applicables. Les régions réelles Supabase, hébergeur et fournisseurs IA ne sont pas prouvées par leurs noms commerciaux. Documenter le flux et obtenir la validation adaptée avant activation, notamment transferts internationaux ; ne pas présumer que le consentement remplace toutes les formalités.

## Applicabilité internationale
Le RGPD nécessite une analyse territoriale (établissement, offre ciblée ou suivi de personnes dans son champ), de rôle et de chaque finalité. Aucun raccourci « client européen = toute la conformité acquise ». Si applicable : base légale par finalité, information, droits/délais, DPA, transferts, sécurité et DPIA selon les risques. Le consentement marketing éventuel doit être distinct du contrat de service ; une case UI seule n'est pas une base légale universelle. Texte à faire vérifier : https://eur-lex.europa.eu/eli/reg/2016/679/oj.

## Droits réellement disponibles
- Profil : rectification de champs existants via Settings.
- `/settings/privacy` : consultation, téléchargement JSON et suppression **de sa mémoire IA dans le workspace actif uniquement**. Auth + RLS, confirmation et contrôle d'origine ; pas de service-role exposé. Export local à protéger par son destinataire.
- `/files` : gestion des fichiers selon permissions actuelles, pas un export de compte complet.
- `/integrations` : déconnexion locale ; révoquer aussi côté fournisseur tant que la révocation distante n'est pas implémentée.
- Export complet, suppression de compte/workspace, opposition, restriction : **NOT_IMPLEMENTED comme workflow utilisateur complet**. Le futur opérateur doit définir réception confidentielle, vérification proportionnée d'identité, suivi, décision, réponse et recours dans les délais applicables.
- Supprimer la mémoire n'arrête pas les requêtes déjà en vol et n'efface pas les logs, sauvegardes ou données détenues par les fournisseurs. Fermer les autres sessions IA avant suppression. Désactivation durable et gestion des courses restent à développer.

## Publication
Les pages publiques ont reçu un avertissement de brouillon ; promesses non prouvées de suppression immédiate globale, sauvegardes 30 jours, DPA signés et absence de transfert lors d'un timeout corrigées. Des placeholders et formulations normatives subsistent : relire **toutes** les mentions/conditions avant publication. Relier ce document à DATA_MAP, RETENTION, AI_TRANSPARENCY et THIRD_PARTY_PROCESSORS.
