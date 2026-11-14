// v2.1.6 : épingle « Voir dans la cave » sur chaque ligne des transferts
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  // Une bouteille rangée dans une case, à Campagne, à emporter vers Ville ; l'app affiche Ville
  const t = await p.evaluate(() => {
    const ville = S.sites.find(s => s.role !== 'stock'), camp = S.sites.find(s => s.role === 'stock');
    const bt = S.bottles.find(x => x.state === 'cave' && x.unitId && !UNIT_TYPES[unit(x.unitId).type].box && siteOfBottle(x) === camp.id && !x.owner);
    transferAdd([bt.id], ville.id); S.settings.site = ville.id; render(); ACT.transferSheet();
    return { bid: bt.id, camp: camp.id };
  });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const rows = [...document.querySelectorAll('.sheet .li')].filter(l => l.querySelector('[data-act=tBrief]'));
    return { rows: rows.length, pins: rows.filter(l => l.querySelector('[data-act=caveJump]')).length, sugg: document.querySelectorAll('.sheet [data-act=tAdd]').length,
      over: rows.filter(l => l.scrollWidth > l.clientWidth + 1).length }; });
  ok('une épingle sur chaque ligne (à emporter et suggestions)', r.rows > 1 && r.pins === r.rows && r.sugg > 0, JSON.stringify(r));
  ok('lignes sans débordement', r.over === 0);
  await p.screenshot({ path: D + '230-transfert-epingles.png' });
  await p.click(`.sheet [data-act=caveJump][data-b="${t.bid}"]`); await p.waitForTimeout(1000);
  const j = await p.evaluate(b => ({ sheet: !!document.querySelector('.sheet'), site: S.settings.site, view, flash: !!document.querySelector(`.view [data-b="${b}"].flash`) }), t.bid);
  ok('bouteille à emporter : fenêtre fermée, bon site, case qui clignote', !j.sheet && j.site === t.camp && j.view === 'cave' && j.flash, JSON.stringify(j));
  // Depuis une suggestion
  await p.evaluate(() => ACT.transferSheet()); await p.waitForTimeout(300);
  const sb = await p.evaluate(() => document.querySelector('.sheet [data-act=tAdd]').closest('.li').querySelector('[data-act=caveJump]').dataset.b);
  await p.click(`.sheet [data-act=caveJump][data-b="${sb}"]`); await p.waitForTimeout(1600);
  const k = await p.evaluate(b => { const x = byId(S.bottles, b), u = x.unitId && unit(x.unitId);
    return { site: S.settings.site === siteOfBottle(x), ok: !u ? !!document.querySelector('.view .unplaced .flash') : UNIT_TYPES[u.type].box ? !!document.querySelector('.sheet') : !!document.querySelector(`.view [data-b="${b}"].flash`) }; }, sb);
  ok('suggestion : saut vers la bouteille', k.site && k.ok, JSON.stringify(k));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
