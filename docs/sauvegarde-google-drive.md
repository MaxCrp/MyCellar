# Sauvegarde automatique sur Google Drive : mise en place (v2.2)

À faire **une seule fois**, par la personne qui héberge MyCellar. Compte environ 30 minutes. Ensuite, chaque utilisateur (toi, tes amis) connecte simplement son propre compte Google depuis l'app : ses sauvegardes vont dans **son** Drive, dans un dossier caché propre à MyCellar, et restent chiffrées par **son** mot de passe.

Tout est gratuit : un projet Google Cloud (sans facturation) et un Worker Cloudflare (offre gratuite, très largement suffisante).

Adresse de MyCellar (celle que tu ouvres sur l'iPhone) : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/`. Elle est déjà reportée ci-dessous ; attention au « / » final, **sans** « / » final quand c'est indiqué.

---

## Étape 1 : le projet Google Cloud

1. Va sur **console.cloud.google.com** avec ton compte Google, accepte les conditions si c'est la première fois.
2. En haut, menu des projets › **Nouveau projet**. Nom : `MyCellar`. Crée-le, puis sélectionne-le.
3. Menu ☰ › **API et services › Bibliothèque**. Cherche **Google Drive API**, ouvre-la, clique **Activer**.

## Étape 2 : l'écran de consentement

Google a réorganisé cette partie : l'assistant de départ ne demande que les informations de base, les autres réglages sont sur des pages à part, dans le menu de gauche de **Google Auth Platform** (menu ☰ › *Google Auth Platform* ; « API et services › Écran de consentement OAuth » y mène aussi).

1. **Premiers pas** (assistant) : nom de l'application `MyCellar`, adresse e-mail d'assistance, type d'utilisateurs **Externe**, coordonnées du développeur, acceptation des règles.
   Puis page **Branding**, rubrique « Domaine de l'application » (nécessaire pour publier) :
   - Page d'accueil de l'application : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/`
   - Lien vers les règles de confidentialité : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/confidentialite`
   - Lien vers les conditions d'utilisation : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/conditions`
   - **Domaines autorisés** › Ajouter un domaine : `dash-cloudflare-com-4uegc.workers.dev` (sans https ni « / » ; Google n'accepte que le domaine « principal », sans le `mycellar.` de tête, et il couvre aussi le Worker d'autorisation). Enregistre.
   Ces deux pages font partie de MyCellar depuis la v2.2.2.
   - **Pas de logo** : n'en envoie pas (ou retire-le). Un logo rend obligatoire l'examen de Google (plusieurs jours), et la connexion resterait bloquée d'ici là.
   - Le bandeau « Votre application doit être validée… / Accéder au centre de validation » peut être ignoré : la validation n'est exigée que pour les droits sensibles ou restreints, pas pour `drive.appdata`.
2. Page **Audience** : l'état de publication est « En test ». Touche **Publier l'application**, confirme : il doit passer à **En production**. *Indispensable* : en test, seuls les « utilisateurs test » peuvent se connecter, et Google coupe l'autorisation tous les 7 jours (la sauvegarde s'arrêterait). Avec le seul droit `drive.appdata` (non sensible), aucune vérification par Google n'est exigée. L'app reste limitée à 100 utilisateurs tant qu'elle n'est pas vérifiée : largement assez pour toi et tes amis. Google peut afficher « application non validée » à la connexion : touche « Paramètres avancés › Accéder à MyCellar ».
3. Page **Accès aux données** (*facultatif, recommandé*) : **Ajouter ou supprimer des champs d'application**, cherche `drive.appdata` (ou colle `https://www.googleapis.com/auth/drive.appdata` dans l'ajout manuel), coche, **Mettre à jour**, **Enregistrer**. Sans cette déclaration, la connexion fonctionne quand même (l'app demande ce droit elle-même) ; la déclarer rend juste l'écran de Google plus clair. C'est le **seul** droit demandé : l'app ne voit rien d'autre du Drive.

## Étape 3 : l'identifiant OAuth

1. Page **Clients** de Google Auth Platform › **Créer un client** (ancienne interface : API et services › Identifiants › Créer des identifiants › ID client OAuth).
2. Type d'application : **Application Web**. Nom : `MyCellar`.
3. **Origines JavaScript autorisées** : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev`
4. **URI de redirection autorisés** : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/` (avec le « / » final, exactement l'adresse de l'app).
5. Crée. Note l'**ID client** (`…apps.googleusercontent.com`) et le **code secret du client**. Le secret ne doit **jamais** aller dans l'app ni dans le dépôt : il ira uniquement dans le Worker.

## Étape 4 : le Worker Cloudflare

1. Tableau de bord Cloudflare › **Workers & Pages › Créer › Worker**. Nom : `mycellar-auth`. Déploie l'exemple proposé.
2. **Modifier le code** : remplace tout le contenu par celui du fichier `worker/mycellar-auth.js` de ce dépôt. **Déployer**.
3. **Paramètres › Variables et secrets** :
   - `CLIENT_ID` (texte) : l'ID client de l'étape 3 ;
   - `CLIENT_SECRET` (type **Secret**) : le code secret de l'étape 3 ;
   - `ALLOWED_ORIGIN` (texte) : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev` (sans « / » final) ;
   - `REDIRECT_URI` (texte) : `https://mycellar.dash-cloudflare-com-4uegc.workers.dev/` (identique à l'étape 3).
4. Note l'adresse du Worker : normalement `https://mycellar-auth.dash-cloudflare-com-4uegc.workers.dev`.

Le Worker ne fait qu'échanger le code d'autorisation contre des jetons et renouveler le jeton d'accès. Il n'enregistre rien, ne journalise aucun jeton et ne voit jamais les sauvegardes, qui vont directement de l'appareil vers le Drive. Il refuse toute demande qui ne vient pas de l'adresse de l'app.

## Étape 5 : brancher l'app

Renseigne le fichier `src/backup-config.json` du dépôt :

```json
{
  "clientId": "123456789-xxxxxxxx.apps.googleusercontent.com",
  "workerUrl": "https://mycellar-auth.dash-cloudflare-com-4uegc.workers.dev"
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

- **« Reconnexion nécessaire »** : l'autorisation a été retirée (depuis le compte Google) ou l'application est restée en mode « Test ». Vérifie que l'état de publication est « En production » (étape 2.2), puis reconnecte.
- **« Service d'autorisation : erreur 403 »** : `ALLOWED_ORIGIN` ne correspond pas exactement à l'adresse de l'app.
- **« redirect_uri_mismatch » chez Google** : l'URI de redirection (étape 3.4) et `REDIRECT_URI` du Worker doivent être identiques à l'adresse de l'app, « / » final compris.
- Pour tout couper : supprime le Worker, ou retire l'ID client dans Google Cloud. Les sauvegardes déjà faites restent dans le Drive de chacun (dossier caché, visible dans Drive › Paramètres › Gérer les applications › MyCellar, où l'on peut aussi les effacer).
