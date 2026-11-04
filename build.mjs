// Assemble l'application dans public/ :
//   src/index.html (gabarit) + src/css/*.css + src/js/*.js  →  public/index.html (un seul fichier)
//   src/static/*  →  public/ (sw.js, manifeste, icônes, en-têtes)
// Le script est intégré en ligne : la politique de sécurité (CSP) n'autorise que lui,
// identifié par son empreinte SHA-256, recalculée ici à chaque build.
// Usage : node build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script } from 'node:vm';

const SRC = 'src', OUT = 'public';
const list = dir => readdirSync(join(SRC, dir)).filter(f => !f.startsWith('.')).sort();
const css = list('css').map(f => readFileSync(join(SRC, 'css', f), 'utf8')).join('\n');
const js = "\n'use strict';\n" + list('js').map(f => `\n/* ===== ${f} ===== */\n` + readFileSync(join(SRC, 'js', f), 'utf8')).join('\n') + '\n';
if (js.includes('</script')) throw new Error('Le code JS ne doit pas contenir « </script ».');
new Script(js, { filename: 'app.js' });   // erreur de syntaxe → le build échoue
const hash = createHash('sha256').update(js, 'utf8').digest('base64');

let html = readFileSync(join(SRC, 'index.html'), 'utf8');
for (const k of ['/*CSS*/', '/*JS*/', '__SCRIPT_HASH__']) if (!html.includes(k)) throw new Error('Marqueur absent du gabarit : ' + k);
html = html.replace('/*CSS*/', () => css).replace('/*JS*/', () => js).replace('__SCRIPT_HASH__', () => 'sha256-' + hash);

// On vide le dossier sans le supprimer (un serveur local peut le servir pendant le développement)
if (!existsSync(OUT)) mkdirSync(OUT);
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
for (const f of list('static')) copyFileSync(join(SRC, 'static', f), join(OUT, f));
console.log(`public/index.html : ${(html.length / 1024).toFixed(0)} Ko, script sha256-${hash.slice(0, 12)}…`);
