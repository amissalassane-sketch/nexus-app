# NEXUS — vérification production de l'onboarding

Ce document sépare les preuves de déploiement des preuves de base de données.
Un fichier SQL présent dans Git ne prouve pas qu'une migration est appliquée au
projet Supabase utilisé par la production.

## État vérifié dans cette session

- Au début du diagnostic, le checkout était sur
  `5d2757ba39ab6a6f4c923bed42a97dbaf8121b33` (`arena/01a03610-nexus-app`).
- Le statut GitHub `Vercel` de ce commit initial était `success` et pointait
  vers le déploiement `Hmb2MFHbVK9drwTb1fPRHrcrLVmT` du projet
  `nexus-intelligence`.
- Le correctif de cette branche contient les fichiers
  `supabase/migrations/016_...sql`, `017_...sql` et `018_...sql`, ainsi que
  `src/app/onboarding/page.tsx` et `src/app/api/onboarding/step-1/route.ts`.
  Après le push, refaire la vérification sur le SHA de la branche et sur son
  nouveau déploiement Vercel.
- L'URL `homepage` actuellement enregistrée dans GitHub
  (`https://nexus-app-iota-one.vercel.app`) répond `DEPLOYMENT_NOT_FOUND`;
  elle ne peut donc pas être considérée comme la production fonctionnelle.
  Les URLs Vercel du projet/de preview sont protégées par Vercel SSO depuis ce
  sandbox.
- La valeur réelle des variables Vercel et la base Supabase ne sont pas
  lisibles depuis GitHub. Elles doivent donc être contrôlées dans les consoles
  Vercel/Supabase ou avec une session CLI autorisée; ne pas déduire leur valeur
  de `.env.example`. Tant que cette vérification et un test avec un compte réel
  ne sont pas faits, le bug ne doit pas être déclaré résolu en production.

## 1. Preuve du déploiement Vercel

Depuis le dépôt :

```bash
git rev-parse HEAD
gh api repos/amissalassane-sketch/nexus-app/commits/$(git rev-parse HEAD)/status
```

La réponse doit contenir un statut `Vercel` `success` et le SHA exact du
commit inspecté. Dans Vercel, ouvrir le déploiement correspondant et contrôler
`Source`, `Environment` et l'alias de production. Un preview de pull request
n'est pas une preuve que l'alias de production a été promu.

Contrôler les variables dans **Project Settings → Environment Variables** pour
**Production** :

- `NEXT_PUBLIC_SUPABASE_URL` : URL `https://<production-project>.supabase.co`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` :
  clé publique du même projet;
- `NEXT_PUBLIC_SITE_URL` : origine publique de l'application, jamais
  `localhost`, une URL `e2b.app` ou un preview Vercel.

Les valeurs des clés ne doivent jamais être ajoutées à Git, à un log ou au
navigateur. L'endpoint public `/api/health` ne renvoie jamais la clé, mais
renvoie le SHA Vercel (`deployment.commit`), l'environnement, `supabaseHost` et
`siteOrigin` afin de comparer le build réellement servi à cette configuration.
Une fois une variable modifiée, redéployer : les variables `NEXT_PUBLIC_*` sont
intégrées au build.

## 2. Preuve de la base Supabase

Ouvrir `supabase/diagnostics/onboarding-production.sql` dans le SQL Editor du
**projet de production** et remplacer l'UUID cible. Le script est en lecture
seule. Il vérifie :

- l'historique `supabase_migrations.schema_migrations`;
- l'existence, la signature et `security_definer` de
  `ensure_personal_workspace`, `get_or_create_personal_workspace` et
  `is_workspace_owner`;
- la policy `base_members_self_claim_owner`;
- la chaîne `auth.users → profiles → workspaces → workspace_members →
  workspace_subscriptions`;
- les comptes orphelins, les rôles non-owner, les memberships inactives et les
  subscriptions manquantes.

La version attendue après ce correctif est 018, en plus de 016 et 017. Si 016
ou 017 manque, ne pas essayer de compenser côté client : appliquer les
migrations dans l'ordre dans le projet de production, puis rafraîchir le cache
API/PostgREST si le dashboard le demande.

## 3. Trace temporaire Step 1

`src/lib/onboarding-diagnostics.ts` et la route
`/api/onboarding/step-1` émettent des événements **uniquement** si la variable
serveur suivante est explicitement activée :

```text
NEXUS_ONBOARDING_DIAGNOSTICS=1
```

Les événements Vercel identifient la requête, l'étape, l'opération (`rpc...`,
`profiles.update`, `profiles.insert`, `profiles.select.verify`), le code et le
message Supabase/Postgres; l'utilisateur ne reçoit jamais le message SQL brut.
Pendant l'incident, corréler le `requestId` retourné par la route avec les logs
Vercel. Après le test, **désactiver la variable et redéployer**, puis supprimer
les logs d'incident de la rétention/outillage conformément à la politique de
confidentialité. Ne jamais laisser cette variable activée en permanence.

L'ordre attendu est strictement :

```text
auth.getUser
rpc.get_or_create_personal_workspace
profiles.update   (ou profiles.insert si aucune ligne)
profiles.select.verify
```

La route ne fait aucun `service_role` call et ne fait confiance à aucun
`workspace_id` fourni par le navigateur.

## 4. Origine des champs préremplis

Le code actuel rend l'origine déterministe :

- `profiles.display_name` et `profiles.username` sont la seule source de
  préremplissage applicative;
- un compte sans ligne `profiles` reçoit deux champs React vides;
- les anciennes clés `localStorage` d'identité ne sont plus lues;
- `sessionStorage` ne conserve que l'étape, jamais le nom ou le username, et
  ses clés contiennent l'UUID de l'utilisateur;
- les métadonnées Supabase Auth et l'email ne sont plus utilisés comme fallback
  d'identité;
- `autocomplete` reste sémantique (`name`/`username`) : un navigateur peut
  encore proposer son propre autofill, qui doit être testé séparément, mais
  cette valeur n'est pas réutilisée par un autre compte.

Tester ce point dans DevTools en vidant successivement les champs
`profiles`, le state de la page, `localStorage` et `sessionStorage`, puis avec
un profil différent. Le changement d'UUID déclenche aussi la remise à zéro du
state React.

## 5. Test RPC avec une session authentifiée réelle

Pour tester le RPC dans le vrai projet sans passer par le SQL Editor :

```bash
NEXT_PUBLIC_SUPABASE_URL='https://<production-project>.supabase.co' \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='(clé publique)' \
ONBOARDING_ACCESS_TOKEN='(jeton court d'un compte de test)' \
node scripts/verify-production-onboarding.mjs
```

Le script appelle réellement `auth.getUser()`,
`get_or_create_personal_workspace()`, puis relit la membership et le profil
avec le JWT du compte. Il n'utilise jamais `service_role` et n'écrit aucune
valeur dans un fichier. Ne pas coller le jeton dans Git ou dans le chat.

## 6. Test d'un compte réel

Avec un compte de test explicitement autorisé dans le projet de production :

1. créer un compte email neuf et confirmer l'email;
2. ouvrir `/onboarding`, saisir l'identité et cliquer sur Continue;
3. contrôler la trace et les cinq tables dans le diagnostic SQL;
4. poursuivre les étapes 2, 3 et 4 jusqu'à `/app`;
5. refaire avec un Google neuf, un Google existant, un ancien compte email,
   un refresh pendant l'onboarding et un logout/login vers un autre compte;
6. vérifier qu'aucune donnée du compte A n'est visible pour le compte B.

Ne pas utiliser de comptes utilisateurs réels dans les fixtures automatisées et
ne pas conclure au succès production à partir de ces seules fixtures.
