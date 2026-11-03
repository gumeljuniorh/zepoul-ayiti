# Référentiel SEO multiréseau — Zepoul Ayiti

## Portée
Optimiser le site pour la **découverte**, l'**indexation** et les **partages**, sans changer les éléments visibles. Les balises communes sont plus pertinentes que des balises inventées pour chaque plateforme. Aucun moteur ne garantit l'indexation ou un classement.

### Moteurs de recherche
- **Google, Google Images** : Search Console, sitemap XML, sitemap d'images, canonicals, données structurées Schema.org, liens HTML indexables.
- **Bing, Microsoft Copilot** : Bing Webmaster Tools, sitemap, et, si la propriété du domaine est vérifiée, IndexNow (optionnel).
- **Yahoo, DuckDuckGo, Ecosia, Brave, Qwant, Startpage** : mêmes conventions HTML et liens indexables; certains utilisent des index tiers, sans garantie de couverture.
- **Yandex, Baidu, Naver, Seznam** : mêmes principes techniques; vérification de propriété et soumissions spécifiques facultatives selon la pertinence des marchés. IndexNow peut servir les moteurs participants, pas tous les moteurs.
- Ne jamais inventer un code de vérification de propriété, une clé IndexNow ou une donnée de positionnement.

### Réseaux sociaux et messageries
- **Facebook, Messenger, WhatsApp, Instagram, LinkedIn, Pinterest, Telegram, Discord, Slack** : balises standard Open Graph (`og:title`, `og:type`, `og:description`, `og:url`, `og:image`, `og:image:alt`).
- **X / Twitter** : `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`.
- **TikTok, iMessage et autres** : lien canonique, titre, description et Open Graph pour les clients qui lisent ces balises; l'apparence des aperçus varie par plateforme.
- Présence officielle de Zepoul Ayiti : Facebook, Instagram, TikTok et X seulement; ne pas déclarer un profil d'entreprise sans confirmation.
- Les balises n'activent ni publication automatique ni connexion aux comptes sociaux.

## Points de référence du site
- Domaine canonique : `https://www.zepoulayiti.com/`. Conserver la redirection non-www vers www.
- Sitemaps : `https://www.zepoulayiti.com/sitemap.xml` et `https://www.zepoulayiti.com/sitemap-images.xml`; déclarés dans `robots.txt`.
- Les pages publiées doivent avoir un titre et une description uniques, un canonical cohérent, un seul `h1`, les balises Open Graph et les balises X utiles.
- Les pages de confirmation `merci.html`, d'erreur `404.html` et le tableau de bord `admin.html` doivent rester non indexables.
- Les images de produit réelles publiées doivent apparaître dans le sitemap d'images; `image:loc` suffit. Les anciens `image:title` et `image:caption` sont ignorés par Google.
- Les informations de Schema.org doivent refléter les activités réelles; ne jamais inventer évaluations, prix, stocks, quantités, horaires, recrutements ou projections.

## Maillage interne et qualité du contenu (audit XKey, 3 novembre 2026)
- Les pages publiques importantes doivent avoir au moins un lien HTML `<a href>` contextuel depuis une autre page; une URL dans un sitemap ne remplace pas la navigation interne.
- Maintenir les chemins : accueil → `/vision/`, vision → `/expertise/`, entreprise → `/girard-gumel-j-henry/`. Les liens doivent être compréhensibles et réellement utilisables, non masqués pour les robots.
- La limite « moins de 200 mots » des outils d'audit **n'est pas un seuil minimal de Google** : ajouter du contenu seulement s'il informe réellement un visiteur; ne pas remplir artificiellement les pages Contact, Cotation, Mentions légales ou Réseaux sociaux.
- Les titres SEO ne sont pas soumis à une limite universelle de caractères ou de pixels; privilégier la clarté et vérifier l'aperçu des résultats.
- Le JSON-LD de type WebPage, ContactPage ou BreadcrumbList enrichit la description des pages mais **ne garantit aucun résultat enrichi**.
- Aucun ajout de texte visible, de section ou de changement de disposition ne doit être publié sans approbation.

## Contrôle lors des mises à jour
1. Après chaque changement des pages HTML ou du sitemap, exécuter `node scripts/seo-audit.mjs`.
2. Vérifier en production les codes HTTP, canonicals, `robots.txt`, sitemaps, ressources d'image et les aperçus des liens.
3. Contrôler la propriété du domaine et soumettre les sitemaps dans **Google Search Console** et **Bing Webmaster Tools** (actions à réaliser seulement avec un compte autorisé).
4. Consulter les rapports d'indexation; ne pas déduire l'indexation d'un simple `site:` ou de la validité des balises.
5. Ne jamais modifier le visuel, publier ou fusionner une branche sans l'accord de l'utilisateur. Les copies locales ne suivent automatiquement que `main`, pas les branches de préparation.
