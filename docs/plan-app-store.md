# Plan : MyCellar sur l'App Store

*Rédigé le 8 novembre 2026, sur ta demande : publier l'app sur l'App Store pour le plus grand nombre, avec un modèle économique qui couvre les frais et te rapporte un complément, et la rendre « grand public ». Ce document est un plan : rien n'est développé sans ton accord, release par release, comme d'habitude.*

## En bref

1. **On ne publie pas la PWA telle quelle.** Apple refuse les apps qui ne sont qu'un site web dans une coque (règle 4.2). L'app sera emballée en app iOS native (Capacitor), en gardant l'essentiel du code actuel, avec de vraies fonctions natives : notifications, iCloud, appareil photo, partage, Face ID.
2. **Le plus gros changement est l'IA.** Aujourd'hui, chaque utilisateur doit fournir sa propre clé Anthropic : c'est impossible pour le grand public. Il faut un petit service en ligne (un Worker Cloudflare) qui appelle le sommelier avec *ta* clé, avec des quotas par abonné. C'est aussi lui qui rend l'IA payante, donc finançable.
3. **Modèle recommandé : gratuit + abonnement « Premium ».** La cave est gratuite et complète ; le sommelier IA, la lecture d'étiquettes illimitée et la synchronisation iCloud sont dans Premium, à **3,99 € par mois ou 29,99 € par an**, avec 7 jours d'essai. Pas de publicité (vin et loi Évin, et c'est désagréable).
4. **Coûts fixes faibles** (environ 150 à 300 € par an) ; le coût variable est l'IA, environ 5 € par abonné et par an en usage moyen, couvert par l'abonnement. Ordre de grandeur du bénéfice la première année : de quelques centaines d'euros (lancement discret) à quelques milliers (bon bouche-à-oreille).
5. **Durée : environ 4 à 5 mois** jusqu'à la sortie, en 5 phases. Avant de commencer, 6 décisions te reviennent (fin du document), dont le nom : « My Cellar » est déjà pris sur l'App Store.

---

## 1. Ce qui sépare l'app actuelle d'une app grand public

| Aujourd'hui (conçu pour toi) | Pour le grand public |
|---|---|
| PWA installée depuis Safari, mise à jour approuvée à la main (empreinte du code) | App de l'App Store, mises à jour par Apple ; le mécanisme d'empreinte disparaît dans l'app native |
| Clé API personnelle à saisir, plafond de 2 € par mois | IA incluse dans Premium, sans clé, via ton service ; quotas d'usage raisonnable |
| Mot de passe obligatoire pour chiffrer la cave ; un oubli fait tout perdre | Ouverture simple, Face ID en option ; données protégées par iOS ; mot de passe facultatif pour ceux qui le veulent |
| Sauvegarde manuelle (fichier), Google Drive prévu (v2.3) | Sauvegarde et synchronisation iCloud automatiques (iPhone + iPad), sans compte à créer |
| Français uniquement, tutoiement | Français et anglais au lancement ; tutoiement à garder ou non (à décider) |
| Pensé pour 2 sites, primeurs, vins des amis, Ploc | Garder ces fonctions (elles sont des atouts), mais les masquer au départ : premier lancement en 3 écrans, options avancées dans les réglages |
| Présentation et aide pour un utilisateur averti | Parcours de premier lancement guidé, cave d'exemple, aide en ligne, page de support |

Ce que l'app a déjà d'excellent pour le grand public, et qui la distingue : plan visuel des meubles, sommelier qui choisit *dans ta cave*, fenêtres de dégustation et onglet À boire, dégustations à l'aveugle, import Ploc (argument fort pour les déçus de Ploc), données sur l'appareil.

## 2. Modèle économique

### Recommandation : gratuit + Premium par abonnement

| | Gratuit | Premium |
|---|---|---|
| Cave, plan, meubles, caisses, sites | Complet, sans limite | Complet |
| Ajout de vins | Saisie manuelle ; 5 lectures d'étiquette offertes | Lecture d'étiquette illimitée (usage raisonnable) |
| À boire, fenêtres de dégustation | Saisie manuelle des fenêtres | Fenêtres estimées et réévaluées par le sommelier |
| Sommelier (accords, audit, valeur) | 3 questions offertes pour découvrir | Inclus (usage raisonnable, environ 100 demandes par mois) |
| Dégustations, séances, aveugle | Complet | Complet + analyse du sommelier |
| iCloud (synchronisation iPhone, iPad, sauvegarde) | Sauvegarde sur l'appareil | Synchronisation et historique |
| Exports, carte des vins, import Ploc | Import Ploc gratuit (pour attirer), exports Premium | Tout |

**Prix proposés** : 3,99 € par mois ou 29,99 € par an (soit 2,50 € par mois), avec 7 jours d'essai gratuit. Partage familial activé (un seul abonnement pour le foyer).

**Repères du marché** (fiches App Store françaises, à revérifier) : *Ma cave à vins* 4,99 € par mois ou 39,99 € par an ; *Oeni* 8,99 € par mois, formules annuelles de 29,99 € à 79,99 € ; *Caveo* de 14,99 € à 149,99 €. Ploc est gratuit. 29,99 € par an place MyCellar dans le bas de la fourchette, avec plus d'IA que les concurrents.

**Pourquoi pas les autres modèles**
- *App payante à l'achat* : frein fort au téléchargement, et l'IA coûte chaque mois, pas une fois.
- *Achat « à vie »* : séduisant, mais l'IA deviendrait une dépense sans recette. Possible plus tard pour une version sans IA.
- *Publicité* : pour une app sur le vin, la loi Évin encadre strictement la publicité pour l'alcool en France, et la publicité dégrade l'expérience pour quelques centimes.
- *Commissions de cavistes* (liens d'achat) : piste intéressante plus tard (le sommelier suggère déjà des achats), mais pas au lancement.

### Ce que rapporte un abonné annuel

| | Par an |
|---|---|
| Prix payé | 29,99 € |
| TVA (collectée et reversée par Apple) | − 5,00 € |
| Commission Apple (15 % dans le programme pour petits développeurs, sous 1 M$ par an) | − 3,75 € |
| **Versé par Apple** | **≈ 21,25 €** |
| IA (usage moyen estimé, environ 0,40 € par mois) | − 5 € |
| **Marge avant cotisations et impôts** | **≈ 16 €** |

Les quotas d'usage raisonnable protègent contre les gros consommateurs ; les tâches simples (lecture d'étiquette, découpage des noms) peuvent passer sur un modèle moins cher (Haiku) pour réduire le coût.

## 3. Coûts

| Poste | Montant | Remarque |
|---|---|---|
| Programme développeur Apple | 99 € par an | Obligatoire pour publier |
| Nom de domaine et site (page de présentation, confidentialité, support) | ≈ 15 € par an | Hébergement gratuit sur Cloudflare Pages |
| Service en ligne (Worker Cloudflare) | 0 à ≈ 60 € par an | Gratuit au début, offre payante à 5 $ par mois si le trafic grandit |
| Gestion des abonnements (RevenueCat ou équivalent) | 0 € au début | Gratuit jusqu'à un certain chiffre d'affaires ; sinon, gestion directe avec les outils d'Apple |
| Mac pour compiler l'app | 0 € si tu en as un ; sinon service de compilation en ligne (offres gratuites limitées) ou Mac mini d'occasion | Xcode ne tourne que sur macOS |
| Micro-entreprise (statut pour encaisser) | Création gratuite ; cotisations sociales proportionnelles au chiffre d'affaires (de l'ordre d'un quart des recettes en BNC, à vérifier) ; CFE à partir de la 2ᵉ année | Faire valider par un expert-comptable |
| Domiciliation (adresse publique, voir §7) | 0 à ≈ 25 € par mois | Facultatif, si tu ne veux pas afficher ton adresse personnelle |
| IA | ≈ 5 € par abonné et par an | Variable, couvert par l'abonnement |

**Point mort** : avec environ 250 € de frais fixes par an, une quinzaine d'abonnés annuels suffisent à couvrir les frais.

## 4. Scénarios pour la première année (ordres de grandeur)

| | Prudent | Moyen | Bon |
|---|---|---|---|
| Téléchargements | 2 000 | 10 000 | 30 000 |
| Taux de conversion vers Premium | 3 % | 4 % | 5 % |
| Abonnés | 60 | 400 | 1 500 |
| Versé par Apple | ≈ 1 300 € | ≈ 8 500 € | ≈ 32 000 € |
| − IA | ≈ 300 € | ≈ 2 000 € | ≈ 7 500 € |
| − Frais fixes | ≈ 250 € | ≈ 300 € | ≈ 500 € |
| − Cotisations (≈ 22 %, à vérifier) | ≈ 300 € | ≈ 1 900 € | ≈ 7 000 € |
| **Reste avant impôt sur le revenu** | **≈ 450 €** | **≈ 4 300 €** | **≈ 17 000 €** |

Ces chiffres sont des hypothèses, pas des prévisions : le nombre de téléchargements dépend surtout de la visibilité (communautés d'amateurs, bouche-à-oreille, cavistes). Les apps de cave sont un marché de niche mais fidèle.

## 5. Les changements produit (version grand public)

Par ordre de priorité :

1. **IA sans clé** : appels au sommelier via ton service, quotas, messages clairs quand le quota est atteint ; consentement explicite avant le premier envoi de données à l'IA (exigé par Apple depuis novembre 2025, règle 5.1.2(i)).
2. **Ouverture simple** : plus de mot de passe obligatoire ; Face ID facultatif ; chiffrement par mot de passe en option avancée. Les caves existantes (toi, tes amis) sont migrées sans perte.
3. **iCloud** : synchronisation et sauvegarde automatiques (base privée iCloud de chaque utilisateur : chacun ses données, sans serveur à toi). Remplace la v2.3 Google Drive pour la version App Store.
4. **Premier lancement guidé** en 3 écrans (« Où ranges-tu ton vin ? », « Ajoute ta première bouteille par photo », « Ce que fait le sommelier »), cave d'exemple à découvrir, options avancées (plusieurs sites, spiritueux, vins des amis, primeurs) proposées plus tard.
5. **Anglais** en plus du français (textes, formats de date et de prix) ; ouvre les marchés européens et nord-américains.
6. **Notifications** : vins à boire en priorité ce mois-ci, primeurs à recevoir, rappel de dégustation à noter. Utile, et c'est une vraie fonction native.
7. **Écran Premium** clair (ce qui est inclus, essai, restauration des achats), gestion de l'abonnement, conditions d'utilisation.
8. **Accessibilité et iPad** : tailles de texte dynamiques, contrastes, mode sombre, mise en page iPad.
9. **Support** : page d'aide, adresse de contact, « Signaler un problème » existant relié à ton e-mail.

Les fonctions actuelles restent ; certaines passent en Premium (voir §2).

## 6. Le chemin technique

- **App native par Capacitor** : le code actuel (HTML, CSS, JavaScript) tourne dans une app iOS, avec des modules natifs pour l'appareil photo, le partage, les notifications, iCloud, Face ID et les achats intégrés. C'est le chemin le plus court sans tout réécrire. Le service worker, l'empreinte du code et la bannière de mise à jour deviennent inutiles dans l'app native ; la version web peut rester pour toi et tes amis pendant la transition.
- **Service en ligne (Worker Cloudflare)** : il reçoit les demandes de l'app, vérifie l'abonnement (avec les outils d'Apple ou RevenueCat), applique les quotas et appelle Claude avec ta clé, gardée secrète côté serveur. Il ne stocke pas les caves. Identification par « Se connecter avec Apple », ou par un identifiant anonyme lié à l'abonnement (plus simple, à décider).
- **Abonnements** : achats intégrés d'Apple (obligatoires sur l'App Store pour des fonctions numériques ; dans l'UE, d'autres moyens de paiement sont possibles mais ajoutent de la complexité : à éviter au lancement).
- **Compilation** : Xcode sur un Mac (le tien, ou un service en ligne), signature, envoi sur TestFlight pour la bêta.

## 7. Obligations à prévoir

- **Compte développeur Apple** (99 € par an) en tant que personne physique, ou au nom d'une entreprise.
- **Statut pour encaisser** : une micro-entreprise suffit au démarrage (déclaration des recettes, cotisations, impôt). Faire valider par un expert-comptable.
- **Statut de « commerçant » dans l'UE** (Digital Services Act) : une app payante oblige à afficher publiquement sur l'App Store une adresse, un téléphone et un e-mail. Une domiciliation ou une boîte postale évite d'afficher ton domicile.
- **Données personnelles (RGPD)** : politique de confidentialité, étiquettes de confidentialité de l'App Store, consentement avant l'envoi de données au sommelier, suppression du compte depuis l'app si un compte existe.
- **Âge** : app réservée aux adultes (thème de l'alcool) ; classement d'âge élevé sur l'App Store.
- **Communication** : en France, la loi Évin encadre la promotion de l'alcool ; la présentation de l'app doit rester informative (gestion de cave, dégustation), sans incitation à boire.
- **Nom et marque** : « My Cellar: AI Wine Scanner » existe déjà sur l'App Store, avec un sommelier IA et iCloud. Il faut un autre nom (ou un nom composé distinctif), vérifié sur l'App Store et auprès de l'INPI ou de l'EUIPO avant d'acheter le domaine.
- **Conditions d'abonnement** : prix, durée, renouvellement automatique et résiliation affichés avant l'achat (exigé par Apple).

## 8. Feuille de route

Chaque phase devient une ou plusieurs releases dans `SPEC.md` (v3.x), spécifiées puis lancées sur ton accord.

| Phase | Contenu | Durée indicative |
|---|---|---|
| **0. Décisions et démarches** | Tes 6 décisions ci-dessous ; nom et marque ; micro-entreprise ; compte développeur Apple ; domaine | 2 à 3 semaines (en parallèle) |
| **1. Produit grand public (v3.0)** | Ouverture simple et migration, premier lancement guidé, options avancées repliées, anglais, accessibilité | 5 à 6 semaines |
| **2. Service IA et abonnement (v3.1)** | Worker Cloudflare, quotas, consentement IA, écran Premium, abonnements Apple, essai gratuit | 3 à 4 semaines |
| **3. App native et bêta (v3.2)** | Capacitor, iCloud, notifications, Face ID, appareil photo, partage ; TestFlight avec 20 à 50 testeurs (tes amis, un club d'œnologie), rapport d'usage existant | 3 semaines + 4 semaines de bêta |
| **4. Publication** | Fiche App Store (captures, textes FR/EN, mots-clés), confidentialité, classement d'âge, site, soumission, corrections demandées par Apple | 1 à 2 semaines |
| **5. Lancement et croissance** | Annonce sur les forums et groupes d'amateurs (La Passion du Vin, clubs, réseaux), argument « quitte Ploc sans rien perdre », cavistes partenaires ; suivi des abonnements et coûts IA ; Android plus tard si la demande existe | En continu |

**Total : environ 4 à 5 mois** jusqu'à la sortie, selon ta disponibilité pour les tests et les démarches.

## 9. Risques

| Risque | Parade |
|---|---|
| Refus d'Apple « simple site web » (4.2) | Fonctions natives réelles (iCloud, notifications, appareil photo, Face ID), fonctionnement hors ligne complet |
| Refus pour le consentement IA (5.1.2) | Écran de consentement avant tout envoi, testé en bêta, mentionné dans les notes pour Apple |
| Coût IA qui dérape | Quotas par abonné, modèles moins chers pour les tâches simples, tableau de bord des coûts, plafond global |
| Clé Anthropic exposée | Clé uniquement dans le Worker (jamais dans l'app), limites de débit, alertes |
| Perte de données lors de la migration | Migration testée, sauvegarde automatique avant, chemin de retour |
| Peu de téléchargements | Lancement ciblé sur les communautés d'amateurs et les déçus de Ploc ; prix d'appel la première année |
| Nom déjà pris ou contesté | Recherche de marque avant tout investissement |
| Temps d'assistance aux utilisateurs | FAQ, rapports de problème intégrés, réponse par e-mail ; limiter le support aux abonnés si besoin |

## 10. Les décisions qui te reviennent

1. **Modèle** : gratuit + Premium par abonnement (recommandé), ou autre ?
2. **Prix** : 3,99 € par mois / 29,99 € par an avec 7 jours d'essai ?
3. **Nom** de l'app (MyCellar est pris sous la forme « My Cellar ») : as-tu des idées ? Je peux en proposer et vérifier leur disponibilité.
4. **Statut** : publier à ton nom (micro-entreprise) ou via une société existante ?
5. **Mac** : en as-tu un pour compiler l'app ?
6. **Langues et ton** : français + anglais au lancement ? Garder le tutoiement en français ?

---

*Sources consultées les 8 et 10 novembre 2026 (à revérifier sur les pages d'Apple avant toute démarche) : programme pour petits développeurs et frais ([Adapty](https://adapty.io/blog/markdown/app-store-small-business-program.md), [Magora](https://magora-systems.com/app-store-small-business-program/)) ; règle 4.2 et apps web emballées ([MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Capgo](https://capgo.app/blog/how-to-pass-app-store-review-2026/)) ; consentement IA, règle 5.1.2(i) ([TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)) ; statut de commerçant dans l'UE ([MacRumors](https://www.macrumors.com/2024/10/17/developers-eu-app-store-trader-requirements/)) ; nouvelles conditions de l'UE ([Apple Newsroom](https://www.apple.com/ca/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/)) ; prix des concurrents ([Ma cave à vins](https://apps.apple.com/fr/app/ma-cave-a-vins/id1547090471), [Oeni](https://apps.apple.com/FR/app/id6445827140), [Caveo](https://apps.apple.com/fr/app/caveo/id6449490048), [Ploc](https://apps.apple.com/fr/app/ploc-lapp-des-%C3%A9picuvins/id1156928592)) ; nom existant ([My Cellar: AI Wine Scanner](https://apps.apple.com/app/id6764875381)).*

---

## 11. Décisions prises (10 novembre 2026)

| # | Décision |
|---|---|
| 1 | Modèle gratuit + Premium par abonnement : **validé** |
| 2 | 3,99 € par mois ou 29,99 € par an, 7 jours d'essai : **validé** |
| 3 | **Deux versions** : `master` reste « MyCellar », ta version personnelle, qui continue d'évoluer avec plus de fonctions ; la version App Store prend un **nouveau nom** et vit sur une branche dédiée (`store`). Nom à choisir (propositions ci-dessous). |
| 4 | Statut : **compte Apple « individuel » à ton nom + micro-entreprise** (recommandé, voir ci-dessous), à confirmer après vérification de ton contrat de travail |
| 5 | **Pas de Mac** : compilation dans le cloud (Codemagic, 500 minutes macOS gratuites par mois), tests sur ton iPhone par TestFlight |
| 6 | Français et anglais au lancement ; **tutoiement ou vouvoiement réglable** dans les réglages |

### Deux versions, une seule base de code

- `master` = MyCellar, ta version : elle garde ta clé IA personnelle, la sauvegarde que tu choisis, et reçoit les nouvelles fonctions en premier.
- `store` = la version App Store, créée depuis `master`. Elle n'ajoute que ce qui est propre au grand public : nom et icône, service IA à la place de ta clé, abonnement, iCloud, emballage natif.
- Pour éviter que les deux versions s'éloignent : `master` est fusionnée régulièrement dans `store`, et tout ce qui diffère est regroupé dans quelques fichiers bien délimités (nom, IA, abonnement, natif) plutôt que dispersé dans le code. Une fonction utile aux deux se développe sur `master`.
- Les releases v3.x se livrent sur `store`. `master` continue avec ses propres releases (v2.x et suivantes), qui restent publiées sur ton adresse Cloudflare actuelle.

### Propositions de nom pour la version App Store

| Nom | Idée | Remarque |
|---|---|---|
| **Apogée** (« Apogée – cave à vin ») | Le cœur de l'app : boire chaque bouteille à son apogée | Fort et clair en français, compréhensible en anglais (« Apogee ») ; mot courant, donc marque à vérifier de près |
| **Décante** (« Décante – cave & sommelier ») | Le geste du sommelier | Court, élégant ; en anglais « Decant » |
| **Cellier** | Le lieu où l'on garde le vin | Sonne français à l'étranger ; très descriptif, donc moins protégeable |
| **Cuvéa** | Mot inventé, de « cuvée » | Facile à protéger comme marque ; à vérifier |
| **Millésia** | Mot inventé, de « millésime » | Idem |
| **Garde & Apogée** | Les deux moments de la vie d'un vin | Plus long ; bien comme sous-titre |

Une recherche rapide n'a trouvé aucune app nommée « Apogée », « Décante » ou « Cellier » sur l'App Store, ce qui ne suffit pas : il faut vérifier les marques déposées (INPI, EUIPO) et la disponibilité du nom de domaine avant de choisir. Sur l'App Store, le nom est suivi d'un sous-titre (30 caractères) : par exemple « Apogée » + « Cave à vin et sommelier IA ».

### Statut : le plus simple quand on est salarié

- **Cumuler salariat et micro-entreprise est possible.** Même si ton contrat contient une clause d'exclusivité, ton employeur ne peut pas te l'opposer pendant **un an** après la création (article L1222-5 du Code du travail) ; au-delà, elle s'applique si elle est valable. Dans tous les cas, l'**obligation de loyauté** demeure : pas de concurrence avec ton employeur, pas d'usage de son temps, de son matériel ni de ses informations.
- **À vérifier dans ton contrat et les règles internes** : clause d'exclusivité, clause de propriété intellectuelle (un code écrit sur ton temps libre et ton matériel t'appartient en principe, sauf clause contraire ou si ton employeur édite des logiciels), et procédure de déclaration d'activité annexe ou de conflit d'intérêts, fréquente dans les grandes entreprises. Le plus sûr est de déclarer l'activité selon cette procédure.
- **Le plus simple** : un compte développeur Apple **individuel** (pas de numéro D-U-N-S ; le vendeur affiché est ton nom légal) et une **micro-entreprise** en activité libérale (déclaration en ligne gratuite sur le guichet unique, déclarations de recettes à l'Urssaf, cotisations seulement sur ce que tu encaisses).
- **Calendrier** : rien n'est nécessaire pour développer ni pour la bêta TestFlight. La micro-entreprise se crée juste avant d'activer les abonnements payants.
- **Point à éclaircir le moment venu** : les recettes viennent d'Apple, société irlandaise ; même en franchise de TVA, une formalité de TVA intracommunautaire peut être demandée (numéro de TVA, déclaration européenne de services). Le guichet unique, l'Urssaf ou une consultation ponctuelle chez un expert-comptable règlent ce point.

### Sans Mac

- Le projet iOS est généré et compilé dans le cloud : **Codemagic** offre 500 minutes par mois sur des Mac M2, gratuitement pour un compte personnel ; une compilation prend environ 10 à 15 minutes, donc une trentaine de compilations par mois sans frais.
- Codemagic signe l'app avec ton compte développeur Apple et l'envoie directement sur **TestFlight** : tu l'installes sur ton iPhone pour la tester.
- Les captures d'écran de la fiche App Store se font sur ton iPhone.
- Seule limite : pas de simulateur iPhone sous la main, donc chaque essai passe par une compilation. Les tests automatiques actuels (Chromium) continuent de couvrir l'essentiel avant chaque compilation.

*Sources complémentaires (10 novembre 2026) : cumul salariat et micro-entreprise ([Service-Public](https://entreprendre.service-public.gouv.fr/vosdroits/F23264), [Bpifrance Création](https://bpifrance-creation.fr/encyclopedie/statut-du-dirigeant-son-conjoint/situation-pluriactifs/cumul-dune-activite), [clause d'exclusivité et article L1222-5](https://consultation.avocat.fr/barreau-vienne/blog/jean-luc-braunschweig-klein/article-2983836-clause-d-exclusivite-et-creation-d-entreprise-est-ce-possible.html)) ; compte Apple individuel et D-U-N-S ([Apple](https://developer.apple.com/support/d-u-n-s/)) ; Codemagic ([tarifs](https://docs.codemagic.io/billing/pricing/)).*
