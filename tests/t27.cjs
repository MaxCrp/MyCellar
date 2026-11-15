// v2.2.2 : pages publiques (règles de confidentialité, conditions d'utilisation), avec et sans app installée
const { chromium } = require('playwright');
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Sans service worker : le fichier statique
  await p.goto('http://localhost:8765/confidentialite.html'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => ({ txt: document.body.innerText, app: !!document.querySelector('#app') }));
  ok('confidentialité : page publique lisible sans l’app', /Règles de confidentialité/.test(t.txt) && /drive\.appdata/.test(t.txt) && /utilisation limitée/.test(t.txt) && !t.app);
  await p.goto('http://localhost:8765/conditions.html'); await p.waitForTimeout(300);
  ok('conditions d’utilisation : page publique', /Conditions d’utilisation/.test(await p.evaluate(() => document.body.innerText)));
  // App installée (service worker actif) : l'app affiche la page elle-même, sans ouvrir la cave
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
  ok('service worker actif', await p.evaluate(() => !!navigator.serviceWorker.controller));
  for (const path of ['/confidentialite.html', '/confidentialite', '/conditions']) {
    await p.goto('http://localhost:8765' + path); await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ app: !!document.querySelector('#app'), doc: document.querySelector('.docpage')?.innerText || '', lock: !!document.querySelector('.lock'), title: document.title }));
    ok(`app installée, ${path} : page affichée par l’app, cave non ouverte`, r.app && r.doc.length > 200 && !r.lock && /MyCellar/.test(r.title), r.doc.slice(0, 50));
  }
  ok('aucune erreur', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
