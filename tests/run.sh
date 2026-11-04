#!/usr/bin/env bash
# Construit l'app, la sert en local et lance les tests de bout en bout.
# Les captures d'écran sont écrites dans tests/shots/.
set -e
cd "$(dirname "$0")/.."
node build.mjs
python3 -m http.server 8765 -d public >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
for t in t1 t2 t3 t4; do echo "== $t"; node tests/$t.cjs; done
