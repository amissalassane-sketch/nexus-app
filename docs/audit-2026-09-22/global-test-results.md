# Global mission — résultats mesurés

Date : 2026-09-22. Dernière séquence complète après modifications du code (serveur dev arrêté pour éviter concurrence build/dev).

| Commande | Exit | Durée s |
|---|---|---|
| `npm ci` | 0 | 20.85 |
| `npm run lint` | 0 | 28.09 |
| `npx tsc --noEmit` | 0 | 16.92 |
| `npm run build` | 0 | 24.69 |
| `npm test` | 0 | 77.78 |
| `git diff --check` | 0 | 0.02 |

## Nouvelles suites incluses dans npm test
- global-product : 36 pass, 0 fail, 0 skip.
- stripe-transport : 14 pass, 0 fail, 0 skip. SDK signature réelle sur bytes des fixtures ; tous transports simulés explicitement, aucun réseau fournisseur.
- global-privacy-rls : 1 suite SQL PGlite pass, multiples assertions d'isolation/ACL/rétention, aucune DB distante.
- Total nouveau : 51 tests. Lint : 21 warnings / 0 erreur. npm ci : 0 vulnérabilité signalée par npm, pas un pentest.
- Hérité test:audit : intégrations 20 pass/29 skip (adapters non implémentés), SQL intégrations 1 pass.

## Hors npm test (réexécutés)
Voir global-extra-tests.json : admin-auth-contract 25 pass ; six suites SQL exit 1 sur fixtures/extensions pgcrypto/Storage/types/helpers. Ne pas prétendre que tous les fichiers de test passent. auth-flow HTTP harness non exécuté (fixture dédiée non montée).

## Navigateur
Chromium temporaire Playwright + @sparticuz/chromium + axe, hors dépôt. Deux viewports 1440×1000 / 390×844, reduced-motion, thèmes initialisés avant paint, routes /login /pricing /privacy /admin/login. 16 scans finaux après correction de l'allowlist HMR/hydratation et du contraste admin light : 0 violation automatique, 0 overflow. Incompletes contraste subsistants dans le JSON. Ne couvre pas l'app authentifiée, screen reader ni toute WCAG2.2AA.
Sept assertions d'interaction réussies : Light, persistance reload, System dark, changement OS light, focus clavier, retrait de l'offre annuelle, protection privacy page. Un premier test échouait car l'HMR refusé bloquait l'hydratation ; localhost/127.0.0.1 ajoutés à allowedDevOrigins en développement, puis test complet réexécuté. Un lancement du navigateur a aussi échoué SIGSEGV ; relancement réussi, aucune conclusion de produit tirée du crash du navigateur.

## HTTP
Évidence dans global-http-smoke.json. Aucune config Supabase : GET privacy/regional et billing POST = 503 ; DELETE origine étrangère = 403 ; DELETE même origine correctement accepté par le garde puis 503 de config ; PUT body régional invalide = 400 ; health = 200 mais supabaseConfigured:false. Il s'agit de refus mesurés, pas d'une connexion fonctionnelle.

## Purge
Script sans --execute exécuté : aucun effacement effectué. RPC SQL testée en PGlite avec 1002 anciennes lignes (lots 1000 + 2), ligne récente conservée, authenticated/anon refusés. Pas de scheduler ni appel service-role réel.

## Reproduction locale
`npm ci && npm run lint && npx tsc --noEmit && npm run build && npm test`.
`npm run test:global` exécute les trois nouvelles suites, avec condition react-server pour le marqueur server-only du transport Stripe.
`node --import tsx supabase/tests/<suite-extra>.test.mjs` pour les suites supplémentaires listées dans global-extra-tests.json.
Les outils Chromium/axe sont temporaires et non inclus dans les dépendances applicatives ; les résultats JSON sont conservés. Toute reproduction E2E authentifiée nécessite staging configuré et données synthétiques autorisées.
