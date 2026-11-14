# Sauvegarde automatique sur Google Drive : mise en place (v2.2)

À faire **une seule fois**, par la personne qui héberge MyCellar. Compte environ 30 minutes. Ensuite, chaque utilisateur (toi, tes amis) connecte simplement son propre compte Google depuis l'app : ses sauvegardes vont dans **son** Drive, dans un dossier caché propre à MyCellar, et restent chiffrées par **son** mot de passe.

Tout est gratuit : un projet Google Cloud (sans facturation) et un Worker Cloudflare (offre gratuite, très largement suffisante).

Dans ce qui suit, remplace `https://TON-APP.pages.dev` par l'adresse réelle de MyCellar (celle que tu ouvres sur l'iPhone), **sans** « / » final quand c'est indiqué.

---

## Étape 1 : le projet Google Cloud

1. Va sur **console.cloud.google.com** avec ton compte Google, accepte les conditions si c'est la première fois.
2. En haut, menu des projets › **Nouveau projet**. Nom : `MyCellar`. Crée-le, puis sélectionne-le.
3. Menu ☰ › **API et services › Bibliothèque**. Cherche **Google Drive API**, ouvre-la, clique **Activer**.

## Étape 2 : l'écran de consentement

1. Menu ☰ › **API et services › Écran de consentement OAuth** (selon la version : « Google Auth Platform › Branding »).
2. Type d'utilisateurs : **Externe**. Nom de l'application : `MyCellar`. Adresse e-mail d'assistance et coordonnées du développeur : la tienne.
3. **Accès aux données** (ou « Champs d'application ») › Ajouter : `https://www.googleapis.com/auth/drive.appdata` (« Afficher, créer et supprimer ses propres données de configuration dans votre Google Drive »). C'est le **seul** droit demandé : l'app ne voit rien d'autre du Drive. Il est classé « non sensible ».
4. **Audience** (ou « Statut de publication ») › **Publier l'application** › passer **En production**.
   *Important* : en mode « Test », Google coupe l'autorisation tous les 7 jours, et la sauvegarde s'arrêterait.
   Tant que l'application n'est pas vérifiée par Google, elle est limitée à 100 utilisateurs : largement assez pour toi et tes amis. Google peut afficher un avertissement « application non validée » au moment de la connexion : touche « Paramètres avancés › Accéder à MyCellar ».

## Étape 3 : l'identifiant OAuth

1. Menu ☰ › **API et services › Identifiants** (ou « Clients ») › **Créer des identifiants › ID client OAuth**.
2. Type d'application : **Application Web**. Nom : `MyCellar`.
3. **Origines JavaScript autorisées** : `https://TON-APP.pages.dev`
4. **URI de redirection autorisés** : `https://TON-APP.pages.dev/` (avec le « / » final, exactement l'adresse de l'app).
5. Crée. Note l'**ID client** (`…apps.googleusercontent.com`) et le **code secret du client**. Le secret ne doit **jamais** aller dans l'app ni dans le dépôt : il ira uniquement dans le Worker.

## Étape 4 : le Worker Cloudflare

1. Tableau de bord Cloudflare › **Workers & Pages › Créer › Worker**. Nom : `mycellar-auth`. Déploie l'exemple proposé.
2. **Modifier le code** : remplace tout le contenu par celui du fichier `worker/mycellar-auth.js` de ce dépôt. **Déployer**.
3. **Paramètres › Variables et secrets** :
   - `CLIENT_ID` (texte) : l'ID client de l'étape 3 ;
   - `CLIENT_SECRET` (type **Secret**) : le code secret de l'étape 3 ;
   - `ALLOWED_ORIGIN` (texte) : `https://TON-APP.pages.dev` (sans « / » final) ;
   - `REDIRECT_URI` (texte) : `https://TON-APP.pages.dev/` (identique à l'étape 3).
4. Note l'adresse du Worker, du type `https://mycellar-auth.TON-COMPTE.workers.dev`.

Le Worker ne fait qu'échanger le code d'autorisation contre des jetons et renouveler le jeton d'accès. Il n'enregistre rien, ne journalise aucun jeton et ne voit jamais les sauvegardes, qui vont directement de l'appareil vers le Drive. Il refuse toute demande qui ne vient pas de l'adresse de l'app.

## Étape 5 : brancher l'app

Renseigne le fichier `src/backup-config.json` du dépôt :

```json
{
  "clientId": "123456789-xxxxxxxx.apps.googleusercontent.com",
  "workerUrl": "https://mycellar-auth.TON-COMPTE.workers.dev"
}
```

(Ces deux valeurs ne sont pas secrètes.) Ou envoie-les simplement à Claude, qui les ajoutera, reconstruira l'app et publiera. Comme pour toute mise à jour, l'app installée proposera « Installer la mise à jour ».

## Étape 6 : vérifier

1. Sur l'iPhone, ouvre MyCellar (depuis l'écran d'accueil) › Réglages › Sauvegarde › **Sauvegarde automatique** › **Connecter Google Drive**.
2. Choisis ton compte Google, accepte. Tu reviens dans l'app : déverrouille ta cave. Le message « Google Drive connecté » s'affiche, puis la première sauvegarde part.
3. Réglages › Sauvegarde affiche « Google Drive · dernière : … ». « Restaurer une version » liste les sauvegardes.

### Sur un nouvel appareil

Au premier lancement : **Restaurer depuis Google Drive** › compte Google › choisis la version › mot de passe de la cave. La sauvegarde automatique reprend aussitôt.

## En cas de souci

- **« Reconnexion nécessaire »** : l'autorisation a été retirée (depuis le compte Google) ou l'application est restée en mode « Test ». Vérifie l'étape 2.4, puis reconnecte.
- **« Service d'autorisation : erreur 403 »** : `ALLOWED_ORIGIN` ne correspond pas exactement à l'adresse de l'app.
- **« redirect_uri_mismatch » chez Google** : l'URI de redirection (étape 3.4) et `REDIRECT_URI` du Worker doivent être identiques à l'adresse de l'app, « / » final compris.
- Pour tout couper : supprime le Worker, ou retire l'ID client dans Google Cloud. Les sauvegardes déjà faites restent dans le Drive de chacun (dossier caché, visible dans Drive › Paramètres › Gérer les applications › MyCellar, où l'on peut aussi les effacer).
