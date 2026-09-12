# NEXUS — Landing Page Framework

## Structure réelle actuelle `[CONFIRMED, src/app/page.tsx]`

```
NAVBAR
→ HERO + PRODUCT PREVIEW (un seul temps d'ouverture continu)
→ PROBLEM (value-band)
→ ANSWER (model-section)
→ THE NEXUS MODEL (intelligence-section)
→ IT READS THE WORK (how-it-works)
→ FOUR MOVES (features)
→ FEATURE ARCHITECTURE (integrations-section)
→ TRUST
→ PRICING
→ FAQ
→ FINAL CTA
→ FOOTER
```

Commentaire source explicite : *"the product preview now sits inside the opening beat, pulled up against the hero, so the visitor sees the real surface within the first screen instead of after a full page of copy."* — **règle à préserver** : le visiteur doit voir un aperçu du produit réel dès le premier écran, pas seulement une promesse textuelle.

Ce plan correspond presque terme à terme au framework demandé par le brief (VISION → PROBLÈME → SOLUTION → NEXUS → WORKSPACE → AI → AUTOMATIONS → INTEGRATIONS → PRODUCTIVITY → USE CASES → TRUST → CTA) — le mapping est :

| Étape du brief | Section réelle NEXUS |
|---|---|
| VISION | Hero (promesse + aperçu produit) |
| PROBLÈME | Value band |
| SOLUTION | Model section |
| NEXUS / WORKSPACE | Intelligence section, How it works |
| AI | Intelligence section (le moteur, pas un simple encart marketing) |
| AUTOMATIONS | `[NEEDS DECISION]` — pas de section dédiée automations distincte identifiée ; actuellement fondu dans Features/Integrations |
| INTEGRATIONS | Integrations section |
| PRODUCTIVITY / USE CASES | Features ("Four moves") |
| TRUST | Trust section |
| CTA | Final CTA + CTA du Hero |

## Direction artistique attendue (contrainte du brief, cohérente avec le code existant)

- **Premium, minimaliste, technologique, légèrement futuriste, professionnelle** — cohérent avec l'identité "Pill Atelier Noir" déjà en place (fond quasi-noir, bordures discrètes, typographie resserrée à haute densité d'information au-delà de la taille display).
- **Personal Operating System**, pas un produit "IA gadget" — le champ animé de fond (`HeroAtmosphere`, `NexusSpatialField`) doit rester une **atmosphère derrière le texte**, jamais devant : commentaire source explicite ("The animated field is the mark and the atmosphere behind the copy — never in front of it, and dimmed so the type stays the brightest thing on the page").
- **Violet en dose contrôlée** — la landing ne doit jamais devenir majoritairement violette ; ce token reste un signal d'intelligence ponctuel (badges, glows discrets), jamais un fond de section généralisé.

## Ce qu'il ne faut jamais faire sur la landing

- Copier la mise en page, le rythme d'animation ou la composition visuelle d'un produit tiers précis (interdiction du brief, cf. `01-CORE-PRINCIPLES/`).
- Transformer la page en argumentaire marketing générique déconnecté du produit réel — la règle du code est explicite : *"Every section uses real NEXUS data or real product behaviour."* Toute nouvelle section doit pouvoir s'appuyer sur une fonctionnalité réellement construite, pas sur une promesse vague.
- Laisser le fond animé interférer avec la lisibilité du texte ou le focus clavier.
- Introduire une deuxième largeur de conteneur différente de `--container-page: 1148px` (voir `NEXUS-DESIGN-DECISIONS.md` D-001).

## Checklist spécifique landing

- [ ] Le premier écran montre-t-il un aperçu produit réel, pas seulement une promesse textuelle ?
- [ ] Chaque section peut-elle être reliée à une fonctionnalité réellement construite dans le code ?
- [ ] La densité typographique de la landing utilise-t-elle l'échelle publique complète (`eyebrow → h4 → h3 → lead → h2 → xl → h1 → display-lg → display-xl`) plutôt qu'un saut brutal entre deux paliers extrêmes ?
- [ ] Le violet reste-t-il un accent ponctuel, jamais une couleur de fond dominante ?
- [ ] Le CTA principal est-il unique et cohérent par section (pas de concurrence entre deux CTA `primary` visibles simultanément) ?
- [ ] La page reste-t-elle accessible (contraste, focus, alternatives texte) au même niveau d'exigence que l'application authentifiée — la landing n'est pas un espace où l'on relâche les standards d'accessibilité.
