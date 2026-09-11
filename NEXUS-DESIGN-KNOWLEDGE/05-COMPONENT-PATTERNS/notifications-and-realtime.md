# Pattern — Notifications et signaux temps réel [CONFIRMED]

## Composants existants
- `NotificationPreview` (`src/components/notification-preview.tsx`) : dropdown compact accessible depuis la topbar/le header mobile, affiche les notifications récentes avec icône contextuelle, horodatage relatif, lien vers l'entité concernée.
- `NotificationCenter` (`src/components/notification-center.tsx`) : vue complète sur `/notifications`.

## Règles déjà en place
- **Icône dérivée du type réel de la notification** (`iconFor`), pas une icône générique unique — un événement projet a une icône différente d'un événement tâche ou d'un avertissement. Cohérent avec le principe "la couleur/l'icône renforce le sens, elle ne le remplace pas seule" (icône **+** texte, jamais icône seule).
- **Route de destination dérivée du type d'entité** (`routeFor`) — cliquer une notification amène toujours sur l'écran réel concerné, jamais sur une page générique de log.
- **Horodatage relatif via `Intl.RelativeTimeFormat`** plutôt qu'une chaîne fabriquée à la main — garantit une locale correcte et un format cohérent avec le reste du produit.
- **Squelette de chargement dédié** (`Skeleton`) plutôt qu'un état vide pendant le chargement initial — évite un flash de "0 notification" avant que les données réelles n'arrivent.
- **`prefers-reduced-motion` respecté** via `useReducedMotion()` avant d'utiliser `framer-motion` pour l'entrée du dropdown.

## Sévérité et couleur
La sévérité (`severity: "critical"` par ex.) doit rester un signal secondaire à l'icône/au texte, jamais la seule indication (voir `01-CORE-PRINCIPLES/unicef-design-guidelines.md`, règle "la couleur ne porte jamais seule le sens").

## Où la logique de badge de comptage vit
Le compteur de notifications non lues (`unreadCount`, `NavCountKey: "unreadNotifications"`) est calculé côté shell (`nav-config.ts`, `workspace-sidebar.tsx`) et affiché avec `accentCount: true` — seul badge de la sidebar qui porte l'accent, ce qui est cohérent avec la règle "l'accent doit signaler quelque chose qui requiert l'attention", pas être décoratif.

## Anti-patterns à éviter
- Ne jamais afficher un compteur de notification "faux" ou plafonné arbitrairement sans l'indiquer (ex. afficher "9+" sans jamais dire le vrai total nulle part) sans décision produit explicite — actuellement le code n'implémente pas de plafonnement observé ; toute future troncature doit être un choix documenté, pas un oubli.
- Ne jamais faire disparaître une notification de la liste avant que l'action de lecture soit confirmée côté serveur (cohérent avec la règle mémoire IA : ne jamais afficher un état comme acquis avant vérification).
