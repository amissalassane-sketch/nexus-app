# NEXUS — PHASE 6 : Mobile Experience & Intelligence Surface
## Rapport final

**Branche de travail :** `arena/01a040f0-nexus-app` (session Arena — voir §22 pour le nom de branche demandé)
**Base :** `f5d810e` (master, merge PR #41)
**Date :** 2026-08-27

---

## 0. AVERTISSEMENT SUR L'ÉTAT PRÉCÉDENT

Le dépôt contenait un `PHASE6-FINAL-REPORT.md` et un `MOBILE_UX_PHASE_REPORT.md`
antérieurs annonçant une phase mobile terminée. **L'audit du code réel a montré
que cette itération n'existait pas dans le produit** : `MobileHome.tsx` et
`signals-mobile.tsx` n'étaient importés nulle part, contenaient des APIs
inexistantes (`router.openDrawer?.()`, `(window as any).workspaceId`,
`window.unreadNotifications`, `window.recentActivity`) et des liens vers des
routes qui n'existent pas (`/app/missions`, `/app/settings`, `/app/notifications`).
Ce rapport décrit la phase réellement implémentée et vérifiée.

---

## 1. AUDIT INITIAL — VERIFIED

Périmètre inspecté : routes `src/app/**`, layouts (`(app)/layout.tsx`,
`app-shell.tsx`, `workspace-sidebar.tsx`, `topbar.tsx`, `nav-config.ts`),
surfaces Intelligence (`intelligence-view`, `mission-panel`,
`proactive-signals-panel`, `signal-card`, `signal-detail`, `intelligence-ask`),
APIs `/api/intelligence/*`, librairies `src/lib/intelligence/*`, primitives UI,
`globals.css` (Tailwind v4 `@theme`), manifest, viewport, suites
`supabase/tests/*` et `scripts/test-mobile-ux.mjs`, configuration
(package.json, lockfile, tsconfig, postcss, eslint).

### Baseline AVANT toute modification (mesurée, pas déclarée)

| Vérification | Résultat sur master |
|---|---|
| `npm ci` | **IMPOSSIBLE** — `package.json` revenu au template Vite (react 18, framer-motion, scripts vite) alors que le lockfile décrit l'app réelle (Next 16.3.1, React 19.2.8, Supabase, Tailwind v4, three) |
| `npm run build` | **ÉCHEC** — `postcss.config.js` v3 vestigial masque `postcss.config.mjs` (v4) : « you're trying to use tailwindcss directly as a PostCSS plugin » |
| `npx tsc --noEmit` | **26 erreurs** préexistantes (16 dans les composants morts, 4 dans mission-panel, 6 dans lib/scene) + alias `@/*` absent du tsconfig |
| `npm run lint` | **11 erreurs** (toutes dans les composants morts) + 23 warnings |
| `test:unit` (9 suites via tsx) | **56 pass / 1 FAIL** (`h-11` littéral attendu, le code utilise `min-h-[44px]`) — et l'échec de la 1ʳᵉ suite bloquait la chaîne |
| `test:mobile` | 45/45 |
| Suites PGlite | non exécutables sans `npm install --no-save @electric-sql/pglite` |

**Conclusion baseline : la toolchain était cassée avant la phase.** Documenté
puis réparé dans le commit `47961af` (package.json restauré à l'identique du
lockfile — zéro changement de dépendance, lockfile intact —, alias `@/*`
ajouté, `tsconfig.node.json` → `next.config.ts`, suppression des 4 fichiers
vestigiels Vite qui bloquaient le build : `postcss.config.js`, `index.html`,
`vite.config.ts`, `.eslintrc.cjs` ; `.next/` ignoré).

### Question posée pendant l'audit (§18 du cahier des charges)

*« Qu'est-ce que NEXUS peut faire que Linear ne fait pas de la même manière ? »*
Linear organise le travail déclaré. NEXUS **détecte** (moteur de signaux),
**explique** (preuves, scores), **propose** la prochaine action
(nextBestAction déterministe), **exécute avec vérification** (read-back
serveur) et **mémorise** (miroir mémoire Phase 2). Toute l'UX mobile de cette
phase met « ce qui compte + pourquoi + l'action » au-dessus de la navigation.
Linear n'a servi que de référentiel de qualité (densité, calme, hiérarchie) ;
aucun écran, texte, composant ou workflow Linear n'a été copié — l'IA du
produit (signaux + mission + ask) reste l'architecture d'information.

---

## 2. PROBLÈMES TROUVÉS — VERIFIED

| # | Problème (état master) | Gravité |
|---|---|---|
| 1 | Aucune hiérarchie mobile : `/dashboard` rendait les mêmes blocs desktop compressés ; pas de carte mission, pas d'accès Ask | Haute |
| 2 | **Les mutations de mission partaient avec `confirmed: true` sans aucune confirmation UI** (« Continuer » POSTait directement) — violation du contrat confirmation-gated | Critique |
| 3 | Annulation de mission en un tap (icône X) sans confirmation | Haute |
| 4 | Le panneau de signaux affichait le code interne brut : `signal.type.replace(/_/g," ")` → « GOAL AT RISK » — exactement l'anti-pattern cité dans le cahier des charges | Haute |
| 5 | Erreur réseau sur les signaux → `setSignals([])` : l'écran se vidait au lieu de garder l'affiché | Haute |
| 6 | Composants morts `MobileHome.tsx` / `signals-mobile.tsx` : 15 erreurs tsc + 10 erreurs lint, APIs hallucinées, routes inexistantes | Haute |
| 7 | Navigation `window.location.href` sur les surfaces intelligence (perte d'état client) | Moyenne |
| 8 | MissionPanel : `return null` pendant le chargement (flash blanc), libellés dupliqués, aucune action par étape | Moyenne |
| 9 | Signal : entité concernée et impact (nombre d'éléments touchés) jamais affichés | Moyenne |
| 10 | Toolchain cassée (voir baseline) | Bloquante |
| 11 | FocusPanel : CTA 36px < 44px sur téléphone | Moyenne |
| 12 | `refresh` du panneau signaux avec une flèche au lieu d'une icône refresh | Mineure |

---

## 3. ARCHITECTURE RETENUE — VERIFIED

- **Une seule home.** La surface mobile vit sur `/dashboard` (pas de route
  séparée) : `MobileOverview` (server component) est rendue `< lg`, l'overview
  desktop existante est préservée telle quelle dans un wrapper
  `hidden lg:block`. Mêmes lectures serveur pour les deux (zéro fetch client,
  zéro waterfall : la mission est lue en parallèle du snapshot via
  `Promise.all`, bornée 4 s, best-effort).
- **L'intelligence reste sur `/app/intelligence`**, enrichie (mission
  confirmation-gated, signaux humains), et la home mobile y deep-linke :
  `#mission` (ancre scroll-mt), `?ask=1` (focus composer),
  `?q=…` (préremplissage sans envoi).
- **Aucune réécriture** : moteur de signaux, mission engine, mémoire, agent,
  APIs et RLS inchangés. Seule la présentation et le gating UI ont bougé.
- **Aucune seconde mémoire** : le miroir localStorage Phase 2 (`nexus.
  intelligence.memory.v1`) reste l'unique cache client.
- **Suppression des composants morts** plutôt que réparation : ils
  n'étaient pas branchés et reposaient sur des globals inexistants.

## 4. FICHIERS CRÉÉS — VERIFIED

| Fichier | Rôle |
|---|---|
| `src/components/mobile-home/mobile-overview.tsx` | Surface home mobile (attention → mission → action → contexte récent → ask), server-rendered |
| `supabase/tests/mobile-experience.test.mjs` | 41 invariants Phase 6 (statique) |
| `scripts/preview-mobile.mjs` | Harnais de prévisualisation (stub Supabase + scénario mission bloquée réaliste) |
| `docs/screenshots-phase6/*.png` | 8 captures chromium réelles (320/390/768/1440) |

## 5. FICHIERS MODIFIÉS — VERIFIED

| Fichier | Changement |
|---|---|
| `package.json` | Restauré depuis le lockfile + scripts next + chaînes de test |
| `tsconfig.json` / `tsconfig.node.json` | Alias `@/*` ; cible next.config.ts |
| `.gitignore` | `.next/`, `next-env.d.ts` |
| `src/app/(app)/dashboard/page.tsx` | Lecture mission serveur bornée + rendu `MobileOverview` < lg |
| `src/app/(app)/app/intelligence/page.tsx` | `searchParams` (contrat async Next 16) → autoFocusAsk / initialAskQuery |
| `src/components/intelligence/mission-panel.tsx` | Refonte mobile (voir §8) + correction des 4 erreurs tsc |
| `src/components/intelligence/proactive-signals-panel.tsx` | Libellés humains, entité/impact, résilience offline, ref last-known-signals (zéro suppression de règle lint) |
| `src/components/intelligence/intelligence-ask.tsx` | Props `autoFocus`/`initialQuery`, ancre `#nexus-ask`, focus + scrollIntoView |
| `src/components/intelligence/intelligence-view.tsx` | Passage des props Ask |
| `src/components/intelligence-panel.tsx` | CTA FocusPanel 44px mobile (`h-11 sm:h-9`) |
| `src/components/nexus-intelligence/scene/background-field.ts`` , `src/lib/intelligence/signals.ts` | Symboles inutilisés préexistants (préfixe `_`, champ mort) |
| `supabase/tests/supabase-stub.mjs` | Hook additif `shared.extraTables` (appelants existants inchangés) |
| `supabase/tests/intelligence-agent.test.mjs`, `intelligence-agent-v2.test.mjs` | Assertion 44px : `min-h-[44px]` au lieu de `h-11` (voir §14) |

**Supprimés :** `src/components/mobile-home/MobileHome.tsx`,
`src/components/intelligence/signals-mobile.tsx` (morts),
`postcss.config.js`, `index.html`, `vite.config.ts`, `.eslintrc.cjs` (vestiges Vite).

## 6. DÉCISIONS UX — VERIFIED

- **Anglais pour la home** (langue du shell produit : nav, dashboard,
  sidebar), **français conservé pour la console Intelligence** (convention
  établie des phases 2–5 : starters, mission, signaux). Une langue par écran ;
  le mélange est entre écrans, pas à l'intérieur.
- Home mobile = 5 sections maximum, contenu prioritaire avant le scroll
  (vérifié : Attention à ~430px, Mission à ~700px sous le header sur 390×844).
- « Pourquoi » toujours en mots simples (`Pourquoi ça bloque — …`,
  `Voir pourquoi`, `Pourquoi ?` + preuves chiffrées + décomposition du score).
- Aucune donnée inventée : mission absente → carte honnête + « Start with a
  mission » ; workspace vide → écran de bienvenue existant (les deux états
  sont rendus différemment, jamais de signal fictif).
- Phrases naturelles Phase 2 (`"la deuxième"`, `"reporte-la"`, `"pourquoi ?"`)
  : non touchées — le résolveur de références et la mémoire servent le même
  endpoint `/api/intelligence/query` (vérifié par les suites
  intelligence-agent v1/v2, memory, proactive, 208 checks au total).

## 7. DIFFÉRENCES DESKTOP / MOBILE — VERIFIED

| | Mobile (< lg) | Desktop (≥ lg) |
|---|---|---|
| `/dashboard` | MobileOverview (5 sections, cartes empilées, CTA 44px) | Overview existante inchangée (metrics 5 colonnes, grilles, listes) |
| Shell | Header compact + bottom nav 4+drawer + safe-areas | Sidebar 248px + topbar (inchangés) |
| Détail signal | Panneau inline sous la liste | Rail sticky 360px |
| Ask | Composer multi-ligne, `enterKeyHint=send`, trace repliée | Idem (déjà en place), CTA 36px conservés |

Vérifié non-régressif par 6 checks navigateur @1440 (sidebar présent, bottom
nav masqué, overview desktop complète, section Ask mobile cachée).

## 8. AMÉLIORATIONS MISSION — VERIFIED

Confirmation inline AVANT toute mutation (nextBestAction **et** action par
étape **et** annulation de mission) avec payload explicite, badge risque
destructeur, boutons Confirmer/Annuler ≥44px ; « Pourquoi ça bloque » sur
l'étape courante ; « Voir pourquoi » (sujet suivi, échéance, tâches liées,
liste des blocages, signaux liés) ; étapes triées par ordre avec statut
icône+libellé, `#n`, nombre de dépendances, raison de blocage, résumé de
vérification en échec, action disponible ; skeleton de chargement ; offline =
l'affiché reste + message honnête ; navigation SPA (`router.push`). Le
read-back vérifié serveur reste l'unique source de complétion (contrat
Phase 4 intact, 64 checks mission verts).

## 9. AMÉLIORATIONS SIGNALS — VERIFIED

`SIGNAL_TYPE_LABEL` (« Project at risk », « Blocked work »…) à la place du
code interne ; ligne « Concerne : Tâche — X · n éléments touchés » ;
offline/API error → l'affiché reste avec « Connexion perdue. Les signaux
affichés restent disponibles. » ; icône refresh ; preuves + score déjà en
place (inchangés, 77+47 checks verts).

## 10. AMÉLIORATIONS ASK — VERIFIED

`?ask=1` focus + scroll doux du composer (clavier mobile ouvert là où le CTA
pointait) ; `?q=` préremplit sans jamais envoyer (l'utilisateur presse
envoyer, borné à 500 caractères) ; starters de la home en one-tap vers la
console ; vérifié en navigateur : focus réel, préremplissage réel, question
réelle posée et réponse rendue via le fallback déterministe (aucune clé AI).

## 11. NAVIGATION — VERIFIED

Audit : bottom nav 4 destinations + « More » (drawer), header mobile
safe-area, drawer complet. Décision : **pas de nouvelle navigation** —
Missions/Attention/Ask sont des sections de `/app/intelligence` (1 geste
depuis la home via la bottom nav « Intelligence », 0 geste depuis la home
elle-même). Aucune nav lourde ajoutée ; `MOBILE_NAV` inchangé.

## 12. ACCESSIBILITÉ — VERIFIED (code + navigateur)

`aria-label` sur chaque section (`Needs your attention`, `Active mission`,
`Next action`, `Recent activity`, `Ask NEXUS`) ; `role="progressbar"` +
`aria-valuenow` ; `role="alertdialog"` sur les confirmations ;
`aria-expanded` sur les disclosures ; skip-link existant ; focus-visible
préservé partout ; contrastes documentés dans `globals.css` (16.3:1 / 6.6:1 /
4.8:1 AA) ; cibles ≥44px vérifiées mesurées en navigateur (CTA Ask, chips,
CTA mission, « Pourquoi ? », confirmations).

## 13. PERFORMANCE — VERIFIED (mesuré)

Home mobile 100 % server-rendered (0 fetch client, 0 waterfall — mission en
`Promise.all` avec les lectures existantes) ; three.js inchangé et déjà
`dynamic(..., { ssr:false })` ; **71 KB de JS statique transférés** sur
/dashboard et /app/intelligence @390 (mesuré via chromium) ; skeletons plutôt
que flash blanc ; hydration unique (storageState → session réutilisée).

## 14. TESTS — VERIFIED

| Suite | Baseline | Final |
|---|---|---|
| intelligence-agent (+v2) | 56 pass / 1 FAIL | **57 + 116 pass / 0** |
| memory / proactive / signals / mission / experience / onboarding-product / schema-errors | non exécutées (chaîne bloquée) | **115 / 47 / 77 / 64 / 70 / 37 / 33 pass / 0** |
| **mobile-experience (nouvelle)** | — | **41 pass / 0** |
| test:mobile (structurel UX) | 45/45 | **45/45** |
| PGlite (migration-logic / onboarding-rls / workspace-bootstrap) | — | **67 / 43 / 33 pass / 0** |
| **Vérification navigateur chromium (harnais ad hoc)** | — | **59/59** (hiérarchie, ordre, overflow 320→768 sur 2 pages, gate de confirmation tap→cancel, libellés, focus/préremplissage ask, desktop non-régressif) |

Note de transparence sur l'assertion modifiée
(`intelligence-agent*.test.mjs`) : l'ancien test exigeait la classe littérale
`h-11` (hauteur fixe) ; le composer livré est un textarea auto-extensible
dont le plancher 44px est `min-h-[44px]` — même garantie, compatible avec la
croissance jusqu'à 132px. Aucun test supprimé, aucune règle désactivée ;
justification dans le commit.

## 15. LINT — VERIFIED
`npm run lint` → **exit 0, 0 erreur, 11 warnings** (préexistants : variables
inutilisées dans les suites de test + `tailwind.config.js`). Aucune règle
désactivée ; un `eslint-disable` ajouté par erreur en cours de route a été
remplacé par une refacto (ref `hasSignalsRef`).

## 16. TSC — VERIFIED
`npx tsc --noEmit` → **exit 0, 0 erreur** (baseline : 26 erreurs).

## 17. BUILD — VERIFIED
`npm run build` (Next 16.3.1 / Turbopack) → **exit 0**, 44 pages générées ;
re-vérifié après chaque commit fonctionnel (dont un build avec env stub pour
la prévisualisation).

## 18. LIMITES RÉELLES — NOT VERIFIED / assumé

1. **Pas de test sur appareil physique** : la vérification navigateur
   (chromium headless + UA iOS) couvre géométrie, overflow, cibles et flux,
   mais pas le comportement réel du clavier iOS/Android (safe-areas
   implémentées via `env(safe-area-inset-*)` + `viewport-fit=cover`,
   vérifiables au code seulement) — **NOT VERIFIED sur device**.
2. **Service worker / offline complet** : hors périmètre (le manifest PWA
   existant prépare l'installation ; aucune seconde architecture de cache
   n'a été créée, conformément au cahier des charges).
3. **Orientation paysage** : vérifiée au code (aucune largeur fixe
   critique), non testée en navigateur — **partiellement VERIFIED**.
4. La branche demandée `feature/mobile-experience` n'a pas pu être créée :
   cette session Arena est fixée sur `arena/01a040f0-nexus-app` (les commits
   y sont isolés et mergeables comme une feature branch).
5. Les captures d'écran ont été produites avec le stub Supabase et des
   données de prévisualisation clairement identifiées comme telles (harnais
   de dev) — jamais branchées dans le produit.

## 19. CAPTURES / PREUVES — VERIFIED

`docs/screenshots-phase6/` : `01-mobile-dashboard-390`,
`03-mobile-intelligence-390`, `05-mobile-ask-focus-390`,
`06-mobile-dashboard-320`, `07-mobile-intelligence-320`,
`08-tablet-dashboard-768`, `09-desktop-dashboard-1440`,
`10-desktop-intelligence-1440` — produites par chromium contre le build de
production + stub seedé. Journaux de vérification : 59/59 checks navigateur,
624 checks unitaires, 143 checks PGlite.

## 20. COMMITS — VERIFIED

```
bbc1c08 test(mobile): phase 6 suite + seeded preview harness + verification screenshots
3eeec55 feat(mobile): server-driven mobile home surface on /dashboard
614d37a feat(mobile): human signal types, entity line, offline honesty in signals panel
7e964ac feat(mobile): redesign mission panel — confirmation gate, why, per-step actions
1350649 fix(types): silence pre-existing unused symbols in scene & signal libs
47961af chore(build): restore Next.js toolchain manifest removed by the consolidation merge
```

Atomiques, sur `arena/01a040f0-nexus-app`, master non modifié, aucune
migration/permission/RLS touchée, aucun test supprimé.
