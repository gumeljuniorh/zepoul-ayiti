# Déploiement du système opérationnel Zepoul Ayiti

Ce document décrit uniquement les réglages à effectuer dans les interfaces Cloudflare et Google. Aucune commande Terminal n’est nécessaire.

## Architecture

1. Le site envoie la demande vers `/api/quote`.
2. Le Worker `zepoul-quote-security` vérifie l’origine, les champs et le jeton Turnstile.
3. Le Worker transmet la demande à Google Apps Script avec un secret partagé.
4. Apps Script enregistre la demande dans `DEMANDE DE COTATION`.
5. Le tableau de bord `admin.html`, protégé par Cloudflare Access, lit et met à jour le même registre.
6. Le stock public provient de `STOCK PUBLIC` et n’est affiché que s’il est activé et mis à jour depuis moins de 72 heures.

## 1. Google Apps Script

1. Ouvrir le projet Apps Script relié à la feuille `Demandes de cotation - Zepoul Ayiti`.
2. Remplacer tout le contenu de `Code.gs` par le contenu du fichier `google-apps-script.gs`.
3. Ouvrir **Paramètres du projet**.
4. Dans **Propriétés du script**, ajouter :
   - Propriété : `WORKER_SHARED_SECRET`
   - Valeur : une longue valeur privée choisie par vous.
5. Ouvrir **Déployer**, puis **Gérer les déploiements**.
6. Modifier le déploiement Web existant, sélectionner **Nouvelle version**, puis déployer.

Le script créera automatiquement l’onglet `STOCK PUBLIC` et les colonnes opérationnelles manquantes lors du premier appel autorisé.

## 2. Cloudflare Worker

1. Ouvrir **Workers & Pages** puis `zepoul-quote-security`.
2. Ouvrir **Edit code**.
3. Remplacer le code par le contenu de `cloudflare-worker.js`, puis déployer.
4. Dans **Settings**, ouvrir **Variables and secrets**.
5. Conserver ou ajouter :
   - Secret `TURNSTILE_SECRET_KEY` : votre clé secrète Turnstile existante.
   - Secret `WORKER_SHARED_SECRET` : exactement la même valeur que dans Apps Script.
   - Variable `ADMIN_EMAILS` : l’adresse personnelle autorisée à ouvrir le tableau de bord. Plusieurs adresses peuvent être séparées par des virgules.
   - Variable `ADMIN_ENABLED` : laisser `false` jusqu’à la fin de l’étape Cloudflare Access.
   - Variable `TEAM_DOMAIN` : domaine d’équipe Access sous la forme `https://votre-equipe.cloudflareaccess.com`.
   - Variable `POLICY_AUD` : valeur **Application Audience (AUD) Tag** de l’application Access qui protège le tableau de bord et son API.
   - Variable facultative `APPS_SCRIPT_URL` : URL `/exec` du déploiement Apps Script actuel.
   - Secret facultatif `ALERT_WEBHOOK_URL` : URL de notification si vous en configurez une plus tard.
6. Dans **Triggers**, remplacer l’ancienne route limitée à la cotation par ces routes :
   - `www.zepoulayiti.com/api/*`
   - `zepoulayiti.com/api/*`
7. Si l’option existe dans les paramètres du Worker, désactiver l’adresse publique `workers.dev`. Les API doivent répondre uniquement sur le domaine Zepoul Ayiti.

## 3. Protection du tableau de bord

Ne rendez pas `admin.html` opérationnel sans cette protection.

1. Ouvrir **Cloudflare Zero Trust**.
2. Ouvrir **Access**, puis **Applications**.
3. Créer une application **Self-hosted** et lui ajouter deux chemins protégés : `www.zepoulayiti.com/admin.html` et `www.zepoulayiti.com/api/admin/*`.
4. Créer une règle **Allow** limitée à votre adresse e-mail personnelle.
5. Dans **Additional settings**, copier l’**Application Audience (AUD) Tag** dans la variable Worker `POLICY_AUD`.
6. Copier votre domaine d’équipe Cloudflare Access dans la variable Worker `TEAM_DOMAIN`.
7. Utiliser la même adresse autorisée dans la variable Worker `ADMIN_EMAILS`.
8. Après avoir testé la protection Access, remplacer la variable Worker `ADMIN_ENABLED` par `true`.

Le Worker vérifie la signature, l’émetteur, l’audience et l’expiration du jeton Access avant de retourner une donnée commerciale.

## 4. Supervision horaire

1. Dans le Worker, ouvrir **Triggers**.
2. Dans **Cron Triggers**, ajouter `0 * * * *`.
3. Le Worker vérifiera Apps Script chaque heure. Les échecs apparaîtront dans les logs Cloudflare.
4. Si `ALERT_WEBHOOK_URL` est configuré, une notification sera également transmise à cette adresse.

## 4 bis. Limitation des abus

Si votre forfait Cloudflare propose les règles de limitation de débit :

1. Ouvrir **Security**, puis **WAF** et **Rate limiting rules**.
2. Créer une règle nommée `Protection formulaire cotation`.
3. Cibler la méthode `POST` et le chemin `/api/quote`.
4. Limiter à cinq tentatives par adresse IP sur dix minutes, puis bloquer pendant dix minutes.

Turnstile reste obligatoire : cette règle protège surtout l’API contre les rafales de requêtes.

## 5. Publication du stock

Dans l’onglet `STOCK PUBLIC`, utiliser uniquement la ligne 2 :

- `A2` : nombre de cartons disponibles.
- `B2` : statut public.
- `C2` : date et heure de la mise à jour.
- `D2` : court message public.
- `E2` : `OUI` pour publier ou `NON` pour masquer.

Le site ne montre rien si la publication est désactivée, si la quantité est invalide ou si la mise à jour date de plus de 72 heures.

## 6. Vérifications finales

1. Ouvrir `https://www.zepoulayiti.com/api/health` : la réponse doit contenir `"success":true`.
2. Envoyer une demande test depuis le formulaire public.
3. Vérifier qu’une nouvelle ligne apparaît dans `DEMANDE DE COTATION`.
4. Ouvrir `https://www.zepoulayiti.com/admin.html` et confirmer que Cloudflare demande l’authentification.
5. Publier temporairement un stock test, vérifier le bloc sur l’accueil, puis remettre `E2` à `NON` si vous ne souhaitez pas le laisser visible.

## Fichiers à ne jamais modifier avec des secrets

Ne placez aucune clé secrète dans `index.html`, `site.js`, `cloudflare-worker.js`, `google-apps-script.gs` ou GitHub. Les valeurs privées doivent rester dans **Cloudflare Variables and secrets** et **Apps Script Properties**.
