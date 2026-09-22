# Résultats de vérification locale

Les sorties finales sont résumées dans le rapport. Tous les transports fournisseurs des suites sont mockés ; PGlite n’est pas Supabase hébergé.

## nexus-npm-ci.log
```text

added 452 packages, and audited 453 packages in 1m

162 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

## nexus-lint.log
```text
/home/user/nexus-app/supabase/tests/intelligence-mission.test.mjs
  19:3  warning  'computeNextBestAction' is assigned a value but never used  @typescript-eslint/no-unused-vars
  53:7  warning  'context' is assigned a value but never used                @typescript-eslint/no-unused-vars

/home/user/nexus-app/supabase/tests/intelligence-proactive.test.mjs
  11:66  warning  'SEVERITY_ORDER' is assigned a value but never used         @typescript-eslint/no-unused-vars
  17:27  warning  'focusMemoryOnEntity' is assigned a value but never used    @typescript-eslint/no-unused-vars
  17:72  warning  'updateMemoryAfterTurn' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/user/nexus-app/supabase/tests/intelligence-signals.test.mjs
  10:66  warning  'SEVERITY_ORDER' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/user/nexus-app/tailwind.config.js
  7:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export

✖ 21 problems (0 errors, 21 warnings)
  0 errors and 9 warnings potentially fixable with the `--fix` option.

```

## nexus-tsc.log
```text

```

## nexus-build.log
```text
├ ƒ /projects
├ ○ /reset-password
├ ○ /robots.txt
├ ƒ /settings
├ ƒ /settings/billing
├ ƒ /signup
├ ○ /sitemap.xml
├ ƒ /tasks
├ ○ /terms
├ ƒ /upgrade
└ ƒ /verify-email


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

## nexus-test.log
```text
# todo 0
# duration_ms 135.781024
TAP version 13
# Subtest: integration SQL: cross-user/workspace isolation, relational tenant binding, cascading disconnect, worker ACL and unknown usage
ok 1 - integration SQL: cross-user/workspace isolation, relational tenant binding, cascading disconnect, worker ACL and unknown usage
  ---
  duration_ms: 2913.245494
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2921.468227
```

## nexus-hardening.log
```text
  duration_ms: 0.576864
  type: 'test'
  ...
# Subtest: UI/source/health regression contracts (static assertions, not a browser audit)
ok 49 - UI/source/health regression contracts (static assertions, not a browser audit)
  ---
  duration_ms: 0.798416
  type: 'test'
  ...
1..49
# tests 49
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 29
# todo 0
# duration_ms 128.102228
```

## nexus-rls.log
```text
TAP version 13
# Subtest: integration SQL: cross-user/workspace isolation, relational tenant binding, cascading disconnect, worker ACL and unknown usage
ok 1 - integration SQL: cross-user/workspace isolation, relational tenant binding, cascading disconnect, worker ACL and unknown usage
  ---
  duration_ms: 2934.076094
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2975.138636
```

## Hors npm test : admin-auth-contract.log
```text
Results: 25 passed, 0 failed
```

## Hors npm test : auth-workspace-bootstrap.log
```text
        extension "pgcrypto" is not available
        relation "storage.buckets" does not exist
        extension "vector" is not available
error: current transaction is aborted, commands ignored until end of transaction block
```

## Hors npm test : core-contract.log
```text
        extension "pgcrypto" is not available
error: function "public.is_active_workspace_member(uuid, uuid)" does not exist
```

## Hors npm test : lineage-reconciliation.log
```text
        001_nexus_core.sql: extension "pgcrypto" is not available
        002_nexus_storage.sql: relation "storage.buckets" does not exist
        003_nexus_ai.sql: extension "vector" is not available
error: extension "pgcrypto" is not available
```

## Hors npm test : migration-logic.log
```text
        relation "storage.buckets" does not exist
        extension "vector" is not available
error: current transaction is aborted, commands ignored until end of transaction block
```

## Hors npm test : onboarding-rls.log
```text
FAIL 001_nexus_core.sql: extension "pgcrypto" is not available
```

## Hors npm test : workspace-bootstrap.log
```text
FAIL 001_nexus_core.sql: extension "pgcrypto" is not available
```

## Exécution finale séquentielle

`npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build` → `npm test` : codes de sortie **0 / 0 / 0 / 0 / 0**. `git diff --check` : succès. Les six fichiers de tests supplémentaires en échec ne font pas partie de cette chaîne.
