// v1.7.1 : recherche sur tous les sites avec accès à la bouteille, croix des barres de recherche, nouvelle conversation du sommelier
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  let dialogAnswer = true;
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => dialogAnswer ? d.accept() : d.dismiss());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  const inView = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight - 70; }, sel);

  // Un vin présent sur les deux sites : on ajoute une bouteille non placée de l'autre site si besoin
  const t = await p.evaluate(() => {
    const cur = S.settings.site, other = S.sites.find(s => s.id !== cur);
    const w = S.wines.find(x => x.kind === 'vin' && !x.owner && wineBottles(x.id).some(b => b.unitId && !UNIT_TYPES[unit(b.unitId).type].box && siteOfBottle(b) === other.id));
    const there = wineBottles(w.id).find(b => b.unitId && !UNIT_TYPES[unit(b.unitId).type].box && siteOfBottle(b) === other.id);
    if (!wineBottles(w.id).some(b => siteOfBottle(b) === cur)) createBottles(w, 1, { spaceId: siteSpaces(cur)[0].id });
    render();
    return { w: w.id, q: w.domaine, cur, other: other.id, otherName: other.name, curName: site(cur).name, bid: there.id };
  });
  await p.fill('header input[data-in=caveSearch]', t.q); await p.waitForTimeout(200);
  const r = await p.evaluate(() => ({ lists: document.querySelectorAll('.view .res').length, rows: [...document.querySelectorAll('.view .res [data-act=caveJump]')].map(x => x.textContent.trim()), plan: !!document.querySelector('.view .rack, .view .shelf'), x: !document.querySelector('header .sx').hidden }));
  ok('résultats sous la barre, sans le plan', r.lists >= 1 && !r.plan, JSON.stringify(r).slice(0, 200));
  ok('emplacements des deux sites listés', r.rows.some(x => x.includes(t.otherName)) && r.rows.some(x => x.includes(t.curName)), r.rows.join(' | ').slice(0, 200));
  ok('croix visible après la saisie', r.x);
  await p.screenshot({ path: D + '120-recherche.png' });
  await p.click(`.view [data-act=caveJump][data-b="${t.bid}"]`); await p.waitForTimeout(900);
  const j = await p.evaluate(b => ({ site: S.settings.site, space: caveSpace, flash: !!document.querySelector(`.view [data-b="${b}"].flash`), list: !!document.querySelector('.view .res') }), t.bid);
  ok('le site affiché devient celui de la bouteille', j.site === t.other);
  ok('liste fermée, case qui clignote', !j.list && j.flash, JSON.stringify(j));
  ok('case visible à l’écran', await inView(`.view [data-b="${t.bid}"]`));
  await p.screenshot({ path: D + '121-case-trouvee.png' });

  // Croix : efface d'un coup et rend le plan normal
  await p.click('header .sx'); await p.waitForTimeout(200);
  const c = await p.evaluate(() => ({ v: document.querySelector('header input[data-in=caveSearch]').value, q: caveQuery, hl: document.querySelectorAll('.view .hl, .view .dim').length, x: document.querySelector('header .sx').hidden, focus: document.activeElement?.dataset?.in || '' }));
  ok('croix : champ vidé, plan normal, croix masquée, clavier replié', c.v === '' && c.q === '' && c.hl === 0 && c.x && c.focus !== 'caveSearch', JSON.stringify(c));

  // Caisse : la caisse s'ouvre
  const box = await p.evaluate(() => { const b = S.bottles.find(x => inCave(x) && x.unitId && UNIT_TYPES[unit(x.unitId).type].box); return { q: wine(b.wineId).domaine, u: b.unitId, id: b.id }; });
  await p.fill('header input[data-in=caveSearch]', box.q); await p.waitForTimeout(200);
  await p.click(`.view [data-act=caveJump][data-b="${box.id}"]`); await p.waitForTimeout(1500);
  ok('caisse : la caisse s’ouvre', await p.evaluate(u => !!document.querySelector('.sheet') && document.querySelector('.sheet').textContent.includes(unit(u).name), box.u));
  await p.evaluate(() => closeSheet());

  // Bouteille non placée, et touche « Rechercher » avec un seul emplacement
  const np = await p.evaluate(() => {
    const w = { id: uid(), kind: 'vin', domaine: 'Domaine Zéphyrin', cuvee: 'Unique', appellation: 'Test', couleur: 'blanc', format: '75', createdAt: Date.now() };
    S.wines.push(w); const other = S.sites.find(s => s.id !== S.settings.site);
    const [id] = createBottles(w, 1, { spaceId: siteSpaces(other.id)[0].id }); return { id, site: other.id };
  });
  await p.click('header .sx'); await p.fill('header input[data-in=caveSearch]', 'Zéphyrin'); await p.press('header input[data-in=caveSearch]', 'Enter'); await p.waitForTimeout(900);
  const e = await p.evaluate(() => ({ site: S.settings.site, flash: !!document.querySelector('.view .unplaced .flash') }));
  ok('touche Rechercher : un seul emplacement → saut direct, bloc « non placées »', e.site === np.site && e.flash, JSON.stringify(e));

  // « Voir sur le plan » depuis la fiche bouteille et depuis la fiche vin
  await p.click('header .sx');
  await p.evaluate(b => showSheet(() => bottleSheet(b)), t.bid); await p.waitForTimeout(200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.sheet [data-act=planGo]'); await p.waitForTimeout(900);
  ok('fiche bouteille : « Voir sur le plan »', await p.evaluate(b => !document.querySelector('.sheet') && !!document.querySelector(`.view [data-b="${b}"].flash`), t.bid));
  await p.evaluate(w => { S.settings.site = S.sites[0].id === S.settings.site ? S.sites[1].id : S.sites[0].id; render(); showSheet(() => wineSheet(w)); }, t.w); await p.waitForTimeout(200);
  await p.click(`.sheet [data-act=planGo][data-b="${t.bid}"]`); await p.waitForTimeout(900);
  ok('fiche vin : épingle « Voir sur le plan » sur chaque emplacement', await p.evaluate(b => S.settings.site === siteOfBottle(byId(S.bottles, b)) && !!document.querySelector(`.view [data-b="${b}"].flash`), t.bid));

  // Croix sur les autres barres de recherche
  await p.click('[data-act=go][data-v=deg]'); await p.waitForTimeout(200);
  await p.fill('header input[data-in=degSearch]', 'zzz'); await p.waitForTimeout(100);
  await p.click('header .sx'); await p.waitForTimeout(150);
  ok('Dégustations : croix', await p.evaluate(() => degQuery === '' && document.querySelector('header input[data-in=degSearch]').value === ''));
  await p.evaluate(() => ACT.rebuyList()); await p.waitForTimeout(200);
  const before = await p.evaluate(() => document.querySelector('#rebuy-list').innerHTML);
  await p.fill('.sheet input[data-in=rebuyFind]', 'zzz'); await p.waitForTimeout(100);
  await p.click('.sheet .sx'); await p.waitForTimeout(100);
  ok('Racheter un vin : croix, liste complète revenue', await p.evaluate(h => document.querySelector('.sheet input[data-in=rebuyFind]').value === '' && document.querySelector('#rebuy-list').innerHTML === h, before));
  await p.evaluate(() => closeSheet());
  await p.evaluate(() => ACT.newTaste({ dataset: {} })); await p.waitForTimeout(200);
  await p.fill('.sheet input[data-in=tasteFind]', 'zzz'); await p.waitForTimeout(100); await p.click('.sheet .sx'); await p.waitForTimeout(100);
  ok('Nouvelle dégustation : croix', await p.evaluate(() => document.querySelector('.sheet input[data-in=tasteFind]').value === '' && document.querySelector('.sheet .sx').hidden));
  await p.evaluate(() => closeSheet());

  // Sommelier : conversation plus longue que l'écran
  await p.evaluate(() => {
    S.chat = [];
    for (let i = 0; i < 8; i++) { S.chat.push({ role: 'user', text: 'Question ' + i + ' : un vin pour un rôti de porc aux herbes et des légumes du jardin ?', at: Date.now() }); S.chat.push({ role: 'assistant', data: { message: 'Réponse ' + i + '. '.repeat(1) + 'Un blanc de Loire tendu ira bien, servi frais, avec une belle acidité pour les herbes. '.repeat(3), recos: [], achats: [], relances: [] }, at: Date.now() }); }
  });
  await p.click('[data-act=go][data-v=somm]'); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200);
  const s = await p.evaluate(() => { const comp = document.querySelector('.composer').getBoundingClientRect(), last = [...document.querySelectorAll('.view .bubble')].at(-1).getBoundingClientRect(), n = document.querySelector('.composer [data-act=chatNew]'); return { long: document.body.scrollHeight > innerHeight * 1.5, gap: Math.round(comp.top - last.bottom), btn: !!n && n.getBoundingClientRect().top >= comp.top, oldLink: !!document.querySelector('.view [data-act=chatNew]') }; });
  ok('conversation plus longue que l’écran', s.long);
  ok('icône « Nouvelle conversation » dans l’encart flottant, ancien lien retiré', s.btn && !s.oldLink, JSON.stringify(s));
  ok('dernière réponse entièrement au-dessus de l’encart', s.gap >= 0, 'écart ' + s.gap + ' px');
  await p.screenshot({ path: D + '122-sommelier-long.png' });
  dialogAnswer = false; await p.click('.composer [data-act=chatNew]'); await p.waitForTimeout(450);
  ok('confirmation refusée : rien n’est effacé', await p.evaluate(() => S.chat.length === 16));
  dialogAnswer = true; await p.click('.composer [data-act=chatNew]'); await p.waitForTimeout(450);
  ok('confirmation acceptée : nouvelle conversation, icône masquée', await p.evaluate(() => S.chat.length === 0 && !document.querySelector('.composer [data-act=chatNew]')));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
