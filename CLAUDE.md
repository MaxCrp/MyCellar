# Consignes pour travailler sur MyCellar

- Toute la communication avec l'utilisateur se fait en français.
- **Releases** : chaque mise à jour demandée est rattachée à une release de développement nommée (v1.6, v1.6.1…), inscrite dans `SPEC.md` § 10 avec une case à cocher.
- **Pas de développement sans demande explicite** : une demande est d'abord spécifiée et rangée dans sa release. Le code ne change que lorsque l'utilisateur demande explicitement de lancer cette release (« lance la v1.6 »). Seules les corrections de bugs bloquants signalés par l'utilisateur peuvent être traitées directement, et elles sont tout de même notées dans la release en cours.
- Avant de livrer : ajouter la version en tête de `src/changelog.json` (numéro, date, titre, nouveautés rédigées pour l'utilisateur) ; `tests/run.sh` doit passer ; cocher les cases de la release dans `SPEC.md` ; commit et push sur `master`.
- Ne jamais modifier `public/` à la main : modifier `src/`, puis `node build.mjs`. Ne pas modifier `src/static/sw.js` sans raison impérative (voir README).
