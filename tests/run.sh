#!/usr/bin/env bash
# Construit l'app, la sert en local et lance les tests de bout en bout.
# Les captures d'écran sont écrites dans tests/shots/.
set -e
cd "$(dirname "$0")/.."
node build.mjs
node tests/serve.cjs 8765 & SRV=$!   # imite Cloudflare (redirection de /index.html)
trap 'kill $SRV' EXIT
sleep 1
T="t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t21 t23"
# Téléphone simulé : iPhone, puis toute la suite rejouée sur Android (v2.1.4)
for t in $T t22 campagne; do echo "== $t"; node tests/$t.cjs; done
# t20 vérifie la case photo unique d'iOS : sur Android, deux choix (vérifiés par t22)
for t in ${T/ t20/} campagne; do echo "== $t (Android)"; MC_DEVICE=android node tests/$t.cjs; done
