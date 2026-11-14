# MyCellar — Spécification

Application de gestion de cave à vin, avec un sommelier IA intégré.
Utilisateur principal : un seul, sur iPhone. Le partage avec des amis est envisagé plus tard (chacun aura sa propre copie, ses données et sa clé API).

---

## 1. Principes d'architecture (repris de Patrimoine)

| Sujet | Choix |
|---|---|
| Format | PWA installable sur l'écran d'accueil : un seul `index.html` en JavaScript sans framework ni CDN, plus `sw.js`, `manifest.webmanifest`, des icônes et `_headers` |
| Hébergement | Cloudflare Pages, avec du code statique uniquement |
| Données | 100 % locales, dans IndexedDB, chiffrées en AES-GCM avec une clé dérivée du mot de passe par PBKDF2. Option « rester déverrouillé sur cet appareil » |
| Persistance | `navigator.storage.persist()` est demandé au premier lancement |
| Mises à jour | Le service worker sert toujours le code installé. L'app vérifie l'empreinte du nouveau code et demande confirmation avant de l'installer |
| Hors ligne | Tout fonctionne hors ligne, sauf l'IA |
| Sécurité | CSP stricte. `connect-src` est limité à `api.anthropic.com`, `api.mistral.ai` et, en v2, aux domaines Google Drive |
| IA | Appels directs depuis le navigateur avec la clé API de l'utilisateur, stockée chiffrée. Claude Sonnet 5.5 (`claude-sonnet-5-5`) par défaut, Mistral en alternative |
| Langue | Français |

---

## 2. Organisation physique des caves

```
Site (Site 1, Site 2… renommables ; rôle consommation ou stockage ; Primeurs = virtuel)
 └─ Espace (Cave cuisine, Cave de vieillissement…)  ← conditions de stockage notées
     └─ Meuble
         ├─ Armoire : N clayettes, chacune en simple rangée de K places
         ├─ Rack    : grille L lignes × C colonnes, une bouteille par case
         ├─ Caisse bois : capacité 6 ou 12, un seul vin (caisse d'origine), position dans une pile
         ├─ Carton  : comme une caisse
         └─ Étagère : N planches avec des places libres (bar, spiritueux, grands formats)
```

- **Mode de fonctionnement**, réglable dans les paramètres (Plus › Sites, espaces et meubles). La création de la cave ne pose aucune question : elle démarre en site unique, avec un site nommé « Site 1 ».
  En passant en plusieurs sites, l'app ajoute « Site 2 » (rôle stockage), puis « Site 3 »… Chaque nom se change à tout moment.
  - **Site unique** : le sélecteur de site, les transferts et les conseils entre sites disparaissent de l'interface. Les conseils de déplacement restent possibles entre espaces, par exemple de la cave de vieillissement vers la cuisine.
  - **Plusieurs sites** : de 2 à N sites.
- **Site** : nom **librement modifiable** (par défaut « Site 1 », « Site 2 »…), rôle (`consommation` ou `stockage`), ordre d'affichage. On peut ajouter, renommer ou supprimer un site ; un site qui contient encore des bouteilles ne peut pas être supprimé.
- **Primeurs** : un site virtuel pour les vins payés mais pas encore livrés, avec la date de livraison prévue et le site de destination.
- **Espace** : nom, et **conditions de stockage** (température : stable / variable ; hygrométrie ; lumière ; vibrations). Ces critères donnent une note de qualité de 1 à 5. Elle sert aux conseils de déplacement, et elle raccourcit les apogées estimées des vins gardés dans une cave de moindre qualité.
- **Meuble** : type, nom, dimensions et ordre d'affichage.
- **Emplacement d'une bouteille** : meuble plus position (clayette et place, ou ligne et colonne, ou caisse). Une bouteille peut aussi rester « non placée » dans un espace.
- **Site actuel** : un sélecteur en haut de l'écran (« Je suis à : Site 1 / Site 2 », avec les noms choisis). Le sommelier ne propose que les bouteilles présentes sur place, avec une option pour inclure l'autre site.

### Plan visuel (v1)
- Chaque meuble est dessiné en 2D. Chaque case affiche directement le **nom abrégé** du vin et son millésime, avec une pastille de couleur (rouge, blanc, rosé, effervescent, liquoreux). On n'a plus besoin de cliquer case par case.
- La recherche met en surbrillance les cases où se trouve le vin.
- Deux vues seulement : **Plan** et **Liste**. L'urgence à boire se consulte dans l'onglet « À boire », qui reste la seule référence sur ce sujet.
- Toucher une case ouvre la bouteille ; toucher une case vide propose d'y ranger un vin.
- Les caisses sont dessinées en piles de tuiles (vin, millésime, nombre de bouteilles restantes).
- Un éditeur de meuble permet d'ajouter un meuble, d'en définir les dimensions et de le renommer.
- **Rangement suggéré** à l'ajout : les vins de garde vont plutôt dans l'espace de stockage, ceux à boire bientôt dans la cave de consommation. La suggestion peut être refusée.

---

## 3. Modèle de données

```js
Wine {          // une référence (vin ou spiritueux)
  id, type:'vin'|'spiritueux', domaine*, cuvee*, couleur*, millesime*,   // champs propres aux spiritueux : §7 bis
  appellation, region, pays, cepages[], degre, format('75cl'|'37.5cl'|'150cl'|…),
  bio, nature, photo (≈100 Ko, compressée),
  owner: 'moi' | { ami: 'Pierre' },        // vins gardés pour des amis
  achat: { prix, lieu, date },
  apogee: { debut, pic, fin, source:'ia'|'manuel', justification, sources[], maj },
  cadeau: { offertPar }, notes, tags[], createdAt, updatedAt
}
Bottle {        // une bouteille physique
  id, wineId, siteId, espaceId, meubleId, position, statut:'en_cave'|'primeur'|'sortie'
}
Movement {      // journal
  id, bottleId, type:'sortie'|'deplacement'|'entree'|'transfert',
  motif:'bue'|'offerte'|'cassee'|'bouchonnee'|'vendue'|'rendue_ami',
  date, de, vers, offerteA, occasion, convives, plat
}
Tasting {       // dégustation
  id, wineId, bottleId, date, note20 (pas de 0,5), commentaire,
  complete?: { oeil, nez, bouche, conclusion }   // §6
}
Site, Espace, Meuble, Settings, AiUsage(mois, coût)
```
`*` signale un champ obligatoire. Tous les autres sont modifiables librement, sans dépendre d'une base externe.

### Vins gardés pour des amis
- Le champ `owner` vaut alors « ami ». Ces vins sont rangés et déplacés comme les autres, avec un marqueur visuel sur le plan (initiale de l'ami, case hachurée).
- Ils sont **exclus** des conseils du sommelier, du tableau « À boire », des suggestions de consommation, de la valeur de cave et des statistiques de consommation. Un filtre permet de les afficher ou de les masquer.
- Ils ont un motif de sortie spécifique : « rendue à l'ami ».

---

## 4. Saisie

1. **Photo d'étiquette** : Claude lit l'image et pré-remplit la fiche (domaine, cuvée, appellation, millésime, couleur, cépages, degré). L'utilisateur valide, puis choisit la quantité et l'emplacement.
2. **Saisie manuelle** avec auto-complétion à partir des vins déjà présents en cave. La dictée vocale passe par le micro du clavier iOS.
3. **Import du PDF Ploc**. Le PDF contient le nom, le domaine, le millésime et l'emplacement. *Format réel constaté le 5 novembre 2026, bien plus riche : depuis la v1.7, l'import reprend les fiches, place les bouteilles d'après le plan et rapproche les caves Ploc des sites (§10).*
   - L'IA lit le PDF et recopie les fiches ; elle ne complète que les champs vides et donne son avis sur la fenêtre de garde, sans recherche web pour limiter le coût.
   - Un écran de vérification permet de valider avant l'import : sites, meubles, aperçu du plan, fenêtres proposées.
4. **Duplication** : « + 1 bouteille identique », ou « ajouter le millésime suivant ».

---

## 5. Sorties et mouvements
- **Sortir une bouteille en deux taps** : on touche la bouteille, puis « Sortir ». Le motif est « bue » par défaut, et on peut le changer.
- Juste après la sortie, l'app propose une note rapide. Si on ne note pas, elle relance le lendemain à l'ouverture.
- **Déplacement** : d'une case à une autre, ou d'un site à l'autre.
- **Liste de transfert** : on prépare la liste des bouteilles à emporter lors du prochain passage à la campagne. Le bouton « Arrivées » les déplace toutes d'un coup.
- **Primeurs** : le bouton « Réceptionner » range les bouteilles reçues.

---

## 6. Dégustation
- **Mode rapide** : un slider de note sur 20 (par pas de 0,5) et un commentaire facultatif.
- **Mode complet**, entièrement au toucher, avec des sliders et des pastilles :
  - **Contexte** : date, occasion, convives, plat.
  - **Œil** : teinte (nuancier selon la couleur du vin), intensité, limpidité ; pour les effervescents, finesse et persistance des bulles.
  - **Nez** : intensité, ouverture, et une **roue des arômes** visuelle et tactile, sur le principe de Ploc :
    - L'anneau intérieur montre les familles, l'anneau extérieur leurs arômes.
    - Toucher une famille l'agrandit (environ 140° du cercle) et affiche ses arômes en grand. Les autres familles restent visibles en réduit.
    - Toucher un arôme le sélectionne ou le désélectionne. Les arômes choisis s'affichent en bordeaux sur la roue et en pastilles sous la roue.
    - Le centre de la roue indique le nombre d'arômes sélectionnés.
    - Environ 120 arômes au total. On peut **ajouter ses propres arômes** dans une famille ; ils sont mémorisés.
    - Les familles : fruits rouges, fruits noirs, fruits blancs, agrumes, fruits exotiques, fruits secs et confits, floral, végétal, épicé, boisé, grillé et fumé, pâtissier et lacté, minéral, sous-bois et animal.
    - Les défauts : goût de bouchon, réduction, oxydation.
  - **Bouche** : attaque, sucre, acidité, tanins (quantité et texture), alcool, corps, équilibre, longueur en caudalies.
  - **Conclusion** : stade d'évolution (jeune, à point, en déclin), potentiel restant, note sur 20, commentaire.
- L'historique complet sert au sommelier pour apprendre tes goûts.

---

## 6 bis. Onglet Dégustations (v1.5)

Le journal unique de toutes les dégustations : bouteilles de la cave, et vins bus ailleurs (bouteille achetée et bue tout de suite, restaurant, salon, domaine…).

### Navigation
- **Barre d'onglets** : Cave · Dégustations · **+** · À boire · Sommelier.
- **Réglages** : l'ancien onglet « Plus » devient une icône engrenage, en haut à droite de la page Cave.
- **Bouton « + »** : il s'adapte à l'onglet. Depuis Dégustations, il ouvre « Nouvelle dégustation » ; depuis les autres onglets, « Ajouter une bouteille ».

### Vin dégusté hors de la cave
- **Fiche sans bouteille** : une dégustation hors cave crée une fiche vin ordinaire, mais sans bouteille. Elle n'apparaît ni dans le plan, ni dans le stock, ni dans la valeur de la cave.
- **Achat ultérieur** : le bouton « Ajouter à la cave » réutilise cette fiche, et l'historique des dégustations est conservé.
- **Saisie du vin**, dans cet ordre :
  1. photo de l'étiquette (lue par l'IA) ;
  2. recherche parmi les vins connus (en cave, ou déjà dégustés) ;
  3. saisie manuelle.
- **Vin de la cave bu ailleurs** : la dégustation se rattache à la fiche existante. Une case « Une bouteille de ma cave » permet en plus de la sortir du stock (motif « bue »).
- **Spiritueux** : si l'option est activée, on peut aussi déguster un spiritueux hors cave, avec sa propre roue d'arômes.

### Contenu d'une dégustation
- **Type de dégustation**, facultatif : Restaurant, Séance œnologie, Salon du vin, Au domaine, Plaisir.
- **Lieu** (texte libre, ex. nom du restaurant), **date**, **convives**.
- **Prix payé** et **lieu d'achat**, facultatifs, pour pouvoir racheter le vin.
- **Provenance du vin**, facultative : d'où vient la bouteille (achetée chez…, offerte par…, apportée par…, carte du restaurant…).
- **Photo** : celle de l'étiquette, rattachée à la fiche vin, plus une photo libre facultative (plat, tablée), réduite à environ 100 Ko.
- **Plat**, et une **appréciation de l'accord**, facultative : raté, correct, parfait. Le sommelier s'en sert pour apprendre ce qui fonctionne chez toi.
- **Fiche** : exactement la même que pour les bouteilles de la cave, en mode rapide (note sur 20 et commentaire) ou complet (œil, nez avec la roue des arômes, bouche, évolution, potentiel).

### Séances
- **Principe** : une séance, facultative, regroupe plusieurs vins sous une même date, un même lieu et un même type (salon, verticale, soirée…).
- **Saisie** : on enchaîne les vins sans ressaisir le contexte. Une fiche de séance affiche les vins dégustés et leur classement par note.
- **Dégustation seule** : elle reste possible sans séance.

### Historique
- **Liste chronologique** : date, vin, note, type et lieu. Les séances apparaissent comme un bloc dépliable.
- **Recherche et filtres** : note minimale, couleur, région, type de dégustation, « de ma cave » ou « hors cave ».
- **Vue par vin** : toutes les dégustations d'un même vin et d'un même millésime, pour suivre son évolution dans le temps.
- **Reprise de l'existant** : les dégustations déjà saisies pour les bouteilles de la cave y apparaissent aussi.
- **Actions** : modifier ou supprimer une dégustation.

### Liste d'envies
- **Depuis une dégustation** : le bouton « Je veux en acheter » met le vin dans la liste d'envies, avec le prix et le lieu d'achat s'ils sont connus.
- **Où la trouver** : dans les réglages et sur la fiche du vin.
- **Une fois acheté** : le bouton « Acheté » ouvre l'ajout en cave et retire le vin de la liste.

### Lien avec le sommelier
- Le sommelier tient compte des dégustations hors cave (notes, commentaires, accords réussis ou ratés) pour comprendre tes goûts et pour ses suggestions d'achat.
- La liste d'envies lui est aussi transmise. Les vins des amis restent exclus.

### Plus tard (v2)
- Partager une fiche de dégustation, en image ou en texte.

### Modèle de données
```js
Tasting { …existant, type:'restaurant'|'oeno'|'salon'|'domaine'|'plaisir'|null, lieu, convives, prix, achatLieu, provenance,
          accord:'rate'|'correct'|'parfait'|null, photoLibre, sessionId, horsCave:boolean,
          blind?: { kind, couleur, hyp:{ cepage, region, millesime, prix }, revealed, revealedAt, analysis } }   // v1.5.2 : wineId vide tant que le vin mystère n'est pas révélé
Session { id, date, type, lieu, convives, titre }
Wish    { id, wineId, at, prix, lieu, note }
Wine    : peut n'avoir aucune bouteille (vin seulement dégusté)
```

---

## 7. Agents IA

Un même modèle, avec un rôle et des instructions dédiés pour chaque agent. Un contexte de cave compact est mis en cache : la liste des vins disponibles avec stock, emplacement, apogée et notes passées. Les vins des amis en sont exclus.

### 7.1 Sommelier des accords mets-vins (conversation)
- Saisie libre (« poulet basquaise ce soir, 4 personnes »), plus des suggestions rapides prêtes à taper.
- **Critères, par ordre de priorité** :
  1. le vin est dans sa fenêtre de dégustation ;
  2. la qualité de l'accord ;
  3. les vins en fin d'apogée passent en priorité ;
  4. les grandes bouteilles sont protégées, sauf pour une « grande occasion » ;
  5. le budget, selon le type d'occasion (quotidien, amis, grande occasion).
- **Réponse** : les trois meilleures bouteilles, sous forme de cartes. Chaque carte donne l'explication de l'accord, la température de service, s'il faut carafer (et combien de temps), et l'**emplacement exact**. Le bouton « Je la prends » sort la bouteille du stock.
- Un menu complet (un vin par plat) uniquement si on le demande.
- Le sens inverse marche aussi : « Que cuisiner avec ce vin ? »
- Si rien dans la cave ne convient, l'agent le dit et **suggère quoi acheter**.
- Il tient compte du site actuel et des préférences tirées des notes passées.

### 7.2 Sommelier des apogées
- À l'ajout d'un vin : il estime le début, le pic et la fin de la fenêtre, avec une justification courte et ses sources (recherche web). La qualité de la cave de stockage est prise en compte.
- Si l'utilisateur corrige la fenêtre, c'est sa valeur qui fait foi.
- Après une dégustation : il propose d'ajuster la fenêtre des bouteilles restantes du même vin, et l'utilisateur valide.
- **Tableau « À boire »** : quatre catégories (à boire en priorité, à leur apogée, pas encore prêts, en déclin), plus une frise par année.
- Un résumé apparaît à l'ouverture de l'app, sans notification push.

### 7.3 Logistique entre sites et cuisine (v1.5)
Une carte « Conseils de rangement » dans l'onglet À boire ouvre la liste des déplacements conseillés. Les règles sont locales, sans appel à l'IA :
- **À rapprocher** : un vin à boire en priorité qui se trouve dans un espace de garde va vers un espace de consommation, de préférence sur le site de consommation.
- **À mettre en garde** : un vin de longue garde (trop tôt, ou fin de fenêtre à 6 ans ou plus) va vers le meilleur espace de garde, s'il est rangé dans un espace de consommation, ou dans une cave nettement moins bonne qu'une autre disponible.
- **Réassort** : un espace de consommation qui a un nombre de places cible et se trouve en dessous est complété avec les vins prêts à boire des espaces de garde, les plus urgents d'abord.
- **Action** : quand le conseil change de site, la bouteille va dans la liste de transfert (§5) ; sur le même site, l'écran de rangement s'ouvre directement. Les vins des amis ne sont concernés que par la mise en garde.

**Réévaluation après dégustation (v1.5).** Elle part quand une dégustation apporte une information (commentaire, évolution ou potentiel) et qu'il reste des bouteilles du vin. Le sommelier propose alors une nouvelle fenêtre, ou ne dit rien si la fenêtre actuelle tient ; tu valides. C'est un appel court, sans recherche web. Sans clé IA, la règle simple de la v1 s'applique.

### 7.4 Audit de cave (v2)
- Analyse de l'équilibre de la cave (couleurs, régions, prêts à boire, embouteillage de millésimes qui arrivent à maturité en même temps), avec des suggestions d'achat.

### 7.5 Coûts
- Le compteur de dépense mensuelle est calculé à partir de l'usage réel renvoyé par l'API. Le plafond est réglable (2 € par défaut) ; au-delà, l'IA est bloquée.
- Estimation : environ 1 $ par mois pour 120 bouteilles et un usage normal.
- Paramètres de l'API Claude : réflexion adaptative et effort `medium`, sorties structurées (JSON) pour les cartes de recommandation et les fiches, mise en cache du contexte de cave, recherche web `web_search_20260209` limitée par `max_uses`, en-tête `anthropic-dangerous-direct-browser-access`, et `fallbacks: "default"` en cas de refus.

---

## 7 bis. Spiritueux (option activable dans les paramètres)

Désactivée par défaut. Une fois activée, elle s'applique dans toute l'app : un filtre Vins / Spiritueux dans la Cave, un type à choisir à l'ajout, des statistiques séparées.

- **Catégories** : whisky, rhum, cognac, armagnac, calvados, gin, autre (catégorie libre).
- **Fiche** : maison ou distillerie, nom de l'expression, catégorie, pays et région, âge, millésime de distillation, date d'embouteillage, degré, type de fût et finition, brut de fût, single cask, embouteilleur indépendant, numéro de fût ou de bouteille, contenance (70 cl par défaut), prix, photo, propriétaire (moi ou un ami, comme pour les vins).
- **Bouteille entamée** : une dégustation ne sort pas la bouteille du stock. La bouteille passe à l'état « ouverte », avec sa date d'ouverture et un **niveau restant** réglable au slider. Elle ne sort du stock qu'au motif « terminée ».
- **Pas d'apogée** (un spiritueux évolue peu en bouteille). À la place, le tableau « À boire » signale les **bouteilles ouvertes à finir** : niveau bas depuis longtemps, risque d'oxydation.
- **Dégustation** : une **roue d'arômes dédiée aux spiritueux**.
  - Familles communes : tourbé et fumé, céréales et malt, fruits frais, fruits secs, floral, boisé et vanille, épices, vineux (sherry, porto), maritime et iodé, caramel et sucré.
  - Familles spécifiques au rhum : canne, mélasse, esters et notes « funky ».
  - La note sur 20 et le commentaire fonctionnent comme pour les vins.
- **Sommelier** :
  - choix selon l'envie (« quelque chose de tourbé mais pas trop ») ;
  - accords (chocolat, fromages, desserts) ;
  - digestif après un repas donné ;
  - ordre de dégustation pour une soirée découverte.
- **Cocktails** : le sommelier peut proposer un cocktail réalisable avec les spiritueux de la cave, uniquement quand l'option spiritueux est activée. Un interrupteur dédié permet de couper les cocktails.
- **Mignonnettes et échantillons** : une contenance de plus (5 cl), à côté de 20, 35, 50, 70, 100 et 150 cl.
- **Rangement** : dans n'importe quel meuble, en particulier le type « Étagère ».

---

## 8. Interface
- **Quatre onglets** (v1 ; en v1.5, l'onglet Dégustations s'ajoute et « Plus » devient une icône engrenage, voir §6 bis) :
  - **Cave** : le plan, avec une bascule vers la liste ;
  - **Sommelier** ;
  - **À boire** ;
  - **Plus** : statistiques, réglages, sauvegarde, export.

  Le bouton **« + »** (ajouter une bouteille) est placé **au centre de la barre d'onglets**, surélevé : Cave · Sommelier · **+** · À boire · Plus.
- Les pastilles de couleur sont **rondes** (cercles parfaits, de taille fixe).
- **Recherche** plein texte et filtres rapides : couleur, région, prêt à boire, site, propriétaire.
- **Identité visuelle** : thème clair sur fond crème. Bordeaux pour les éléments principaux, vert bouteille et doré en accents discrets. Police **système sans empattements** (SF Pro sur iPhone), sobre, sans fioritures. Une pastille de couleur par type de vin.

---

## 9. Sauvegarde
- **v1** : le bouton « Sauvegarder » produit un fichier chiffré et ouvre le partage iOS, puis « Enregistrer dans Fichiers » vers iCloud. Rappel si la dernière sauvegarde a plus de 7 jours. Import depuis ce fichier.
- **v2** : sauvegarde automatique, chiffrée, vers **Google Drive** (dossier caché de l'application, `appDataFolder`), via OAuth PKCE.

---

## 10. Découpage en releases

**Règles de travail**
- Chaque mise à jour demandée est rattachée à une release de développement nommée (v1.6, v1.6.1…). Elle est inscrite ici, avec une case à cocher.
- Une demande est d'abord seulement spécifiée. Le développement d'une release ne commence que sur demande explicite (« lance la v1.6 »).
- Une release livrée a toutes ses cases cochées et porte la mention « (livrée) ».

**v1**
- Sites, espaces et meubles, avec plan visuel et éditeur.
- Fiches vin, bouteilles et emplacements ; vins des amis.
- Scan d'étiquette, saisie manuelle, import du PDF Ploc.
- Sorties, déplacements, liste de transfert, primeurs.
- Dégustation rapide et complète, avec la roue des arômes.
- Sommelier des accords (§7.1).
- Apogées et tableau « À boire » (§7.2).
- Site actuel, mode site unique ou plusieurs sites, sites renommables.
- Compteur de coûts, chiffrement, sauvegarde manuelle.
- Option spiritueux (§7 bis).

**v1.5**
- Conseils de logistique entre sites et de réassort de la cuisine (§7.3).
- Réévaluation des apogées après dégustation.
- Onglet **Dégustations**, séances et liste d’envies (§6 bis).

**v1.5.2** (livrée)
- [x] Icône du bouton « Déguster » : un bouchon de liège à la place de l’étoile.
- [x] Icône de l’onglet Dégustations : un carnet (couverture, reliure, pages) à la place de l’icône actuelle, qui évoque un ticket de caisse.
- [x] Présentation de l’app au premier lancement, quand aucune cave n’existe encore : une fenêtre qui présente MyCellar, ses fonctions et un tutoriel rapide. Proposition à valider :
  - **Format** : quelques écrans à faire défiler, avec une illustration chacun, un bouton « Passer » toujours visible, et le bouton « Créer ma cave » sur le dernier écran.
  - **Écrans** :
    1. Bienvenue : ta cave sur ton iPhone, privée et chiffrée.
    2. Décrire sa cave : sites, espaces, meubles, plan visuel.
    3. Ajouter des bouteilles : photo d’étiquette ou saisie, puis rangement (l’import Ploc est signalé dans les réglages).
    4. Boire au bon moment : fenêtres de dégustation, onglet À boire, conseils de rangement.
    5. Le sommelier : accords mets-vins depuis ta cave, clé API et coût (environ 1 € par mois).
    6. Les dégustations : en cave ou ailleurs, séances, liste d’envies.
    7. Sauvegarder : rappel que les données ne sont que sur l’iPhone.
  - **Revoir la présentation** : possible ensuite depuis Réglages › Aide.
- [x] Bouton « + » identique sur tous les onglets, simplifié en deux choix :
  - **Nouvelle dégustation** : ouvre l’écran actuel (photo de l’étiquette, vin déjà connu, saisie manuelle, spiritueux, démarrer une séance) ;
  - **Nouveau vin** : ouvre l’écran actuel d’ajout en cave (photo de l’étiquette, saisie manuelle, spiritueux, racheter un vin de la cave).
  Une case libre touchée sur le plan continue d’ouvrir directement « Nouveau vin » pour cette place.
- [x] Import depuis Ploc accessible uniquement depuis les réglages : il disparaît du bouton « + » et de la carte d’accueil de la page Cave, puisqu’il ne sert qu’une fois.
- [x] Barre de recherche dans « Racheter un vin de la cave », pour ne plus faire défiler toute la liste. Elle filtre sur le domaine, la cuvée, l’appellation et le millésime.
- [x] **Dégustation à l’aveugle** (nouvelle fonction, validée) :
  - **Entrée** : un choix « À l’aveugle » dans « Nouvelle dégustation », et dans une séance. Une séance peut être entièrement à l’aveugle.
  - **D’abord la fiche** : la fiche de dégustation habituelle, sur un « vin mystère ». La couleur (rouge, blanc, rosé…) se choisit dans la partie œil, et elle adapte les teintes et la bouche, comme aujourd’hui.
  - **Hypothèses**, facultatives : avant la révélation, tu notes ce que tu penses avoir dans le verre (cépage, région ou appellation, millésime, gamme de prix).
  - **Puis la révélation** : « Révéler le vin » ouvre la recherche dans les vins connus, la photo d’étiquette ou la saisie manuelle (appellation, millésime, domaine…). La dégustation est alors rattachée à ce vin.
  - **Comparaison** : les hypothèses sont affichées face à la réalité (cépage trouvé, millésime à ±2 ans…).
  - **En attente** : une dégustation pas encore révélée reste dans le journal en « Vin mystère », pour être révélée plus tard, par exemple à la fin d’une séance.
  - **Analyse du sommelier** : après la révélation, un court commentaire de pédagogie de dégustation, pas un simple « bravo ».
    - **Ce qu’il explique** : ce qui, dans ta propre fiche (teinte, arômes, acidité, tanins, évolution), pointait vers le vrai vin ; et ce qui a pu t’orienter vers tes hypothèses.
      Exemple : « La note de pierre à fusil et l’acidité vive que tu as notées évoquent un Sauvignon de Loire, d’où Sancerre ; le Chenin s’en distingue par le coing et une texture plus cireuse, absents de ta fiche. »
    - **Ce qu’il donne** : un ou deux repères concrets pour distinguer la prochaine fois les vins que tu as confondus.
    - **Règle** : il ne s’appuie que sur ce que tu as noté et sur les caractéristiques connues du vin. Il ne fait aucun commentaire générique ; s’il n’a rien d’utile à dire, il le dit en une phrase.
    - **Coût** : un appel court, moins d’un centime, uniquement quand il y avait des hypothèses ; on peut aussi le demander à la main.

**v1.6** (release intermédiaire avant la v2 ; livrée)
- [x] **Suivi d'utilisation**, sur le modèle de Patrimoine, pour améliorer l'expérience à partir des retours des bêta-testeurs (validé) :
  - **Ce qui est noté**, en local uniquement :
    - les écrans affichés et le temps passé sur chacun ;
    - les boutons touchés (nom de l'action dans le code) ;
    - les formulaires validés et les champs modifiés (nom du champ, jamais sa valeur) ;
    - les ouvertures, mises en arrière-plan et verrouillages ;
    - les erreurs rencontrées (message technique) et les appels IA (type, durée, succès ou échec, coût), sans leur contenu.
  - **Ce qui n'est jamais noté** : noms de vins, domaines, notes de dégustation, commentaires, prix, lieux, convives, questions au sommelier, clé API.
  - **Stockage** : journal chiffré avec la clé du coffre, plafonné à 20 000 événements (les plus anciens sont effacés), jamais envoyé automatiquement.
  - **Activation** : interrupteur dans Réglages › Aide, désactivé par défaut. La présentation du premier lancement le mentionne et indique où l'activer.
  - **Synthèse dans l'app** : ouvertures, durée médiane, gestes les plus fréquents, écrans les plus consultés, tâches accomplies avec le nombre de gestes pour y arriver (ajouter un vin, sortir une bouteille, déguster, demander au sommelier…), chemins les plus empruntés.
  - **Rapport à envoyer** : bouton « Exporter le rapport », un fichier **JSON uniquement**, partagé par la feuille de partage iOS (Mail, Messages, AirDrop…). Le fichier n'a pas besoin d'être lisible : l'analyse des rapports reçus se fait avec Claude.
    - Contenu : la synthèse, le journal brut, une légende des champs, la version et l'empreinte du code, la taille d'écran, et des indicateurs de contexte sans contenu (nombre de références, de sites, options activées).
    - **Avis libre** : au moment de l'export, un champ facultatif « Ton avis » (ce qui plaît, ce qui gêne, ce qui manque), inclus tel quel dans le rapport. C'est le seul texte libre du rapport, et il est écrit volontairement par le testeur.
    - Le nom du fichier inclut la date.
  - **Signaler un problème** : un bouton dans Réglages › Aide, et un raccourci dans le message affiché quand une erreur survient.
    - Il demande une description courte du problème (obligatoire).
    - Il exporte un rapport ciblé : la description, les 15 dernières minutes du journal, les dernières erreurs techniques, l'écran affiché et le contexte. Même format JSON et même partage iOS.
    - Il fonctionne même si le suivi est désactivé : seuls le contexte et les erreurs récentes sont joints, et l'app l'indique.
  - **Effacement** : bouton « Effacer le journal ».
- [x] **Suivi des mises à jour** : savoir ce que contient une mise à jour avant et après l'avoir acceptée (validé) :
  - **Numéro de version** : l'app connaît son propre numéro (1.6, 1.6.1…), affiché dans Réglages › Aide.
  - **Journal des versions** : un fichier `changelog.json` publié avec l'app. Pour chaque version, il donne le numéro, la date et la liste des nouveautés et corrections, rédigées pour l'utilisateur. Ce fichier est mis à jour à chaque release, à partir des cases de ce document.
  - **Avant d'installer** : dans le bandeau « Une nouvelle version est disponible », le bouton « Détails » devient « Plus d'infos ».
    - Il récupère le journal des versions en ligne et affiche tout ce qui a changé depuis la version installée. Si plusieurs versions ont été publiées entre-temps, elles sont toutes listées, de la plus récente à la plus ancienne.
    - On y retrouve l'empreinte du code et les boutons « Installer la mise à jour » et « Plus tard ».
    - Hors connexion, ou si le journal est absent, l'app le dit et garde l'affichage actuel de l'empreinte.
  - **Après l'installation** : au premier lancement de la nouvelle version, une fenêtre « Nouveautés de la version X » s'affiche une fois.
  - **Historique** : Réglages › Aide › « Historique des versions » liste toutes les versions et leur contenu.
  - **Versions passées** : le journal contient aussi un résumé des versions 1.0, 1.5 et 1.5.2, rédigé pour l'utilisateur, pour que les bêta-testeurs voient d'où part l'app.
  - **Sécurité** : le journal des versions n'est que du texte affiché, jamais du code. Il n'entre pas dans l'empreinte et ne remplace pas la vérification du code.
  - **Limite** : la fonction n'existe qu'à partir de la v1.6. Lors du passage de la v1.5.2 à la v1.6, le bandeau ne pourra pas encore montrer le contenu avant l'installation, mais la fenêtre « Nouveautés » s'affichera après.

**v1.6.1** (corrections ; livrée)
- [x] **Suivi d'utilisation grisé dans la cave fictive, sans explication** (validé) :
  - **Constat** : dans la cave fictive (mode démo), l'interrupteur du suivi est désactivé, comme Face ID et « Rester déverrouillé », mais rien ne l'explique. Sur une vraie cave, il fonctionne.
  - **Décision** : ces réglages restent désactivés en démo.
  - **Correction** : sous chaque réglage désactivé en démo, une ligne indique « Indisponible dans la cave fictive : crée ta cave pour l'utiliser ». Toucher l'interrupteur grisé affiche le même message.
  - **Réglages concernés** : suivi d'utilisation, Face ID, Rester déverrouillé. L'export du rapport n'est pas proposé en démo.
- [x] **Clignotement et retour en haut dans les fenêtres** (relevé : fiche de dégustation, champs « Équilibre » ou « À boire »). Audit fait sur tous les boutons qui modifient une fenêtre sur place (`tests/t9.cjs`) : 16 actions sur 23 présentent un défaut.
  - **Cause 1, clignotement** : à chaque choix, la fenêtre entière est recréée, et son animation d'ouverture est rejouée. Touche toutes les pastilles et tous les choix de la fiche de dégustation (teinte, limpidité, attaque, tanins, équilibre, évolution, potentiel, type, accord, couleur à l'aveugle, Rapide/Complète), l'écran de rangement (choisir une case, Suggérer, Effacer, changer d'espace), la liste d'envies depuis une fiche vin, l'ajout au transfert, la vérification de l'import Ploc, les réglages des sites.
  - **Cause 2, retour vers le haut** : la position de défilement est restaurée avant que la roue des arômes et les photos soient redessinées. La fenêtre est alors trop courte et le défilement remonte. Mesuré : de 87 px (attaque) à 398 px (évolution, potentiel) sur iPhone.
  - **Correction** :
    - une fenêtre déjà ouverte est mise à jour sur place : son contenu change, mais elle n'est ni recréée ni réanimée ;
    - le défilement est restauré après le dessin complet (roue, photos) ;
    - les photos gardent une hauteur réservée pour ne plus décaler la page en se chargeant ;
    - même vérification pour les écrans principaux. L'audit n'y montre pas de saut aujourd'hui, mais ils resteront couverts.
  - **Contrôle** : `tests/t9.cjs` est ajouté à `tests/run.sh` et doit afficher 0 défaut sur l'ensemble des actions.
- [x] **Réglages › Contenu** : supprimer la ligne « Vins · Toujours actif », qui n'apporte rien. Il reste « Spiritueux » et, quand les spiritueux sont activés, « Cocktails ».
- [x] **Fiche de dégustation : retirer le bouton « OK » en haut à droite**. Il est collé à la croix de fermeture, et on risque de toucher l'un pour l'autre. L'enregistrement se fait uniquement par le bouton « Enregistrer la dégustation » en bas de la fiche. Ça vaut pour toutes les dégustations, puisque c'est la même fiche : après la sortie d'une bouteille, depuis l'onglet Dégustations, à l'aveugle ou en séance.
- [x] **Fiche de dégustation : confirmation avant de fermer sans enregistrer.** Si la fiche contient déjà des informations (note modifiée, commentaire, arômes, pastilles, contexte, hypothèses, photo), fermer demande « Abandonner cette dégustation ? Ce que tu as saisi sera perdu. », avec les boutons « Abandonner » et « Continuer la dégustation ».
  - **Cas couverts** : la croix, le fond grisé derrière la fiche et la flèche de retour.
  - **Fiche vide** : elle se ferme directement, sans question.

**v1.6.2** (fiabilité, issue de la campagne de tests du 4 novembre 2026 ; livrée)
Le détail est dans `docs/tests/2026-11-04-campagne-v1.6.1/` : `rapport-bugs.md` pour les constats, `rapport-correctifs.md` pour le plan, les fichiers concernés et les vérifications.
- [x] C01 · Doubles appuis : une validation ou une action d'enregistrement ne s'exécute qu'une fois (B01, majeur).
- [x] C02 · Fiche vin : bornes et messages (millésime, prix, degré, quantité), et nombres au format « 1.234,50 » (B02, B09). Validé : un millésime à deux chiffres est complété automatiquement (« 19 » → 2019, « 98 » → 1998).
- [x] C03 · Fenêtres de dégustation toujours cohérentes, à la saisie comme dans les réponses de l'IA (B03, B06).
- [x] C04 · Lecture d'étiquette : valeurs ramenées aux listes connues (B04).
- [x] C05 · Dégustation sans note : pas de 14/20 par défaut (B05 ; validé : note vide tant que le curseur n'est pas touché, mention « Touche pour noter »).
- [x] C06 · Import Ploc : quantités bornées et total exact (B07).
- [x] C07 · Sites et espaces : nom vide et cible négative refusés (B08).
- [x] C08 · Nettoyage des données orphelines et des positions invalides (B10, B13).
- [x] C09 · Rangement : avertissement quand les places manquent (B11).
- [x] C10 · Restauration : messages distincts pour un fichier endommagé et un mot de passe faux (B12).
- [x] C11 · Spiritueux désactivés : cases grisées sur le plan (B14 ; validé : cases grisées, sans nom).
- [x] C12 · Sommelier : mention quand une recommandation ne correspond plus à la cave (B15).
- [x] C13 · Contexte du sommelier réduit au-delà de 300 références (B16 ; validé).
- [x] La campagne `tests/campagne.cjs` rejoint `tests/run.sh` et doit afficher 0 anomalie.

**v1.7** (import Ploc complet, d'après un vrai export reçu le 5 novembre 2026 ; livrée)

*Format constaté.* Un export Ploc porte sur **une cave** (ex. « Argenteuil - Cave Moyenne ») et contient :
- **un plan** de la cave : une grille (ici 15 lignes × 5 colonnes) où chaque bouteille est un rond portant le numéro de son vin ;
- **une légende** : numéro → millésime et nom complet du vin ;
- **une fiche par vin** : couleur, alcool, apogée (« 2021/2028 »), estimation (« 15 € »), producteur, pays, région, appellation, cépages, stock total, contenance (« 750ml »), caves avec quantités (« Argenteuil - Cave Moyenne : 1, Étagère Gauche Thevray : 2 »), servir à (« 10-12° »), accords, classement, cuvée, référence, tags, une note sur 100 (« 75 », vide sinon), une photo.

*Ce que fait l'import actuel avec ce PDF.* Il fonctionne, mais :
- toutes les bouteilles arrivent « non placées », alors que le plan donne leur case exacte ;
- l'IA réinvente couleur, cépages et apogée au lieu de reprendre ceux de Ploc (ta fenêtre « 2021/2028 » serait remplacée par une estimation) ;
- l'alcool, l'estimation, la contenance, la température de service, les accords et la note sont perdus ;
- le stock d'une fiche couvre toutes les caves : importer ensuite l'export d'une autre cave créerait des doublons.

*Ce que fait la v1.7.*
- [x] **Lecture fidèle des fiches** : chaque champ rempli dans Ploc est repris tel quel (couleur, degré, producteur, pays, région, appellation, cépages, contenance → format, apogée début/fin). L'IA ne complète que les champs vides (ex. producteur ou région absents), et l'écran de vérification les signale « complété par le sommelier ».
- [x] **Nom découpé** : le titre Ploc mélange producteur, appellation et cuvée (« Bernard Haegelin Alsace Pinot Gris Bollenberg ») ; la cuvée est ce qui reste une fois le producteur et l'appellation retirés (« Pinot Gris Bollenberg »).
- [x] **Apogée de Ploc conservée**, marquée « source : Ploc » ; l'apogée (pic) est placée au milieu de la fenêtre.
- [x] **Avis du sommelier sur la fenêtre de Ploc** (validé le 5 novembre 2026) : pendant l'import, le sommelier estime aussi la fenêtre de chaque vin, sans recherche web pour limiter le coût. S'il juge celle de Ploc décalée (au moins 2 ans d'écart sur le début ou la fin), l'écran de vérification l'indique sur la ligne : « Le sommelier propose 2022–2032 au lieu de 2021–2028 », avec sa justification en une phrase et un choix « Garder Ploc / Prendre la proposition ». Par défaut, la fenêtre de Ploc est gardée. Sans fenêtre dans Ploc, celle du sommelier s'applique.
- [x] **Correspondance des sites** : le nom de cave Ploc est rapproché des sites de l'utilisateur (ex. une cave « Maison - Cave 1 » va vers un site nommé « Maison »). Le site reconnu est présélectionné ; sinon, l'écran demande une fois à quel site rattacher la cave, et propose de renommer le site au nom de Ploc.
  - **Confidentialité** : aucun nom de site n'est écrit dans le code ni dans le modèle d'import. Le rapprochement se fait sur l'iPhone, à partir des sites de la cave ouverte. La liste des sites n'est pas envoyée à l'IA : celle-ci ne reçoit que le PDF. Les tests utilisent des noms fictifs.
- [x] **Placement exact** : l'écran de vérification propose, pour chaque cave Ploc, de **créer le meuble** à l'identique (rack aux dimensions du plan, nom repris, dans l'espace choisi) ou de l'associer à un meuble existant. Chaque bouteille est posée dans sa case. Si une case est occupée ou hors du meuble, la bouteille reste « non placée », avec son emplacement Ploc en note.
- [x] **Bouteilles des autres caves** : les quantités d'une cave sans plan dans le PDF (ex. « Étagère Gauche Thevray : 2 ») sont proposées en « non placées », dans l'espace de ton choix, ou ignorées.
- [x] **Pas de doublons entre plusieurs exports** : chaque bouteille garde sa cave Ploc d'origine. Au second export, un vin déjà importé pour une cave n'est pas recréé ; l'écran indique « déjà importé ».
- [x] **Estimation** (validé) : l'estimation de Ploc devient le **prix d'achat unitaire** de chaque bouteille (« 8,15 € » → 8,15). Pas de nouveau champ.
- [x] **Note sur 100** (validé) : convertie sur 20 (note ÷ 5, arrondie au demi-point : 75 → 15/20, 87 → 17,5/20) et enregistrée comme une dégustation « Note Ploc », datée du jour de l'import. Elle compte dans les moyennes et le sommelier la voit. Une note vide n'est pas importée.
- [x] **Température de service** (validé) : nouveau champ de la fiche vin (« 10-12° »), saisissable à la main, rempli depuis Ploc, affiché sur la fiche et au moment de déguster.
- [x] **Accords** (validé) : ajoutés aux notes du vin (« Accords Ploc : poissons, volailles »), que le sommelier lit déjà.
- [x] **Écran de vérification** : un aperçu du plan importé, avec les vins par numéro, permet de contrôler la lecture avant d'importer.
- [x] **Hors périmètre** : les photos des bouteilles (il faudrait embarquer un lecteur PDF dans l'app), le classement, la référence et les tags (vides dans l'export reçu).
- [x] Tests : un export Ploc fictif au même format (plan, légende, fiches, deux caves, une note, des champs vides), avec réponses de l'IA simulées, vérifie placement, champs repris, absence de doublons au second import.

**v1.7.1** (recherche dans la cave, conversation avec le sommelier ; livrée)

*Constat.* Aujourd'hui, la recherche de l'onglet Cave encadre les bouteilles trouvées sur le plan du site affiché et grise les autres. Il faut faire défiler les meubles pour les repérer, puis changer de site et chercher à nouveau.

- [x] **Recherche sur tous les sites** : en mode Plan, la recherche porte sur toutes les caves de tous les sites, quel que soit le site affiché. Le mode Liste reste tel quel : il cherche déjà partout.
- [x] **Résultats sous la barre** : dès la saisie, une liste apparaît sous la barre de recherche, avec une ligne par vin trouvé (pastille de couleur, nom, millésime, nombre de bouteilles), puis un emplacement par ligne : « Site › Espace › Meuble · Clayette 2, place 3 », « … › Caisse A » ou « … › non placée ». Les bouteilles en primeur apparaissent en « primeur, pas encore livrée », sans lien vers le plan.
- [x] **Aller à la bouteille** (validé le 5 novembre 2026 : le site actuel change, comme avec le sélecteur) : toucher un emplacement ferme la liste et affiche le bon site, comme le sélecteur de site en haut de l'écran. L'app ouvre ensuite le bon espace, fait défiler jusqu'au meuble et fait clignoter la case quelques secondes. Pour une caisse, la caisse s'ouvre. Pour une bouteille non placée, l'app défile jusqu'au bloc « non placées ».
- [x] **Un seul emplacement trouvé** : la touche « Rechercher » du clavier y emmène directement.
- [x] **Vider la recherche** (redemandé le 5 novembre 2026) : une croix apparaît dans la barre dès qu'un texte est saisi. La toucher efface le texte d'un coup, ferme les résultats, rend le plan normal et replie le clavier ; plus besoin de toucher la barre puis d'effacer lettre par lettre. Même croix sur toutes les barres de recherche de l'app : Cave, Dégustations, « Racheter un vin » et choix d'un vin dans une dégustation ou une liste d'envies.
- [x] **Depuis une fiche** : sur la fiche d'une bouteille, et sur chaque emplacement de la fiche vin, un bouton « Voir sur le plan » emmène à la case de la même façon.
- [x] Tests : recherche d'un vin présent sur deux sites, saut vers la case du site non affiché, case visible à l'écran et mise en évidence, caisse ouverte, bouteille non placée, « Voir sur le plan » depuis une fiche.

*Sommelier : bouton « Nouvelle conversation »* (demande du 5 novembre 2026). Quand la conversation dépasse un écran, le lien « Nouvelle conversation », placé tout en bas, se retrouve caché sous l'encart flottant « Demander au sommelier ».
- [x] **Icône dans l'encart flottant** : un bouton rond « nouvelle conversation » (icône bulle avec un +), à gauche du champ de saisie, toujours visible. Il n'apparaît que lorsqu'une conversation est en cours, et il est inactif pendant que le sommelier répond. L'ancien lien en bas de la conversation est retiré.
- [x] **Confirmation** : « Commencer une nouvelle conversation ? La conversation actuelle sera effacée. » Sans réponse de l'utilisateur, rien n'est effacé.
- [x] **Dernier message visible** : la conversation garde en bas un espace égal à la hauteur de l'encart, pour que la dernière réponse ne soit jamais cachée dessous, même quand l'encart s'agrandit (plusieurs lignes, choix d'occasion).
- [x] Tests : conversation plus longue que l'écran, icône visible et utilisable, confirmation, dernier message entièrement visible au-dessus de l'encart.

**v1.7.2** (transferts dans les deux sens, résumé du vin, détail du graphique « À boire avant la fin de… » ; livrée)

*Constat.* Aujourd'hui, il n'y a qu'une liste de transfert, avec une destination. À l'arrivée, les bouteilles vont toujours dans l'espace de consommation du site, et les suggestions ne proposent que des vins prêts à boire. Ramener vers le stockage des bouteilles achetées en ville n'est pas prévu. Dans les listes, une bouteille n'affiche que son nom et son emplacement : pour voir sa fenêtre, il faut fermer le transfert et chercher le vin.

*Transferts dans les deux sens*
- [x] **Deux sections dans le transfert** : « Vers [site de consommation] » et « Vers [site de stockage] », chacune avec ses bouteilles, son total et son bouton « Arrivées à … ». On peut préparer les deux pour un même trajet : prendre des vins prêts à la campagne, et y laisser des achats faits en ville.
- [x] **Destination d'une bouteille** : elle part vers l'autre site. S'il y a plus de deux sites, l'app demande lequel au moment de l'ajout. Le bouton de la fiche bouteille le dit : « Ajouter au transfert vers Campagne ».
- [x] **Arrivée au stockage** : les bouteilles vont dans l'espace de garde de meilleure qualité du site, non placées. Un bouton « Ranger maintenant » ouvre l'écran de rangement avec des cases suggérées. L'arrivée en consommation ne change pas (espace de consommation, non placées).
- [x] **Suggestions vers le stockage** : bouteilles du site de consommation dont le vin est « trop tôt » ou de fenêtre inconnue, en commençant par les plus récemment ajoutées (validé le 5 novembre 2026). Les vins des amis et les bouteilles ouvertes ne sont pas proposés.
- [x] **À l'achat** (validé le 5 novembre 2026) : quand on ajoute sur le site de consommation des bouteilles d'un vin à garder (« trop tôt »), l'app propose « À emporter au prochain transfert vers [site de stockage] ? ».
- [x] **Données existantes** : le transfert en cours est repris tel quel, vers sa destination actuelle.

*Résumé du vin dans les listes*
- [x] **Toucher une bouteille** dans une liste de transfert ou dans les suggestions ouvre un résumé, et la flèche retour ramène au transfert. Le résumé contient : nom, millésime, couleur, domaine et appellation ; fenêtre de dégustation avec sa barre et son statut (« Prêt à boire », « Trop tôt »…) ; bouteilles par site ; dernière note de dégustation ; emplacement de cette bouteille. Il propose deux boutons : « Ajouter au transfert » ou « Retirer du transfert », et « Fiche complète ».
- [x] **Même résumé** dans « Préparer le transfert » (À boire) et dans les conseils de rangement qui mènent au transfert.
- [x] Tests : deux sections préparées en même temps, arrivées séparées (espace de consommation, espace de garde), suggestions vers le stockage, résumé ouvert depuis chaque liste puis retour au transfert, ancien transfert repris.

*Graphique « À boire avant la fin de… »* (onglet À boire, demande du 5 novembre 2026). Aujourd'hui, ses six barres (l'année en cours, qui inclut les vins déjà en retard, puis les quatre suivantes et « +5 ans ») n'affichent qu'un nombre de bouteilles.
- [x] **Barre touchée** : elle est mise en évidence, et le détail s'affiche juste sous le graphique : « À boire avant la fin de 2027 · 7 bouteilles ». Toucher la même barre referme le détail ; une barre à zéro ne réagit pas.
- [x] **Détail par bouteille** : une ligne par vin (pastille, nom, millésime, fenêtre, statut), triée par fin de fenêtre. Dessous, l'emplacement de chaque bouteille (« Campagne › Cave › Rack mural · Ligne 1, place 2 »). Pour la barre de l'année en cours, les vins déjà en retard sont marqués « en déclin ».
- [x] **Actions** : toucher le vin ouvre sa fiche, toucher un emplacement mène à la case sur le plan (comme la recherche de la v1.7.1). Sur une barre de l'année en cours, les bouteilles du site de stockage gardent le raccourci « Préparer le transfert ».
- [x] Tests : chaque barre ouvre le bon détail, avec des totaux égaux à la barre ; une barre à zéro est inactive ; accès à la fiche et à la case.

**v1.7.3** (bouteilles sorties à noter, changement de site par glissement ; livrée)

*Constat.* Après une sortie « bue », « bouchonnée » ou « terminée », l'app propose « Note rapide », « Fiche complète » ou « Plus tard ». Mais elle ne retient que la dernière bouteille : le lendemain, une bannière la rappelle, et « Non merci » l'oublie. Si plusieurs bouteilles sont sorties sans fiche, les précédentes sont perdues, et rien dans l'onglet Dégustations ne permet de les retrouver.

- [x] **Liste « À noter »** : chaque bouteille sortie sans fiche y reste jusqu'à ce qu'on la note ou qu'on choisisse « Sans fiche ». Une ligne par bouteille : vin, date de sortie, motif, plat ou occasion, et avec qui.
- [x] **Bouton dans Dégustations** : en haut de l'onglet, une carte « 3 bouteilles sorties à noter » ouvre la liste. Elle n'apparaît que s'il y a des bouteilles à noter. La liste est aussi accessible quand le journal est vide.
- [x] **Choix pour une bouteille** : « Note rapide », « Fiche complète » (contexte prérempli avec la date de sortie, le plat et les convives) ou « Sans fiche » (la bouteille quitte la liste, sans dégustation). En bas de la liste, « Tout passer sans fiche » demande confirmation.
- [x] **Au moment de la sortie** : l'écran « Bonne dégustation ! » propose « Note rapide », « Fiche complète », « Plus tard » (la bouteille va dans « À noter ») et « Sortir sans fiche » (rien à noter, aucun rappel).
- [x] **Rappel du lendemain** : la bannière compte les bouteilles à noter (« 2 bouteilles sorties à noter »). « Noter » ouvre la liste, ou directement la fiche s'il n'y en a qu'une. « Plus tard » masque la bannière jusqu'au lendemain sans rien retirer de la liste.
- [x] **Sorties passées** : à l'installation, les bouteilles bues, bouchonnées ou terminées dans les 30 derniers jours sans dégustation entrent dans la liste (validé le 5 novembre 2026). Les sorties plus anciennes n'y apparaissent pas.
- [x] Non concernés : les bouteilles d'un ami, et les sorties « offerte », « vendue », « cassée » ou « rendue ».
- [x] Tests : trois sorties successives toutes retrouvées, chaque choix (rapide, complète, sans fiche), « Plus tard » à la sortie et dans la bannière, « Tout passer sans fiche », reprise des sorties récentes.

*Onglet Cave : changer de site en glissant* (demande du 5 novembre 2026)
- [x] **Geste** : en mode Plan, avec plusieurs sites, un glissement horizontal sur la page passe au site suivant (vers la gauche) ou au précédent (vers la droite), dans l'ordre des sites. C'est le même effet que le sélecteur de site en haut de l'écran.
- [x] **Repères** : la page glisse dans le sens du geste, le nom du site s'affiche brièvement, et de petits points sous le titre indiquent le site affiché.
- [x] **Sans conflit** : un geste commencé dans un meuble large qui défile horizontalement, ou dans la rangée des espaces, fait défiler ce meuble ou ces espaces, pas le site. Un geste surtout vertical fait défiler la page. Rien ne se passe pendant qu'une fenêtre est ouverte, en mode Liste ou avec un seul site.
- [x] Tests : glissements dans les deux sens (site suivant, précédent, retour au premier après le dernier), geste vertical et geste dans un meuble large sans effet.

**v1.7.4** (nouveau millésime, bouteilles partagées avec un ami, actions sur une caisse entière ; livrée)

*Constat.* « Racheter un vin » ajoute des bouteilles au même vin, donc au même millésime. Pour un autre millésime, il faut ressaisir toute la fiche.

- [x] **Accès** : bouton « Nouveau millésime » sur la fiche d'un vin ; dans « Racheter un vin », chaque vin propose « Mêmes bouteilles » ou « Autre millésime ».
- [x] **Saisie courte** : un écran présente d'abord ce qui change : millésime, quantité, source d'achat (validé : lieu d'achat, ou « Offert par » pour un cadeau), prix unitaire, date d'achat (aujourd'hui par défaut), espace de rangement. La source et le prix du dernier achat sont proposés en grisé, comme exemple.
- [x] **Repris du vin d'origine** : couleur, domaine, cuvée, appellation, région, pays, cépages, degré, format, température de service, bio et nature, nom court et abréviation. Un lien « Modifier les autres informations » ouvre la fiche complète, déjà remplie.
- [x] **Non repris** : fenêtre de dégustation (elle dépend du millésime : le sommelier l'estime, comme pour tout nouveau vin), photo d'étiquette, notes, dégustations, propriétaire (vin d'un ami), cadeau.
- [x] **Millésime déjà en cave** : l'app le signale et propose d'ajouter les bouteilles à ce vin-là plutôt que de créer un doublon.
- [x] **Autres millésimes** : la fiche d'un vin liste ses autres millésimes en cave (même domaine, même cuvée ou appellation), avec le nombre de bouteilles et la fenêtre de chacun.
- [x] Rangement ensuite comme pour tout ajout, avec la proposition de transfert vers le stockage de la v1.7.2 si le vin est à garder.
- [x] Tests (millésime) : champs repris et non repris, fenêtre estimée à part, millésime déjà présent, liste des autres millésimes.

*Bouteilles d'un ami dans un même vin* (demande du 5 novembre 2026). Aujourd'hui, le propriétaire est fixé au niveau du vin : toutes ses bouteilles sont à moi, ou toutes à un ami. Or, dans une commande groupée, un même vin est souvent partagé.
- [x] **Propriétaire par bouteille** : chaque bouteille est « à moi » ou à un ami. Les anciennes données sont converties sans perte : un vin « à Paul » donne des bouteilles « à Paul ».
- [x] **À l'ajout** : sous la quantité, « Dont pour un ami : [nombre] [prénom] » (ex. 12 bouteilles, dont 6 pour Paul). Par défaut, tout est à moi.
- [x] **Après coup** : sur la fiche du vin, « Répartir entre propriétaires » permet de choisir combien de bouteilles vont à qui. Sur la fiche d'une bouteille, « Appartient à » se modifie seul.
- [x] **Partout ailleurs** : le sommelier, À boire, les conseils de rangement et les suggestions de transfert ne comptent que mes bouteilles. Sur le plan, les cases d'un ami gardent leur hachure et l'initiale. La fiche du vin affiche « 12 bouteilles, dont 6 à Paul ». Le filtre « Vins des amis » de la liste montre les vins qui ont au moins une bouteille d'un ami. « Rendue à son propriétaire » reste un motif de sortie, par bouteille.

*Actions sur une caisse ou un carton entier* (demande du 5 novembre 2026). Une caisse en bois ou un carton contient toujours un seul vin (validé ; pour un assortiment, utiliser une étagère ou un rack).
- [x] **Un vin par caisse** : au rangement, une caisse qui contient déjà un autre vin n'est pas proposée. Si on la touche, un message explique pourquoi. Une caisse qui contient déjà plusieurs vins (données existantes) est signalée « à répartir » sans rien perdre.
- [x] **Fiche de la caisse, actions groupées** sur toutes ses bouteilles, ou sur un nombre choisi :
  - **Sortir** N bouteilles d'un coup (bues, offertes, vendues, rendues…) ;
  - **Déplacer la caisse** vers un autre espace ou un autre site : le meuble part avec ses bouteilles, qui restent dedans ;
  - **Ajouter la caisse au transfert** : à l'arrivée, la caisse est posée dans l'espace d'arrivée avec ses bouteilles, sans avoir à les ranger une par une (validé le 5 novembre 2026) ;
  - **Attribuer** N bouteilles à un ami, ou à moi ;
  - **Modifier le vin** (fiche commune) et **Modifier l'achat** (prix, date, source) pour toutes les bouteilles de la caisse.
- [x] Tests : nouveau millésime depuis la fiche et depuis « Racheter un vin », « Offert par » ; ajout de 12 bouteilles dont 6 pour un ami, puis répartition après coup ; sommelier et À boire limités à mes bouteilles ; caisse à un seul vin au rangement ; sortie, déplacement, transfert et attribution d'une caisse entière.

**v1.7.5** (primeurs plus faciles à trouver ; livrée)

*Constat* (question du 5 novembre 2026). L'option primeur existe, mais elle se cache dans un menu « État » (« En cave » / « Primeur, pas encore livré »), à côté de la quantité. On la trouve dans « Nouveau vin › Saisie manuelle » et dans « Racheter un vin › Mêmes bouteilles ». Elle manque dans « Nouveau millésime » (v1.7.4), alors que c'est le cas le plus courant : on achète en primeur le millésime suivant d'un vin qu'on a déjà.

- [x] **Choix visible** : le menu « État » devient deux pastilles bien visibles sous la quantité, « En cave » et « En primeur ». Avec « En primeur », la date de livraison prévue apparaît, et « Ranger dans » devient « Destination à la livraison ».
- [x] **Partout où l'on ajoute des bouteilles** : nouveau vin (saisie et photo d'étiquette), « Mêmes bouteilles », « Nouveau millésime ».
- [x] **Raccourci** : dans Réglages › Primeurs, un bouton « Ajouter un primeur » ouvre « Racheter un vin » ou « Nouveau vin », avec « En primeur » déjà choisi.
- [x] Le reste ne change pas : réception depuis Réglages › Primeurs ou la fiche de la bouteille, propriétaire « dont N pour un ami » possible aussi en primeur.
- [x] Tests : primeur depuis chacun des trois écrans, date de livraison, raccourci depuis Réglages › Primeurs, réception.

**v2** (demandée le 5 novembre 2026 : « Lance la V2 ». Jusqu'ici, c'était une simple liste. Elle est maintenant découpée en quatre releases et spécifiée ; le développement attend la validation des questions ci-dessous.)

Ordre proposé : v2.0 (comprendre sa cave), v2.1 (partager et exporter), v2.2 (QR codes), v2.3 (sauvegarde automatique). Chaque release est livrée et testée à part. *Revu le 13 novembre 2026* : v2.2 sauvegarde automatique (avant les QR codes, mis en réserve) ; les barres d'apogée et l'aperçu des meubles sont une amélioration de la version actuelle (v2.1.3).

**v2.0** (statistiques, valeur, cadeaux, audit ; livrée)
*Statistiques* : un écran Réglages › Ma cave › Statistiques. Seules mes bouteilles sont comptées.
- [x] **La cave aujourd'hui** : bouteilles par couleur, par région (les 8 premières, puis « autres »), par pays, par millésime (histogramme), par format, par statut (à boire en priorité, prêt, trop tôt, déclin, inconnu), par site et par espace.
- [x] **Consommation** : bouteilles bues par mois sur 12 mois, par couleur ; note moyenne ; les 10 vins les mieux notés ; rythme annuel (bouteilles bues par an).
- [x] **Achats** : bouteilles achetées et dépense par année, prix moyen par bouteille, lieux d'achat les plus fréquents.
- [x] Chaque graphique se touche pour afficher la liste des vins concernés, comme le graphique d'À boire.

*Valeur estimée* (question 1 validée : saisie à la main ou estimation par le sommelier à la demande, jamais en tâche de fond)
- [x] **Champ « valeur actuelle »** sur la fiche d'un vin, saisi à la main, ou proposé par le sommelier avec recherche web. Il affiche sa source, sa date et une fourchette.
- [x] **Estimation groupée** « Estimer la valeur des vins sans estimation », avec le coût annoncé avant de lancer (environ 1 centime par vin) et le respect du plafond mensuel.
- [x] **Valeur de la cave** : la somme des valeurs actuelles, ou à défaut du prix d'achat, avec la part estimée et la part au prix d'achat. Évolution : valeur actuelle comparée au prix d'achat, par vin et au total.

*Suivi des cadeaux*
- [x] **Écran « Cadeaux »** (Réglages › Ma cave) : vins reçus (« Offert par ») et vins offerts (sorties « offerte », avec le destinataire), groupés par personne, avec dates et occasions. Recherche par prénom.
- [x] **Éviter les doublons** : au moment d'offrir un vin à quelqu'un, l'app signale « Tu as déjà offert ce vin à Paul en mars 2026 ».
- [x] La fiche d'une personne réunit ce qu'elle t'a offert, ce que tu lui as offert, et les bouteilles que tu gardes pour elle.

*Audit de cave* (§7.4)
- [x] **Bilan calculé sur l'appareil** : équilibre des couleurs et des régions ; calendrier des années de maturité comparé à ton rythme de consommation (années où trop de vins arrivent à maturité en même temps, années creuses) ; part des vins en déclin ; espaces de garde pleins ou vides.
- [x] **Lecture du sommelier** : une synthèse, trois à cinq constats et des suggestions d'achat concrètes (types de vins, millésimes à viser, budget indicatif), à partir de ce bilan. C'est un appel unique, sans recherche web : environ 5 centimes.
- [x] Accès : bouton « Audit de ma cave » dans À boire et dans les suggestions du sommelier. Le dernier audit est conservé et daté.
- [x] Tests : statistiques sur la cave fictive (totaux justes, vins des amis exclus), valeur avec et sans estimation, cadeaux reçus et offerts, alerte de doublon, audit avec réponse simulée.

**v2.1** (partager et exporter, import des dégustations Ploc ; livrée)
- [x] **Carte des vins à partager** : tu choisis les vins (prêts à boire, un site, des couleurs, ou une sélection à la main) et la mise en forme (avec ou sans prix ni nombre de bouteilles). La carte est rangée par couleur puis par région, sur une jolie page. Elle se partage en image (Messages, WhatsApp…) ou en PDF.
- [x] **Partager une dégustation** (§6 bis, « Plus tard ») : une carte image avec le vin, la note, la teinte, les arômes principaux, l'accord et le commentaire, ou la même chose en texte.
- [x] **Export Excel** : un vrai fichier .xlsx créé sur l'iPhone, sans service extérieur, avec trois onglets : Inventaire (une ligne par vin, avec quantités par site et emplacements), Dégustations, Mouvements.
- [x] **Export PDF** : inventaire imprimable (par site, espace et meuble, avec le plan de chaque meuble), par l'impression iOS (« Enregistrer en PDF »).
- [x] Rien ne quitte l'iPhone sans action de ta part : le partage passe par la feuille de partage iOS.
- [x] **Import des dégustations depuis Ploc** (demande du 5 novembre 2026, précisée le 6) : à partir du fichier CSV exporté par Ploc, une ligne par dégustation. Accès par Réglages › Importer depuis Ploc › « Dégustations (CSV) ».
  - **Format réel** (fichier reçu le 6 novembre 2026, 130 dégustations de 2020 à 2026) :
    - encodage Windows-1252 et non UTF-8 (l'app détecte l'un ou l'autre) ; séparateur « ; » ; textes entre guillemets ; fins de ligne Windows ;
    - en-tête : `Date ; Nom du vin ; Millésime ; Lieu ; Note ; EmotiPLOC ; Couleur ; Personnes présentes ; Plats ; Commentaires ; IdVin` ;
    - date au format « 16/01/2023 » ; millésime parfois vide (18 lignes) ; note sur 100, parfois vide (5 lignes) ;
    - la couleur est un code (« #8E1521 »), parfois vide (13 lignes) ;
    - « IdVin » est l'identifiant Ploc du vin, rempli sur 29 lignes seulement ; « Commentaires » contient parfois « À compléter » (texte par défaut de Ploc, ignoré) ou un prix (« 450€ »).
    - Les colonnes sont repérées par leur nom d'en-tête ; à défaut, par cet ordre. Les variantes UTF-8, séparateur « , » ou dates « 2024-03-12 » sont aussi acceptées.
  - **Correspondance des champs** : Lieu → lieu de la dégustation ; Personnes présentes → convives (virgule finale retirée) ; Plats → plat ; Commentaires → commentaire ; EmotiPLOC → ignoré ; IdVin → regroupe les lignes d'un même vin.
  - **Couleur** : les codes Ploc connus sont traduits directement. Rouge : #8E1521, #751A17, #C3233A, #C9193A, #E4113F. Blanc : #F9F2B0, #FFD464, #F0C701, #FFD374. Rosé : #F39869, #D97666, #EFA58F, #F3390B. Liquoreux : #9EC3C7. Les codes ambigus (#F3A200 : un Monbazillac et un vin orange ; #C33061 : rouges légers) et les couleurs vides sont laissés au sommelier, avec le code en indice. Le sommelier peut aussi reconnaître un effervescent (Champagne, méthode traditionnelle, brut), que Ploc ne distingue pas.
  - **Note** : sur 100, convertie sur 20 au demi-point (75 donne 15/20, 100 donne 20/20). Une note vide donne une dégustation sans note.
  - **Nom du vin démêlé par le sommelier** (validé le 6 novembre 2026, le coût n'est pas un frein puisque l'import n'a lieu qu'une fois) : dans Ploc, « nom du vin » est un champ unique qui mélange souvent domaine, appellation et cuvée, dans tous les ordres (« Chablis - Jean Dauvissat », « Les Argiles, François Chidaine », « La Planche - Jean louis Mauler »). On y trouve aussi des variantes d'un même vin (« Chateau Margaux » et « Château Margaux », « Les Haut De Smith » et « Les Hauts De Smith »), que le sommelier signale comme un même vin. Le commentaire (cépages, appellation) lui sert d'indice. Le sommelier les sépare pour chaque vin, puis complète le domaine, l'appellation et la région quand il les reconnaît. La couleur de Ploc a priorité. Le coût est annoncé avant de lancer.
  - **À vérifier par l'utilisateur** : sur l'écran de vérification, chaque vin montre domaine, appellation et cuvée, modifiables. Les champs complétés par le sommelier sont signalés « à vérifier », et ceux qu'il n'a pas pu déterminer restent vides, à compléter.
  - **Séances** (demande du 6 novembre 2026) : les dégustations d'une même date sont regroupées dans une séance, datée de ce jour. Le lieu de la séance est celui de ses dégustations, ou le plus fréquent s'ils diffèrent. Son titre est le lieu, sinon « Dégustation du 12 mars 2024 ». Une date avec une seule dégustation ne crée pas de séance : elle reste une dégustation simple (validé le 6 novembre 2026). Dans le fichier reçu, cela donne 30 séances (105 dégustations) et 25 dégustations simples. Si une séance existe déjà à cette date, les dégustations la rejoignent.
  - **Rapprochement avec ta cave** : après le travail du sommelier, chaque vin est rapproché d'un vin existant (domaine, cuvée ou appellation, et millésime, sans tenir compte des accents ni de la casse). Sinon, une fiche « vin dégusté » est créée, sans bouteille.
  - **Écran de vérification** : regroupé par séance, avec pour chaque dégustation la date, le vin, la note, le lieu et le rapprochement (« vin de ta cave », « nouveau vin » ou « déjà importée »). On peut corriger le vin, changer le rapprochement ou décocher une ligne.
  - **Sans doublon** : une dégustation de même date, même vin et même note n'est pas réimportée. On peut donc relancer l'import avec un fichier plus récent.
  - **Effet** : les dégustations rejoignent le journal, marquées « importée de Ploc ». Elles comptent dans les moyennes et le sommelier les voit. Aucune bouteille ne sort du stock.
- [x] Tests (import CSV) : un fichier fictif au format exact du fichier reçu (Windows-1252, mêmes colonnes ; le fichier réel n'est pas mis dans le dépôt, il contient des données personnelles), plus des variantes UTF-8 et séparateur « , », guillemets et retours à la ligne dans un commentaire, colonnes repérées par l'en-tête ou par l'ordre, codes couleur connus et ambigus, notes sur 100 et sur 20, dates aux trois formats, nom démêlé par le sommelier (réponse simulée) et champs « à vérifier », séance par date, vin rapproché et vin nouveau, second import sans doublon, ligne invalide signalée.
- [x] Tests : contenu de la carte selon les filtres, image produite, fichier .xlsx lisible (structure vérifiée), page d'impression.

**v2.1.1** (photo d'étiquette depuis la photothèque ; livrée)

*Constat* (demande du 6 novembre 2026). Dans « Nouveau vin › Photo de l'étiquette », l'iPhone ouvre directement l'appareil photo : le champ de fichier impose la prise de vue (`capture="environment"`). Une photo prise plus tôt ne peut pas être utilisée.

- [x] **Deux choix** sous « Photo de l'étiquette » : « Prendre une photo » (appareil photo, comme aujourd'hui) et « Choisir dans mes photos » (photothèque ou Fichiers, sans prise de vue imposée).
- [x] **Même lecture** ensuite : le sommelier lit l'étiquette et pré-remplit la fiche, la photo est réduite et rangée chiffrée avec le vin.
- [x] Même choix pour la photo d'une fiche de vin existante (« Modifier ») et pour la dégustation à l'aveugle (révélation par photo), là où une photo d'étiquette est demandée.
- [x] Formats acceptés : ceux de la photothèque de l'iPhone (JPEG, HEIC, PNG). Si un format n'est pas lisible, un message propose de prendre la photo à la place.
- [x] Tests : les deux boutons, fichier choisi (sans prise de vue imposée) lu comme une photo prise, format illisible signalé.

**v2.1.2** (photo d'étiquette : un seul bouton ; livrée)

*Constat* (retour du 6 novembre 2026, sur iPhone). Le bouton « Choisir dans mes photos » ouvre déjà le menu d'iOS, qui propose « Photothèque », « Prendre une photo » et « Choisir le fichier ». Le bouton « Prendre une photo » de la v2.1.1 fait donc doublon.

- [x] **Un seul bouton** : toute la case « Photo de l’étiquette » ouvre le menu d'iOS (prendre une photo, photothèque ou fichiers), comme le faisait « Choisir dans mes photos ». Le bouton « Prendre une photo » séparé est retiré.
- [x] Partout où il y avait les deux boutons : nouveau vin, nouvelle dégustation, révélation à l'aveugle. Sur une fiche en modification, un seul bouton « Changer la photo ».
- [x] Le champ qui imposait l'appareil photo (`capture`) n'est plus utilisé. Le reste ne change pas : lecture par le sommelier et message pour un format illisible.
- [x] Tests : une seule entrée par écran, qui ouvre le sélecteur sans prise de vue imposée ; lecture de la photo inchangée.

**v2.1.3** (améliorations de la version actuelle : barres d'apogée dans les listes, onglet Cave plus compact avec aperçu des meubles, filtres de la liste et recherche déplacée ; demandées le 13 novembre 2026 ; livrée)

*Barres d'apogée*

*Constat* : dans « Transferts entre sites » et dans « Conseils de rangement », il faut toucher chaque vin pour voir où il en est de sa fenêtre de dégustation.

- [x] **Petite barre d'apogée** sous chaque vin de ces deux écrans : la fenêtre (début → fin) en couleur, et un trait pour aujourd'hui, comme dans la liste « À boire ». On voit d'un coup d'œil si un vin est trop jeune, à son apogée ou en fin de fenêtre.
- [x] Dans « Transferts entre sites » : sur les bouteilles à emporter (chaque sens) et sur les suggestions.
- [x] Dans « Conseils de rangement » : sur chaque conseil (à rapprocher, à mettre en garde, réassort).
- [x] **Même échelle pour tout l'écran** (de 3 ans avant à 12 ans après l'année en cours, comme « À boire ») pour pouvoir comparer les vins entre eux ; les années de début et de fin de l'échelle sont rappelées en tout petit en tête de liste. Une fenêtre qui dépasse l'échelle est coupée au bord.
- [x] Vin sans fenêtre : barre grise vide (rien n'est estimé automatiquement à l'ouverture de l'écran). Spiritueux : pas de barre.
- [x] Le reste ne change pas : toucher le vin ouvre toujours son résumé, avec la grande barre et les années.
- [x] Tests : barre présente et trait d'aujourd'hui bien placé dans les deux écrans, vin sans fenêtre, spiritueux, écran de 100 vins sans ralentissement.

*Aperçu des meubles dans l'onglet Cave* (maquette à valider sur iPhone **avant** tout développement : https://claude.ai/artifact/3MikYoN8vzhhRXZirWq824)

*Constat* : sur un site avec plusieurs espaces et meubles, il faut faire défiler tout le plan pour atteindre un meuble.

- [x] **Maquette validée** le 13 novembre 2026. Choix : la barre montre **les meubles du site actuel** (on change de site avec le sélecteur, comme aujourd'hui).
- [x] **Barre d'aperçu** d'environ 1,5 cm de haut, sous « Plan / Liste », qui reste visible pendant le défilement du plan. Elle montre en miniature, en 2D, chaque meuble du site, regroupés par espace : la grille réelle (une pastille par place, à la couleur du vin, vide si la place est libre) ; pour une caisse ou un carton, la caisse avec ses bouteilles. Sous chaque miniature : le nom du meuble et « occupées / places ».
- [x] **Toucher une miniature** amène directement au meuble sur le plan (défilement doux, le meuble s'encadre un instant). Pour un meuble en bas de page, le défilement s'arrête à la fin du plan : jamais au-delà, sinon iPhone fait glisser tout l'écran et la barre d'onglets remonte (bug constaté sur la maquette le 13 novembre 2026, corrigé).
- [x] **Suivi** : pendant le défilement du plan, la miniature du meuble visible s'encadre, et la barre glisse pour la garder visible.
- [x] Défilement horizontal de la barre quand les meubles ne tiennent pas en largeur ; les grandes grilles sont réduites pour tenir dans la hauteur.
- [x] La barre remplace les puces de choix d'espace (« Tout · N », un espace…), devenues inutiles : le plan montre toujours tout le site. Elle n'apparaît pas en mode Liste, ni pendant une recherche (résultats sur tous les sites), ni s'il n'y a qu'un seul meuble.
- [x] Les miniatures se mettent à jour après chaque rangement, sortie ou transfert, sans ralentir le plan (cave de 500 bouteilles).
- [x] Tests : miniatures fidèles au contenu, saut vers le bon meuble (et le bon site), saut vers le dernier meuble sans dépasser la fin de la page, suivi au défilement, caisses et cartons, barre absente en Liste et en recherche, performance.

*Filtres de la liste* (même maquette, 3e version, validée le 13 novembre 2026)

- [x] En mode **Liste**, la même barre (même hauteur) porte un bouton **« Filtres »** (avec le nombre de filtres actifs) et, dessous, les **filtres actifs** en puces. Toucher une puce la retire ; « Tout effacer » retire tout. Sans filtre, un court rappel (« Aucun filtre : tous les vins sont affichés »).
- [x] Le bouton ouvre une **feuille** qui montre tous les filtres d'un coup, sans défilement sur le côté, par groupes : **Maturité** (Priorité, Apogée, Trop tôt, Déclin), **Couleur** (rouge, blanc, rosé, bulles, liquoreux, et spiritueux si activés), **Site** (si plusieurs), **Région** (celles présentes dans la cave), **Millésime** (≤ 2015, 2016–2019, 2020 et +, tranches calculées sur la cave), **À qui** (mes vins, vins des amis, s'il y en a). En bas, « Voir N vins » ferme la feuille ; la liste derrière se met à jour à chaque choix.
- [x] Dans un même groupe, les choix s'additionnent (rouge ou blanc) ; entre groupes, ils se combinent (rouge et Loire). Chaque puce de la feuille affiche le nombre de vins qu'elle donnerait ; une puce qui ne donnerait rien est estompée.
- [x] Les filtres se combinent avec la recherche et sont gardés en passant de Plan à Liste.
- [x] Remplace les puces de filtre actuelles de la liste (Prêts à boire, couleurs, Mes vins / Vins des amis).

*Recherche déplacée* (gagner de la hauteur ; choix du 13 novembre 2026 : **flottante**)

- [x] Le champ de recherche permanent disparaît de l'en-tête, dans les deux modes (Plan et Liste).
- [x] **Loupe flottante** : un bouton rond en bas à droite, au-dessus de la barre d'onglets. Le toucher ouvre le champ en bas de l'écran, juste au-dessus du clavier, avec « Annuler ».
- [x] Une pastille sur la loupe signale une recherche en cours ; « Annuler » efface la recherche ; le reste ne change pas (en Plan, résultats sur tous les sites avec saut vers l'emplacement ; en Liste, filtrage en direct).
- [x] Tests : ouverture et fermeture de la recherche flottante, résultats, feuille des filtres, filtres seuls et combinés, compteurs, retrait d'une puce, « Tout effacer », hauteur de l'en-tête réduite.

**v2.1.4** (adaptation à Android ; demandée le 14 novembre 2026 ; livrée)

*Constat* : MyCellar s'installe déjà sur Android depuis Chrome (menu ⋮ › « Installer l'application ») : c'est la même web app, à la même adresse. Mais elle a été conçue et testée uniquement sur iPhone : textes « cet iPhone », déverrouillage nommé « Face ID » (qui n'existe pas sur Android), icône non adaptée, bouton retour d'Android non géré.

*Détection de l'appareil*

- [x] L'app reconnaît au démarrage si elle tourne sur **iPhone ou iPad**, sur **Android** ou ailleurs (ordinateur), d'après l'identité que le navigateur annonce (l'iPad récent se présente comme un Mac : il est reconnu par son écran tactile). Elle sait aussi déjà si elle est installée ou ouverte dans le navigateur. Tout ce qui suit s'appuie sur cette détection ; en cas de doute, les textes neutres (« cet appareil », « Clé d'accès ») s'affichent.

*Déverrouillage biométrique (remplace « Face ID » hors iPhone)*

- [x] Le nom suit l'appareil : **« Face ID »** sur iPhone (inchangé) ; **« Empreinte ou visage »** sur Android (avec une icône d'empreinte) ; **« Clé d'accès »** ailleurs. Partout où « Face ID » apparaît : écran de verrouillage, bouton « Déverrouiller avec… », Réglages › Sécurité, proposition au premier lancement, messages de confirmation et d'erreur.
- [x] Sur Android, la clé d'accès est rangée dans le gestionnaire de mots de passe de Google (au lieu du trousseau iCloud) et s'utilise avec l'empreinte, le visage ou le code de l'écran de verrouillage. Le principe de sécurité ne change pas (extension PRF : la clé de la cave n'est jamais stockée en clair).
- [x] Si le téléphone ne permet pas ce déverrouillage (gestionnaire de clés sans l'extension PRF, Android ou Chrome trop ancien), un message clair l'explique et propose de garder le mot de passe ; l'option n'est plus proposée au lancement suivant. Les messages d'erreur ne citent plus le trousseau iCloud sur Android.

*Textes et aide*

- [x] Plus de « cet iPhone » hors iPhone : « cet appareil » (ou « ce téléphone ») dans l'écran d'accueil, la présentation, le verrouillage, « Rester déverrouillé », la sauvegarde, le suivi d'utilisation, le sommelier.
- [x] Sauvegarde : sur Android, « vers Téléchargements ou Google Drive » au lieu de « Fichiers ou iCloud Drive ». PDF : « Imprimer › Enregistrer au format PDF » sur Android.
- [x] **Aide à l'installation** : ouverte dans Chrome sans être installée, l'app propose un bouton « Installer l'application » (fenêtre d'installation d'Android) ; dans Safari sur iPhone, rappel « Partager › Sur l'écran d'accueil ». Une fois installée, plus rien ne s'affiche.
- [x] README : section « Installer sur Android » à côté de « Installer sur l'iPhone ».

*Comportement propre à Android*

- [x] **Bouton (ou geste) retour** : il ferme d'abord la fenêtre ouverte (fiche, filtres, recherche), puis revient à l'onglet Cave ; il ne quitte l'app que depuis l'onglet Cave sans rien d'ouvert. Sans effet sur iPhone.
- [x] **Icône adaptée** aux formes d'Android (rond, carré arrondi…) : version « maskable » avec marge de sécurité, déclarée dans le manifeste ; plus d'icône réduite dans un rond blanc. Couleur de la barre d'état assortie à l'app.
- [x] **Recherche flottante** : le champ reste juste au-dessus du clavier d'Android, sans double décalage (Chrome redimensionne la page, Safari non).
- [x] **Partage et export** (carte des vins, dégustation, Excel, sauvegarde) : feuille de partage d'Android quand elle est disponible, sinon téléchargement du fichier.
- [x] **Photo d'étiquette** : le sélecteur d'Android (appareil photo, galerie, fichiers) ; lecture inchangée.

*Données sur l'appareil (Android et iPhone)*

- [x] Demande au navigateur de **ne jamais effacer les données** de l'app (stockage persistant). L'état est affiché dans Réglages › Sauvegarde ; s'il est refusé, le rappel de sauvegarde le signale.

*Tests*

- [x] Tests automatiques sur un téléphone Android simulé (Pixel) : conditions d'installation (manifeste, icônes dont la version adaptée, fichier d'installation), noms du déverrouillage selon l'appareil, aucun « iPhone » affiché sur Android, bouton retour, recherche au-dessus du clavier, partage et export, photo. Toute la suite existante rejouée aussi en mode Android.
- [ ] **Vérification sur un vrai téléphone Android** (par toi ou un ami) : installation, déverrouillage par empreinte, photo d'une étiquette, sauvegarde puis restauration d'une cave venue de l'iPhone. Une liste de contrôle courte est fournie à la livraison. *(à faire par l'utilisateur : liste de contrôle fournie à la livraison)*

**v2.1.5** (correctif Android : photo ; bug bloquant signalé le 14 novembre 2026, corrigé directement ; livrée)

*Constat* : sur Android, « Nouveau vin › Photo de l’étiquette » ouvre directement la galerie (Google Photos) : impossible de prendre la photo avec l'appareil photo. Chrome, contrairement à iOS, ne propose pas les deux dans son menu.

- [x] Sur Android, toucher la case photo ouvre un petit choix : **« Prendre une photo »** (appareil photo, arrière) ou **« Choisir dans mes photos »** (galerie). Le choix se ferme et la lecture de la photo est inchangée.
- [x] Partout où une photo est demandée : nouveau vin, fiche en modification, nouvelle dégustation (étiquette et photo de la dégustation), révélation à l'aveugle.
- [x] Sur iPhone, rien ne change (une seule case, le menu d'iOS propose déjà les deux).
- [x] Tests : les deux choix sur Android (appareil photo imposé pour l'un, galerie pour l'autre), photo remise à la bonne lecture ; iPhone inchangé.

**v2.1.6** (transferts : trouver la bouteille en cave ; demandée le 14 novembre 2026 ; livrée)

*Constat* : au moment de faire un transfert, il faut ouvrir le résumé de chaque vin pour savoir où prendre la bouteille.

- [x] Dans « Transferts entre sites », chaque ligne (bouteilles à emporter, dans chaque sens, et suggestions) a la petite **épingle** « Voir dans la cave », comme dans les résultats de recherche.
- [x] La toucher ferme la fenêtre et amène directement à la bouteille : bon site, plan, case qui clignote (ou la caisse qui s'ouvre si la bouteille est dans une caisse, ou le bloc « non placées »).
- [x] Le reste ne change pas : toucher le vin ouvre toujours son résumé ; la croix retire du transfert ; « Ajouter » pour les suggestions.
- [x] Tests : épingle sur chaque ligne, saut vers la bonne case et le bon site, depuis une bouteille à emporter et depuis une suggestion.

**v2.1.7** (cave à variation saisonnière ; demandée le 14 novembre 2026 ; livrée)

*Constat* : la température d'un espace n'a que deux choix, « Stable (10–14 °C) » ou « Variable ». Une cave enterrée qui passe lentement de 5 °C l'hiver à 23 °C l'été (grande inertie, pas d'écart d'un jour à l'autre) est notée comme une pièce qui fait le yoyo chaque jour, alors que l'effet sur le vin est très différent : la variation lente abîme peu, c'est surtout le temps passé au chaud qui accélère l'évolution.

- [x] **Trois choix de température** : « Stable (10–14 °C) », **« Variable lentement, au fil des saisons »** (nouveau), « Variable rapidement (jour/nuit, chauffage…) » (l'ancien « Variable », dont la valeur enregistrée est gardée).
- [x] **Températures mini et maxi sur l'année** (°C, facultatives, entre −10 et 40, mini ≤ maxi), sous le choix de température.
- [x] **Qualité de l'espace** (Excellente, Bonne, Moyenne, Faible) : la note de température tient compte de la variation saisonnière et du maxi d'été. Stable : 2 points (1 si le maxi dépasse 18 °C) ; saisonnière : 2 si le maxi ne dépasse pas 18 °C, 1,5 jusqu'à 21 °C, 1 jusqu'à 24 °C ou si le maxi n'est pas renseigné, 0,5 au-delà ; rapide : 0. Exemple : cave saisonnière 5–23 °C, humidité bonne, obscurité, sans vibrations : « Bonne ».
- [x] **Sommelier** : la fiche envoyée pour estimer la fenêtre de dégustation précise la variation (« variable lentement, au fil des saisons, de 5 à 23 °C »), et sa consigne explique qu'une variation lente abîme peu, que c'est le temps passé au-dessus de 20 °C qui accélère l'évolution (fenêtre un peu raccourcie), et qu'un maxi au-dessus de 25 °C ou un mini sous 0 °C est un vrai risque.
- [x] Conseils de rangement : la qualité ainsi calculée sert, comme aujourd'hui, à choisir la meilleure cave de garde.
- [x] Tests : les trois choix, mini et maxi enregistrés et contrôlés, qualité calculée pour plusieurs cas (dont l'exemple ci-dessus), fiche envoyée au sommelier, ancien « Variable » relu sans changement.

**v2.1.8** (réanalyser les apogées de tous les vins d'une cave ; demandée le 14 novembre 2026 ; livrée)

*Constat* : quand on change les conditions d'un espace (température, mini et maxi, hygrométrie…), les fenêtres de dégustation des vins qui y sont rangés restent calculées avec les anciennes conditions. Aujourd'hui, il faut toucher « Réestimer » vin par vin, et chaque réestimation refait une étude complète du vin (avec recherche web), ce qui coûte cher pour une cave entière.

*Principe* : changer de cave ne change pas le potentiel du vin, seulement sa vitesse d'évolution. On demande donc au sommelier d'**ajuster** les fenêtres existantes à de nouvelles conditions, en groupe et de façon compacte, plutôt que de tout réétudier.

*Où*

- [x] Réglages › Sites, espaces et meubles › un espace : bouton **« Réanalyser les apogées des N vins de cet espace »**.
- [x] **Après avoir modifié les conditions** d'un espace qui contient des vins (température, mini ou maxi, hygrométrie, lumière, vibrations) : proposition immédiate « Conditions modifiées : réajuster les fenêtres des N vins concernés ? », avec le coût indicatif, et « Plus tard ».

*Quels vins*

- [x] Les vins (pas les spiritueux) dont la **cave principale** est cet espace (celui qui contient le plus de leurs bouteilles), en cave ou en primeur livrable dans cet espace.
- [x] **Seulement ceux qui en ont besoin** : chaque fenêtre garde la trace des conditions avec lesquelles elle a été calculée. Un vin déjà estimé avec les conditions actuelles est sauté (aucun appel). Le nombre de vins à jour et à réanalyser est affiché avant de lancer.
- [x] Les fenêtres **saisies à la main** ne sont pas touchées, sauf si tu coches « inclure les fenêtres saisies à la main ». Les vins sans fenêtre reçoivent une estimation complète groupée (comme « Estimer » dans À boire).

*Économie de jetons*

- [x] **Ajustement, pas réétude** : pour chaque vin, une seule ligne compacte (appellation, producteur, millésime, couleur, format, fenêtre actuelle, et la note de la dernière dégustation s'il y en a une). Les anciennes et les nouvelles conditions de la cave ne sont envoyées **qu'une fois** pour tout le groupe.
- [x] **Par lots** de 40 vins par appel, **sans recherche web**, avec une réponse structurée minimale (numéro et trois années par vin, une seule explication courte pour tout le lot).
- [x] Consigne fixe et identique d'un lot à l'autre (mise en cache par le service quand elle est assez longue pour l'être), et **modèle économique** (Haiku avec Claude, le petit modèle avec Mistral) : la tâche est un ajustement, pas une recherche.
- [x] **Coût indicatif annoncé** avant de lancer (par exemple « 120 vins : environ 0,02 € »), et compté dans le plafond mensuel comme les autres appels.

*Résultat*

- [x] Un récapitulatif : nombre de fenêtres modifiées, la liste des vins dont la fenêtre bouge, de l'ancienne à la nouvelle (les plus grands écarts d'abord), et ceux inchangés.
- [x] **« Annuler ces changements »** remet les anciennes fenêtres (gardées jusqu'à la réanalyse suivante).
- [x] La fiche de chaque vin indique « Fenêtre ajustée le … aux conditions de [cave] ».
- [x] Sans clé IA : bouton remplacé par l'invitation à configurer le sommelier (aucun ajustement automatique approximatif).

*Tests*

- [x] Choix des vins (cave principale, spiritueux exclus, saisies à la main exclues ou incluses, déjà à jour sautés), proposition après changement de conditions, lots de 40 et une seule description des conditions par lot (sommelier simulé), taille de la demande par vin bornée, récapitulatif, annulation, coût annoncé, plafond mensuel respecté, absence de clé.

**v2.2** (sauvegarde automatique ; spécifiée et validée le 5 novembre 2026 : option b, Google Drive avec un Worker Cloudflare. *Passée en premier le 13 novembre 2026*, à la place des QR codes ; développée le 14 novembre 2026, active dès la mise en place faite)
- [x] **Sauvegarde automatique** chiffrée (le même fichier que la sauvegarde manuelle, illisible sans ton mot de passe). *Réalisé ainsi* : envoi 2 minutes après une modification, ou dès que l'app passe en arrière-plan ; **une nouvelle version au plus par heure** (dans l'heure, la plus récente est mise à jour) ; contrôle au moins une fois par jour à l'ouverture ; rien n'est envoyé si la cave n'a pas changé. Les 30 dernières versions sont gardées. Une PWA ne tourne pas en tâche de fond : l'envoi se fait quand l'app est ouverte ou au moment où on la quitte.
- [x] **Restauration** depuis la liste des versions, avec leur date.
- [x] **État visible** dans Réglages › Sauvegarde : dernière sauvegarde réussie, échec éventuel et sa raison. Le rappel des 7 jours ne s'affiche plus quand la sauvegarde automatique fonctionne.
- [x] **Destination (validée : option b)** : le Google Drive de chaque utilisateur, dans le dossier caché de l'app (`appDataFolder`, droit `drive.appdata`). Chacun se connecte avec son propre compte Google : les sauvegardes sont distinctes par construction.
- [x] **Connexion** : Réglages › Sauvegarde › « Connecter Google Drive », une seule fois par appareil. L'autorisation de longue durée est rangée dans le coffre chiffré de l'app.
- [x] **Worker Cloudflare** : il échange et renouvelle l'autorisation avec le secret du projet Google, et ne garde rien. Les fichiers vont directement de l'iPhone au Drive. Le code du Worker est livré dans le dépôt (`worker/`), avec sa marche à suivre.
- [ ] **Mise en place (à faire par toi, une fois)** : un projet Google Cloud, l'écran de consentement en statut « En production », un identifiant OAuth « Application Web » avec l'adresse de l'app, et le Worker avec le secret. Marche à suivre pas à pas : `docs/sauvegarde-google-drive.md`. *En attente* : à faire par l'utilisateur, puis renseigner `src/backup-config.json` (identifiant OAuth et adresse du Worker, non secrets).
- [x] **Nouvel appareil** : « Restaurer depuis Google Drive » au premier lancement, puis le mot de passe de la cave.
- [x] Tests : envoi, rotation des versions, restauration, absence de réseau, jeton expiré (service simulé). *Réalisé* : t26 (Google, Drive et service simulés, 33 vérifications) et `tests/worker.mjs` (service d'autorisation, 21 vérifications).

**En réserve : QR codes sur les meubles** (spécifiée le 5 novembre 2026 ; *mise de côté le 13 novembre 2026* : peu de valeur ajoutée telle que définie, il suffit d'ouvrir l'app et de choisir la cave. Sans numéro de release ; à reprendre seulement sur demande, éventuellement repensée)
- [ ] **Étiquettes** : pour chaque meuble ou caisse, une étiquette QR avec son nom, à imprimer (planche d'étiquettes en PDF, une ou plusieurs par page).
- [ ] **Scan dans l'app** : un bouton « Scanner » (onglet Cave) ouvre l'appareil photo. Le meuble scanné s'affiche directement sur le plan, avec son contenu et les actions habituelles (ranger ici, sortir, caisse entière…).
- [ ] Le scan se fait dans l'app, pas avec l'appareil photo d'iOS : sur iPhone, une app installée et Safari ne partagent pas leurs données, donc un lien ouvert par l'appareil photo ne verrait pas ta cave.
- [ ] Le code ne contient qu'un identifiant aléatoire du meuble : rien sur le contenu, inutilisable sans ta cave.
- [ ] Tests : génération et relecture des codes, scan simulé qui ouvre le bon meuble, code inconnu.

*Questions à valider avant de lancer*
1. **Valeur estimée** : saisie à la main, ou estimation par le sommelier à la demande (vin par vin, ou en groupe avec le coût annoncé) ? Pas d'estimation automatique en tâche de fond, pour tenir le plafond de 2 € par mois.
2. **QR codes** : il faut intégrer dans l'app deux petites bibliothèques libres, l'une pour dessiner les codes, l'autre pour les lire avec l'appareil photo. Safari sur iPhone ne sait pas encore lire les QR codes seul. Elles sont incluses dans l'app, sans appel extérieur.
3. **Destination de la sauvegarde automatique** :
   - (a) Google Drive, sans serveur : simple, mais Google demande de se reconnecter environ toutes les heures. La sauvegarde ne serait donc automatique que pendant une session.
   - (b) Google Drive, avec un petit service Cloudflare (Worker) qui garde l'autorisation : vraiment automatique. Il faut créer un projet Google Cloud et le Worker ; je fournis le code et la marche à suivre pas à pas.
   - (c) Ton propre espace Cloudflare (Worker et stockage KV), sans Google : vraiment automatique, et le plus simple à installer puisque tu utilises déjà Cloudflare. Le fichier reste chiffré.

   *Précision du 5 novembre 2026* : l'app est aussi utilisée par des amis, chacun avec sa propre cave. Il faut donc que chacun ait sa sauvegarde distincte.
   - Avec Google Drive (a ou b), chacun se connecte avec son propre compte Google. Sa sauvegarde va dans un dossier caché de son Drive, propre à l'app (`appDataFolder`), que personne d'autre ne voit. Sur un nouvel iPhone, il suffit de se reconnecter à Google, puis de saisir le mot de passe de la cave.
   - Avec (c), les sauvegardes de tous sont stockées sur ton compte Cloudflare. Chacune est rangée sous une clé personnelle tirée au hasard sur l'iPhone. Personne ne peut lire la sauvegarde d'un autre, ni toi, puisqu'elle est chiffrée. En revanche, chacun doit garder sa clé de récupération pour restaurer sur un autre appareil.
   - Pour (b) : un seul projet Google Cloud sert à tous. Le droit demandé (`drive.appdata`) est classé « non sensible » par Google, donc une vérification de base suffit. L'app doit passer en statut « En production », sinon l'autorisation expire tous les 7 jours. Le projet est limité à 100 utilisateurs tant qu'il n'est pas vérifié. Le Worker ne fait que renouveler l'autorisation : il ne voit jamais les données, qui vont directement de l'iPhone au Drive de chacun.

---

## 11. Apogée, la version App Store

*En pause depuis le 11 novembre 2026* : le développement revient sur MyCellar. Apogée (plan, business plan, spécifications) est gardé tel quel pour plus tard.

*Réorganisé le 10 novembre 2026* : Apogée a sa propre feuille de route, numérotée à partir de 1.0. MyCellar (§10, branche `master`) et Apogée (branche `store`) évoluent en parallèle ; c'est l'utilisateur qui dit laquelle faire évoluer. Pour lancer une release d'Apogée : « lance Apogée 1.0 » ; pour MyCellar : « lance la v2.2 », comme avant. Une fonction développée pour l'une n'est reportée dans l'autre que sur demande.

Le plan d'ensemble (publication sur l'App Store, grand public ; rédigé le 8 novembre 2026) est dans `docs/plan-app-store.md`.

**Point de départ** : Apogée 1.0 part de l'état de MyCellar au moment de son lancement (v2.1.2 aujourd'hui). Son propre journal des versions démarre à 1.0, sur la branche `store`.

**Feuille de route d'Apogée**
Chaque étape est une release spécifiée, puis lancée sur demande :
- **Apogée 1.0 : socle de sécurité** (réorganisé le 10 novembre 2026 : la sécurité passe en premier). App native minimale, service en ligne sécurisé, identité Apple, authenticité de l'app, crédits et abonnements vérifiés côté serveur, protection de la clé, tests d'attaque. Spécifiée ci-dessous ;
- Apogée 1.1 : produit grand public (ouverture simple et migration, premier lancement guidé, options avancées repliées, langue réglable, import multi-apps, accessibilité) ;
- Apogée 1.2 : sommelier et Premium branchés sur le socle (écran Premium, consentement IA, quotas visibles) ;
- Apogée 1.3 : iCloud, notifications, Face ID, bêta TestFlight ;
- Apogée 1.4 : fiche App Store et publication.
Décisions du 10 novembre 2026 (détail dans le plan, §11) : modèle et prix validés ; deux versions, `master` reste MyCellar (version personnelle, évoluée) et la version App Store vit sur une branche `store` sous le nom **Apogée** (choisi le 10 novembre 2026, marque et domaine à vérifier) ; compte Apple individuel et micro-entreprise ; compilation dans le cloud (pas de Mac) ; français et anglais, tutoiement ou vouvoiement réglable.

**Apogée 1.0 : socle de sécurité** (branche `store` ; spécifiée le 10 novembre 2026, rien n'est développé)

*Objectifs fixés* :
1. aucune donnée d'utilisateur ne peut être extraite, ni de l'app, ni du serveur, ni en chemin ;
2. aucune attaque ne permet de profiter financièrement de l'app : pas de Premium gratuit, pas de crédits IA en plus, pas d'usage de la clé API ;
3. rien ne doit porter atteinte au propriétaire de l'app : ni à ses finances, ni à ses comptes, ni à sa responsabilité, ni à sa réputation.

*Référentiels étudiés* (recherche du 10 novembre 2026), qui servent de grille de contrôle :
- **OWASP MASVS v2.1**, le standard de vérification des apps mobiles : 8 groupes (stockage, cryptographie, authentification, réseau, interaction avec la plateforme, code, résilience, vie privée) ;
- **OWASP Mobile Top 10 (2024)** : identifiants mal utilisés (M1), chaîne d'approvisionnement (M2), authentification et autorisation (M3), validation des entrées et sorties (M4), communications (M5), vie privée (M6), protection du binaire (M7), mauvaise configuration (M8), stockage (M9), cryptographie (M10) ;
- **OWASP API Security Top 10 (2023)**, pour le service en ligne : contrôle d'accès par objet, authentification, consommation de ressources illimitée, flux métier sensibles (achats, crédits), mauvaise configuration… ;
- **OWASP Top 10 pour les applications à base de LLM (2025)** : injection de consignes (LLM01), divulgation d'informations (LLM02), sorties mal traitées (LLM05), fuite des instructions système (LLM07), consommation illimitée, dite « déni de portefeuille » (LLM10) ;
- **CNIL, recommandations sur les applications mobiles** (septembre 2024, mises à jour en avril 2025) et **RGPD** (protection dès la conception, article 25 ; sécurité, article 32 ; notification d'une fuite sous 72 heures, article 33) ;
- **Règles d'Apple** : vérification des achats signés, App Attest, « Se connecter avec Apple », suppression du compte dans l'app (5.1.1), consentement avant envoi de données à une IA tierce (5.1.2), code embarqué dans l'app (2.5.2).

*Principe directeur* : ce que le serveur ne stocke pas ne peut pas fuir, et ce que l'app ne contient pas ne peut pas être volé. Les données de cave restent sur l'iPhone (et, plus tard, dans l'iCloud privé de l'utilisateur) ; le serveur ne garde que le strict nécessaire aux crédits et à l'abonnement ; la clé API n'existe que sur le serveur.

**A. Architecture et données**
- [ ] **Deux éléments seulement** : l'app (Capacitor, tout son code embarqué, rien de téléchargé) et le service Apogée (Worker Cloudflare), séparé de l'hébergement du site de présentation.
- [ ] **Le serveur ne stocke aucune donnée de cave** : pas de vins, notes, dégustations, photos, lieux ni prénoms. Il ne garde que : un identifiant Apple pseudonymisé (empreinte), l'état de l'abonnement, les compteurs de crédits, l'empreinte de la clé App Attest de chaque appareil, et des journaux techniques sans contenu (date, type de demande, résultat, coût).
- [ ] **Minimisation des envois à l'IA** : le contexte de cave envoyé au sommelier ne contient ni prénoms (amis, convives), ni lieux, ni prix d'achat, ni photos de dégustation ; seulement ce qui sert à la réponse (vins, millésimes, fenêtres, emplacements génériques, notes et commentaires de dégustation). Chaque type de demande a sa liste de champs autorisés, vérifiée par le serveur.
- [ ] **Durées de conservation** : journaux techniques 30 jours ; compteurs et état d'abonnement tant que le compte existe ; tout est effacé à la suppression du compte.

**B. Identité : un compte Apple, pas de mot de passe**
- [ ] **Seulement « Se connecter avec Apple »** : pas d'inscription par e-mail, pas de mot de passe stocké, donc rien à voler par hameçonnage ou fuite de base. Le serveur vérifie le jeton d'identité d'Apple (signature avec les clés publiques d'Apple, émetteur, destinataire, expiration, valeur aléatoire à usage unique).
- [ ] **Crédits de découverte une seule fois par compte Apple** et, en plus, une seule fois par iPhone (marqueurs DeviceCheck d'Apple), pour qu'une réinstallation ou un changement de compte sur le même appareil ne les redonne pas.
- [ ] **Sessions courtes** : après connexion, le serveur délivre un jeton de session signé, valable quelques heures, lié à l'appareil (clé App Attest) : volé, il ne sert à rien sur un autre appareil.
- [ ] **Suppression du compte dans l'app** (exigée par Apple) : révocation de l'autorisation Apple et effacement de tout ce que le serveur détient.
- [ ] **Contrôle d'accès strict** : chaque requête n'agit que sur le compte de son jeton ; aucun identifiant de compte n'est accepté venant de l'app (pas d'accès aux crédits ou à l'abonnement d'un autre en changeant un numéro).

**C. Authenticité de l'app (App Attest)**
- [ ] **Enregistrement de l'appareil** : au premier lancement, l'app crée une clé dans la puce sécurisée de l'iPhone (Secure Enclave) et la fait attester par Apple ; le serveur vérifie l'attestation (certificat d'Apple, identifiant de l'app, environnement de production).
- [ ] **Chaque requête est signée** par cette clé (assertion), avec un compteur croissant : une requête copiée et rejouée, ou forgée hors de l'app, est refusée.
- [ ] **Indicateur de fraude d'Apple** : le nombre de clés attestées par appareil sur 30 jours est consulté ; un appareil anormal voit ses crédits gratuits refusés et ses demandes limitées.
- [ ] Simulateur, app modifiée, script ou autre app : aucun accès au service.
- [ ] **Appareil sans App Attest** (validé le 10 novembre 2026) : iPhone trop ancien ou version d'iOS trop ancienne. Apogée y fonctionne normalement (cave, plan, dégustations, imports sans IA, exports), mais **sans sommelier ni crédits IA** : sans attestation, le service refuse toute demande, pour ne pas ouvrir une porte de contournement. Un message l'explique une fois (« Le sommelier n'est pas disponible sur cet appareil »), et la fiche App Store indique la version d'iOS requise pour l'IA. Le seuil exact est fixé avec la version minimale d'iOS d'Apogée. L'abonnement Premium n'est pas proposé sur ces appareils, pour ne pas vendre un service inutilisable.

**D. Abonnements et crédits : décidés par le serveur, jamais par l'app**
- [ ] **Premium accordé uniquement sur preuve d'Apple** : le serveur vérifie la transaction signée d'Apple (StoreKit 2) avec la bibliothèque officielle d'Apple (chaîne de certificats, identifiant de l'app, environnement), puis l'état de l'abonnement auprès de l'API d'Apple. Un indicateur « Premium » envoyé par l'app n'a aucune valeur.
- [ ] **Achat lié au compte** : chaque achat porte un jeton de compte (appAccountToken) ; une même transaction ne peut pas débloquer un autre compte (Partage familial géré selon les règles d'Apple).
- [ ] **Remboursement, révocation, expiration** : les notifications signées d'Apple (version 2) retirent immédiatement les droits ; un abonnement remboursé ne garde pas ses crédits.
- [ ] **Compteurs atomiques** : chaque demande réserve son crédit avant l'appel à l'IA et le confirme ou le rend après ; cinquante demandes envoyées en même temps ne dépassent pas le quota (compteur unique par compte, Durable Object Cloudflare).
- [ ] **Limites de débit** par appareil, par compte et globales ; le dépassement renvoie un message clair, sans appeler l'IA.

**E. Service IA : la clé introuvable et inutilisable hors des demandes prévues**
- [ ] Toutes les exigences « Clé API impossible à obtenir » ci-dessous (clé seulement dans les secrets chiffrés du Worker, jamais dans l'app, le dépôt, les journaux ni l'hébergement du site).
- [ ] **Espace de travail Anthropic dédié à Apogée**, avec un plafond de dépense mensuel fixé chez Anthropic ; une clé de développement distincte, à plafond très bas ; remplacement de la clé en quelques minutes (procédure écrite et testée).
- [ ] **Demandes typées uniquement** : lecture d'étiquette, accord, fenêtre, valeur, audit, découpage de noms d'import. Pour chacune, le serveur écrit les instructions, choisit le modèle, fixe la taille maximale de la réponse et le format de sortie, et vérifie la taille des entrées (image redimensionnée, nombre de vins, longueur des textes). Aucun texte libre n'est transmis comme consigne.
- [ ] **Injection de consignes** (une étiquette, un fichier importé ou une question qui tente de détourner l'IA) : les contenus de l'utilisateur sont transmis comme données délimitées, jamais comme consignes ; l'IA n'a ni outil, ni accès, ni action possible ; ses réponses sont validées par un schéma, et l'app échappe tout ce qu'elle affiche. Au pire, une injection produit une réponse fausse pour son propre auteur.
- [ ] **Sujet limité** : le sommelier ne traite que le vin, les spiritueux et les accords ; une demande hors sujet est refusée sans être facturée en crédits.
- [ ] **Coupe-circuit** : un réglage serveur suspend l'IA (tous les comptes, ou un compte) en un geste ; alerte automatique si la dépense du jour ou d'un compte sort de l'ordinaire.

**F. Communications**
- [ ] HTTPS uniquement, TLS 1.2 au minimum, aucune exception à la sécurité de transport d'iOS (ATS) ; l'app ne parle qu'au service Apogée et à Apple.
- [ ] Le service refuse les navigateurs (pas d'autorisation d'origine croisée), ne pose aucun cookie, et renvoie des erreurs sans détail interne.
- [ ] Pas d'épinglage de certificat (Cloudflare renouvelle ses certificats, un épinglage casserait l'app) : la protection contre l'interception repose sur TLS, App Attest et les requêtes signées.

**G. Stockage sur l'iPhone**
- [ ] Données de l'app sous la protection de fichiers « complète » d'iOS (illisibles quand l'iPhone est verrouillé) ; jeton de session et identifiants dans le trousseau, liés à cet appareil, non sauvegardés.
- [ ] Rien de sensible dans les journaux de l'app ; voile sur l'aperçu dans le sélecteur d'apps (déjà en place) ; Face ID facultatif ; chiffrement par mot de passe facultatif conservé pour qui le veut.
- [ ] Exports et sauvegardes : chiffrés par défaut, ou export lisible après avertissement.

**H. Code et entrées**
- [ ] Tout le code est dans l'app (aucun script téléchargé), sous une politique de sécurité de contenu stricte ; aucune évaluation de code dynamique.
- [ ] Tout ce qui est affiché est échappé (déjà en place dans MyCellar et couvert par la campagne de tests).
- [ ] Imports (CSV, Excel, PDF, ZIP) : tailles et nombres d'entrées bornés, archives piégées refusées (taux de compression anormal, chemins de fichiers suspects), lecture sans exécution de formules.
- [ ] Exports tableur : une cellule qui commence par « = », « + », « - » ou « @ » est neutralisée (protection contre l'injection de formules).

**I. Chaîne d'approvisionnement**
- [ ] Le moins de dépendances possible, versions figées, empreintes vérifiées ; aucun SDK de publicité ni de mesure d'audience ; chaque bibliothèque intégrée (PDF, QR, Capacitor et ses modules) relue avant intégration et mise à jour.
- [ ] Alertes de vulnérabilités sur le dépôt, recherche automatique de secrets à chaque envoi, branche `store` protégée.
- [ ] Compilation dans le cloud (Codemagic) avec des accès limités : la clé d'App Store Connect n'y sert qu'à publier sur TestFlight ; aucun secret du service IA n'y transite.

**J. Vie privée (CNIL, RGPD, Apple)**
- [ ] Aucune publicité, aucun traceur, aucune mesure d'audience tierce. Le suivi d'utilisation de MyCellar reste local, désactivé par défaut, jamais envoyé sans action de l'utilisateur.
- [ ] Consentement explicite avant le premier envoi à l'IA, case non cochée par défaut, retirable dans les réglages (sans consentement, l'app fonctionne sans IA).
- [ ] Politique de confidentialité claire, étiquettes de confidentialité de l'App Store exactes, registre des traitements, liste des sous-traitants (Apple, Cloudflare, Anthropic) et de leurs garanties.
- [ ] Droits des personnes depuis l'app : voir ce que le serveur détient, le supprimer (suppression du compte).

**K. Protection du propriétaire**
- [ ] **Comptes** Apple, Cloudflare, Anthropic, GitHub, Codemagic et du nom de domaine : double authentification forte (clé de sécurité ou passkey), adresse e-mail dédiée, codes de secours conservés hors ligne, jetons d'accès Cloudflare limités au strict nécessaire.
- [ ] **Finances** : plafond de dépense chez Anthropic, alertes de facturation Cloudflare, quotas, coupe-circuit : une attaque ne peut pas coûter plus que le plafond fixé.
- [ ] **Juridique** : mentions légales, conditions d'utilisation et de vente, avertissement alcool (réservé aux adultes, modération, conformité à la loi Évin dans la présentation), limitation de responsabilité sur les conseils du sommelier ; domiciliation pour l'adresse publique exigée dans l'UE.
- [ ] **Incident** : procédure écrite (couper le service, remplacer la clé, analyser les journaux, informer les utilisateurs, notifier la CNIL sous 72 heures si des données personnelles sont touchées).

**L. Vérification avant toute publication**
- [ ] Grille MASVS v2.1 remplie point par point (niveau de base L1, plus les contrôles de résilience utiles à App Attest).
- [ ] **Tests d'attaque automatiques du service**, rejoués à chaque modification : sans jeton, jeton faux, expiré ou d'un autre appareil ; requête rejouée ; attestation falsifiée ; transaction forgée, réutilisée sur un autre compte ou remboursée ; quota dépassé par requêtes simultanées ; demande hors type ou hors sujet ; entrée géante ; tentatives d'injection de consignes ; recherche de la clé dans l'app compilée et dans les réponses du serveur.
- [ ] **Sans audit externe payant** (décidé le 10 novembre 2026, faute de budget) : à la place, des contrôles gratuits rejoués avant chaque publication : revue de sécurité du code à chaque release ; analyse de l'app compilée avec un outil libre d'audit d'apps mobiles (MobSF) ; recherche de secrets dans le dépôt et dans l'app compilée (outil libre, par exemple gitleaks) ; alertes de vulnérabilités des dépendances (Dependabot, gratuit) ; grille MASVS remplie à la main. Un audit externe pourra être envisagé plus tard, quand les abonnements le financeront.
- [ ] Limite assumée : aucun système n'est inviolable. Le but est qu'aucune voie connue ne mène aux données ni à la clé, que l'impact d'une faille soit borné (plafonds, quotas, données minimales) et qu'elle soit détectée et coupée vite.

*Budget minimal* (décidé le 10 novembre 2026) : hors adhésion Apple, rien de payant au lancement. Cloudflare en offre gratuite (Worker, stockage des compteurs, pages du site sous une adresse `pages.dev`, sans nom de domaine acheté), Codemagic en offre gratuite (500 minutes par mois), vérification des achats directement avec les outils gratuits d'Apple (sans service intermédiaire), aucun audit payant. Seule dépense variable : l'API Claude, facturée à l'usage et plafonnée chez Anthropic (par exemple 10 à 20 $ par mois au départ). Attention : l'abonnement Claude Pro (claude.ai) ne peut pas servir à l'app ; l'API se paie à part, par crédits prépayés sur la console d'Anthropic.

*Préalables à Apogée 1.0* : compte développeur Apple (nécessaire pour App Attest, « Se connecter avec Apple », les achats intégrés de test et TestFlight), compte Cloudflare (déjà disponible), espace de travail Anthropic dédié à Apogée, compte Codemagic. Tant que le compte Apple n'existe pas, le service et ses tests d'attaque peuvent être développés et testés avec des réponses d'Apple simulées.

*Références* : [OWASP MASVS v2.1](https://opensecurityarchitecture.org/frameworks/owasp-masvs-v2), [OWASP Mobile Top 10 2024](https://www.cobalt.io/blog/owasp-mobile-top-10-2024-update), [OWASP Top 10 LLM 2025](https://genai.owasp.org/2024/11/17/owasp-reveals-2025-top-10-risks-for-llms-new-sponsorship-program/), [CNIL, recommandations applications mobiles](https://www.cnil.fr/fr/recommandations-applications-mobiles), [Apple, vérification des transactions](https://developer.apple.com/documentation/storekit/verificationresult), [Apple, risque de fraude App Attest](https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk).

*Exigences de la version store, Apogée* (demandées le 10 novembre 2026). Elles s'ajoutent aux releases ci-dessus et sont développées sur la branche `store`, release par release, sur demande.

**Crédits IA fixés côté serveur** (Apogée 1.0 pour le moteur, Apogée 1.2 pour l'affichage)
- [ ] **Quotas fixés par Apogée**, sans réglage possible par l'utilisateur. Le réglage « plafond mensuel » de MyCellar n'existe pas dans Apogée. Quotas validés le 10 novembre 2026, calculée pour que le pire cas reste couvert par l'abonnement :
  - **Gratuit** : crédits de découverte donnés **une seule fois**, à la première connexion, **par compte Apple** (validé le 10 novembre 2026) : quelques lectures d'étiquette (5) et 3 questions au sommelier. Pas de création de compte dans l'app (identification uniquement par « Se connecter avec Apple ») : pas de multi-comptes en un clic. Coût maximal ≈ 0,08 € par compte.
  - **Premium** : par mois, 60 questions au sommelier (accords, audit, analyses), lectures d'étiquette et estimations sans recherche web en usage raisonnable (jusqu'à 200), 10 estimations avec recherche web (fenêtre, valeur). Coût maximal ≈ 2 € par mois, coût moyen attendu ≈ 0,20 à 0,50 €.
  - **Choix des modèles** : Claude Haiku 5.5 pour les tâches de lecture (étiquettes, découpage des noms, imports), environ vingt fois moins cher ; Claude Sonnet 5.5 pour le sommelier. Recherche web seulement quand elle apporte vraiment (fenêtre ou valeur d'un vin précis), à 1 centime de dollar la recherche.
- [ ] **Le compteur vit sur le serveur, pas dans l'app** : il est tenu par le service IA (Worker Cloudflare), rattaché à l'abonnement vérifié auprès d'Apple. L'app ne fait qu'afficher les crédits restants. Modifier l'app, ses données ou ses requêtes ne donne aucun crédit en plus : le serveur refuse au-delà du quota.
- [ ] **Abonnement vérifié auprès d'Apple** : le serveur contrôle la preuve d'achat signée par Apple (et non une simple déclaration de l'app) ; essai et crédits gratuits rattachés à l'appareil par les outils d'Apple (App Attest, DeviceCheck), pour qu'une réinstallation ne les remette pas à zéro.
- [ ] **Garde-fous globaux** : limite de débit par appareil et par abonné, plafond de dépense mensuel fixé chez Anthropic pour la clé d'Apogée (dernier rempart), alerte en cas de consommation anormale.

**Clé API impossible à obtenir** (Apogée 1.0, priorité absolue)
- [ ] **La clé n'est jamais dans l'app** : ni dans le code, ni dans les données, ni dans les échanges avec l'iPhone. Seul le Worker la connaît, rangée comme secret chiffré chez Cloudflare (illisible une fois enregistrée, y compris depuis le tableau de bord), jamais dans le dépôt GitHub ni dans les journaux.
- [ ] **Le site hébergé ne la contient pas** : l'hébergement des pages (Cloudflare Pages) et le service IA sont séparés ; une intrusion sur l'hébergement des pages ne donne accès à aucun secret.
- [ ] **Le serveur ne sert pas de « Claude gratuit »** : l'app n'envoie pas de texte libre à faire suivre. Elle envoie une demande typée (lire une étiquette, accorder un plat, estimer une fenêtre…), et le serveur construit lui-même les instructions, choisit le modèle et limite la taille des réponses. Une requête détournée ne peut donc pas utiliser la clé pour autre chose.
- [ ] **Seules les vraies apps sont acceptées** : chaque requête prouve qu'elle vient d'une copie authentique d'Apogée sur un vrai iPhone (App Attest d'Apple).
- [ ] **Comptes protégés** : double authentification par clé physique ou application sur les comptes Apple, Cloudflare, Anthropic et GitHub ; une clé de développement distincte de celle de production ; procédure de remplacement de la clé en quelques minutes.
- [ ] **Contrôles avant chaque publication** : revue de sécurité du code et des dépendances, recherche automatique de secrets dans le dépôt, tests d'intrusion du service IA (requêtes forgées, rejeu, dépassement de quota, appareil non authentique).
- [ ] Données sur l'iPhone : protection des fichiers d'iOS, Face ID facultatif, aucune donnée de cave stockée sur le serveur.
- [ ] Limite assumée : aucun système n'est inviolable. L'objectif est qu'aucune voie connue ne donne la clé, et que même une fuite reste limitée et coupée vite (plafond de dépense, alerte, remplacement de la clé).

**Import depuis les grandes apps de cave, surtout sans IA** (Apogée 1.1)
- [ ] **Sources** : Ploc (PDF de cave et CSV de dégustations, déjà pris en charge), CellarTracker (export CSV), Vivino (export de données CSV), InVintory (export CSV), et tout fichier CSV ou Excel (.xlsx) d'une autre app. Liste à compléter selon les exports réels disponibles.
- [ ] **Lecture locale d'abord** : chaque format connu est reconnu par ses colonnes et lu sur l'iPhone, sans IA. Pour un fichier inconnu, un écran de correspondance des colonnes (« cette colonne, c'est le domaine ») est mémorisé pour les imports suivants.
- [ ] **PDF Ploc lu localement** : le texte du PDF (fiches, légende, plan) est extrait sur l'iPhone par une bibliothèque intégrée, puis découpé sans IA ; l'IA ne sert qu'en secours si la mise en page n'est pas reconnue.
- [ ] **IA seulement en complément, et en option** : pour démêler un nom de vin mélangé (domaine, appellation, cuvée) ou compléter des champs vides, après accord et avec le nombre de crédits annoncé ; regroupement des vins identiques pour ne demander qu'une fois par vin.
- [ ] Écran de vérification, sans doublon à la réimportation, comme pour l'import Ploc actuel.
- [ ] **Formats connus (recherche du 10 novembre 2026, sans fichier réel)** : CellarTracker exporte en CSV ou texte depuis son site (pas depuis l'app), avec des colonnes choisies par l'utilisateur, en encodage Latin-1, et les emplacements dans un export à part. Vivino envoie, sur demande, une archive .zip qui contient `cellar.csv`, sans prix, format ni emplacement. InVintory exporte en CSV depuis sa page Collection (offre gratuite comprise). Les noms exacts des colonnes ne sont publiés nulle part : la lecture repose donc sur un **dictionnaire de colonnes** en français et en anglais (Producer / Winery / Domaine / Producteur, Wine / Wine name / Nom, Vintage / Millésime, Quantity / Qty / Stock, Location / Bin / Cave, BeginConsume / Drink from / Apogée, Price / Value / Estimation, Size / Format / Contenance, Color / Type / Couleur…), complété par l'écran de correspondance pour ce qui reste inconnu. L'archive .zip de Vivino est ouverte sur l'iPhone.
- [ ] Des exports réels (testeurs de la bêta) serviront à affiner le dictionnaire avant la publication ; les tests utilisent des fichiers fictifs construits d'après ces informations.

**Langue réglable** (Apogée 1.1)
- [ ] Réglages › Langue : français ou anglais (d'autres langues plus tard). Par défaut, la langue de l'iPhone.
- [ ] Toute l'app suit ce réglage : textes, dates, nombres et prix, messages d'erreur, présentation, et les réponses du sommelier.
- [ ] En français, tutoiement ou vouvoiement au choix (décidé le 10 novembre 2026).

**Idées pour plus tard (Apogée, non rattachées à une release)**
- **Soutien client et boucle d'amélioration** (mémo du 10 novembre 2026) : depuis l'app, envoyer une demande d'évolution ou un rapport de bug (en s'appuyant sur « Signaler un problème » et le rapport d'utilisation de MyCellar), reçus dans un endroit centralisé, sans donnée de cave sauf accord explicite ; tri et analyse par IA (regroupement des demandes semblables, gravité, reproduction probable, piste de correctif) ; programmation des correctifs dans les releases, avec réponse à l'utilisateur quand c'est corrigé. À spécifier le moment venu (outil de réception, coût, confidentialité, place du propriétaire dans la validation).
