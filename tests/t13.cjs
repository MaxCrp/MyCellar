// v1.7.2 : transferts dans les deux sens, résumé du vin, détail du graphique « À boire avant la fin de… »
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');

  // Préparation : un transfert « ancien format » (ids + to, sans destination par bouteille) vers Ville,
  // et un vin de garde acheté récemment en Ville (3 bouteilles)
  const t = await p.evaluate(() => {
    const ville = S.sites.find(s => s.role === 'conso'), camp = S.sites.find(s => s.role === 'stock'), y = thisYear();
    const old = S.bottles.find(b => b.state === 'cave' && siteOfBottle(b) === camp.id && !isFriend(wine(b.wineId)));
    S.transfer = { ids: [old.id], to: ville.id };
    const w = { id: uid(), kind: 'vin', domaine: 'Domaine du Test', cuvee: 'Garde', appellation: 'Cornas', couleur: 'rouge', millesime: y - 2, format: '75', createdAt: Date.now(), apogee: { debut: y + 4, pic: y + 8, fin: y + 15, src: 'manuel' } };
    S.wines.push(w);
    const ids = createBottles(w, 3, { spaceId: siteSpaces(ville.id)[0].id });
    const local = S.bottles.find(b => b.state === 'cave' && siteOfBottle(b) === ville.id && !isFriend(wine(b.wineId)) && b.wineId !== w.id);
    render(); return { ville: ville.id, camp: camp.id, old: old.id, w: w.id, ids, local: local.id };
  });
  await p.evaluate(() => ACT.transferSheet()); await p.waitForTimeout(200);
  const s1 = await p.evaluate(t => ({ sects: [...document.querySelectorAll('.sheet [data-tsect]')].map(x => x.textContent.trim()),
    oldIn: document.querySelector(`.sheet [data-act=tBrief][data-b="${t.old}"]`)?.closest('.list')?.previousElementSibling?.dataset?.tsect || document.querySelector(`.sheet [data-act=tBrief][data-b="${t.old}"]`) && tDest(t.old),
    sugg: !!document.querySelector(`.sheet [data-act=tAdd][data-to="${t.camp}"][data-ids*="${t.ids[0]}"]`) }), t);
  ok('deux sections : vers Ville (consommation) et vers Campagne (stockage)', s1.sects.length === 2 && /Ville · consommation/.test(s1.sects[0]) && /Campagne · stockage/.test(s1.sects[1]), s1.sects.join(' | '));
  ok('ancien transfert repris vers sa destination', s1.oldIn === t.ville, String(s1.oldIn));
  ok('suggestion vers le stockage : le vin de garde acheté en ville', s1.sugg);
  await p.click(`.sheet [data-act=tAdd][data-to="${t.camp}"][data-ids*="${t.ids[0]}"]`); await p.waitForTimeout(250);
  ok('« Ajouter ×3 » : les 3 bouteilles vont vers Campagne', await p.evaluate(t => t.ids.every(id => S.transfer.ids.includes(id) && tDest(id) === t.camp), t));
  // Depuis la fiche bouteille : libellé avec la destination
  await p.evaluate(t => { closeSheet(); showSheet(() => bottleSheet(t.local)); }, t); await p.waitForTimeout(150);
  ok('fiche bouteille : « Ajouter au transfert vers Campagne »', /Ajouter au transfert vers Campagne/.test(await sheet()));
  await p.click('.sheet [data-act=toTransfer]'); await p.waitForTimeout(250);
  ok('bouteille de Ville ajoutée vers Campagne', await p.evaluate(t => tDest(t.local) === t.camp, t));
  // Résumé du vin, puis retour au transfert
  await p.evaluate(() => { closeSheet(); ACT.transferSheet(); }); await p.waitForTimeout(150);
  await p.screenshot({ path: D + '130-transferts.png' });
  await p.click(`.sheet [data-act=tBrief][data-b="${t.ids[0]}"]`); await p.waitForTimeout(200);
  const br = await sheet();
  ok('résumé : fenêtre, statut, bouteilles par site, emplacement, transfert', /Fenêtre de dégustation/.test(br) && /Trop tôt/.test(br) && /Ville ×3/.test(br) && /Cette bouteille/.test(br) && /vers Campagne/.test(br) && /Fiche complète/.test(br), br.slice(0, 160));
  await p.screenshot({ path: D + '131-resume.png' });
  await p.click('.sheet [data-act=sheetback]'); await p.waitForTimeout(200);
  ok('retour au transfert', /Transferts entre sites/.test(await sheet()));
  // Arrivées à Campagne : meilleur espace de garde, « Ranger maintenant »
  await p.click(`.sheet [data-act=transferDone][data-to="${t.camp}"]`); await p.waitForTimeout(300);
  const a1 = await p.evaluate(t => ({ sp: [...new Set([...t.ids, t.local].map(id => space(byId(S.bottles, id).spaceId).use + ':' + siteOfBottle(byId(S.bottles, id))))], left: S.transfer.ids, txt: document.querySelector('.sheet')?.textContent || '' }), t);
  ok('arrivées à Campagne : espace de garde, non placées', a1.sp.length === 1 && a1.sp[0] === 'garde:' + t.camp, a1.sp.join(','));
  ok('l’autre sens reste préparé', a1.left.length === 1 && a1.left[0] === t.old);
  ok('« Ranger maintenant » proposé', /Ranger maintenant/.test(a1.txt));
  await p.click('.sheet [data-act=tPlaceNow]'); await p.waitForTimeout(250);
  ok('écran de rangement des 4 bouteilles (2 vins)', /Ranger 4 bouteilles/.test(await sheet()) && /2 vins/.test(await sheet()));
  await p.click('.sheet [data-act=placeOk]'); await p.waitForTimeout(300);
  ok('bouteilles rangées dans des cases', await p.evaluate(t => [...t.ids, t.local].every(id => byId(S.bottles, id).unitId), t));
  // Arrivées à Ville
  await p.evaluate(() => ACT.transferSheet()); await p.waitForTimeout(150);
  await p.click(`.sheet [data-act=transferDone][data-to="${t.ville}"]`); await p.waitForTimeout(300);
  ok('arrivées à Ville : espace de consommation, transfert vide', await p.evaluate(t => space(byId(S.bottles, t.old).spaceId).use === 'conso' && !S.transfer.ids.length, t));

  // Achat en ville d'un vin à garder : proposition d'emporter au stockage
  await p.evaluate(t => showSheet(() => addBottlesSheet(t.w)), t); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=qty]', '2');
  await p.selectOption('.sheet select[name=spaceId]', await p.evaluate(t => siteSpaces(t.ville)[0].id, t));
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  ok('à l’achat : « À emporter au prochain transfert vers Campagne ? »', /prochain transfert vers Campagne/.test(await sheet()));
  await p.screenshot({ path: D + '132-achat-garde.png' });
  await p.click('.sheet [data-act=placeToTransfer]'); await p.waitForTimeout(300);
  ok('« Oui, au transfert » : 2 bouteilles vers Campagne', await p.evaluate(t => S.transfer.ids.length === 2 && S.transfer.ids.every(id => tDest(id) === t.camp && byId(S.bottles, id).wineId === t.w), t));
  // Un vin prêt à boire acheté en ville : pas de question
  await p.evaluate(t => { const w = S.wines.find(x => x.kind === 'vin' && status(x) === 'apogee' && !isFriend(x)); showSheet(() => addBottlesSheet(w.id)); }, t); await p.waitForTimeout(150);
  await p.selectOption('.sheet select[name=spaceId]', await p.evaluate(t => siteSpaces(t.ville)[0].id, t));
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  ok('vin prêt à boire : pas de proposition', !/prochain transfert/.test(await sheet()));
  await p.evaluate(() => { draft = null; closeSheet(); });

  // Conseils de rangement : résumé
  await p.click('[data-act=go][data-v=boire]'); await p.waitForTimeout(200);
  const adv = await p.evaluate(() => moveAdvice().length);
  if (adv) { await p.evaluate(() => ACT.adviceSheet()); await p.waitForTimeout(150); await p.click('.sheet .lb[data-act=tBrief]'); await p.waitForTimeout(150); ok('conseils de rangement : résumé du vin', /Fenêtre de dégustation|Fiche complète/.test(await sheet())); await p.evaluate(() => closeSheet()); }
  else console.log('-- pas de conseil de rangement dans la cave fictive');

  // Graphique : détail par bouteille
  const bars = await p.evaluate(() => [...document.querySelectorAll('.bars button')].map(x => ({ n: +(x.textContent.trim() || 0), on: !!x.dataset.act })));
  const i = bars.findIndex(x => x.n > 0), z = bars.findIndex(x => x.n === 0);
  ok('barres à zéro inactives', z < 0 || !bars[z].on);
  let allOk = true;
  for (let k = 0; k < bars.length; k++) {
    if (!bars[k].n) continue;
    await p.click(`.bars button[data-i="${k}"]`); await p.waitForTimeout(150);
    const det = await p.evaluate(() => { const d = document.querySelector('.bar-detail'); return d ? { title: d.querySelector('.ct').textContent, sum: [...d.querySelectorAll('.res > [data-act=wine] .qty')].reduce((t, x) => t + +x.textContent.replace('×', ''), 0), locs: d.querySelectorAll('[data-act=caveJump]').length } : null; });
    if (!det || det.sum !== bars[k].n || !det.locs) { allOk = false; console.log('   barre', k, JSON.stringify(det), bars[k].n); }
  }
  ok('chaque barre : détail avec un total égal à la barre et les emplacements', allOk);
  await p.click(`.bars button[data-i="${i}"]`); await p.waitForTimeout(150);
  if (await p.$('.bar-detail')) { await p.click(`.bars button[data-i="${i}"]`); await p.waitForTimeout(150); }
  ok('second appui sur la même barre : détail refermé', !(await p.$('.bar-detail')));
  await p.click(`.bars button[data-i="${i}"]`); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bar-detail').scrollIntoView()); await p.waitForTimeout(100);
  await p.screenshot({ path: D + '133-graphique-detail.png' });
  const jb = await p.evaluate(() => document.querySelector('.bar-detail [data-act=caveJump]').dataset.b);
  await p.click('.bar-detail [data-act=caveJump]'); await p.waitForTimeout(900);
  ok('emplacement → case sur le plan', await p.evaluate(b => view === 'cave' && !!document.querySelector(`.view .flash`), jb));
  await p.click('[data-act=go][data-v=boire]'); await p.waitForTimeout(200);
  await p.click('.bar-detail .res > [data-act=wine]'); await p.waitForTimeout(200);
  ok('vin → fiche', /Fenêtre de dégustation/.test(await sheet()));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
