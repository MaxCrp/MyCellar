#!/usr/bin/env bash
# Construit l'app, la sert en local et lance les tests de bout en bout.
# Les captures d'écran sont écrites dans tests/shots/.
set -e
cd "$(dirname "$0")/.."
node build.mjs
node tests/serve.cjs 8765 & SRV=$!   # imite Cloudflare (redirection de /index.html)
trap 'kill $SRV' EXIT
sleep 1
for t in t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 t11 campagne; do echo "== $t"; node tests/$t.cjs; done
