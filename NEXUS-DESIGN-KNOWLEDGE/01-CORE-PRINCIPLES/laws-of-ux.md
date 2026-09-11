# Laws of UX — principes retenus pour NEXUS

Source : [lawsofux.com](https://lawsofux.com) (Jon Yablonski) — recueil de principes de psychologie cognitive appliqués à l'interface. Domaine public de la connaissance UX ; aucune identité visuelle à éviter ici, seulement des lois de comportement humain.

## Lois directement actionnables pour NEXUS

**Loi de Hick** — le temps de décision augmente avec le nombre et la complexité des choix.
→ NEXUS : le Command Menu (`command-menu.tsx`) groupe les résultats par catégorie (Recent, Actions, Pages, Projects, Tasks, Goals) plutôt que de présenter une liste plate — bonne application. À vérifier à chaque ajout de filtre/onglet : est-ce que ça réduit ou multiplie les choix visibles simultanément ?

**Loi de Fitts** — le temps pour atteindre une cible dépend de sa taille et de la distance à parcourir.
→ NEXUS applique déjà une cible tactile minimale (`h-9`/`h-10` sur mobile pour les boutons `icon`/`sm`, commentaire explicite dans `button.tsx` : "36px hit area on touch screens, 32px where a precise pointer exists"). Règle à ne jamais régresser : **44×44px minimum sur tout contrôle tactile primaire**, 32px acceptable seulement pour un contrôle secondaire desktop avec pointeur précis.

**Loi de Jakob** — les utilisateurs passent le plus clair de leur temps sur d'autres produits ; ils préfèrent que le vôtre fonctionne comme ceux qu'ils connaissent déjà.
→ Justifie que NEXUS réutilise des conventions connues (⌘K pour la palette de commandes, sidebar à gauche, notifications en cloche, sheet mobile qui glisse du bas) plutôt que d'inventer une gestuelle propriétaire — sans jamais copier l'identité visuelle d'un produit précis.

**Loi de Miller (7±2)** — la mémoire de travail a une capacité limitée.
→ Justifie le regroupement de la sidebar en 3 sections (Primary / Work / Workspace, voir `nav-config.ts`) plutôt qu'une liste plate de 10 destinations.

**Effet de Von Restorff (isolation)** — un élément qui se distingue visuellement des autres est mieux mémorisé.
→ Justifie l'usage **parcimonieux** de l'accent lavande pour signaler "ce qui vient de l'intelligence" — s'il était partout, il perdrait sa fonction de signal. C'est déjà la position documentée dans `globals.css` ("Intelligence accent... used sparingly").

**Loi de Postel (robustesse)** — être tolérant en entrée, rigoureux en sortie.
→ NEXUS : les entrées utilisateur (recherche, commande, requêtes en langage naturel à l'assistant) doivent tolérer la casse, les fautes de frappe mineures, le FR/EN mélangé (déjà le cas dans `intent.ts` qui route FR/EN) ; les réponses de l'assistant doivent rester strictement structurées et jamais inventer de données (`context-builder.ts` ne lit que le vrai snapshot workspace).

**Loi de Tesler (conservation de la complexité)** — toute complexité retirée à l'utilisateur doit être absorbée ailleurs dans le système.
→ Justifie que la complexité de l'agent IA (sélection d'outils, planification, vérification post-mutation) reste **interne** à `lib/intelligence/agent.ts` et ne remonte à l'utilisateur que sous forme d'un état court et honnête (thinking → planning → using tools → executing → verifying), jamais sous forme de chaîne de raisonnement brute.

**Loi de Zeigarnik** — une tâche interrompue reste plus présente en mémoire qu'une tâche terminée.
→ Justifie les checklists de progression persistantes (`GetStartedChecklist`, barre `Progress` dans `feedback.tsx`) : montrer "2/4" motive plus la complétion qu'un état binaire fait/pas fait.

**Loi de Doherty (réactivité)** — la productivité augmente quand un système répond en moins de 400ms.
→ Justifie les micro-durées définies dans `globals.css` (`--duration-micro: 120ms`, `--duration-small: 200ms`) : le feedback d'interaction (hover, clic, toggle) doit rester perceptiblement instantané ; seules les opérations réseau réelles peuvent dépasser ce seuil, et doivent alors afficher un état de chargement explicite plutôt qu'un gel silencieux.

**Aesthetic-Usability Effect** — une interface perçue comme esthétiquement plaisante est perçue comme plus utilisable, même à fonctionnalité égale.
→ Justifie l'investissement dans le polish visuel (transitions soignées, glow subtil au focus) mais **ne dispense jamais** d'une vraie vérification d'utilisabilité — le risque est de confondre "ça a l'air premium" avec "c'est utilisable". Toute revue de design NEXUS doit évaluer les deux axes séparément (voir `07-DESIGN-INTELLIGENCE/ux-audit-framework.md`).

**Loi de Peak-End** — une expérience est jugée surtout sur son pic émotionnel et sur sa fin, pas sur sa moyenne.
→ Applicable aux flux critiques : la fin d'un onboarding, la confirmation d'une action IA, l'écran de succès après paiement doivent recevoir un soin disproportionné par rapport à leur fréquence d'usage.

## Utilisation par l'agent

Quand une décision de layout, de feedback ou de hiérarchie est ambiguë, consulter cette liste avant de trancher esthétiquement. Ces lois sont des heuristiques de justification, pas des règles absolues — elles doivent toujours être pondérées par le contexte réel de NEXUS (utilisateurs qui gèrent des tâches/projets à volume, souvent en session courte et répétée).
