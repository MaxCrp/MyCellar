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

const SRC = 'src', OUT = process.env.MC_OUT || 'public';   // MC_OUT : construction de test ailleurs
const list = dir => readdirSync(join(SRC, dir)).filter(f => !f.startsWith('.')).sort();
const css = list('css').map(f => readFileSync(join(SRC, 'css', f), 'utf8')).join('\n');
// Journal des versions : intégré au code (nouveautés, historique) et publié à part (consulté avant une mise à jour)
const changelog = JSON.parse(readFileSync(join(SRC, 'changelog.json'), 'utf8'));
if (!Array.isArray(changelog) || !changelog.every(e => /^\d+(\.\d+)*$/.test(e.version) && Array.isArray(e.items))) throw new Error('changelog.json invalide');
// Sauvegarde automatique (v2.2) : identifiant OAuth et adresse du service d'autorisation, non secrets (voir docs/sauvegarde-google-drive.md)
const cfgPath = process.env.MC_BACKUP_CONFIG || join(SRC, 'backup-config.json');
const gcfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const gdrive = { clientId: String(gcfg.clientId || ''), workerUrl: String(gcfg.workerUrl || '').replace(/\/$/, '') };
if (gdrive.clientId && !/^[\w-]+\.apps\.googleusercontent\.com$/.test(gdrive.clientId)) throw new Error('backup-config.json : clientId invalide');
if (gdrive.workerUrl && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(gdrive.workerUrl)) throw new Error('backup-config.json : workerUrl doit être une adresse https sans chemin');
const gdOn = !!(gdrive.clientId && gdrive.workerUrl);
const connectExtra = gdOn ? ` https://www.googleapis.com https://oauth2.googleapis.com ${gdrive.workerUrl}` : '';
const js = "\n'use strict';\nconst CHANGELOG = " + JSON.stringify(changelog) + ";\nconst APP_VERSION = CHANGELOG[0].version;\nconst GDRIVE_CFG = Object.freeze(" + JSON.stringify(gdOn ? gdrive : { clientId: '', workerUrl: '' }) + ");\n" + list('js').map(f => `\n/* ===== ${f} ===== */\n` + readFileSync(join(SRC, 'js', f), 'utf8')).join('\n') + '\n';
if (js.includes('</script')) throw new Error('Le code JS ne doit pas contenir « </script ».');
new Script(js, { filename: 'app.js' });   // erreur de syntaxe → le build échoue
const hash = createHash('sha256').update(js, 'utf8').digest('base64');

let html = readFileSync(join(SRC, 'index.html'), 'utf8');
for (const k of ['/*CSS*/', '/*JS*/', '__SCRIPT_HASH__']) if (!html.includes(k)) throw new Error('Marqueur absent du gabarit : ' + k);
// CSP : la sauvegarde Google Drive n'ouvre ses destinations que si elle est branchée
if (!html.includes('https://api.mistral.ai;')) throw new Error('CSP : connect-src introuvable');
html = html.replace('https://api.mistral.ai;', () => 'https://api.mistral.ai' + connectExtra + ';');
html = html.replace('/*CSS*/', () => css).replace('/*JS*/', () => js).replace('__SCRIPT_HASH__', () => 'sha256-' + hash);

// On vide le dossier sans le supprimer (un serveur local peut le servir pendant le développement)
if (!existsSync(OUT)) mkdirSync(OUT);
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
for (const f of list('static')) copyFileSync(join(SRC, 'static', f), join(OUT, f));
writeFileSync(join(OUT, 'changelog.json'), JSON.stringify(changelog, null, 1));
console.log(`v${changelog[0].version}${gdOn ? ' · sauvegarde Google Drive branchée' : ''} · ${OUT}/index.html : ${(html.length / 1024).toFixed(0)} Ko, script sha256-${hash.slice(0, 12)}…`);
