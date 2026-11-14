// v1.7.5 : primeurs plus faciles à trouver (pastilles « En cave / En primeur » partout, raccourci dans Réglages › Primeurs)
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  const primeurs = wid => p.evaluate(w => S.bottles.filter(b => b.wineId === w && b.state === 'primeur').length, wid);
  const choosePrimeur = async (date) => {
    await p.click('.sheet label.chip:has(input[name=state][value=primeur])'); await p.waitForTimeout(100);
    const st = await p.evaluate(() => ({ on: document.querySelector('.sheet input[name=state][value=primeur]').checked, box: !document.querySelector('.sheet .primeur-f').hidden, lab: document.querySelector('.sheet .dest-l')?.textContent }));
    if (date) await p.fill('.sheet input[name=delivery]', date);
    return st;
  };
  const w0 = await p.evaluate(() => { const w = S.wines.find(x => x.kind === 'vin' && heldBottles(x.id).length && !S.bottles.some(b => b.wineId === x.id && b.state === 'primeur')); return { id: w.id, mill: w.millesime, dom: w.domaine }; });

  // 1. Mêmes bouteilles
  await p.evaluate(id => showSheet(() => addBottlesSheet(id)), w0.id); await p.waitForTimeout(150);
  ok('« Mêmes bouteilles » : pastilles En cave / En primeur', /En cave/.test(await sheet()) && /En primeur/.test(await sheet()) && !(await p.$('.sheet select[name=state]')));
  const s1 = await choosePrimeur('2027-06-15');
  ok('« En primeur » : date de livraison et « Destination à la livraison »', s1.on && s1.box && s1.lab === 'Destination à la livraison', JSON.stringify(s1));
  await p.screenshot({ path: D + '160-primeur.png' });
  await p.fill('.sheet input[name=qty]', '3'); await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  ok('3 bouteilles en primeur, livraison prévue', await primeurs(w0.id) === 3 && await p.evaluate(w => S.bottles.filter(b => b.wineId === w && b.state === 'primeur').every(b => b.delivery?.date === '2027-06-15'), w0.id));
  await p.evaluate(() => { draft = null; closeSheet(); });

  // 2. Nouveau millésime en primeur
  await p.evaluate(id => showSheet(() => vintageSheet(id)), w0.id); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=millesime]', String(w0.mill + 2)); await p.fill('.sheet input[name=qty]', '6');
  await choosePrimeur('2028-01-10');
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  const nv = await p.evaluate(w0 => { const w = S.wines.find(x => x.domaine === w0.dom && x.millesime === w0.mill + 2); return w && { id: w.id, pr: S.bottles.filter(b => b.wineId === w.id && b.state === 'primeur').length, inCave: S.bottles.filter(b => b.wineId === w.id && inCave(b)).length }; }, w0);
  ok('« Nouveau millésime » en primeur : 6 bouteilles attendues, aucune en cave', nv && nv.pr === 6 && nv.inCave === 0, JSON.stringify(nv));
  ok('pas d’écran de rangement pour un primeur', !(await p.$('.sheet [data-act=placeOk]')));
  await p.evaluate(() => { draft = null; closeSheet(); });

  // 3. Nouveau vin (saisie manuelle)
  await p.evaluate(() => ACT.newWine({ dataset: { kind: 'vin' } })); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=domaine]', 'Domaine Primeur Test'); await p.fill('.sheet input[name=millesime]', '2025');
  await choosePrimeur('2027-09-01');
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  ok('« Nouveau vin » en primeur', await p.evaluate(() => { const w = S.wines.find(x => x.domaine === 'Domaine Primeur Test'); return !!w && S.bottles.filter(b => b.wineId === w.id && b.state === 'primeur').length === 1; }));
  await p.evaluate(() => { draft = null; closeSheet(); });

  // 4. Raccourci dans Réglages › Primeurs
  await p.click('[data-act=go][data-v=plus]'); await p.waitForTimeout(150);
  await p.click('[data-act=primeursSheet]'); await p.waitForTimeout(150);
  ok('Réglages › Primeurs : « Ajouter un primeur »', !!(await p.$('.sheet [data-act=primeurAdd]')));
  await p.click('.sheet [data-act=primeurAdd]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=rebuyList][data-primeur]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[data-in=rebuyFind]', w0.dom); await p.waitForTimeout(100);
  await p.click(`.sheet [data-act=newVintage][data-id="${w0.id}"][data-primeur]`); await p.waitForTimeout(150);
  ok('raccourci → « Nouveau millésime » avec « En primeur » déjà choisi', await p.evaluate(() => document.querySelector('.sheet input[name=state][value=primeur]').checked && !document.querySelector('.sheet .primeur-f').hidden));
  await p.evaluate(() => closeSheet());
  await p.evaluate(() => ACT.primeurAdd()); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=newWine][data-primeur]'); await p.waitForTimeout(150);
  ok('raccourci → « Nouveau vin » avec « En primeur » déjà choisi', await p.evaluate(() => document.querySelector('.sheet input[name=state][value=primeur]').checked));
  await p.evaluate(() => { draft = null; closeSheet(); });

  // 5. Réception
  await p.evaluate(() => ACT.primeursSheet()); await p.waitForTimeout(150);
  const before = await p.evaluate(() => ({ pr: S.bottles.filter(b => b.state === 'primeur').length, cave: S.bottles.filter(inCave).length }));
  await p.click(`.sheet [data-act=receive][data-b]`); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ pr: S.bottles.filter(b => b.state === 'primeur').length, cave: S.bottles.filter(inCave).length }));
  ok('réception d’un primeur : les bouteilles entrent en cave', after.pr < before.pr && after.cave - before.cave === before.pr - after.pr, JSON.stringify({ before, after }));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
