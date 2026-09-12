# Pattern — Formulaires et validation [CONFIRMED, src/components/ui/input.tsx]

## Composants existants

`Input`, `Textarea`, `Select`, `Field` (wrapper label + hint), `Checkbox`, `PasswordInput` (`ui/password-input.tsx`). Tous partagent une même classe de base `field` : bordure par défaut, focus avec halo lavande à 14% d'opacité (`shadow-[0_0_0_3px_rgba(233,228,255,0.14)]`), état désactivé à 50% d'opacité.

**Point notable** : le halo de focus des champs de formulaire utilise la couleur **lavande** (accent intelligence), pas un bleu générique. C'est cohérent avec la position "l'accent lavande signale l'intelligence" — mais ici il est utilisé pour *tout* focus de champ, pas seulement les champs liés à l'IA. `[INFERRED]` : ce choix élargit le rôle de la lavande de "signal IA" à "signal de focus clavier général". Ce n'est pas nécessairement une contradiction (le focus est un état système, pas une décoration), mais c'est une nuance à connaître : **ne pas ajouter une deuxième couleur de focus** pour "réserver" la lavande à l'IA — la convention actuelle du code est déjà celle-ci et doit être respectée telle quelle, pas réinterprétée.

## Règles de labellisation (héritées de Primer/UNICEF, `01-CORE-PRINCIPLES/`)

- **`Field` impose un `label` textuel** — jamais un placeholder comme seul porteur de sens. Toute nouvelle capture d'utilisateur doit utiliser `Field` plutôt qu'un `<input>` nu avec juste un `placeholder`.
- Le `hint` (aide contextuelle) apparaît sous le champ, jamais seulement en tooltip caché — cohérent avec le principe "explicite pour tous les niveaux de compétence technique" (UNICEF).

## Validation et erreurs

- `[INFERRED]` : les erreurs de validation doivent apparaître **près du champ concerné**, jamais uniquement en résumé global en haut de formulaire, pour rester utilisables au clavier et au lecteur d'écran (l'utilisateur doit pouvoir associer l'erreur au bon champ sans chercher).
- Pour les erreurs serveur (limite de plan atteinte, doublon), utiliser `Alert` (tone `danger`) plutôt qu'un `toast` volatile si l'erreur bloque la soumission — un toast disparaît, une erreur de formulaire bloquante doit rester visible tant qu'elle n'est pas résolue.
- **Ne jamais désactiver un bouton de soumission sans expliquer pourquoi** (règle UNICEF déjà citée) — si un formulaire doit bloquer la soumission (champ requis manquant, limite de plan), afficher le hint correspondant à côté du bouton ou du champ fautif.

## Boutons de formulaire

- Utiliser `Button` avec `loading` pendant la soumission réseau (jamais un simple texte qui change sans indicateur visuel) — le composant gère déjà le spinner et le verrouillage d'interaction (`disabled={disabled || isBusy}`).
- `success`/`error` props du bouton pour un feedback direct post-soumission bref (voir `empty-loading-error-states.md`).

## Ce qu'il ne faut jamais faire

- Ne jamais utiliser `window.confirm()`/`window.alert()` natifs pour valider une action destructrice — NEXUS a explicitement un test structurel (`scripts/test-mobile-ux.mjs`) qui vérifie l'absence de `confirm()` natif et impose `ConfirmDialog` à la place.
- Ne jamais soumettre un formulaire sur une simple pression de touche sans `type="submit"` explicite ou gestion de `Enter` intentionnelle — en particulier dans les champs multi-lignes (`Textarea`) où `Enter` doit insérer un saut de ligne, pas soumettre (voir la distinction faite dans `intelligence-ask.tsx` avec `enterKeyHint="send"` réservé au champ de chat).
