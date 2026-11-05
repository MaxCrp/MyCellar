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

**v1.7.1** (recherche dans la cave, conversation avec le sommelier ; spécifiée, rien n'est développé)

*Constat.* Aujourd'hui, la recherche de l'onglet Cave encadre les bouteilles trouvées sur le plan du site affiché et grise les autres. Il faut faire défiler les meubles pour les repérer, puis changer de site et chercher à nouveau.

- [ ] **Recherche sur tous les sites** : en mode Plan, la recherche porte sur toutes les caves de tous les sites, quel que soit le site affiché. Le mode Liste reste tel quel : il cherche déjà partout.
- [ ] **Résultats sous la barre** : dès la saisie, une liste apparaît sous la barre de recherche, avec une ligne par vin trouvé (pastille de couleur, nom, millésime, nombre de bouteilles), puis un emplacement par ligne : « Site › Espace › Meuble · Clayette 2, place 3 », « … › Caisse A » ou « … › non placée ». Les bouteilles en primeur apparaissent en « primeur, pas encore livrée », sans lien vers le plan.
- [ ] **Aller à la bouteille** (validé le 5 novembre 2026 : le site actuel change, comme avec le sélecteur) : toucher un emplacement ferme la liste et affiche le bon site, comme le sélecteur de site en haut de l'écran. L'app ouvre ensuite le bon espace, fait défiler jusqu'au meuble et fait clignoter la case quelques secondes. Pour une caisse, la caisse s'ouvre. Pour une bouteille non placée, l'app défile jusqu'au bloc « non placées ».
- [ ] **Un seul emplacement trouvé** : la touche « Rechercher » du clavier y emmène directement.
- [ ] **Vider la recherche** (redemandé le 5 novembre 2026) : une croix apparaît dans la barre dès qu'un texte est saisi. La toucher efface le texte d'un coup, ferme les résultats, rend le plan normal et replie le clavier ; plus besoin de toucher la barre puis d'effacer lettre par lettre. Même croix sur toutes les barres de recherche de l'app : Cave, Dégustations, « Racheter un vin » et choix d'un vin dans une dégustation ou une liste d'envies.
- [ ] **Depuis une fiche** : sur la fiche d'une bouteille, et sur chaque emplacement de la fiche vin, un bouton « Voir sur le plan » emmène à la case de la même façon.
- [ ] Tests : recherche d'un vin présent sur deux sites, saut vers la case du site non affiché, case visible à l'écran et mise en évidence, caisse ouverte, bouteille non placée, « Voir sur le plan » depuis une fiche.

*Sommelier : bouton « Nouvelle conversation »* (demande du 5 novembre 2026). Quand la conversation dépasse un écran, le lien « Nouvelle conversation », placé tout en bas, se retrouve caché sous l'encart flottant « Demander au sommelier ».
- [ ] **Icône dans l'encart flottant** : un bouton rond « nouvelle conversation » (icône bulle avec un +), à gauche du champ de saisie, toujours visible. Il n'apparaît que lorsqu'une conversation est en cours, et il est inactif pendant que le sommelier répond. L'ancien lien en bas de la conversation est retiré.
- [ ] **Confirmation** : « Commencer une nouvelle conversation ? La conversation actuelle sera effacée. » Sans réponse de l'utilisateur, rien n'est effacé.
- [ ] **Dernier message visible** : la conversation garde en bas un espace égal à la hauteur de l'encart, pour que la dernière réponse ne soit jamais cachée dessous, même quand l'encart s'agrandit (plusieurs lignes, choix d'occasion).
- [ ] Tests : conversation plus longue que l'écran, icône visible et utilisable, confirmation, dernier message entièrement visible au-dessus de l'encart.

**v2**
- Sauvegarde automatique Google Drive.
- Audit de cave.
- Statistiques et valeur estimée.
- Carte des vins à partager.
- QR codes sur les casiers (scan dans l'app).
- Export PDF et Excel.
- Suivi des cadeaux.
