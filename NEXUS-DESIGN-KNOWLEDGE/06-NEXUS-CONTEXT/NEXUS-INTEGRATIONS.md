# NEXUS INTEGRATIONS — architecture produit

**Statut : [CONFIRMED]** sauf mention contraire. Sources : `src/lib/integrations/catalog.ts`, `src/components/integrations/integration-hub.tsx`, `integration-icon.tsx`, `src/app/(app)/integrations/page.tsx`.

## Position produit `[CONFIRMED]`

Le commentaire source du catalogue est explicite et doit rester la doctrine : *"This registry describes product direction, not fabricated connections. A provider becomes available only when its server-side OAuth/sync adapter is implemented and security-reviewed."* Autrement dit : **une intégration listée n'est jamais présentée comme active tant que son adaptateur serveur n'existe pas réellement**, même si la carte est visuellement complète.

## Modèle de données du catalogue `[CONFIRMED]`

```ts
type IntegrationStatus = "coming-soon" | "not-configured";
type IntegrationCategory = "calendar" | "development" | "communication" | "documents" | "automation";

type IntegrationDefinition = {
  id, name, category, categoryLabel, description,
  capabilities: string[],
  status: IntegrationStatus,
  available: boolean,
};
```

Catalogue actuel (7 entrées) : Google Calendar (calendar), GitHub (development), Slack (communication), Notion (documents), NEXUS Webhooks (automation), Linear (development), Jira (development). **Toutes** sont actuellement `status: "coming-soon"`, `available: false` — aucune intégration réelle n'est branchée à ce jour dans le code exploré. `[NEEDS DECISION]` : l'ordre de priorité d'implémentation réelle (quelle intégration en premier) n'est pas tranché dans le code — c'est une décision produit, pas une décision de design.

Catégories déclarées : `all`, `calendar`, `development`, `communication`, `documents`, `automation` (`INTEGRATION_CATEGORIES`).

## Le Hub d'intégrations (`IntegrationHub`) `[CONFIRMED]`

- Recherche texte (nom, description, libellé de catégorie) + filtre de disponibilité (`all/connected/available/coming-soon`) + filtre de catégorie — deux barres de filtres empilées, pas fusionnées.
- `filter === "connected"` retourne actuellement toujours `false` (aucune intégration n'est connectée dans le modèle de données actuel) — **ce n'est pas un bug à corriger silencieusement**, c'est le reflet honnête de l'état réel du produit ; le jour où une vraie connexion existe, ce filtre doit refléter un état de connexion réel par utilisateur, pas un catalogue statique.
- État vide de recherche → `EmptyState` avec action "Reset filters" (bon pattern à répliquer ailleurs).
- Chaque carte affiche : icône (voir ci-dessous), nom, catégorie, badge de statut, description, liste de capacités en pills, `"Server connection required"` + bouton désactivé avec `title` explicatif.

## Icônes de marque `[CONFIRMED]`

Voir aussi `../02-DESIGN-SYSTEMS/iconography.md`. Architecture actuelle :
- `simple-icons` fournit les paths officiels (`siGithub`, `siGooglecalendar`, `siNotion`, `siLinear`, `siJira`).
- Slack : path SVG inliné manuellement avec provenance documentée (`simple-icons@10.4.0`, retiré depuis pour raison de marque). **Ce pattern (sourcer et documenter la provenance) est la procédure à suivre pour toute future marque retirée de `simple-icons`.**
- Rendu : `<svg fill="currentColor">` — monochrome, suit la couleur de texte ambiante, jamais la couleur officielle de la marque. Ce choix uniformise visuellement le hub sans "publicité de couleur" pour chaque marque tierce.
- Fallback pour une intégration sans marque tierce (ex. NEXUS Webhooks, concept propre au produit) : icône Lucide neutre (`Webhook`), jamais un logo générique inventé.

## Architecture cible pour une intégration réellement connectée `[NEEDS DECISION — proposition de structure, pas encore implémentée]`

Sur la base du modèle de risque déjà appliqué à l'IA (`INTELLIGENCE_AGENT_REPORT.md`) et des principes de ce document, une intégration réelle devrait exposer à minima :

1. **États** : `disconnected` (par défaut) → `connecting` (flux OAuth en cours) → `connected` → `error` (échec de sync/token expiré) → `disconnected` (déconnexion volontaire). Chaque état doit avoir une représentation visuelle distincte (pas seulement un changement de libellé de bouton).
2. **Permissions/scopes demandés** : afficher explicitement ce que l'intégration va lire/écrire avant la connexion (cohérent avec le principe de transparence IA déjà appliqué ailleurs, `04-AI-DESIGN-SYSTEMS/ai-interaction-principles.md`).
3. **Déconnexion** : action réversible et immédiate, jamais cachée dans un sous-menu profond ; confirmation légère (pas nécessairement un `ConfirmDialog` complet si l'action est peu risquée et réversible), mais toujours un accusé de réception visuel.
4. **Synchronisation** : horodatage de dernière synchronisation réussie visible sur la carte, jamais un état "connecté" sans indication de fraîcheur des données.
5. **Erreurs** : un état d'erreur (token expiré, permission révoquée côté provider) doit être visible sur la carte elle-même dans le hub, pas seulement dans un journal caché — cohérent avec le principe "visibilité de l'état du système" (`NEXUS-UX-PRINCIPLES.md` §5).
6. **Activité récente** : si l'intégration a produit du contexte (ex. GitHub a importé des issues), un lien vers cette activité doit être visible depuis la carte — évite qu'une intégration connectée semble "silencieuse" sans preuve de valeur.
7. **Webhooks/notifications** : toute automatisation déclenchée par une intégration doit apparaître dans le centre de notifications existant (`NotificationCenter`), pas dans un canal séparé — réutiliser l'infrastructure de notification déjà en place plutôt que la dupliquer.

**Cette section 5 est une proposition d'architecture à valider en décision produit avant implémentation — elle n'invente aucune donnée, elle projette les principes déjà actés ailleurs dans le code sur un domaine encore non construit.**

## Ce qu'il ne faut jamais faire

- Ne jamais afficher un statut "Connected" pour une intégration qui n'a pas de mutation serveur réelle.
- Ne jamais remplacer un logo de marque manquant par un emoji ou une icône générique qui prétendrait représenter cette marque.
- Ne jamais mélanger la couleur officielle d'une marque tierce dans le hub tant que le reste du hub reste monochrome — cohérence visuelle avant fidélité de marque décorative.
