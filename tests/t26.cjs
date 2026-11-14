// v2.2 : sauvegarde automatique sur Google Drive (Google, Drive et service d'autorisation simulés)
// Construit une version de test de l'app, branchée sur un service fictif, servie sur le port 8766.
const { chromium } = require('playwright');
const { execFileSync, spawn } = require('child_process');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const D = __dirname + '/shots/'; fs.mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, '.gd-build'), CFG = path.join(__dirname, '.gd-config.json');
const WORKER = 'https://auth.test.example', CLIENT = 'test-123.apps.googleusercontent.com', APP = 'http://localhost:8766/';
const PASS = 'ma cave secrète drive';

(async () => {
  fs.writeFileSync(CFG, JSON.stringify({ clientId: CLIENT, workerUrl: WORKER }));
  execFileSync('node', ['build.mjs'], { cwd: ROOT, env: { ...process.env, MC_OUT: OUT, MC_BACKUP_CONFIG: CFG }, stdio: 'pipe' });
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'), pub = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const csp = s => (s.match(/connect-src ([^;]*);/) || [])[1] || '';
  ok('CSP : Google Drive et le service ouverts seulement quand la sauvegarde est branchée', csp(html).includes('https://www.googleapis.com') && csp(html).includes(WORKER) && !csp(pub).includes('googleapis'), csp(html));
  const srv = spawn('node', [path.join(__dirname, 'serve.cjs'), '8766', OUT], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 600));

  /* ---------- Faux Google : autorisation, service, Drive ---------- */
  const G = { files: [], seq: 0, auth: [], token: [], refresh: [], uploads: 0, patches: 0, deletes: 0, revoked: 0, fail401: 0, refreshErr: null, offline: false, resumable: 0 };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'location' };
  const jr = (route, status, o, h = {}) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...h }, body: JSON.stringify(o) });
  const meta = f => ({ id: f.id, name: f.name, createdTime: f.createdTime, modifiedTime: f.modifiedTime, size: String(f.content.length) });
  const parseMultipart = (buf, ctype) => { const b = ctype.match(/boundary=(.+)$/)[1], s = buf.toString('utf8'), parts = s.split('--' + b).slice(1, -1).map(p => p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
    return { meta: JSON.parse(parts[0] || '{}'), content: parts[1] || '' }; };
  async function setup(ctx) {
    await ctx.route('https://accounts.google.com/**', route => {
      const u = new URL(route.request().url()); G.auth.push(Object.fromEntries(u.searchParams));
      const back = new URL(u.searchParams.get('redirect_uri')); back.searchParams.set('code', 'CODE-' + G.auth.length); back.searchParams.set('state', u.searchParams.get('state'));
      return route.fulfill({ status: 302, headers: { location: back.href } });
    });
    await ctx.route(WORKER + '/**', async route => {
      const r = route.request(); if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const p = new URL(r.url()).pathname, b = JSON.parse(r.postData());
      if (p === '/token') { G.token.push(b); return jr(route, 200, { access_token: 'AT-1', expires_in: 3599, refresh_token: 'RT-SECRET-42' }); }
      G.refresh.push(b); if (G.refreshErr) return jr(route, 400, { error: G.refreshErr });
      return jr(route, 200, { access_token: 'AT-' + (G.refresh.length + 1), expires_in: 3599 });
    });
    await ctx.route('https://oauth2.googleapis.com/revoke', route => { G.revoked++; return route.fulfill({ status: 200, headers: cors, body: '' }); });
    await ctx.route('https://www.googleapis.com/**', async route => {
      const r = route.request(), u = new URL(r.url()), m = r.method();
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (G.offline) return route.abort('internetdisconnected');
      if (!/^Bearer AT-/.test(r.headers().authorization || '')) return jr(route, 401, { error: { code: 401 } });
      if (G.fail401) { G.fail401--; return jr(route, 401, { error: { code: 401 } }); }
      const now = new Date().toISOString();
      if (u.pathname === '/drive/v3/files' && m === 'GET') {
        ok.lastList = Object.fromEntries(u.searchParams);
        return jr(route, 200, { files: [...G.files].sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(meta) });
      }
      if (u.pathname === '/upload/drive/v3/files' && m === 'POST' && u.searchParams.get('uploadType') === 'multipart') {
        const { meta: mt, content } = parseMultipart(r.postDataBuffer(), r.headers()['content-type']);
        const f = { id: 'file' + String(++G.seq).padStart(6, '0') + 'xyz', name: mt.name, parents: mt.parents, createdTime: now, modifiedTime: now, content }; G.files.push(f); G.uploads++;
        return jr(route, 200, meta(f));
      }
      if (u.pathname === '/upload/drive/v3/files' && m === 'POST' && u.searchParams.get('uploadType') === 'resumable') {
        const mt = JSON.parse(r.postData()); G.pending = mt; return route.fulfill({ status: 200, headers: { ...cors, location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=XYZ' }, body: '' });
      }
      if (u.pathname === '/upload/drive/v3/files' && m === 'PUT') {
        const f = { id: 'file' + String(++G.seq).padStart(6, '0') + 'xyz', name: G.pending.name, parents: G.pending.parents, createdTime: now, modifiedTime: now, content: r.postData() }; G.files.push(f); G.uploads++; G.resumable++;
        return jr(route, 200, meta(f));
      }
      const mm = u.pathname.match(/^\/(upload\/)?drive\/v3\/files\/([\w-]+)$/), f = mm && G.files.find(x => x.id === mm[2]);
      if (mm && !f) return jr(route, 404, { error: { code: 404 } });
      if (mm && m === 'PATCH') { f.content = parseMultipart(r.postDataBuffer(), r.headers()['content-type']).content; f.modifiedTime = now; G.patches++; return jr(route, 200, meta(f)); }
      if (mm && m === 'DELETE') { G.files = G.files.filter(x => x !== f); G.deletes++; return route.fulfill({ status: 204, headers: cors, body: '' }); }
      if (mm && m === 'GET' && u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: f.content });
      return jr(route, 400, { error: { code: 400 } });
    });
  }

  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await setup(ctx);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(APP); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  ok('écran de création : « Restaurer depuis Google Drive »', !!(await p.$('[data-act=gdRestoreStart]')));
  await p.fill('input[name=p1]', PASS); await p.fill('input[name=p2]', PASS); await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
  await p.evaluate(() => closeSheet());
  await p.evaluate(() => { const w = { id: uid(), kind: 'vin', domaine: 'Domaine Nuage', appellation: 'Chinon', couleur: 'rouge', millesime: 2020, format: '75', createdAt: Date.now() }; S.wines.push(w); createBottles(w, 6, { spaceId: S.spaces[0].id }); return save(); });
  await p.evaluate(() => { view = 'plus'; render(); }); await p.waitForTimeout(200);
  ok('Réglages : « Sauvegarde automatique · Connecter Google Drive »', await p.evaluate(() => /Sauvegarde automatique\s*Connecter Google Drive/.test(document.querySelector('.view').innerText)));

  /* ---------- Connexion ---------- */
  await p.click('[data-act=bkSheet]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '260-drive-connecter.png' });
  await Promise.all([p.waitForURL(u => u.href.startsWith(APP) && !u.href.includes('accounts.google'), { timeout: 8000 }), p.click('.sheet [data-act=gdConnect]')]);
  await p.waitForTimeout(800);
  const a = G.auth[0] || {};
  ok('page Google : droit drive.appdata seul, accès durable, PKCE S256, adresse de retour de l’app', a.scope === 'https://www.googleapis.com/auth/drive.appdata' && a.access_type === 'offline' && a.code_challenge_method === 'S256' && a.code_challenge?.length === 43 && a.redirect_uri === APP && a.client_id === CLIENT, JSON.stringify(a).slice(0, 200));
  const lock = await p.evaluate(() => ({ url: location.href, txt: document.body.innerText }));
  ok('retour : adresse nettoyée, cave verrouillée avec le message « déverrouille ta cave »', lock.url === APP && /terminer la connexion à Google Drive/.test(lock.txt), lock.url);
  await p.fill('input[name=p1]', PASS); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(3500);
  const t0 = G.token[0] || {};
  ok('échange du code par le service, avec le vérificateur PKCE', t0.code === 'CODE-1' && crypto.createHash('sha256').update(t0.code_verifier).digest('base64url') === a.code_challenge);
  ok('première sauvegarde envoyée dans le dossier caché de l’app', G.files.length === 1 && G.files[0].parents?.[0] === 'appDataFolder' && /^mycellar-sauvegarde-/.test(G.files[0].name), JSON.stringify(G.files.map(f => f.name)));
  const first = JSON.parse(G.files[0].content);
  ok('le fichier est la sauvegarde chiffrée habituelle (mot de passe seul, sans Face ID)', first.app === 'mycellar' && first.ct && first.slots.pw && !first.slots.pk && !G.files[0].content.includes('Domaine Nuage'));
  const tok = await p.evaluate(async () => { const e = await store.get('gdrive'); return { enc: !!(e?.iv && e?.ct), plain: JSON.stringify(e).includes('RT-SECRET') }; });
  ok('autorisation durable chiffrée sur l’appareil', tok.enc && !tok.plain);
  ok('autorisation absente du fichier de sauvegarde', !G.files[0].content.includes('RT-SECRET'));
  const st = await p.evaluate(() => { view = 'plus'; render(); return document.querySelector('.view').innerText; });
  ok('Réglages : « Google Drive · dernière : … »', /Google Drive · dernière :/.test(st));

  /* ---------- Rythme ---------- */
  await p.evaluate(() => { BK_DELAY = 300; S.wines[0].notes = 'modifié'; return save(); }); await p.waitForTimeout(1500);
  ok('modification : envoi quelques instants plus tard, la version de moins d’une heure est mise à jour', G.patches === 1 && G.files.length === 1 && JSON.parse(G.files[0].content).savedAt > first.savedAt, `patch ${G.patches}, fichiers ${G.files.length}`);
  const up0 = G.uploads + G.patches;
  ok('cave inchangée : rien n’est envoyé', await p.evaluate(() => runBackup()) === 'same' && G.uploads + G.patches === up0);
  // 30 versions au plus
  const old = Date.now() - 3 * 3600e3;
  G.files[0].createdTime = new Date(old).toISOString();
  for (let i = 1; i <= 30; i++) { const t = new Date(old - i * 3600e3).toISOString(); G.files.push({ id: 'old' + String(i).padStart(7, '0') + 'ab', name: 'mycellar-sauvegarde-ancienne.json', createdTime: t, modifiedTime: t, content: '{}' }); }
  await p.evaluate(() => { S.wines[0].notes = 'encore'; return save(); }); await p.waitForTimeout(1500);
  ok('nouvelle version après une heure, et 30 versions gardées (la plus ancienne supprimée)', G.files.length === 30 && G.deletes === 2 && !G.files.some(f => f.id === 'old0000030ab' || f.id === 'old0000029ab'), `fichiers ${G.files.length}, suppressions ${G.deletes}`);
  // Jeton d'accès expiré : renouvelé par le service
  const r0 = G.refresh.length; G.fail401 = 1;
  await p.evaluate(() => { S.wines[0].notes = 'jeton'; return runBackup(); });
  ok('jeton d’accès refusé : renouvelé, puis envoi réussi', G.refresh.length === r0 + 1 && G.refresh.at(-1).refresh_token === 'RT-SECRET-42' && await p.evaluate(() => !bkState().err));
  // Grosse sauvegarde : envoi en deux temps
  await p.evaluate(() => { GD_SIMPLE_MAX = 10; S.wines[0].notes = 'grosse'; return runBackup(); });
  ok('grosse sauvegarde : envoi en deux temps', G.resumable === 1 && await p.evaluate(() => !bkState().err));
  await p.evaluate(() => { GD_SIMPLE_MAX = 4.5e6; });
  // Mise en arrière-plan : envoi immédiat si quelque chose attend
  const pa = G.patches + G.uploads;
  await p.evaluate(async () => { BK_DELAY = 600e3; S.wines[0].notes = 'arrière-plan'; await save(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(1500);
  ok('l’app passe en arrière-plan : la modification part tout de suite', G.patches + G.uploads === pa + 1);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); BK_DELAY = 300; });
  await p.waitForTimeout(300);

  /* ---------- Échecs ---------- */
  G.offline = true;
  await p.evaluate(() => { S.wines[0].notes = 'hors ligne'; return runBackup(); });
  const off = await p.evaluate(() => ({ err: bkState().err, sum: bkSummary() }));
  ok('sans réseau : échec noté avec sa raison', /injoignable|réseau/.test(off.err || '') && /Échec/.test(off.sum), off.err);
  await p.evaluate(() => { view = 'plus'; render(); }); await p.click('[data-act=bkSheet]'); await p.waitForTimeout(200);
  ok('Réglages › Sauvegarde automatique : dernier essai échoué et dernière réussie', await p.evaluate(() => /Dernier essai échoué/.test(document.querySelector('.sheet').innerText) && /Dernière sauvegarde réussie/.test(document.querySelector('.sheet').innerText)));
  await p.screenshot({ path: D + '261-drive-etat.png' });
  G.offline = false;
  await p.click('.sheet [data-act=gdNow]'); await p.waitForTimeout(1200);
  ok('réseau revenu : « Sauvegarder maintenant » réussit, l’échec disparaît', await p.evaluate(() => !bkState().err && Date.now() - bkState().last < 5000));
  await p.evaluate(() => closeSheet());
  // Rappel des 7 jours masqué quand la sauvegarde automatique fonctionne
  const rem = await p.evaluate(() => { S.settings.lastExport = null; view = 'cave'; render(); return !!document.querySelector('[data-act=backupLater]'); });
  ok('rappel « sauvegarde » masqué quand la sauvegarde automatique fonctionne', !rem);

  /* ---------- Restaurer une version (dans l'app) ---------- */
  await p.evaluate(() => { view = 'plus'; render(); }); await p.click('[data-act=bkSheet]'); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=gdVersions]'); await p.waitForTimeout(800);
  const vs = await p.evaluate(() => document.querySelectorAll('.sheet [data-act=gdPick]').length);
  ok('liste des versions avec leur date', vs === G.files.length && vs === 30, String(vs));
  await p.screenshot({ path: D + '262-drive-versions.png' });
  await p.click('.sheet [data-act=gdPick] >> nth=0'); await p.waitForTimeout(800);
  ok('version choisie : demande du mot de passe de la cave', await p.evaluate(() => !!document.querySelector('.sheet form[data-form=import]')));
  await p.evaluate(() => closeSheet());

  /* ---------- Autorisation retirée ---------- */
  G.refreshErr = 'invalid_grant';
  await p.evaluate(() => { gd.access = null; gd.exp = 0; S.wines[0].notes = 'retirée'; return runBackup(); });
  const rc = await p.evaluate(async () => { view = 'cave'; render(); return { banner: /Sauvegarde automatique arrêtée/.test(document.querySelector('.view').innerText), sum: bkSummary(), stored: !!(await store.get('gdrive')) }; });
  ok('autorisation retirée : « Reconnexion nécessaire », bandeau, autorisation effacée', rc.banner && /Reconnexion nécessaire/.test(rc.sum) && !rc.stored, JSON.stringify(rc));
  await p.screenshot({ path: D + '263-drive-reconnexion.png' });
  G.refreshErr = null;
  ok('aucune erreur (premier appareil)', !errs.length, errs.join(' | '));

  /* ---------- Nouvel appareil : restaurer depuis Google Drive ---------- */
  // (la dernière version utile est en tête de liste)
  G.files = G.files.filter(f => f.content !== '{}');
  const ctx2 = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await setup(ctx2);
  const q = await ctx2.newPage(), e2 = []; q.on('pageerror', e => e2.push(e.message)); q.on('dialog', d => d.accept());
  await q.goto(APP); await q.waitForTimeout(500); if (await q.$('#intro')) await q.click('#intro [data-act=introDone]');
  await Promise.all([q.waitForURL(u => u.href.startsWith(APP) && !u.href.includes('accounts.google'), { timeout: 8000 }), q.click('[data-act=gdRestoreStart]')]);
  await q.waitForTimeout(1500);
  const n2 = await q.evaluate(() => document.querySelectorAll('.sheet [data-act=gdPick]').length);
  ok('nouvel appareil : retour de Google, versions listées', n2 === G.files.length && n2 > 0, String(n2));
  const before = G.uploads + G.patches;
  await q.click('.sheet [data-act=gdPick] >> nth=0'); await q.waitForTimeout(800);
  await q.fill('.sheet input[name=p]', PASS); await q.click('.sheet form[data-form=import] [type=submit]'); await q.waitForTimeout(3500);
  const rs = await q.evaluate(async () => ({ mode, wine: S?.wines.some(w => w.domaine === 'Domaine Nuage'), tok: !!(await store.get('gdrive')), on: gdOn() }));
  ok('cave restaurée avec son mot de passe', rs.mode === 'app' && rs.wine, JSON.stringify(rs));
  ok('sauvegarde automatique reprise sur le nouvel appareil (autorisation gardée)', rs.tok && rs.on);
  await q.evaluate(() => runBackup()); await q.waitForTimeout(300);
  ok('contenu restauré depuis le Drive : pas renvoyé inutilement', G.uploads + G.patches === before);
  ok('aucune erreur (nouvel appareil)', !e2.length, e2.join(' | '));

  /* ---------- Déconnexion ---------- */
  await q.evaluate(() => { view = 'plus'; render(); }); await q.click('[data-act=bkSheet]'); await q.waitForTimeout(200);
  await q.click('.sheet [data-act=gdDisconnect]'); await q.waitForTimeout(500);
  const dc = await q.evaluate(async () => ({ on: gdOn(), tok: !!(await store.get('gdrive')), sum: bkSummary() }));
  ok('déconnexion : autorisation retirée chez Google et sur l’appareil', !dc.on && !dc.tok && G.revoked === 1 && /Connecter Google Drive/.test(dc.sum), JSON.stringify(dc));

  // Démo : rien ne part
  await q.evaluate(() => { S = normalize(demoData()); mode = 'demo'; enterApp(); view = 'plus'; render(); });
  ok('cave fictive : sauvegarde automatique indisponible', await q.evaluate(() => /Sauvegarde automatique/.test(document.querySelector('.view').innerText) && !document.querySelector('[data-act=bkSheet]')));

  await b.close(); srv.kill();
  fs.rmSync(OUT, { recursive: true, force: true }); fs.rmSync(CFG, { force: true });
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
