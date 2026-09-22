# Transparence IA et responsabilité humaine

**LEGAL_REVIEW_REQUIRED**, version 22/09/2026. Pas de certificat AI Act.

## Réalité du produit
- NEXUS Engine : calcul/règles locaux au backend ; pas un modèle externe connecté.
- OpenAI / Anthropic : adaptateurs REST existants, variables serveur seulement ; priorité OpenAI si clé présente. La présence d'une clé n'établit pas la santé du provider.
- Aucune connexion ni consommation réelle attestée dans cet environnement. Coût/tokens non instrumentés complètement : afficher inconnu, jamais zéro consommé comme mesure réelle.
- UI Intelligence indique avant la saisie qu'il s'agit d'un assistant IA, qu'il peut se tromper, qu'un fournisseur externe configuré peut recevoir question/contexte, et renvoie aux contrôles mémoire.
- Références = objets réels du snapshot ; il manque une validation factuelle exhaustive des phrases. « VERIFIED » d'une mutation signifie relecture du résultat dans le workspace, pas certification de toute la réponse.
- Risque faible : lectures/navigation. Moyen : création de tâches/projets/objectifs. Élevé : modification, clôture, déplacement, suppression. Toutes mutations existantes requièrent confirmed côté serveur ; suppression requiert en plus confirmDeletion. Les outils LLM sont proposition-only. Envoi externe, paiement, annulation automatique ne sont pas activés.
- Preview UI existant + confirmation explicite ; signature serveur liant preview/payload/version et consommation unique **non implémentées**. Pas d'autonomie financière.
- Budgets user/workspace/plan/provider, coûts fiables, contrôle modèle par région, opt-out IA externe durable : **à développer**.

## Analyse AI Act à faire
La qualification de NEXUS comme fournisseur/déployeur, le champ territorial, les sorties réellement produites et les cas d'usage doivent être déterminés. Ne pas classer toute la plateforme « haut risque » ou « exemptée » par défaut. Interdire le détournement vers scoring sensible d'employés sans nouvelle évaluation.

L'orientation officielle distingue information de l'interaction (50(1)), marquage machine-readable des sorties (50(2)), et disclosures de certains usages, notamment deepfakes et publications d'intérêt public (50(4)). Elle indique l'application depuis le 2 août 2026 et une grâce **limitée** annoncée pour certains systèmes antérieurs, concernant 50(2) seulement. Ce n'est pas une exonération générale pour NEXUS. Source consultée le 22/09/2026 : [2](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).

Le texte prévoit des conditions/exceptions spécifiques (édition assistive, contrôle éditorial humain pour certaines publications, etc.) ; faire examiner chaque sortie et rôle : [5](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50). Le code de pratique est volontaire, pas un substitut à la loi : [1](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content).

**Livré :** notice d'interaction et classification des actions. **Non livré :** dispositif complet de marquage/détection machine-readable, étude territoriale, qualification réglementaire, contrôle des publications générées, preuve d'accords fournisseurs. Une simple étiquette « AI » n'est pas la conformité à tout l'article 50.
