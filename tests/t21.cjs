// v2.1.3 : aperçu des meubles, filtres de la liste, recherche flottante, barres d'apogée dans les listes
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
  await p.evaluate(() => { S.settings.site = S.sites.find(s => s.role === 'stock').id; render(); });

  /* ---------- Aperçu des meubles ---------- */
  const m = await p.evaluate(() => {
    const occ = occupancy(), units = visibleSpaces().flatMap(sp => spaceUnits(sp.id));
    const minis = [...document.querySelectorAll('header .ustrip .umini')];
    const rows = units.map(u => { const el = document.querySelector(`.umini[data-u="${u.id}"]`), used = capacity(u) - freeSlots(u, occ).length;
      const filled = UNIT_TYPES[u.type].box ? el?.querySelectorAll('circle[r="2.3"]').length : el?.querySelectorAll('rect:not([style*="fill:none"])').length;
      return { ok: !!el && el.querySelector('.uct').textContent === `${used}/${capacity(u)}` && filled === used, name: u.name }; });
    return { n: minis.length, units: units.length, rows, chips: document.querySelectorAll('header [data-act=caveSpace]').length, input: !!document.querySelector('header input'), fab: !!document.querySelector('.sfab') };
  });
  ok('une miniature par meuble du site', m.n === m.units && m.n >= 2, `${m.n}/${m.units}`);
  ok('miniatures fidèles : places occupées et compteur', m.rows.every(r => r.ok), JSON.stringify(m.rows.filter(r => !r.ok)));
  ok('plus de puces d’espaces ni de champ de recherche dans l’en-tête', !m.chips && !m.input);
  ok('loupe flottante présente', m.fab);
  await p.screenshot({ path: D + '210-apercu.png' });

  // Saut vers le dernier meuble (en bas de page) : jamais au-delà de la fin, barre d'onglets en place
  const last = await p.evaluate(() => [...document.querySelectorAll('.umini')].at(-1).dataset.u);
  await p.click(`.umini[data-u="${last}"]`); await p.waitForTimeout(250);
  const j1 = await p.evaluate(u => ({ flash: !!document.querySelector(`.view [data-unit="${u}"].uflash, .view .crate[data-u="${u}"].uflash`), on: document.querySelector('.umini.on')?.dataset.u === u }), last);
  await p.waitForTimeout(800);
  const j2 = await p.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight, tabs: Math.round(document.querySelector('.tabs').getBoundingClientRect().bottom), h: innerHeight }));
  ok('dernier meuble : il s’encadre, sa miniature aussi', j1.flash && j1.on, JSON.stringify(j1));
  ok('défilement arrêté à la fin de la page, barre d’onglets en bas', j2.y <= j2.max + 1 && j2.tabs === j2.h, JSON.stringify(j2));
  // Saut vers le premier meuble : juste sous l'en-tête
  const first = await p.evaluate(() => document.querySelector('.umini').dataset.u);
  await p.click(`.umini[data-u="${first}"]`); await p.waitForTimeout(900);
  const j3 = await p.evaluate(u => { const c = document.querySelector(`.view [data-unit="${u}"]`) || document.querySelector(`.view .crate[data-u="${u}"]`).closest('.card');
    return { card: Math.round(c.getBoundingClientRect().top), head: Math.round(document.querySelector('header.top').getBoundingClientRect().bottom), y: scrollY, max: document.documentElement.scrollHeight - innerHeight }; }, first);
  ok('premier meuble : visible juste sous l’en-tête', j3.card >= j3.head && (j3.card - j3.head < 40 || j3.y >= j3.max - 1), JSON.stringify(j3));

  // Suivi au défilement (cave plus grande : on ajoute deux meubles)
  await p.evaluate(() => { const sp = visibleSpaces()[0]; for (let i = 0; i < 2; i++) S.units.push({ id: uid(), order: S.units.length, type: 'armoire', name: 'Armoire test ' + (i + 1), rows: 6, cols: 4, spaceId: sp.id }); window.scrollTo(0, 0); render(); });
  const target = await p.evaluate(() => { const els = [...document.querySelectorAll('.view [data-unit]')]; const el = els[1]; window.scrollTo(0, scrollY + el.getBoundingClientRect().top - document.querySelector('header.top').getBoundingClientRect().bottom - 5); return el.dataset.unit; });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.dispatchEvent(new Event('scroll'))); await p.waitForTimeout(200);
  ok('suivi : la miniature du meuble visible s’encadre', await p.evaluate(u => document.querySelector('.umini.on')?.dataset.u === u, target));

  // Barre absente : en Liste, pendant une recherche, avec un seul meuble
  await p.click('[data-act=caveMode][data-m=liste]'); await p.waitForTimeout(150);
  ok('mode Liste : pas de miniatures, barre de filtres', await p.evaluate(() => !document.querySelector('.ustrip') && !!document.querySelector('header .fbar')));
  await p.click('[data-act=caveMode][data-m=plan]'); await p.click('.sfab'); await p.waitForTimeout(150);
  const foc = await p.evaluate(() => document.activeElement?.dataset?.in);
  await p.fill('.csearch input', 'morgon'); await p.waitForTimeout(200);
  const s1 = await p.evaluate(() => ({ strip: !!document.querySelector('.ustrip'), res: document.querySelectorAll('.view .res').length, x: !document.querySelector('.csearch .sx').hidden }));
  ok('recherche : champ ouvert avec le clavier', foc === 'caveSearch', foc);
  ok('recherche : résultats, barre masquée, croix visible', !s1.strip && s1.res > 0 && s1.x, JSON.stringify(s1));
  await p.screenshot({ path: D + '211-recherche.png' });
  await p.click('.view [data-act=caveJump] >> nth=0'); await p.waitForTimeout(900);
  ok('après un saut depuis les résultats, la barre revient', await p.evaluate(() => !!document.querySelector('.ustrip')));
  await p.click('[data-act=searchCancel]'); await p.waitForTimeout(150);
  ok('Annuler : recherche effacée, loupe sans pastille', await p.evaluate(() => caveQuery === '' && !document.querySelector('.csearch') && !document.querySelector('.sfab.dot')));
  const one = await p.evaluate(() => { const keep = S.units; const sp = visibleSpaces(); S.units = keep.filter(u => !sp.some(s => s.id === u.spaceId)).concat(keep.find(u => sp.some(s => s.id === u.spaceId))); render(); const r = !document.querySelector('.ustrip'); S.units = keep; render(); return r; });
  ok('un seul meuble : pas de barre', one);

  /* ---------- Filtres de la liste ---------- */
  await p.click('[data-act=caveMode][data-m=liste]'); await p.click('[data-act=cfOpen]'); await p.waitForTimeout(250);
  const g = await p.evaluate(() => [...document.querySelectorAll('.sheet h3')].map(h => h.textContent));
  ok('feuille : groupes Maturité, Couleur, Site, Région, Millésime', ['Maturité', 'Couleur', 'Site', 'Région', 'Millésime'].every(x => g.includes(x)), g.join(', '));
  const before = await p.evaluate(() => +document.querySelector('.sheet [data-g=col][data-v=rouge] em').textContent);
  await p.click('.sheet [data-act=cfToggle][data-g=col][data-v=rouge]'); await p.waitForTimeout(200);
  const f1 = await p.evaluate(() => ({ n: listWines().length, all: listWines().every(w => w.couleur === 'rouge'), btn: document.querySelector('.sheet .btn.primary').textContent, rows: document.querySelectorAll('.view .li[data-act=wine]').length }));
  ok('rouge : liste filtrée, compteur exact, liste derrière à jour', f1.all && f1.n === before && f1.rows === f1.n && f1.btn.includes(String(f1.n)), JSON.stringify(f1) + ' attendu ' + before);
  await p.click('.sheet [data-act=cfToggle][data-g=col][data-v=blanc]'); await p.waitForTimeout(200);
  const f2 = await p.evaluate(() => ({ n: listWines().length, ok: listWines().every(w => ['rouge', 'blanc'].includes(w.couleur)) }));
  ok('rouge + blanc : les choix d’un groupe s’additionnent', f2.ok && f2.n > f1.n, JSON.stringify(f2));
  await p.click('.sheet [data-act=cfToggle][data-g=st][data-v=apogee]'); await p.waitForTimeout(200);
  const f3 = await p.evaluate(() => ({ n: listWines().length, ok: listWines().every(w => ['rouge', 'blanc'].includes(w.couleur) && status(w) === 'apogee'), zero: document.querySelectorAll('.sheet .chip.zero').length }));
  ok('avec Apogée : les groupes se combinent', f3.ok && f3.n <= f2.n, JSON.stringify(f3));
  ok('puces sans résultat estompées', f3.zero > 0);
  await p.screenshot({ path: D + '212-filtres.png' });
  await p.click('.sheet .btn.primary[data-act=close]'); await p.waitForTimeout(300);
  const bar = await p.evaluate(() => ({ chips: document.querySelectorAll('header .factive .chip').length, badge: document.querySelector('header .fbtn b')?.textContent }));
  ok('barre : 3 filtres actifs et le nombre sur le bouton', bar.chips === 3 && bar.badge === '3', JSON.stringify(bar));
  await p.screenshot({ path: D + '213-liste-filtree.png' });
  await p.click('header .factive [data-g=st]'); await p.waitForTimeout(150);
  ok('toucher une puce la retire', await p.evaluate(() => !caveF.st.size && document.querySelectorAll('header .factive .chip').length === 2));
  await p.click('[data-act=caveMode][data-m=plan]'); await p.click('[data-act=caveMode][data-m=liste]');
  ok('filtres gardés entre Plan et Liste', await p.evaluate(() => caveF.col.size === 2));
  await p.click('header [data-act=cfClear]'); await p.waitForTimeout(150);
  ok('Tout effacer', await p.evaluate(() => cfCount() === 0 && listWines().length === listBase().length && !!document.querySelector('header .factive .tiny')));
  // Millésimes : chaque vin daté tombe dans une tranche
  ok('tranches de millésimes couvrant la cave', await p.evaluate(() => { const ws = listBase(), ks = yBuckets(ws); return ws.every(w => ks.filter(k => yTest(k, w.millesime)).length === 1); }));
  // Recherche + filtre combinés
  await p.evaluate(() => { caveF.col.add('rouge'); caveQuery = 'bordeaux'; render(); });
  ok('recherche et filtres se combinent', await p.evaluate(() => listWines().length > 0 && listWines().every(w => w.couleur === 'rouge' && matcher('bordeaux')(w))));
  await p.evaluate(() => { caveF.col.clear(); caveQuery = ''; caveSearchOpen = false; caveMode = 'plan'; render(); });

  /* ---------- Barres d'apogée dans les listes ---------- */
  const t = await p.evaluate(() => {
    const ville = S.sites.find(s => s.role !== 'stock'), camp = S.sites.find(s => s.role === 'stock'), y = thisYear();
    const bs = S.bottles.filter(b => b.state === 'cave' && siteOfBottle(b) === camp.id && wine(b.wineId).kind === 'vin' && wine(b.wineId).apogee?.fin);
    const spirit = S.bottles.find(b => b.state === 'cave' && wine(b.wineId).kind === 'spirit' && siteOfBottle(b) === camp.id) || S.bottles.find(b => b.state === 'cave' && wine(b.wineId).kind === 'spirit');
    const nw = { id: uid(), kind: 'vin', domaine: 'Domaine Sans Fenêtre', appellation: 'Test', couleur: 'rouge', millesime: y - 1, format: '75', createdAt: Date.now() };
    S.wines.push(nw); const [nb] = createBottles(nw, 1, { spaceId: siteSpaces(camp.id)[0].id });
    transferAdd([bs[0].id, nb, spirit.id], spirit && siteOfBottle(spirit) === ville.id ? camp.id : ville.id);
    if (siteOfBottle(spirit) === ville.id) transferAdd([spirit.id], camp.id);
    ACT.transferSheet(); return { known: bs[0].id, none: nb, spirit: spirit.id, a: wine(bs[0].wineId).apogee };
  });
  await p.waitForTimeout(300);
  const w1 = await p.evaluate(t => {
    const row = id => document.querySelector(`.sheet [data-act=tBrief][data-b="${id}"]`);
    const k = row(t.known)?.querySelector('.win'), n = row(t.none)?.querySelector('.win'), s = row(t.spirit)?.querySelector('.win');
    const [f, to] = listScale(), now = parseFloat(k?.querySelector('.now')?.style.left), exp = (thisYear() + new Date().getMonth() / 12 - f) / (to - f) * 100;
    return { scale: document.querySelector('.sheet .winscale')?.textContent, known: !!k?.querySelector('.w'), none: !!n && !n.querySelector('.w'), spirit: !!row(t.spirit) && !s, now, exp, sugg: document.querySelectorAll('.sheet [data-act=tAdd]').length && [...document.querySelectorAll('.sheet [data-act=tAdd]')].every(x => x.closest('.li').querySelector('.win') || wine(byId(S.bottles, x.dataset.ids.split(',')[0]).wineId).kind === 'spirit') };
  }, t);
  ok('transferts : échelle commune rappelée en tête', /\d{4}.*\d{4}/.test(w1.scale || ''), w1.scale);
  ok('transferts : barre avec fenêtre et trait d’aujourd’hui bien placé', w1.known && Math.abs(w1.now - w1.exp) < 0.5, `${w1.now} / ${w1.exp}`);
  ok('vin sans fenêtre : barre grise vide ; spiritueux : pas de barre', w1.none && w1.spirit, JSON.stringify(w1));
  ok('suggestions : barre d’apogée sur chaque vin', !!w1.sugg);
  await p.screenshot({ path: D + '214-transferts.png' });
  await p.evaluate(() => { closeSheet(); ACT.adviceSheet(); }); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const rows = [...document.querySelectorAll('.sheet [data-act=adviceGo]')].map(x => x.closest('.li'));
    return { n: rows.length, bars: rows.filter(r => r.querySelector('.win')).length, scale: !!document.querySelector('.sheet .winscale') }; });
  ok('conseils de rangement : une barre par conseil et l’échelle', a.n > 0 && a.bars === a.n && a.scale, JSON.stringify(a));
  await p.screenshot({ path: D + '215-conseils.png' });
  await p.evaluate(() => closeSheet());

  /* ---------- Performance : cave de 500 bouteilles ---------- */
  const perf = await p.evaluate(() => {
    const sp = visibleSpaces()[0], u = { id: uid(), order: S.units.length, type: 'rack', name: 'Grand rack', rows: 20, cols: 25, spaceId: sp.id }; S.units.push(u);
    const w = S.wines.find(x => x.kind === 'vin'); let n = 0;
    for (let r = 0; r < 20; r++) for (let c = 0; c < 25; c++) { const [id] = createBottles(w, 1, { spaceId: sp.id }); Object.assign(byId(S.bottles, id), { unitId: u.id, r, c }); n++; }
    view = 'cave'; caveMode = 'plan'; render();
    const t0 = performance.now(); for (let i = 0; i < 5; i++) render(); const ms = (performance.now() - t0) / 5;
    const svg = document.querySelector(`.umini[data-u="${u.id}"] svg`), bx = svg.getBoundingClientRect();
    return { ms: Math.round(ms), n, w: bx.width, h: bx.height };
  });
  ok('500 bouteilles de plus : plan rendu rapidement', perf.ms < 300, perf.ms + ' ms');
  ok('grande grille réduite pour tenir dans la barre', perf.w <= 106 && perf.h <= 42, JSON.stringify(perf));

  ok('aucune erreur', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
