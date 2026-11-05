# MyCellar

Gestion de cave à vin sur iPhone, avec un sommelier IA intégré. L'app s'installe depuis Safari sur l'écran d'accueil (PWA) et fonctionne hors ligne, sauf pour l'IA.

- **Données** : uniquement sur l'appareil (IndexedDB), chiffrées avec ton mot de passe (AES-GCM, clé dérivée par PBKDF2). Déverrouillage possible avec Face ID.
- **Code** : statique, hébergé sur Cloudflare Pages. L'app vérifie l'empreinte du code et demande ton accord avant toute mise à jour.
- **IA** : appels directs depuis l'iPhone vers Anthropic (Claude Sonnet 5.5 par défaut) ou Mistral, avec ta propre clé API, rangée dans le coffre chiffré.

La spécification complète est dans [SPEC.md](SPEC.md). Les maquettes sont dans [docs/](docs/).

## Structure

```
src/index.html      gabarit de la page (CSP, conteneurs)
src/css/app.css     styles
src/js/*.js         code, assemblé dans l'ordre des noms de fichiers
  00-core           utilitaires, stockage, chiffrement, Face ID, vérification du code
  10-data           référentiels (couleurs, formats, meubles, arômes), modèle, emplacements
  20-ui             icônes, feuilles, verrou, rendu principal
  30-cave           vue Cave : plan, liste, recherche, meubles
  40-wine           ajout, fiche vin et bouteille, rangement, sortie, transferts, primeurs
  50-tasting        dégustation rapide ou complète, contexte, roue des arômes
  55-deg            onglet Dégustations : journal, vue par vin, séances, liste d'envies
  60-ai             IA : sommelier, apogées, lecture d'étiquette, coûts
  62-ploc           import du PDF Ploc : lecture des fiches et du plan, sites, placement, avis du sommelier
  70-boire          vue À boire, conseils de rangement et réassort
  80-plus           réglages, sites et espaces, IA, sauvegarde, sécurité
  85-demo           cave fictive
  87-usage          suivi d'utilisation, rapport, signaler un problème
  88-versions       numéro de version, nouveautés, historique, « Plus d’infos » avant une mise à jour
  90-boot           événements, démarrage, verrouillage automatique
  95-intro          présentation au premier lancement (et Réglages › Aide)
src/static/         sw.js, manifeste, icônes, _headers (copiés tels quels)
src/changelog.json  journal des versions (intégré au code et publié en public/changelog.json)
build.mjs           assemble tout dans public/index.html et calcule l'empreinte CSP du script
public/             ce qui est publié (généré par le build, commité)
tests/              tests de bout en bout (Playwright)
```

## Développer

```bash
node build.mjs          # régénère public/
tests/run.sh            # build + serveur local + tests de bout en bout (captures dans tests/shots/)
node tests/campagne.cjs # campagne de robustesse seule (fuzzing, doubles appuis, IA anormale…), serveur lancé à part
```

Le script est intégré dans la page et la politique de sécurité (CSP) n'autorise que lui, par son empreinte SHA-256. Ne modifie jamais `public/` à la main : modifie `src/`, puis relance `node build.mjs`.

`src/static/sw.js` ne doit pas changer d’une version à l’autre : si l’hébergeur le remplace, l’app y voit une alerte de sécurité. Il ne met en cache que `./`, jamais `./index.html`, car Cloudflare redirige `/index.html` vers `/` et Safari refuse une page en cache issue d’une redirection. `tests/serve.cjs` imite ce comportement.

## Déployer sur Cloudflare Pages

1. Dans Cloudflare : *Workers & Pages* › *Create* › *Pages* › *Connect to Git*, puis choisis ce dépôt.
2. Branche de production : `master`.
3. Framework preset : *None*. Commande de build : laisser vide. Dossier de sortie (*Build output directory*) : `public`.
4. Après chaque déploiement, l'app installée sur l'iPhone propose « Installer la mise à jour ». N'accepte que si tu viens de publier toi-même.

## Installer sur l'iPhone

Ouvre l'adresse Cloudflare Pages dans Safari, puis *Partager* › *Sur l'écran d'accueil*. Lance ensuite l'app depuis l'écran d'accueil : les données d'une app installée ne sont pas effacées par Safari.

Pense à sauvegarder régulièrement (Plus › Sauvegarder, vers « Fichiers » › iCloud Drive). Sans sauvegarde, la cave n'existe que sur cet iPhone.
