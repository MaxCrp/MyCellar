// v1.7.3 : bouteilles sorties à noter, changement de site en glissant
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

  /* Reprise des sorties récentes (une seule fois, 30 jours) */
  const mig = await p.evaluate(() => {
    const d = structuredClone(S); d.settings.todoInit = false;
    const w = d.wines.find(x => !x.owner && x.kind === 'vin'), mk = (days, motif) => {
      const at = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10), b = { id: uid(), wineId: w.id, state: 'out', outAt: at, addedAt: at };
      d.bottles.push(b); d.moves.push({ id: uid(), at, ts: Date.now(), wineId: w.id, bottleId: b.id, type: 'out', motif }); return b.id;
    };
    const r = { recent: mk(10, 'bue'), old: mk(45, 'bue'), gift: mk(5, 'offerte') };
    const n = normalize(d), f = id => !!n.bottles.find(x => x.id === id).ficheTodo;
    return { recent: f(r.recent), old: f(r.old), gift: f(r.gift), flag: n.settings.todoInit };
  });
  ok('reprise : bue il y a 10 jours → à noter ; 45 jours ou offerte → non', mig.recent && !mig.old && !mig.gift && mig.flag, JSON.stringify(mig));

  /* Trois sorties « Plus tard » et une « Sortir sans fiche » */
  await p.evaluate(() => { for (const b of S.bottles) b.ficheTodo = false; render(); });
  const ids = await p.evaluate(() => S.bottles.filter(b => b.state === 'cave' && !isFriend(wine(b.wineId)) && wine(b.wineId).kind === 'vin').slice(0, 4).map(b => b.id));
  for (let k = 0; k < 4; k++) {
    await p.evaluate(id => showSheet(() => outSheet(id)), ids[k]); await p.waitForTimeout(120);
    await p.fill('.sheet input[name=plat]', 'Plat ' + k); await p.fill('.sheet input[name=who]', 'Léa');
    await p.click('.sheet form [type=submit]'); await p.waitForTimeout(250);
    if (k === 0) ok('après la sortie : Note rapide, Fiche complète, Plus tard, Sortir sans fiche', await p.evaluate(() => ['Note rapide', 'Fiche complète', 'Plus tard', 'Sortir sans fiche'].every(x => document.querySelector('.sheet').textContent.includes(x))));
    if (k < 3) await p.click('.sheet [data-act=close]'); else await p.click('.sheet [data-act=todoSkip]');
    await p.waitForTimeout(200);
  }
  const td = await p.evaluate(ids => ({ todo: todoBottles().map(b => b.id), last: byId(S.bottles, ids[3]).ficheTodo }), ids);
  ok('les trois bouteilles « Plus tard » sont toutes dans « À noter »', ids.slice(0, 3).every(id => td.todo.includes(id)) && td.todo.length === 3, td.todo.length + ' à noter');
  ok('« Sortir sans fiche » : pas dans la liste', td.last === false);
  await p.click('[data-act=go][data-v=deg]'); await p.waitForTimeout(200);
  ok('Dégustations : carte « 3 bouteilles sorties à noter »', /3 bouteilles sorties à noter/.test(await p.evaluate(() => document.querySelector('.view').textContent)));
  await p.screenshot({ path: D + '140-a-noter.png' });
  await p.click('.view [data-act=todoList]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '141-liste-a-noter.png' });
  // Note rapide : contexte de la sortie prérempli
  await p.click(`.sheet [data-act=todoPick][data-b="${ids[0]}"]`); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=taste][data-m=quick]'); await p.waitForTimeout(250);
  const ctxT = await p.evaluate(id => ({ at: draft.taste.at, outAt: byId(S.bottles, id).outAt, plat: draft.taste.plat, conv: draft.taste.convives, bottle: draft.taste.bottleId }), ids[0]);
  ok('note rapide : date, plat et convives de la sortie', ctxT.at === ctxT.outAt && ctxT.plat === 'Plat 0' && ctxT.conv === 'Léa' && ctxT.bottle === ids[0], JSON.stringify(ctxT));
  await p.click('.sheet [data-act=tasteSave]'); await p.waitForTimeout(300);
  ok('note enregistrée : la bouteille quitte la liste', await p.evaluate(id => !byId(S.bottles, id).ficheTodo && S.tastings.some(t => t.bottleId === id), ids[0]));
  // Fiche complète
  await p.evaluate(() => ACT.todoList()); await p.waitForTimeout(150);
  await p.click(`.sheet [data-act=todoPick][data-b="${ids[1]}"]`); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=taste][data-m=full]'); await p.waitForTimeout(250);
  ok('fiche complète ouverte', await p.evaluate(() => draft?.taste?.mode === 'full'));
  await p.click('.sheet [data-act=tasteSave]'); await p.waitForTimeout(300);
  ok('fiche complète enregistrée', await p.evaluate(id => !byId(S.bottles, id).ficheTodo && S.tastings.some(t => t.bottleId === id && t.full), ids[1]));
  // Sans fiche, depuis la liste : retour à la liste
  await p.evaluate(() => ACT.todoList()); await p.waitForTimeout(150);
  await p.click(`.sheet [data-act=todoPick][data-b="${ids[2]}"]`); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=todoSkip]'); await p.waitForTimeout(250);
  ok('« Sans fiche » : retour à la liste, désormais vide', /Rien à noter/.test(await sheet()) && await p.evaluate(() => !todoBottles().length));
  await p.evaluate(() => closeSheet());

  /* Rappel du lendemain */
  await p.evaluate(ids => { const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); for (const id of ids.slice(0, 2)) { const b = byId(S.bottles, id); b.ficheTodo = true; b.outAt = y; } delete S.dismissed.todoDay; }, ids);
  await p.click('[data-act=go][data-v=cave]'); await p.waitForTimeout(200);
  ok('bannière : « 2 bouteilles sorties à noter »', /2 bouteilles sorties à noter/.test(await p.evaluate(() => document.querySelector('.view').textContent)));
  await p.click('.view [data-act=rateLater]'); await p.waitForTimeout(200);
  ok('« Plus tard » : bannière masquée, liste intacte', await p.evaluate(() => !document.querySelector('[data-act=rateLater]') && todoBottles().length === 2));
  await p.evaluate(() => { delete S.dismissed.todoDay; render(); }); await p.waitForTimeout(100);
  await p.click('.view [data-act=rateNow]'); await p.waitForTimeout(200);
  ok('« Noter » avec plusieurs bouteilles : la liste s’ouvre', /À noter/.test(await sheet()));
  await p.click('.sheet [data-act=todoSkipAll]'); await p.waitForTimeout(250);
  ok('« Tout passer sans fiche » (avec confirmation)', await p.evaluate(() => !todoBottles().length));

  /* Changer de site en glissant */
  await p.evaluate(() => { const s = { id: uid(), name: 'Bureau', role: 'conso' }; S.sites.push(s); S.spaces.push({ id: uid(), siteId: s.id, name: 'Placard', use: 'conso', q: {} }); S.settings.site = S.sites[0].id; caveMode = 'plan'; render(); });
  const swipe = (sel, dx, dy = 0) => p.evaluate(({ sel, dx, dy }) => new Promise(res => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = Math.max(r.top + 20, Math.min(innerHeight - 120, r.top + r.height / 2));
    const T = (xx, yy) => new Touch({ identifier: 1, target: el, clientX: xx, clientY: yy });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [T(x, y)], changedTouches: [T(x, y)], bubbles: true }));
    setTimeout(() => { el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T(x + dx, y + dy)], bubbles: true })); setTimeout(res, 250); }, 120);
  }), { sel, dx, dy });
  const cur = () => p.evaluate(() => S.sites.findIndex(s => s.id === S.settings.site));
  await swipe('.view', -150); const a1 = await cur();
  await swipe('.view', -150); const a2 = await cur();
  await swipe('.view', -150); const a3 = await cur();
  ok('glisser vers la gauche : site suivant, puis retour au premier', a1 === 1 && a2 === 2 && a3 === 0, [a1, a2, a3].join('→'));
  await swipe('.view', 150); ok('glisser vers la droite : site précédent', await cur() === 2);
  ok('points sous le titre', await p.evaluate(() => document.querySelectorAll('.sdots i').length === 3 && document.querySelectorAll('.sdots i.on').length === 1));
  await p.screenshot({ path: D + '142-glisser.png' });
  const before = await cur();
  await swipe('.view', -40, -220); ok('geste vertical : pas de changement', await cur() === before);
  await p.evaluate(() => { const st = S.sites.find(s => s.role === 'stock'); S.settings.site = st.id; S.units.push({ id: uid(), order: 0, type: 'rack', name: 'Grand rack', spaceId: siteSpaces(st.id)[0].id, rows: 3, cols: 16 }); render(); });
  const wide = await p.$('.view .rack-scroll');
  if (wide) { const w0 = await cur(); await swipe('.view .rack-scroll', -150); ok('geste dans un meuble large : pas de changement', await cur() === w0); }
  else ok('meuble large présent sur le plan', false);
  await p.evaluate(() => { caveMode = 'liste'; render(); }); const l0 = await cur(); await swipe('.view', -150);
  ok('mode Liste : pas de changement', await cur() === l0);
  await p.evaluate(() => { caveMode = 'plan'; render(); ACT.transferSheet(); }); const s0 = await cur(); await swipe('.view', -150);
  ok('fenêtre ouverte : pas de changement', await cur() === s0);
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
