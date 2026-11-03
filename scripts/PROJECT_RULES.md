# Zepoul Ayiti — Règles maîtresses pour la maintenance du site

Ce document est le point de référence du projet pour les nouveaux échanges et les futures modifications. Il concerne le site public uniquement; ne pas y ajouter de données internes ou confidentielles.

## 1. Identité visuelle inchangée par défaut
- Conserver sans autorisation explicite la mise en page, les couleurs, la typographie, les espacements, les icônes, les photographies et les éléments de navigation.
- Conserver les fichiers de logo officiels. Ne pas remplacer les éléments graphiques par des pictogrammes générés.
- Le vert doux `#eff4eb` est une référence existante de l'identité, pas une permission de recolorer davantage de pages.
- Tester les rendus mobile/desktop et les modes clair/sombre en cas de changement de styles.

## 2. Optimisation des performances
- Appliquer le même principe d'optimisation à toutes les pages publiques, avec priorité au **résultat visuel strictement identique**.
- Réduire les requêtes CSS bloquantes seulement si l'ordre de la cascade et les déclarations CSS sont préservés.
- Garder `site.css` comme feuille commune et réutilisable en cache sur les pages internes; la page d'accueil utilise son bundle dédié.
- Ne pas fusionner les feuilles entre lesquelles se trouve un bloc `<style>` sans démontrer que l'ordre de cascade reste identique.
- Ne pas retarder `theme.js` sans vérification du risque de clignotement des thèmes (FOUC). Ne pas modifier le comportement des formulaires, des scripts ou de la navigation pour un gain hypothétique.
- Régénérer les bundles avec `node scripts/build-page-css.mjs` **après toute modification de** `site.css`, `home.css`, `design.css`, `about.css`, `services.css`, `vision.css`, `expertise.css`, `communications.css`, `social.css`, `contact.css` ou `quote-cotation.css`.
- Vérifier le résultat par `node scripts/build-page-css.mjs --check`; le script comprend aussi `home-bundle.css`. Mesurer les performances avant de revendiquer un gain réel.

## 3. Changements, validation et déploiement
- Utiliser une branche dédiée et une pull request pour chaque changement significatif.
- Ne fusionner sur `main`, ni déclencher volontairement de déploiement, sans autorisation explicite.
- Préserver les URLs canoniques existantes et la redirection non-www vers www, sauf décision explicitement validée.
- Garder les contenus professionnels sobres et les informations commerciales exactes; ne pas publier de chiffres de production, de projections ni de données internes non autorisés.
- Réutiliser les fichiers médias existants lorsque possible. Ne pas inventer de visuels ni de faits sur l'entreprise.

## 4. Synchronisation
- `main` est la source des modifications approuvées sur GitHub.
- La copie locale de travail peut récupérer `main` automatiquement; une branche de préparation n'est pas synchronisée par ce mécanisme.
- Ne jamais écraser de changements locaux non enregistrés, ni utiliser `git reset --hard` ou `git clean` pour forcer la synchronisation.
- À l'ouverture d'un nouveau chat, lire ce document et vérifier l'état du dépôt avant de modifier le site.
