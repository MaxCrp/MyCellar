// v1.7 : import Ploc complet, sur un export fictif au format réel (plan, légende, fiches, deux caves, note, champs vides)
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
const V = o => ({ numero: 0, titre: '', millesime: '', couleur: '', alcool: '', apogee: '', estimation: '', producteur: '', pays: '', region: '', appellation: '', cepages: '', cuvee: '', contenance: '750ml', stock: 1, caves: [], servir: '', accords: '', note: '', ...o });
const BAS = 'Valrose - Cave du bas', ETG = 'Étagère Haute Montbrun';
const EXPORT = {
  caves: [{ nom: BAS, lignes: 6, colonnes: 4, cases: [{ ligne: 1, colonne: 1, numero: 1 }, { ligne: 1, colonne: 2, numero: 2 }, { ligne: 1, colonne: 3, numero: 2 }, { ligne: 2, colonne: 1, numero: 3 }, { ligne: 2, colonne: 2, numero: 4 }] }],
  vins: [
    V({ numero: 1, titre: 'Domaine des Tilleuls Sancerre Les Caillottes', millesime: '2021', couleur: 'Blanc', alcool: '13', apogee: '2023/2027', estimation: '18,50€', producteur: 'Domaine des Tilleuls', pays: 'France', region: 'Vallée de la Loire', appellation: 'Sancerre', cepages: 'Sauvignon', stock: 1, caves: [{ nom: BAS, quantite: 1 }], servir: '10-12°', accords: 'poissons, fromages', note: '75' }),
    V({ numero: 2, titre: 'Clos Fictif Rouge', millesime: '2018', couleur: 'Rouge', apogee: '2022/2030', estimation: '25€', pays: 'France', stock: 5, caves: [{ nom: BAS, quantite: 2 }, { nom: ETG, quantite: 3 }] }),
    V({ numero: 3, titre: 'Mas Imaginaire Cuvée Zéphyr', millesime: '2020', couleur: 'Liquoreux', contenance: '1,5 l', producteur: 'Mas Imaginaire', appellation: 'Jurançon', caves: [{ nom: BAS, quantite: 1 }] }),
    V({ numero: 4, titre: 'Château Inventé Grand Vin', millesime: '2016', couleur: 'Rouge', apogee: '2020/2026', producteur: 'Château Inventé', appellation: 'Pauillac', region: 'Bordeaux', caves: [{ nom: BAS, quantite: 1 }] })] };
const FILL = { items: [
  { i: 0, producteur: '', appellation: '', region: '', pays: '', cepages: '', couleur: '', debut: 2023, pic: 2025, fin: 2028, justification: 'Sancerre à boire jeune.' },
  { i: 1, producteur: 'Clos Fictif', appellation: 'Bandol', region: 'Provence', pays: '', cepages: 'Mourvèdre', couleur: '', debut: 2022, pic: 2026, fin: 2031, justification: 'Bandol de garde moyenne.' },
  { i: 2, producteur: '', appellation: '', region: 'Sud-Ouest', pays: '', cepages: 'Petit manseng', couleur: '', debut: 2024, pic: 2029, fin: 2035, justification: 'Liquoreux de longue garde.' },
  { i: 3, producteur: '', appellation: '', region: '', pays: '', cepages: 'Cabernet sauvignon', couleur: '', debut: 2024, pic: 2029, fin: 2034, justification: 'Pauillac 2016, millésime de garde.' }] };
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [], bodies = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const raw = req.postData(), body = JSON.parse(raw), schema = body.output_config?.format?.schema;
    bodies.push(raw);
    const text = JSON.stringify(schema?.properties?.vins ? EXPORT : schema?.properties?.items?.items?.properties?.justification ? FILL : {});
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 800 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.fill('input[name=p1]', 'mot de passe solide'); await p.fill('input[name=p2]', 'mot de passe solide'); await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
  // Trois sites : « Site 1 » (non reconnu), « Montbrun » (reconnu dans le nom de l'étagère), « Secretsite » (sans rapport)
  const ids = await p.evaluate(() => {
    draft = null; closeSheet();
    S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; S.settings.multi = true;
    const m = { id: uid(), name: 'Montbrun', role: 'stock' }, x = { id: uid(), name: 'Secretsite', role: 'stock' };
    S.sites.push(m, x);
    const cel = { id: uid(), siteId: m.id, name: 'Cellier', use: 'garde', q: {} }, gar = { id: uid(), siteId: x.id, name: 'Garage', use: 'garde', q: {} };
    S.spaces.push(cel, gar); render();
    return { cave: S.spaces[0].id, cellier: cel.id, site1: S.sites[0].id };
  });
  const runImport = async () => { await p.evaluate(async () => { await onPdf(new File([new Uint8Array([37, 80, 68, 70])], 'ploc.pdf', { type: 'application/pdf' })); }); await p.waitForTimeout(400); };

  /* Premier import */
  await runImport();
  const r1 = await p.evaluate(() => ({ caves: plocData.caves.map(c => ({ n: c.name, sp: c.spaceId, plan: !!c.plan, unit: c.unitMode })), diff: plocData.wines.map(w => w.diff), fill: plocData.wines.map(w => w.fill), btn: document.querySelector('[data-act=plocGo]').textContent }));
  ok('deux caves Ploc, plan lu pour la première', r1.caves.length === 2 && r1.caves[0].plan && !r1.caves[1].plan, JSON.stringify(r1.caves));
  ok('site non reconnu : pas d’espace présélectionné', r1.caves[0].sp === null);
  ok('« Étagère Haute Montbrun » rattachée au site Montbrun', r1.caves[1].sp === ids.cellier);
  ok('proposition du sommelier seulement pour le vin n° 4', JSON.stringify(r1.diff) === '[false,false,false,true]', JSON.stringify(r1.diff));
  ok('champs complétés signalés', r1.fill[1].includes('producteur') && r1.fill[1].includes('appellation') && r1.fill[0].length === 0, JSON.stringify(r1.fill));
  ok('total du bouton : 8 bouteilles (5 du plan + 3 de l’étagère)', /8 bouteilles/.test(r1.btn), r1.btn);
  await p.click('.sheet [data-act=plocGo]'); await p.waitForTimeout(300);
  ok('import refusé tant que la cave n’a pas d’espace', await p.evaluate(() => !!plocData && S.wines.length === 0));
  await p.selectOption('.sheet select[data-ch=plocSpace][data-k="0"]', ids.cave); await p.waitForTimeout(200);
  ok('renommage proposé : « Site 1 » → « Valrose »', !!(await p.$('.sheet input[data-ch=plocRename][data-k="0"]')));
  await p.check('.sheet input[data-ch=plocRename][data-k="0"]');
  await p.click('.sheet [data-act=plocWin][data-i="3"][data-v=ia]'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 0)); await p.waitForTimeout(100);
  await p.screenshot({ path: D + '110-ploc-review.png' });
  await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 99999)); await p.waitForTimeout(100);
  await p.screenshot({ path: D + '111-ploc-review-bas.png' });
  await p.click('.sheet [data-act=plocGo]'); await p.waitForTimeout(500);
  await p.screenshot({ path: D + '112-ploc-plan.png' });
  const a = await p.evaluate(() => {
    const W = t => S.wines.find(w => w.domaine === t), bs = w => S.bottles.filter(b => b.wineId === w.id);
    const w1 = W('Domaine des Tilleuls'), w2 = W('Clos Fictif'), w3 = W('Mas Imaginaire'), w4 = W('Château Inventé'), u = S.units.find(x => x.name === 'Cave du bas');
    return { n: S.wines.length, site1: S.sites[0].name, unit: u && [u.type, u.rows, u.cols, u.spaceId === S.spaces[0].id],
      w1: { cuvee: w1.cuvee, app: w1.appellation, degre: w1.degre, prix: w1.achat?.prix, service: w1.service, format: w1.format, apo: [w1.apogee?.debut, w1.apogee?.pic, w1.apogee?.fin, w1.apogee?.src], accords: /Accords Ploc : poissons, fromages/.test(w1.notes), pos: bs(w1).map(b => [b.r, b.c, b.unitId === u.id]) },
      w2: { cuvee: w2.cuvee, app: w2.appellation, region: w2.region, prix: w2.achat?.prix, placed: bs(w2).filter(b => b.unitId).map(b => [b.r, b.c]), etg: bs(w2).filter(b => !b.unitId && b.plocCave === 'Étagère Haute Montbrun' && space(b.spaceId).name === 'Cellier').length },
      w3: { format: w3.format, couleur: w3.couleur, cuvee: w3.cuvee, apo: [w3.apogee?.debut, w3.apogee?.fin, w3.apogee?.src] },
      w4: { apo: [w4.apogee?.debut, w4.apogee?.fin, w4.apogee?.src, w4.apogee?.why] },
      notes: S.tastings.filter(t => t.plocNote).map(t => [wine(t.wineId).domaine, t.note]), bottles: S.bottles.length, units: S.units.length };
  });
  ok('4 vins créés, site renommé « Valrose »', a.n === 4 && a.site1 === 'Valrose', a.site1);
  ok('rack « Cave du bas » 6 × 4 créé dans l’espace choisi', JSON.stringify(a.unit) === '["rack",6,4,true]', JSON.stringify(a.unit));
  ok('fiche reprise : cuvée, appellation, degré, prix, service, format', a.w1.cuvee === 'Les Caillottes' && a.w1.app === 'Sancerre' && a.w1.degre === 13 && a.w1.prix === 18.5 && a.w1.service === '10-12°' && a.w1.format === '75', JSON.stringify(a.w1));
  ok('fenêtre Ploc gardée (2023–2027, apogée 2025)', JSON.stringify(a.w1.apo) === '[2023,2025,2027,"ploc"]', JSON.stringify(a.w1.apo));
  ok('accords dans les notes', a.w1.accords);
  ok('bouteille posée à sa case (ligne 1, colonne 1)', JSON.stringify(a.w1.pos) === '[[0,0,true]]', JSON.stringify(a.w1.pos));
  ok('producteur et appellation complétés, cuvée déduite du titre', a.w2.cuvee === 'Rouge' && a.w2.app === 'Bandol' && a.w2.region === 'Provence', JSON.stringify(a.w2));
  ok('Clos Fictif : 2 à leur place, 3 non placées au Cellier', JSON.stringify(a.w2.placed) === '[[0,1],[0,2]]' && a.w2.etg === 3, JSON.stringify(a.w2));
  ok('magnum, liquoreux, fenêtre du sommelier faute de fenêtre Ploc', a.w3.format === '150' && a.w3.couleur === 'liquoreux' && a.w3.cuvee === 'Cuvée Zéphyr' && JSON.stringify(a.w3.apo) === '[2024,2035,"ia"]', JSON.stringify(a.w3));
  ok('proposition du sommelier retenue pour le vin n° 4', a.w4.apo[0] === 2024 && a.w4.apo[1] === 2034 && a.w4.apo[2] === 'ia' && /Pauillac/.test(a.w4.apo[3]), JSON.stringify(a.w4));
  ok('note 75/100 → dégustation 15/20', JSON.stringify(a.notes) === '[["Domaine des Tilleuls",15]]', JSON.stringify(a.notes));
  ok('8 bouteilles', a.bottles === 8, a.bottles);

  /* Second import du même export : rien ne doit être recréé */
  await runImport();
  const r2 = await p.evaluate(() => ({ sp: plocData.caves[0].spaceId, unit: plocData.caves[0].unitMode, uid: S.units.find(x => x.name === 'Cave du bas')?.id, done: plocData.wines.every(w => w.per.every(x => x.done)), btn: document.querySelector('[data-act=plocGo]').textContent, tag: document.querySelectorAll('.sheet .tag').length }));
  ok('second import : site reconnu, meuble existant proposé', r2.sp === ids.cave && r2.unit === r2.uid, JSON.stringify(r2));
  ok('second import : tout est « déjà importé »', r2.done && /Rien de nouveau/.test(r2.btn) && r2.tag >= 5, r2.btn);
  await p.click('.sheet [data-act=plocGo]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ w: S.wines.length, b: S.bottles.length, u: S.units.length, t: S.tastings.length }));
  ok('pas de doublon (vins, bouteilles, meubles, notes)', c.w === 4 && c.b === 8 && c.u === a.units && c.t === 1, JSON.stringify(c));

  /* Fiche vin et dégustation : température de service */
  await p.evaluate(() => { const w = S.wines.find(x => x.domaine === 'Domaine des Tilleuls'); showSheet(() => wineSheet(w.id)); }); await p.waitForTimeout(200);
  const fiche = await p.evaluate(() => document.querySelector('.sheet').textContent);
  ok('fiche vin : « Servir à 10-12° » et « reprise de Ploc »', /Servir à\s*10-12°/.test(fiche) && /reprise de Ploc/.test(fiche));
  await p.screenshot({ path: D + '113-ploc-fiche.png' });
  await p.evaluate(() => { closeSheet(); const w = S.wines.find(x => x.domaine === 'Domaine des Tilleuls'); startTaste(w.id, null, 'quick'); }); await p.waitForTimeout(200);
  ok('dégustation : température affichée', /Servir à 10-12°/.test(await p.evaluate(() => document.querySelector('.sheet').textContent)));
  await p.evaluate(() => { draft = null; closeSheet(); });
  // Saisie manuelle du champ
  await p.evaluate(() => { const w = S.wines.find(x => x.domaine === 'Château Inventé'); ACT.editWine({ dataset: { id: w.id } }); }); await p.waitForTimeout(200);
  await p.fill('.sheet input[name=service]', '17 °C'); await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300);
  ok('température saisie à la main', await p.evaluate(() => S.wines.find(x => x.domaine === 'Château Inventé').service === '17 °C'));

  /* Confidentialité : les sites de l'utilisateur ne partent jamais vers l'IA */
  ok('aucun nom de site ni d’espace envoyé à l’IA', bodies.length >= 4 && !bodies.some(x => /Secretsite|Cellier|Garage/.test(x)), bodies.length + ' requêtes');
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
