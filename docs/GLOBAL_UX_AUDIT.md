# UX — quinze lois, constats et décisions

Audit source, pas étude comportementale. « Corrigé » signifie code changé, pas toutes surfaces vérifiées. Tests visuels/axe publics décrits dans le rapport final ; app authentifiée et lecteur d'écran restent à tester.

| Loi | Fichier / composant | Problème / raison | Correction ou reste à faire | Impact attendu |
|---|---|---|---|---|
| Hick | user-settings-panel.tsx | Tout mélanger rend le choix difficile | Liens dédiés Privacy et Regional, pas de nouveau mega-formulaire | Choix compréhensibles |
| Fitts | regional-settings.tsx, privacy-settings.tsx | Petites cibles, actions critiques trop proches | Contrôles région/thème ≥44px ; séparation suppression/export ; audit autres icônes restant | Moins d'erreurs tactiles |
| Miller | privacy-settings.tsx | Dump mémoire trop dense | Détails repliables + scope au-dessus ; max-height sans cacher l'export | Charge cognitive réduite |
| Jakob | theme-control.tsx | Thème forcé sans choix standard | Dark/Light/System par select natif, préférence navigateur | Contrôle familier |
| Proximité | privacy-settings.tsx | Suppression potentiellement comprise comme compte entier | Portée, limites et confirmation proches du bouton | Consentement éclairé |
| Région commune | regional-settings.tsx | Apparence et pays légal confondus | Cartes distinctes apparence/préférences, aucun champ pays légal édité | Frontières visibles |
| Similarité | globals.css | Littéraux sombres et sémantiques mélangés | Palette light sémantique, structures pureblack rendues via token ; reste revue couleurs illustrations | Cohérence, mais pas conformité globale |
| Position sérielle | billing/[status]/page.tsx | Retour “success” peut suggérer paiement acquis | Premier titre “Payment not verified”, prochaine action billing à la fin | Réduction fausses conclusions |
| Von Restorff | intelligence-ask.tsx | “Proposition” vs exécution peu distinctes | Notice IA, labels risque existants, confirmation dédiée | Action à haut risque identifiable |
| Tesler | billing/pricing-catalog.ts | Complexité taxes/pays/FX poussée dans UI | Catalogue séparé, checkout bloqué au lieu d'un faux raccourci | Complexité commerciale gardée au backend |
| Doherty | privacy-settings.tsx / regional-settings.tsx | Réseau inconnu, pas de feedback | Chargement/disabled/status ; timeouts UI améliorables | Évite double soumission, indique attente |
| Aesthetic-usability | landing/pricing.tsx | Design soigné donnant illusion checkout prêt | Prix explicitement draft, annuel retiré | Beauté ne masque plus le blocage |
| Postel (avec frontière stricte) | global/context.ts, privacy/request.ts | Entrées permissives = ambiguïtés sécurité | Validation pays/locale/timezone/devise, JSON ≤4KiB ; ne pas tolérer silencieusement un paiement invalide | Erreurs compréhensibles, sécurité |
| Peak-end | privacy-settings.tsx | Fin de suppression peut promettre trop | Succès borné à mémoire workspace, limite requêtes en vol expliquée | Fin de parcours honnête |
| Zeigarnik | integrations-page / Settings | Connexion incomplète sans prochaine étape | États/nextStep existants conservés ; docs humaines ; sync/refresh manquants signalés | Tâche inachevée visible plutôt que fausse complétude |

## WCAG2.2AA — statut
Travail existant sur modal focus/restauration, focus visible, boutons nommés, contrastes dark. Ajouts : labels natifs, checkbox explicite, aria-live/status/alert, description IA liée au textarea. Palette light inclut texte, surface, bordure, succès/avertissement/erreur, admin et chart. Les littéraux des illustrations et les couleurs inline ne sont pas tous convertis. Le lang racine reste en, du contenu français subsiste : audit lang par bloc et i18n complète requis. Vérifier 1.4.3, 1.4.11, 2.1.1, 2.4.7/11, 2.5.8, 3.3.x et 4.1.2 manuellement ; aucun label “conforme AA” livré.
