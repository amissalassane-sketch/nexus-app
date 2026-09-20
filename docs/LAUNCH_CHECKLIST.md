# NEXUS - checklist de lancement

Statut : FAIT (dans le code) / A FAIRE (code) / REGLAGE (Supabase ou Vercel) / A VERIFIER.

| # | Point | Statut | Note |
|---|-------|--------|------|
| 1 | Page RGPD / confidentialite | A VERIFIER | Verifier que la page existe, est liee depuis /signup et decrit Supabase, Vercel, Google |
| 2 | CGU | A VERIFIER | Idem |
| 3 | API hors front-end | A VERIFIER | Aucune cle secrete dans NEXT_PUBLIC_*, pas de service_role cote navigateur, routes /api protegees |
| 4 | HTTPS force | FAIT | Vercel redirige vers HTTPS ; en-tetes de securite ajoutes dans next.config.ts |
| 5 | Banniere cookies | A VERIFIER | /cookies existe ; verifier la banniere de consentement |
| 6 | Meta title | A VERIFIER | metadata du layout racine et des pages publiques |
| 7 | Image reseaux (Open Graph) | A FAIRE | opengraph-image dans src/app |
| 8 | Favicon | A VERIFIER | src/app/icon.* ou favicon.ico |
| 9 | Sitemap + robots.txt | FAIT | src/app/sitemap.ts et robots.ts (variable NEXT_PUBLIC_SITE_URL a definir sur Vercel avec le domaine final) |
| 10 | Textes alternatifs | A VERIFIER | audit du code (balises img / next/image) |
| 11 | Compression des images | A VERIFIER | lister public/ avec les tailles |
| 12 | Vitesse des pages | A VERIFIER | Lighthouse, TTFB, region Vercel = region Supabase |
| 13 | Contraste | A VERIFIER | captures, texte gris sur fond noir |
| 14 | Responsive | A VERIFIER | captures mobile |
| 15 | Page 404 | FAIT | src/app/not-found.tsx |
| 16 | Liens casses | A VERIFIER | audit des href internes |
| 17 | Validation des formulaires | A VERIFIER | audit du code |
| 18 | Anti-spam | REGLAGE | CAPTCHA et limites de debit dans Supabase Auth |
| 19 | Analytics | REGLAGE | Vercel Web Analytics / Speed Insights (Not Enabled aujourd'hui) |
| 20 | Un seul CTA | A VERIFIER | page d'accueil |

## Reglages manuels

- Supabase > Authentication > Emails : serveur SMTP personnalise + modeles avec {{ .Token }} (code a 6 chiffres).
- Supabase > Authentication > URL Configuration : Site URL et Redirect URLs avec le(s) domaine(s) Vercel.
- Supabase > Authentication : activer le CAPTCHA, revoir les limites de debit.
- Vercel > Settings > Functions : region proche du projet Supabase.
- Vercel > Environment Variables : NEXT_PUBLIC_SITE_URL (domaine final, sans slash final).
