# democrito — principes retenus pour NEXUS

Source : dépôt open source `democrito`, design system pour "applications denses en données, inspirées des IDE — dashboards, éditeurs, outils IA". Analysé en lecture (README + `DESIGN.md`), jamais republié tel quel.

democrito documente explicitement sa philosophie visuelle dans un fichier `DESIGN.md` séparé de sa référence de tokens — la "couche de goût" versus la "couche de vocabulaire". C'est une distinction utile, pas un composant ou une palette à copier.

## Ce qui est transférable

- **Séparer la philosophie visuelle (le "pourquoi") de l'inventaire de tokens (le "quoi").** democrito a un `DESIGN.md` qui explique l'intention, et des fichiers de référence séparés pour les tokens exhaustifs. NEXUS a déjà cette séparation en germe (`NEXUS-DESIGN-SYSTEM.md` pour l'entrée, `NEXUS-TOKENS.md` pour l'inventaire) — le principe confirme la structure actuelle, pas de changement nécessaire.
- **Système de profondeur à un nombre de couches fixe et documenté, jamais improvisé.** democrito limite sa hiérarchie de surfaces à trois niveaux nommés par rôle (page → panel → élevé) et interdit explicitement une quatrième couche ou une profondeur par ombre sur les éléments statiques (l'ombre est réservée aux éléments flottants). NEXUS n'a pas encore documenté noir sur blanc son propre nombre de couches de surface dans `NEXUS-TOKENS.md` au-delà de la ramp de couleur — value à vérifier/formaliser si ce n'est pas déjà explicite.
- **"La rareté de l'accent est le principe."** democrito chiffre sa discipline : ~95 % gris neutres, ~4 % accent d'action, ~1 % couleurs sémantiques, et refuse toute couleur "qui ne peut pas nommer son rôle". C'est très proche de la Règle Couleur #2 déjà en place chez NEXUS (lavande réservée au signal "intelligence", jamais décorative) — la contribution de cette référence est le **chiffrage explicite en proportions**, qui pourrait être ajouté comme critère mesurable dans `NEXUS-DESIGN-RULES.md` plutôt que de rester qualitatif ("utilisé avec parcimonie").
- **Le thème "par défaut dans le code" peut différer du thème "par défaut dans la tête des gens".** democrito documente que son thème *Warm* est la valeur `:root` mais que *Dark* est ce que les gens associent au produit dans les captures d'écran — et tranche explicitement lequel utiliser par défaut dans une démo. Pattern utile pour NEXUS si un jour un thème clair est ajouté : documenter la précédence explicitement plutôt que de la laisser implicite dans le code.

## Ce qu'on NE prend PAS

- La palette terracotta/pierre chaude et son inspiration (Sanzo Wada, Dieter Rams cités par democrito) — identité propre à ce système, pas à NEXUS.
- Les trois polices spécifiques (Plus Jakarta Sans / Satoshi) — NEXUS a déjà fait le choix documenté d'Inter Variable + Geist Mono, auto-hébergées ; pas de raison de le remettre en cause depuis cette seule référence.
- Le système de tiers atomiques (atoms/molecules/organisms/templates) exposé comme produit de registry shadcn — NEXUS n'a pas cette contrainte de distribution multi-projets, l'organisation `ui/` vs `<domaine>/` actuelle répond au même besoin sans le formalisme atomique complet.
