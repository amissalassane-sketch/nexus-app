# NEXUS — Competitive Analysis Framework

## Objectif

Permettre d'analyser un produit concurrent ou une référence externe **sans jamais aboutir à une reproduction**. Ce framework structure comment extraire un principe transférable et comment documenter explicitement ce qui reste hors limites.

## Méthode en 4 temps, pour toute référence étudiée

### 1. Identifier ce qui fonctionne, en termes de comportement
Poser la question en termes de **problème résolu**, pas d'apparence : "quel problème utilisateur ce pattern résout-il, indépendamment de son habillage visuel ?" Exemple : Linear résout "la vitesse perçue" par de l'UI optimiste — le problème (vitesse perçue) est transférable, l'exécution visuelle (police, couleurs) ne l'est pas.

### 2. Séparer strictement principe et identité
Compléter systématiquement ce tableau avant toute proposition d'implémentation :

| Colonne | Contenu |
|---|---|
| Principe extrait | Le comportement ou la structure générale, formulé sans référence à une marque |
| Preuve d'efficacité | Pourquoi ce principe fonctionne (loi UX, donnée d'usage, cohérence avec un besoin NEXUS) |
| Ce qu'on ne prend PAS | Palette, typographie propriétaire, logo, layout pixel-exact, ton éditorial de marque, vocabulaire produit spécifique |
| Application NEXUS | Comment ce principe s'exprime avec les tokens et le vocabulaire NEXUS existants |

### 3. Vérifier la non-reproduction
Avant toute implémentation issue d'une référence externe :
- [ ] Aucune valeur de couleur exacte de la référence n'est recopiée telle quelle.
- [ ] Aucun layout n'est reproduit au pixel près.
- [ ] Aucun texte, slogan ou nom de fonctionnalité n'est repris tel quel.
- [ ] Aucun asset (logo, icône propriétaire, illustration) n'est réutilisé.
- [ ] Le résultat final, présenté seul, ne serait pas identifiable comme "une copie de X" par un observateur qui connaît X.

### 4. Documenter la source
Toute référence utilisée doit être citée dans `03-UX-REFERENCES/` (nouveau fichier si la référence n'y est pas déjà) avec la même structure "Ce qui est transférable / Ce qu'on ne prend PAS" — pas seulement mentionnée en passant dans un commentaire de code.

## Références déjà documentées dans cette base

Voir `03-UX-REFERENCES/` : Vercel/Geist, GitHub Primer, Material Design, Fluent, IBM Carbon, Shopify Polaris, Atlassian Design System, Linear. Consulter ces fichiers avant d'en ajouter un nouveau pour éviter la duplication d'analyse.

## Signal d'alerte — quand s'arrêter

Si une proposition d'implémentation ne peut être formulée qu'en disant "fais comme [produit X]" plutôt qu'en citant un principe extrait et reformulé pour NEXUS, c'est un signal que la limite du brief ("NEXUS ne doit pas devenir un clone d'un autre produit") est sur le point d'être franchie. Reformuler la demande en termes de principe avant d'implémenter.
