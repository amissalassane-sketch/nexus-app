# Security — frontières et limites de preuve

## Contrats conservés

- Sessions Supabase vérifiées côté serveur ; cookies refresh propagés même sur redirection (test session-proxy).
- `safeNextPath` rejette URLs externes, doubles slash, backslash et caractères de contrôle ; tests de normalisation WHATWG.
- Auth/profile/billing/intelligence parsers refusent JSON null, tableaux/primitives et syntaxe invalide.
- Workspace choisi depuis membership actif serveur. Lectures/écritures Intelligence avec workspace/user et actions avec lecture scoped avant mutation. Suppression : `confirmed === true` ET `confirmDeletion === true`, puis read-back.
- Admin : table platform_admins, identité RPC, grant authenticated insuffisant sans `admin_assert_access`. Tests SQL USER→DENIED, ADMIN→ALLOWED, revoked→DENIED, anon sans EXECUTE.
- Pas de tool IA de paiement, subscription, modification de permission ou message externe.

## Helpers RLS : signatures historiques, pas fonctions inventées

- 001 : `is_workspace_member(target_workspace_id uuid) returns boolean`, utilise auth.uid(), statut actif ; `has_workspace_role(uuid, workspace_member_role[])` existe historiquement.
- 006 : `is_active_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid()) returns boolean` ; `can_manage_workspace(uuid, uuid default auth.uid()) returns boolean`, owner/admin actifs.
- 017 : helper propriétaire, revocations réaffirmées par 20260920150000.
- Les appels à un seul argument des helpers à deux paramètres sont légitimes grâce au DEFAULT. Ne pas inventer une surcharge à un argument.
- Les helpers modernes fixent `search_path = public, pg_temp`. Les historiques de 001 utilisent `public`. Catalogues/grants réellement déployés : encore à inspecter.

Aucune ancienne migration modifiée. Le nouveau SQL conserve les checks admin et réaffirme les grants/revokes. RLS de production non certifiée par PGlite.

## Erreurs

`IntelligenceDataError` ne transporte aucun détail SQL : code NOT_AUTHORIZED/403 ou INTELLIGENCE_UNAVAILABLE/503. Succès sans ligne reste null/[] ; échec mémoire/mission ne provoque plus un insert de secours. Les mises à jour signals vérifient leur résultat ; insert sans lignes persistées vérifiées échoue au lieu de présenter des identifiants provisoires comme persistés.

Les routes conservent `error` pour compatibilité, en ajoutant `ok/code/message` pour cette classe. Cela n'est **pas** une normalisation exhaustive de toutes les API. Des ActionError métier historiques et d'autres routes restent à revoir pour redaction complète. Une mutation déjà réussie suivie d'un échec mémoire n'est pas transactionnelle avec elle : ne pas rejouer aveuglément l'action ; idempotence end-to-end encore à ajouter.

## Risques non clos

- Pas de limite de dépense IA persistante opposable ; ai_usage historique accepte des inserts membre et ne peut servir tel quel de compteur financier fiable.
- Supabase rate limits, CAPTCHA, SMTP, MFA, restriction sessions et règles Vercel WAF non inspectables sans accès.
- Signup distingue explicitement ACCOUNT_EXISTS : surface d'énumération, nécessitant politique produit et protections anti-abus ; non présentée comme corrigée.
- Origin email : NEXT_PUBLIC_SITE_URL doit être fixé. Fallback actuel aux headers requête si absent ; allowlist Supabase indispensable. CSRF/origins de toutes les mutations n'ont pas une preuve navigateur complète.
- Pas de certification XSS/SSRF générale : aucun nouveau fetch vers URL arbitraire ajouté ; fournisseurs IA utilisent leurs URLs connues. CSP non ajoutée sans analyse de compatibilité.
- Conservation/suppression de toutes les mémoires, données partagées et logs à auditer sur la base réelle.

Scan local des motifs de clés privées, sk-proj/sk-ant et sb_secret dans src/supabase/scripts/tests/docs : aucun résultat. Aucun secret imprimé. Ce contrôle limité ne remplace pas une analyse historique Git ni la rotation d'une clé précédemment divulguée. `npm audit` ne certifie pas l'absence de faille applicative.

## API examinées

| API | Auth / autorisation | Contrat / limite restante |
|---|---|---|
| auth/signup, signin | publiques, validation credentials, Supabase Auth | anti-bruteforce distant inconnu |
| auth/forgot-password, resend-confirmation | publiques, validation email | quota email/énumération à valider |
| auth/update-password | session vérifiée | session de récupération réelle non testée |
| auth/signout | cookies SSR | erreurs auth historiques |
| profile | session / propre profil | bootstrap réparateur ; pas de userId client autoritaire |
| billing/upgrade | session + owner/admin | 501 explicite, détail SQL masqué |
| intelligence/query, action, missions, signals | session + membership + scope workspace | typed storage errors ; pas de rate budget persistant |
| health | publique | liveness/config, pas readiness DB |

Les RPC administratives ne sont pas des API REST publiques anonymes. Le front utilise les fonctions authentifiées, elles-mêmes protégées en base.

## Addendum — global mission 2026-09-22
Current measured limits and blockers: see root `SECURITY.md` and `docs/GLOBAL_AUDIT_FINAL_2026-09-22.md`. New privacy/retention and Stripe transport primitives do not establish production security or activate billing.
