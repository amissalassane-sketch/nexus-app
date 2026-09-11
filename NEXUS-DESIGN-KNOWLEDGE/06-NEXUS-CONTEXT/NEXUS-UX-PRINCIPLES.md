# NEXUS UX PRINCIPLES

Comment NEXUS doit **se comporter**, pas seulement à quoi il doit ressembler. Statut de preuve indiqué par section.

---

## 1. Réduction de la charge cognitive `[CONFIRMED + INFERRED]`

- La sidebar groupe les destinations en 3 blocs (Primary / Work / Workspace) plutôt qu'une liste plate — loi de Miller appliquée (`01-CORE-PRINCIPLES/laws-of-ux.md`).
- Le Command Menu catégorise ses résultats plutôt que de présenter une liste unique — loi de Hick.
- `[INFERRED]` Toute nouvelle vue doit répondre en premier écran à "qu'est-ce qui compte maintenant ?" avant tout détail secondaire — c'est la logique déjà appliquée au dashboard (`KpiGrid` + `PriorityQueue` + `BriefingPanel`) et à `MobileHome` (hiérarchie documentée : où j'en suis → qu'est-ce qui nécessite mon attention → quelle mission est active → quelle est la prochaine action).

## 2. Hiérarchie visuelle `[CONFIRMED]`

- Ordre de lecture texte : `primary` (affirmation) → `secondary` (corps) → `tertiary` (support) → `quaternary` (métadonnée). Ne jamais utiliser un palier de texte hors de son rôle (ex. ne pas mettre une métadonnée en `text-primary`).
- Un seul CTA `primary` par écran/section.
- `display`/`display-lg`/`display-xl` réservés au public — l'app ne doit jamais rivaliser visuellement avec la landing page en intensité typographique.

## 3. Progressive disclosure `[CONFIRMED]`

- Le trace d'exécution de l'agent IA est repliable ("workflow agent repliable" — `INTELLIGENCE_AGENT_REPORT.md`) : le résumé est toujours visible, le détail (outils exécutés, plan) est disponible à la demande.
- L'onboarding utilise un **seul canal de guidance actif à la fois** (tour guidé **ou** checklist/tip/aide) — jamais plusieurs couches d'aide simultanées qui se contrediraient ou se chevaucheraient.
- Les capacités avancées (mémoire, préférences, plan de risque d'une action) doivent rester accessibles mais non imposées à l'écran principal.

## 4. Feedback utilisateur `[CONFIRMED]`

- Toute interaction (hover, clic, toggle) doit produire un retour perceptible sous ~200ms (loi de Doherty).
- Toute mutation de données doit produire soit un toast, soit un état de succès de bouton, soit une mise à jour visible de la liste — jamais un silence après une action explicite.
- Les états de chargement IA sont nommés par ce qui se passe réellement ("Understanding your workspace…"), jamais des points génériques.

## 5. Visibilité de l'état du système `[CONFIRMED]`

- Le workspace expose un état explicite (`ready`/`preparing`/`failed`) — l'UI ne doit jamais laisser croire qu'un workspace est prêt s'il est encore en bootstrap.
- Une action IA proposée, en attente de confirmation, exécutée+vérifiée, ou échouée, sont quatre états **visuellement distincts** — jamais fusionnés.
- Le plan de compteurs (`ShellPlan`) doit toujours refléter l'usage réel par rapport à la limite, pas un pourcentage arrondi trompeur.

## 6. Prévention des erreurs `[CONFIRMED]`

- Un bouton désactivé doit toujours expliquer pourquoi (limite de plan, champ requis, provider non configuré).
- Une action à risque élevé (suppression) exige une confirmation explicite renforcée, jamais un simple clic.
- Le champ multi-lignes de chat (`Textarea`) traite `Enter` comme un saut de ligne, jamais un envoi accidentel ; seul un champ dédié au chat avec `enterKeyHint="send"` envoie sur Entrée.

## 7. Récupération après erreur `[CONFIRMED]`

- L'assistant IA a un mode de repli déterministe si le fournisseur IA distant échoue — l'utilisateur obtient toujours une réponse utile.
- Les erreurs réseau/5xx/429 déclenchent une tentative de nouvelle requête automatique (jamais sur timeout) avant d'informer l'utilisateur d'un échec définitif.
- `ErrorState` doit toujours offrir une action de sortie (réessayer, retourner, contacter le support) quand une action de sortie existe.

## 8. Cohérence `[CONFIRMED]`

- Un même pattern (empty state, confirmation, badge de statut) se comporte identiquement sur toutes les surfaces du produit (Dashboard, Projects, Tasks, Goals, Intelligence, Integrations).
- La navigation, les compteurs et le libellé de chaque page sont dérivés d'une **source unique** (`nav-config.ts`) — jamais dupliqués avec un texte légèrement différent ailleurs.

## 9. Accessibilité `[CONFIRMED]`

Voir `../07-DESIGN-INTELLIGENCE/accessibility-standards.md` pour le détail complet. Rappel des invariants : contraste AA, focus visible, cible tactile ≥44px, jamais de dialogue natif bloquant, jamais de couleur seule pour un statut, labels de formulaire toujours visibles.

## 10. Navigation clavier `[CONFIRMED]`

- `⌘K`/`Ctrl+K` ouvre la palette de commandes partout dans l'app.
- Tab se déplace entre contrôles indépendants ; flèches naviguent à l'intérieur d'un contrôle composite (listes, menus).
- `Escape` ferme systématiquement modales, dropdowns, drawer mobile, palette de commandes.
- Skip link vers le contenu principal en premier élément focusable.

## 11. Comportement responsive `[CONFIRMED]`

- Sidebar fixe (248px) à partir de `lg` (1024px) ; en dessous, header + drawer + navigation basse à 4 destinations.
- 1 geste pour les 4 destinations principales sur mobile, 2 gestes maximum pour atteindre n'importe quelle autre destination.
- La grille change de nombre de colonnes par device class, jamais seulement de largeur.
- Mobile traité comme un citoyen de première classe avec sa propre hiérarchie d'écran (`MobileHome`), pas un rétrécissement du desktop — contre-exemple assumé par rapport à Linear (voir `03-UX-REFERENCES/linear.md`).

## 12. Empty states `[CONFIRMED]`

Toujours accompagnés d'une action de sortie quand une action existe (créer le premier élément, réinitialiser un filtre). Jamais un simple "Rien ici" sans porte de sortie.

## 13. Loading states `[CONFIRMED]`

Le squelette de chargement doit avoir la même forme que le contenu final (préserve la mise en page) — jamais un spinner générique plein écran qui fait "sauter" la mise en page à l'arrivée des données.

## 14. Error states `[CONFIRMED]`

Message humain (jamais de stack trace/code SQL brut), action de sortie disponible, `role="alert"` réservé aux erreurs bloquantes.

## 15. Success states `[CONFIRMED]`

Bref et visible (check animé sur bouton), jamais permanent au point de masquer un changement d'état suivant.

## 16. Onboarding `[CONFIRMED]`

- Modèle déclaratif basé sur des **faits produit réels** (nombre de projets/tâches créés, interaction Intelligence effective) — jamais sur une simple case cochée "j'ai vu le tour".
- Activation définie strictement : `ACCOUNT_CREATED → FIRST_LOGIN → FIRST_PROJECT → FIRST_TASK → FIRST_INTELLIGENCE`. `signup_completed` et `tour_completed` ne comptent explicitement **pas** comme activation (`PRODUCT_UX_REWORK_REPORT.md`).
- Persistance locale (reprise après fermeture) + serveur (`profiles.onboarding_progress`, RLS auto-écriture uniquement).
- Un seul canal de guidance actif à la fois.

## 17. Recherche `[CONFIRMED]`

- Scoring : préfixe > début de mot > sous-chaîne, tous les tokens d'une requête multi-mots doivent matcher.
- Résultats toujours issus de vraies données scoping RLS — jamais de résultat fabriqué.

## 18. Command center `[CONFIRMED]`

Voir `../05-COMPONENT-PATTERNS/command-center.md`. Point clé : catégories Recent → Actions → Pages → Projects → Tasks → Goals, dans cet ordre stable.

## 19. Notifications `[CONFIRMED]`

Icône dérivée du type réel d'événement, route de destination dérivée du type d'entité, horodatage relatif localisé, squelette dédié pendant le chargement. Voir `../05-COMPONENT-PATTERNS/notifications-and-realtime.md`.

## 20. AI interactions `[CONFIRMED]`

- L'IA n'est jamais représentée par un simple "bouton AI" isolé — elle est intégrée au dashboard (briefing, priorités), à l'Intelligence (assistant conversationnel + moteur de signaux), à l'onboarding (détection d'interaction), et au Command Menu.
- Toute proposition de l'IA reste une proposition tant qu'elle n'est pas confirmée par l'utilisateur et vérifiée par relecture serveur.
- Voir `../04-AI-DESIGN-SYSTEMS/` pour le détail complet des patterns.

## 21. Automation `[CONFIRMED + NEEDS DECISION]`

- `[CONFIRMED]` Le catalogue d'intégrations inclut une entrée "NEXUS Webhooks" positionnée comme "future secure event boundary" — l'automatisation via webhooks est un axe produit déclaré mais **`[NEEDS DECISION]`** : aucune UI de configuration de règle d'automatisation (trigger → action) n'existe encore dans le code exploré. Ne pas l'inventer sans décision produit explicite.

## 22. Integrations `[CONFIRMED]`

Voir `NEXUS-INTEGRATIONS.md` pour le détail complet. Principe central : chaque intégration du catalogue affiche honnêtement son statut réel (`coming-soon`/`not-configured`), jamais un faux état "connecté" tant que l'adaptateur serveur n'existe pas.

## 23. Dashboard `[CONFIRMED]`

Composé de blocs à valeur réelle uniquement (`KpiGrid`, `ActiveProjects`, `BriefingPanel`, `PriorityQueue`, `UpcomingPanel`) — chaque chiffre affiché vient d'une vraie requête Supabase, jamais d'un exemple statique.

## 24. Projects / Tasks `[CONFIRMED]`

Compteurs live dans la sidebar et le dashboard (`NavCountKey`), liés au même modèle de données que les vues détaillées — pas de divergence entre le nombre affiché dans la sidebar et le contenu réel de la page.

## 25. Notes `[NEEDS DECISION]`

Aucune fonctionnalité "Notes" indépendante n'a été trouvée dans l'exploration du code (`src/app/(app)/`) — le domaine actuel couvre Projects/Tasks/Goals/Intelligence/Activity/Notifications/Integrations. Si une fonctionnalité Notes est envisagée, elle doit être conçue en cohérence avec les patterns déjà établis (empty state, recherche, intégration au Command Menu), pas isolément.

## 26. Files `[NEEDS DECISION]`

Aucune gestion de fichiers/pièces jointes n'a été trouvée dans le code exploré. À concevoir explicitement si demandé — ne pas supposer un pattern d'upload sans décision produit (stockage, quotas de plan, prévisualisation, sécurité).

## 27. Calendar `[NEEDS DECISION]`

Pas de vue calendrier native trouvée. `Google Calendar` existe uniquement comme entrée du catalogue d'intégrations (statut `coming-soon`) — aucune vue calendrier interne à NEXUS n'est confirmée dans le code. Toute vue calendrier future doit être décidée comme fonctionnalité produit à part entière, pas déduite implicitement de l'intégration.
