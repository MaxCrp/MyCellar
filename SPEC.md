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
3. **Import du PDF Ploc**. Le PDF contient le nom, le domaine, le millésime et l'emplacement.
   - L'IA lit le PDF, puis complète en lot l'appellation, la couleur, la région, les cépages et une apogée estimée, sans recherche web pour limiter le coût.
   - Un écran de correspondance permet de valider avant l'import, y compris les emplacements.
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

**v1.6** (release intermédiaire avant la v2 ; en cours de définition, rien n'est développé)
- [ ] **Suivi d'utilisation**, sur le modèle de Patrimoine, pour améliorer l'expérience à partir des retours des bêta-testeurs (validé) :
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

**v2**
- Sauvegarde automatique Google Drive.
- Audit de cave.
- Statistiques et valeur estimée.
- Carte des vins à partager.
- QR codes sur les casiers (scan dans l'app).
- Export PDF et Excel.
- Suivi des cadeaux.
