// v2.1.7 : cave à variation saisonnière (température lente, mini et maxi de l'année)
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

  // Qualité calculée
  const q = await p.evaluate(() => {
    const base = { humid: 'ok', light: 'sombre', vib: 'non' }, Q = (temp, tmin, tmax) => qualityLabel(spaceQuality({ q: { ...base, temp }, tmin, tmax }));
    return { ex: Q('saison', 5, 23), sNone: spaceQuality({ q: { temp: 'saison' } }), s18: Q('saison', 8, 18), s21: spaceQuality({ q: { temp: 'saison' }, tmax: 21 }), s26: spaceQuality({ q: { temp: 'saison' }, tmax: 26 }),
      stable: Q('stable'), stableHot: spaceQuality({ q: { temp: 'stable' }, tmax: 20 }), rapide: Q('variable', 5, 23), opts: Object.keys(QUALITY.temp.opts) };
  });
  ok('trois choix de température', q.opts.join() === 'stable,saison,variable', q.opts.join());
  ok('exemple 5–23 °C, humidité bonne, noir, sans vibrations : « Bonne »', q.ex === 'Bonne', q.ex);
  ok('saisonnière : 2 points jusqu’à 18 °C, 1,5 jusqu’à 21, 1 sans maxi, 0,5 au-delà de 24', q.s18 === 'Excellente' && q.s21 === 1.5 && q.sNone === 1 && q.s26 === 0.5, JSON.stringify(q));
  ok('stable : 2 points, 1 si le maxi dépasse 18 °C', q.stable === 'Excellente' && q.stableHot === 1);
  ok('variable rapidement : moins bien noté qu’une cave saisonnière', q.rapide === 'Moyenne');

  // Formulaire de l'espace
  const sid = await p.evaluate(() => { const sp = S.spaces.find(s => s.use === 'garde'); ACT.sitesSheet(); showSheet(() => spaceSheet(sp.id)); return sp.id; });
  await p.waitForTimeout(250);
  ok('le formulaire propose mini et maxi', await p.evaluate(() => !!document.querySelector('.sheet input[name=tmin]') && !!document.querySelector('.sheet input[name=tmax]')));
  await p.selectOption('.sheet select[name=q_temp]', 'saison'); await p.selectOption('.sheet select[name=q_humid]', 'ok');
  await p.selectOption('.sheet select[name=q_light]', 'sombre'); await p.selectOption('.sheet select[name=q_vib]', 'non');
  await p.fill('.sheet input[name=tmin]', '25'); await p.fill('.sheet input[name=tmax]', '23');
  await p.click('.sheet form[data-form=space] [type=submit]'); await p.waitForTimeout(450);
  ok('mini supérieur au maxi : refusé', await p.evaluate(() => /au moins égal au mini/.test(document.querySelector('.sheet').textContent)));
  await p.fill('.sheet input[name=tmin]', '60'); await p.click('.sheet form[data-form=space] [type=submit]'); await p.waitForTimeout(450);
  ok('hors de −10 à 40 °C : refusé', await p.evaluate(() => /Entre −10 et 40/.test(document.querySelector('.sheet').textContent)));
  await p.fill('.sheet input[name=tmin]', '5'); await p.fill('.sheet input[name=tmax]', '23,0');
  await p.screenshot({ path: D + '240-cave-saisonniere.png' });
  await p.click('.sheet form[data-form=space] [type=submit]'); await p.waitForTimeout(450);
  const sp = await p.evaluate(id => { const s = space(id); return { temp: s.q.temp, tmin: s.tmin, tmax: s.tmax, label: qualityLabel(spaceQuality(s)), list: document.querySelector('.sheet')?.textContent || '' }; }, sid);
  ok('enregistré : saisonnière, 5 et 23 °C', sp.temp === 'saison' && sp.tmin === 5 && sp.tmax === 23, JSON.stringify(sp).slice(0, 120));
  ok('réglages : « qualité bonne »', sp.label === 'Bonne' && sp.list.includes('qualité bonne'));
  // Rouvrir : valeurs reprises
  await p.evaluate(id => showSheet(() => spaceSheet(id)), sid); await p.waitForTimeout(200);
  ok('valeurs reprises à la réouverture', await p.evaluate(() => document.querySelector('.sheet input[name=tmin]').value === '5' && document.querySelector('.sheet input[name=tmax]').value === '23' && document.querySelector('.sheet select[name=q_temp]').value === 'saison'));
  await p.fill('.sheet input[name=tmin]', ''); await p.fill('.sheet input[name=tmax]', ''); await p.click('.sheet form[data-form=space] [type=submit]'); await p.waitForTimeout(450);
  ok('mini et maxi facultatifs (effacés)', await p.evaluate(id => space(id).tmin == null && space(id).tmax == null, sid));
  await p.evaluate(id => { Object.assign(space(id), { tmin: 5, tmax: 23 }); closeSheet(); }, sid);

  // Sommelier : fiche et consigne
  const ai = await p.evaluate(id => { const w = S.wines.find(x => x.kind === 'vin' && wineBottles(x.id).some(b => b.spaceId === id)); return { brief: wineBrief(w), sys: APO_SYS }; }, sid);
  ok('fiche du vin : « Variable lentement, au fil des saisons, de 5 à 23 °C »', ai.brief.includes('Variable lentement, au fil des saisons, de 5 à 23 °C'), (ai.brief.match(/Stockage.*/) || [''])[0]);
  ok('consigne : variation lente, temps au-dessus de 20 °C, risques au-delà de 25 °C ou sous 0 °C', /variation de température lente/.test(ai.sys) && /20 °C/.test(ai.sys) && /25 °C/.test(ai.sys) && /0 °C/.test(ai.sys));

  // Ancien « Variable » et données importées douteuses
  const old = await p.evaluate(() => { const d = normalize({ sites: [{ id: 's', name: 'X', role: 'conso' }], spaces: [{ id: 'a', siteId: 's', name: 'A', q: { temp: 'variable' } }, { id: 'b', siteId: 's', name: 'B', q: {}, tmin: '<b>', tmax: 99 }, { id: 'c', siteId: 's', name: 'C', q: {}, tmin: 20, tmax: 10 }] });
    const [a, b2, c] = d.spaces; return { a: QUALITY.temp.opts[a.q.temp], b: [b2.tmin, b2.tmax], c: [c.tmin, c.tmax] }; });
  ok('ancien « Variable » relu comme « Variable rapidement »', old.a.startsWith('Variable rapidement'), old.a);
  ok('valeurs importées invalides oubliées', old.b.every(x => x === undefined) && old.c.every(x => x === undefined), JSON.stringify(old));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
