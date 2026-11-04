# Rapport de bugs — campagne de tests sur MyCellar 1.6.1

- **Date** : 4 novembre 2026
- **Version testée** : 1.6.1 (commit `ca5c91a`)
- **Méthode** : tests automatisés de bout en bout (Playwright, Chromium, écran d'iPhone 390 × 844 et 320 px), plus une relecture du code aux endroits à risque. Les réponses de l'IA sont simulées.
- **Script** : `tests/campagne.cjs` (64 tests, environ 2 minutes). Le détail brut de chaque exécution est écrit dans `tests/shots/campagne.json`.

## Synthèse

| Domaine | Tests | Anomalies |
|---|---|---|
| Fuzzing des saisies (fiche vin, meubles, sites, espaces, recherches) | 18 | 11 |
| Sécurité (injection HTML dans tous les champs et dans les réponses de l'IA) | 2 | 0 |
| Doubles appuis | 6 | 5 |
| Combinaisons inattendues | 10 | 1 (+ 3 observations) |
| Réponses anormales de l'IA | 17 | 2 (+ 1 observation) |
| Sauvegardes corrompues | 7 | 0 (+ 1 observation) |
| Affichage étroit (320 px) et noms très longs | 1 | 0 |
| Volume (1 000 vins, 3 000 bouteilles, 2 000 dégustations) | 1 | 1 (observation) |
| Verrouillage et mots de passe | 2 | 0 |
| Relecture du code | — | 2 |

Après regroupement, il reste **16 bugs distincts** : 1 majeur, 4 moyens, 8 mineurs et 3 observations.

**Ce qui tient bien** :
- **Injection HTML** : aucune, ni dans les 15 champs texte, ni dans les réponses du sommelier, ni dans les hypothèses à l'aveugle.
- **Erreurs réseau et API** : toutes les erreurs testées produisent un message clair, sans blocage (coupure réseau, 401, 429, 500 en HTML, refus, réponse tronquée, JSON invalide, réponse vide, boucle `pause_turn` arrêtée après 4 appels).
- **Sauvegardes** : les 7 fichiers corrompus ou piégés sont tous refusés sans planter.
- **Mots de passe** : 200 caractères avec emoji et guillemets acceptés. Après 6 essais faux, le délai d'attente s'applique bien.
- **Affichage** : aucun débordement horizontal à 320 px, même avec des noms de 100 caractères.
- **Volume** : performances correctes à 1 000 vins, chaque écran s'affiche en moins de 250 ms.

## Bugs

Gravité : **majeur** (perte ou corruption de données probable dans un usage normal), **moyen** (donnée fausse ou comportement trompeur), **mineur** (gêne ou cas limite), **observation** (choix à confirmer ou risque futur).

### B01 · Majeur · Un double appui applique l'action deux fois
- **Reproduire** : toucher deux fois rapidement le bouton de validation. C'est fréquent sur iPhone quand la réponse tarde ou que le doigt rebondit.
- **Constaté**, sur 5 formulaires sur 6 :
  - « Ajouter » des bouteilles à une fiche : les bouteilles sont créées deux fois ;
  - « Confirmer la sortie » : **deux sorties** sont enregistrées dans le journal ;
  - « Enregistrer la dégustation » : deux dégustations identiques ;
  - « Ajouter le meuble » : deux meubles ;
  - « Démarrer la séance » : deux séances.
- **Attendu** : une seule exécution. Seul l'envoi au sommelier est protégé, par son indicateur « occupé ».
- **Cause** : le gestionnaire de formulaires (`src/js/90-boot.js`) ne bloque pas le bouton pendant l'exécution, qui est asynchrone. L'action `tasteSave` n'a pas de garde non plus.

### B02 · Moyen · La fiche vin accepte des valeurs absurdes, ou les corrige sans prévenir
- **Constaté** :
  - millésime 3000, 1800 ou « 19 » acceptés tels quels ;
  - millésime « abcd » transformé en « non millésimé » sans avertissement ;
  - prix de −5 € ou de 10¹² € accepté (la valeur de la cave s'en trouve faussée) ;
  - degré de 300 % accepté ;
  - quantité « 1e9 » ramenée à 500 bouteilles, créées d'un coup sans confirmation ;
  - quantité 0 transformée en 1 sans prévenir.
- **Attendu** : des bornes raisonnables, avec un message à côté du champ concerné.
- **Cause** : `readWineForm` et `FORMS.wine` (`src/js/40-wine.js`) convertissent les valeurs sans les valider.

### B03 · Moyen · Une fenêtre de dégustation incohérente est acceptée
- **Constaté** :
  - à la saisie manuelle, un début en 2035 pour une fin en 2020 est enregistré, et le vin passe en « trop tôt » ;
  - une apogée en 2050 pour une fin en 2030 est aussi enregistrée ;
  - la barre de fenêtre et le tableau « À boire » s'appuient ensuite sur ces valeurs.
- **Attendu** : début ≤ apogée ≤ fin, avec un message en cas d'incohérence.
- **Cause** : `readWineForm` (`src/js/40-wine.js`) ne vérifie pas l'ordre des années.

### B04 · Moyen · La lecture d'étiquette accepte des valeurs hors liste
- **Constaté** : si le modèle renvoie un type, une couleur ou une catégorie inconnus, ils passent dans la fiche (`kind: "biere"`, `couleur: "violet"`, `cat: "vodka"`, `age: -3`). On obtient alors un vin d'un type inconnu : ni vin, ni spiritueux, pastille grise, filtres faux. Les sorties structurées de Claude l'empêchent en principe, mais pas Mistral, ni un changement de modèle.
- **Attendu** : toute valeur hors liste est ramenée à une valeur connue ou laissée vide.
- **Cause** : `onPhoto` (`src/js/60-ai.js`) ne vérifie que le format.

### B05 · Moyen · Les dégustations sans note reçoivent 14/20
- **Constaté** : une dégustation rapide enregistrée sans toucher au curseur est notée 14/20. C'est le cas, par exemple, d'un simple commentaire après une sortie. Ces fausses notes faussent les moyennes de la vue par vin, le classement des séances et le profil de goûts transmis au sommelier.
- **Attendu** : pas de note tant que l'utilisateur n'a pas touché le curseur.
- **Cause** : `startTaste` (`src/js/50-tasting.js`) initialise la note à 14.

### B06 · Mineur · La réévaluation par l'IA peut proposer une fenêtre partielle
- **Constaté** : si l'IA renvoie début 2090, apogée 1500 et fin 2030, l'app écarte les deux années invalides mais affiche quand même la proposition « ?–2030 », avec un bouton « Mettre à jour ».
- **Attendu** : une proposition incohérente est écartée en entier, sans rien afficher.
- **Cause** : `reevaluate` (`src/js/60-ai.js`) ne contrôle pas la cohérence d'ensemble. `estimateApogee` a le même défaut, moins visible : il garde la fin et met le début à vide.

### B07 · Mineur · Import Ploc : le total annoncé ne correspond pas à l'import réel
- **Constaté** : une ligne lue avec une quantité de 999 999 donne un bouton « Importer 1000000 bouteilles ». L'import limite pourtant à 200 par ligne, sans le dire. Les quantités nulles ou négatives deviennent 1 sans être signalées.
- **Attendu** : les quantités sont bornées dès l'écran de vérification, et une ligne douteuse est signalée.
- **Cause** : `plocReview` et `plocGo` (`src/js/60-ai.js`).

### B08 · Mineur · Un site peut avoir un nom vide, et un espace une cible négative
- **Constaté** :
  - un nom de site fait uniquement d'espaces passe le contrôle « obligatoire », puis il est enregistré vide ;
  - des places cibles de −3 sont acceptées.
- **Cause** : `FORMS.site` et `FORMS.space` (`src/js/80-plus.js`).

### B09 · Mineur · Les nombres écrits avec un point comme séparateur de milliers sont ignorés
- **Constaté** : « 1.234,50 » donne une valeur vide (le prix disparaît), alors que « 1 234,50 » est lu correctement.
- **Cause** : `num()` (`src/js/00-core.js`).

### B10 · Mineur · Une envie reste enregistrée après la suppression de son vin
- **Constaté** : supprimer un vin retire ses bouteilles et ses dégustations, mais pas son entrée de la liste d'envies. Elle reste invisible, mais encore présente dans les données et dans les sauvegardes.
- **Cause** : `delWine` (`src/js/40-wine.js`).

### B11 · Mineur · Ranger plus de bouteilles que de places libres, sans avertissement
- **Constaté** : en rangeant 120 bouteilles dans un espace qui n'a que 4 places libres, l'écran indique « 4 / 120 », puis 116 bouteilles restent « non placées ». Rien n'explique qu'il manque des places, ni ne propose un autre espace.

### B12 · Mineur · Message trompeur pour une sauvegarde endommagée
- **Constaté** : une sauvegarde altérée, sans mot de passe enregistré ou aux paramètres piégés est bien refusée, mais avec le message « Mot de passe incorrect pour cette sauvegarde ». L'utilisateur va chercher l'erreur dans son mot de passe.
- **Attendu** :
  - si la structure du fichier est invalide : « Sauvegarde incomplète ou endommagée » ;
  - si le déchiffrement échoue : « Mot de passe incorrect, ou fichier endommagé ». Le chiffrement ne permet pas de distinguer ces deux causes.

### B13 · Mineur · Les bouteilles placées hors des dimensions de leur meuble disparaissent du plan
- **Constaté** : si un meuble a des dimensions plus petites que les positions de ses bouteilles, ces bouteilles ne s'affichent ni sur le plan ni dans « Non placées ». Elles restent dans la liste.
  - Par le formulaire du meuble, ce cas est bien géré : les bouteilles deviennent « non placées ».
  - Il peut survenir après une restauration de sauvegarde ancienne ou une modification future.
- **Attendu** : au chargement, une bouteille dont la position est invalide est considérée comme « non placée ».

### B14 · Observation · Spiritueux désactivés, mais visibles sur le plan
- **Constaté** : quand l'option spiritueux est coupée, ils disparaissent de la liste, du sommelier et de « À boire ». Ils restent affichés sur le plan, puisqu'ils occupent des places.
- **À confirmer** : garder ce comportement (les cases sont physiquement prises), ou les afficher grisés sur le plan ?

### B15 · Observation · Une recommandation du sommelier peut disparaître sans explication
- **Constaté** : si le modèle cite un vin qui n'existe plus (par exemple supprimé pendant la conversation), sa carte est ignorée sans un mot.
- **Proposition** : une mention « une recommandation ne correspond plus à ta cave ».

### B16 · Observation · Le contexte du sommelier grossit vite avec de grosses caves
- **Constaté** : pour 1 000 vins, le contexte envoyé fait 230 000 caractères, soit environ 60 000 tokens.
  - Coût estimé : environ 0,12 $ pour la première question d'une conversation, environ 0,01 $ pour les suivantes, grâce au cache.
  - Avec ta cave actuelle (environ 120 bouteilles), c'est négligeable. À 1 000 vins, le plafond de 2 € par mois serait atteint en une quinzaine de conversations.
- **Proposition** : au-delà de 300 références, n'envoyer que les vins prêts à boire, ou proches de l'être, avec un résumé chiffré du reste.

## Fichiers de la campagne

- `tests/campagne.cjs` : le script, rejouable à chaque release (`node tests/serve.cjs 8765 &` puis `node tests/campagne.cjs`).
- `tests/shots/campagne.json` : le résultat de la dernière exécution, non versionné.
- `tests/shots/camp-320.png` : la capture à 320 px.
