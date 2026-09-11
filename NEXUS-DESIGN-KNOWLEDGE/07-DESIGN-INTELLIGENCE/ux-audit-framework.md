# NEXUS — UX Audit Framework

Méthode à appliquer pour auditer un flux complet (pas un composant isolé) — ex. "l'onboarding", "la création de tâche", "la connexion d'une intégration".

## Étape 1 — Cartographier le parcours réel

1. Lister chaque écran/état traversé, dans l'ordre réel (pas l'ordre idéal).
2. Pour chaque écran, noter : ce que l'utilisateur voit, ce qu'il peut faire, ce qui se passe s'il ne fait rien (timeout, valeur par défaut), ce qui se passe s'il fait une erreur.
3. Identifier les points de sortie possibles (abandon volontaire) et vérifier qu'ils sont explicites (bouton "Annuler"/"Passer"), pas seulement une fermeture d'onglet.

## Étape 2 — Appliquer les lois UX pertinentes (`01-CORE-PRINCIPLES/laws-of-ux.md`)

| Symptôme observé | Loi à vérifier |
|---|---|
| L'utilisateur hésite longtemps devant un écran | Hick (trop de choix simultanés ?) |
| Une action échoue souvent par mauvais clic | Fitts (cible trop petite/trop loin ?) |
| L'utilisateur redemande une fonctionnalité "comme dans [autre produit]" | Jakob (convention non respectée ?) |
| L'utilisateur oublie une information affichée 3 écrans plus tôt | Miller (trop d'items en mémoire de travail ?) |
| Une progression abandonnée n'est jamais reprise | Zeigarnik (l'état d'avancement est-il visible et valorisé ?) |
| Une interaction "se sent" lente même si le réseau est rapide | Doherty (le feedback local dépasse 200ms ?) |

## Étape 3 — Vérifier les 8 dimensions de heuristique produit

1. **Visibilité de l'état du système** — l'utilisateur sait-il toujours où il en est ?
2. **Correspondance avec le monde réel** — le vocabulaire est-il celui du domaine de l'utilisateur (tâches, projets) ou un jargon interne ?
3. **Contrôle et liberté** — existe-t-il toujours une sortie/annulation claire ?
4. **Cohérence et standards** — le pattern utilisé ici est-il le même qu'ailleurs dans NEXUS pour un besoin similaire ?
5. **Prévention des erreurs** — le système empêche-t-il l'erreur avant qu'elle se produise (validation en amont, confirmation proportionnée) ?
6. **Reconnaissance plutôt que rappel** — l'utilisateur voit-il ses options plutôt que de devoir se souvenir d'une commande ?
7. **Flexibilité et efficacité d'usage** — un utilisateur expert a-t-il un raccourci (clavier, Command Menu) en plus du chemin découvrable ?
8. **Design minimaliste et esthétique** — chaque élément à l'écran sert-il une fonction, ou est-il resté "parce qu'il était là avant" ?

## Étape 4 — Vérifier la cohérence inter-surfaces

Pour tout pattern qui existe sur plusieurs pages (empty state, confirmation, badge de statut, recherche) : le comportement est-il **identique** sur Dashboard, Projects, Tasks, Goals, Intelligence, Integrations, Activity, Notifications ? Toute divergence non justifiée est un défaut de cohérence à corriger, pas une variation acceptable.

## Étape 5 — Mesurer, pas supposer

Quand c'est possible, s'appuyer sur des faits vérifiables plutôt que sur une impression :
- Nombre de clics/étapes réels pour l'action principale du flux.
- Présence effective d'un état de chargement pour chaque appel réseau identifié dans le code.
- Présence effective d'un état d'erreur géré pour chaque appel réseau (pas seulement le cas de succès).
- Contraste réel mesuré (pas estimé) pour toute nouvelle combinaison texte/fond introduite.

## Étape 6 — Consigner

- Toute décision prise à l'issue de l'audit qui modifie un comportement déjà établi doit être ajoutée à `06-NEXUS-CONTEXT/NEXUS-DESIGN-DECISIONS.md`.
- Tout gap identifié qui nécessite une décision produit (pas seulement une décision de design) doit être marqué `[NEEDS DECISION]` et signalé explicitement, jamais tranché arbitrairement par l'agent.
