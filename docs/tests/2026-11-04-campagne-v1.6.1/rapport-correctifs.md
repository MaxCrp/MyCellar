# Rapport de correctifs — préparation de la release 1.6.2

Ce document part du [rapport de bugs](rapport-bugs.md) du 4 novembre 2026. Il sert à trois choses :
1. **Cadrer le développement de la 1.6.2** : quoi corriger, où, et comment le vérifier.
2. **Préparer le journal des versions** : le texte prêt à copier dans `src/changelog.json`.
3. **Alimenter le rapport de mise à jour** : le tableau de suivi en fin de document, à cocher à la livraison.

Rien n'est encore développé. La release ne démarre que sur « lance la v1.6.2 ».

## Décisions à prendre avant le développement

| # | Question | Proposition par défaut |
|---|---|---|
| D1 | B05 : dégustation enregistrée sans toucher au curseur | « Sans note » : le curseur part au milieu, grisé, avec la mention « Touche pour noter ». La note reste vide tant qu'on n'y a pas touché. |
| D2 | B02 : millésime saisi sur deux chiffres (« 19 ») | Le compléter automatiquement (« 19 » → 2019, « 98 » → 1998) et l'afficher dans le champ. |
| D3 | B14 : spiritueux désactivés, visibles sur le plan | Les garder visibles, mais grisés et sans nom, avec la mention « Spiritueux masqués » dans l'en-tête du meuble. |
| D4 | B16 : grosses caves | Contexte réduit à partir de 300 références. Sans effet sur ta cave actuelle. |

## Correctifs

### C01 → B01 · Doubles appuis (majeur)
- **Correctif** :
  - pendant l'exécution d'un formulaire, son bouton de validation est désactivé et marqué « En cours… », puis réactivé si une erreur survient (`src/js/90-boot.js`, gestionnaire `submit`) ;
  - une garde contre la réentrée protège les actions qui enregistrent quelque chose : `tasteSave`, `placeOk`, `plocGo`, `transferDone`, `receive`, `applyReeval`, `applyAdvice`, `adviceGo`, `delWine`, `delUnit`, `estimateMissing` (`src/js/90-boot.js`, gestionnaire `click`).
- **Vérification** : dans `tests/campagne.cjs`, la section B doit afficher « effet appliqué 1 fois » pour les 6 actions.

### C02 → B02, B09 · Validation de la fiche vin
- **Correctif** :
  - **Bornes** :

    | Champ | Bornes |
    |---|---|
    | Millésime | entre 1900 et l'année prochaine ; deux chiffres complétés automatiquement (décision D2) |
    | Prix | de 0 à 100 000 € |
    | Degré | de 0 à 25 % pour un vin, de 0 à 80 % pour un spiritueux |
    | Quantité | de 1 à 500 |

  - **Message** : en cas de valeur hors bornes, un message apparaît sous le champ et la fiche n'est pas enregistrée. Un millésime texte demande « Millésime non reconnu : laisser non millésimé ? ».
  - **Fonction `num()`** : elle reconnaît le point comme séparateur de milliers quand une virgule décimale suit (« 1.234,50 »).
  - **Fichiers** : `src/js/40-wine.js` (`readWineForm`, `FORMS.wine`, `FORMS.addBottles`) et `src/js/00-core.js` (`num`).
- **Vérification** : la section A de la campagne doit afficher 0 anomalie sur la fiche vin. Les tests unitaires de `num()` sont à ajouter à la campagne.

### C03 → B03, B06 · Cohérence des fenêtres de dégustation
- **Correctif** :
  - une fonction commune `cleanWindow(debut, pic, fin, millésime)` garantit début ≤ apogée ≤ fin, des années dans les bornes, et pas d'année avant le millésime ;
  - elle est utilisée à la saisie manuelle (avec un message), à l'estimation unitaire, à l'estimation groupée, à l'import Ploc et à la réévaluation ;
  - une réponse de l'IA incohérente est écartée en entier, au lieu d'être réparée à moitié.
  - **Fichiers** : `src/js/10-data.js` (nouvelle fonction), `src/js/40-wine.js`, `src/js/60-ai.js`.
- **Vérification** : dans la section C de la campagne, « Fenêtre début > fin » doit être refusée. Dans la section D, la réévaluation incohérente ne doit plus rien afficher.

### C04 → B04 · Lecture d'étiquette : valeurs ramenées aux listes connues
- **Correctif** : dans `onPhoto` (`src/js/60-ai.js`), on applique les règles suivantes :
  - `kind` ∈ {vin, spirit}, sinon vin ;
  - `couleur` ∈ COLORS, sinon vide ;
  - `cat` ∈ SPIRIT_CATS, sinon « autre » ;
  - âge et degré positifs, et dans les bornes de C02.
- **Vérification** : la section D de la campagne, « Lecture d'étiquette », doit passer.

### C05 → B05 · Dégustation sans note (décision D1)
- **Correctif** :
  - la note est vide par défaut ;
  - l'affichage indique « – / 20 » et « Touche pour noter » tant que le curseur n'a pas été touché ;
  - les moyennes, les classements de séance et le contexte du sommelier ignorent les dégustations sans note, ce qu'ils font déjà quand la note est vide ;
  - **données existantes** : on ne peut pas distinguer un vrai 14 d'un 14 par défaut, donc les dégustations passées ne sont pas modifiées.
  - **Fichier** : `src/js/50-tasting.js`.
- **Vérification** : un nouveau test enregistre une dégustation sans toucher au curseur et vérifie que la note est vide.

### C06 → B07 · Import Ploc : quantités cohérentes
- **Correctif** :
  - les quantités sont bornées entre 1 et 200 dès l'écran de vérification ;
  - une ligne dont la quantité a été corrigée porte la mention « quantité corrigée » ;
  - le total du bouton correspond exactement à ce qui sera importé.
  - **Fichier** : `src/js/60-ai.js` (`onPdf`, `plocReview`).

### C07 → B08 · Noms de site vides, cibles négatives
- **Correctif** : un nom de site vide après nettoyage est refusé avec un message. Les places cibles valent au minimum 1, ou restent vides (`src/js/80-plus.js`).

### C08 → B10, B13 · Données orphelines et positions invalides
- **Correctif** :
  - `delWine` supprime aussi les envies du vin ;
  - `normalize()` nettoie au chargement :
    - les envies, transferts et dégustations qui pointent vers un vin ou une bouteille absents ;
    - les bouteilles placées hors des dimensions de leur meuble, ou dans un meuble supprimé, qui deviennent « non placées ».
  - **Fichiers** : `src/js/40-wine.js` et `src/js/10-data.js`.

### C09 → B11 · Rangement : places insuffisantes
- **Correctif** : quand il manque des places, l'écran de rangement affiche « Il manque N places dans cet espace : N bouteilles resteront non placées », avec un raccourci vers l'espace qui a le plus de places libres (`src/js/40-wine.js`, `placeSheet`).

### C10 → B12 · Messages de restauration
- **Correctif** :
  - une erreur de format (structure, emplacement du mot de passe, paramètres) affiche « Sauvegarde incomplète ou endommagée » ;
  - un échec du déchiffrement affiche « Mot de passe incorrect, ou fichier endommagé ».
  - **Fichier** : `src/js/80-plus.js` (`FORMS.import`).

### C11 → B14 · Spiritueux masqués sur le plan (décision D3)
- **Correctif** : avec l'option coupée, les cases des spiritueux sont grisées, sans nom (`src/js/30-cave.js`).

### C12 → B15 · Recommandations disparues
- **Correctif** : si une ou plusieurs cartes ne correspondent plus à un vin de la cave, une mention s'affiche sous la réponse (`src/js/60-ai.js`, `chatMsg`).

### C13 → B16 · Contexte réduit pour les grosses caves (décision D4)
- **Correctif** : au-delà de 300 références, le contexte ne détaille que les vins à boire en priorité, prêts ou proches de l'être, et les vins récemment dégustés. Une ligne résume le reste (nombres par couleur, région et statut) (`src/js/60-ai.js`, `caveContext`).
- **Vérification** : dans la section G de la campagne, le contexte doit faire moins de 80 000 caractères pour 1 000 vins.

## Contrôle de la release

- La campagne `tests/campagne.cjs` doit afficher **0 anomalie**.
- La suite `tests/run.sh` doit passer.
- La campagne rejoint `tests/run.sh` comme onzième série.

## Texte prêt pour le journal des versions (`src/changelog.json`)

```json
{
  "version": "1.6.2",
  "date": "AAAA-MM-JJ",
  "titre": "Fiabilité",
  "items": [
    "Un double appui sur un bouton ne crée plus deux bouteilles, deux sorties ou deux dégustations.",
    "La fiche vin vérifie le millésime, le prix, le degré et la quantité, et explique ce qui ne va pas. Les nombres comme « 1.234,50 » sont reconnus.",
    "Les fenêtres de dégustation restent cohérentes (début, apogée, fin), même quand elles viennent du sommelier.",
    "Une dégustation sans note n’est plus comptée comme un 14/20.",
    "Import Ploc, lecture d’étiquette, rangement et restauration : contrôles et messages plus clairs.",
    "Les très grandes caves restent économes en appels au sommelier."
  ]
}
```

## Suivi pour le rapport de mise à jour

| Correctif | Bug | Gravité | Fait | Vérifié |
|---|---|---|---|---|
| C01 | B01 | Majeur | ☐ | ☐ |
| C02 | B02, B09 | Moyen | ☐ | ☐ |
| C03 | B03, B06 | Moyen | ☐ | ☐ |
| C04 | B04 | Moyen | ☐ | ☐ |
| C05 | B05 | Moyen | ☐ | ☐ |
| C06 | B07 | Mineur | ☐ | ☐ |
| C07 | B08 | Mineur | ☐ | ☐ |
| C08 | B10, B13 | Mineur | ☐ | ☐ |
| C09 | B11 | Mineur | ☐ | ☐ |
| C10 | B12 | Mineur | ☐ | ☐ |
| C11 | B14 | Observation | ☐ | ☐ |
| C12 | B15 | Observation | ☐ | ☐ |
| C13 | B16 | Observation | ☐ | ☐ |
