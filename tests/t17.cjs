// v2.0 : statistiques, valeur estimée, cadeaux, audit de cave (réponses de l'IA simulées)
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [], calls = [];
  let dialogs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()), schema = body.output_config?.format?.schema, sys = (body.system || []).map(s => s.text).join('\n');
    let text;
    if (schema?.properties?.synthese) { calls.push('audit'); text = JSON.stringify({ synthese: 'Cave équilibrée, un peu trop de rouges.', constats: ['Beaucoup de vins arrivent en fin de fenêtre cette année.', 'Peu de blancs de garde.', 'Années creuses à prévoir.'], achats: [{ quoi: 'Chablis premier cru', millesimes: '2022, 2023', budget: '30 à 40 €', pourquoi: 'Rééquilibrer vers les blancs de garde.' }] }); }
    else if (/marché du vin/.test(sys)) { calls.push('valeur'); text = 'Recherche faite.\n```json\n{"valeur": 42.5, "min": 38, "max": 48, "justification": "Cote stable chez les cavistes.", "confiance": "moyenne"}\n```'; }
    else text = 'OK';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 2000, output_tokens: 400 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  await p.evaluate(() => { S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; });
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');

  /* Statistiques */
  await p.click('[data-act=go][data-v=plus]'); await p.waitForTimeout(150);
  await p.click('[data-act=statsSheet]'); await p.waitForTimeout(250);
  const st = await p.evaluate(() => {
    const mine = S.bottles.filter(b => inCave(b) && !b.owner).length, vins = S.bottles.filter(b => inCave(b) && !b.owner && wine(b.wineId).kind === 'vin').length;
    const sumOf = pre => [...statsLists].filter(([k]) => k.startsWith(pre + ':')).length;
    const cardSum = title => { const c = [...document.querySelectorAll('.sheet .card')].find(x => x.querySelector('.ct')?.textContent.startsWith(title)); return c ? [...c.querySelectorAll('.hn')].reduce((t, x) => t + +x.textContent, 0) : -1; };
    return { mine, vins, coul: cardSum('Par couleur'), stat: cardSum('Par statut'), ou: cardSum('Par emplacement'), friends: S.bottles.filter(b => inCave(b) && b.owner).length, head: document.querySelector('.sheet .score').textContent };
  });
  ok('statistiques : totaux égaux à mes bouteilles (amis exclus)', st.coul === st.mine && st.stat === st.vins && st.ou === st.mine && st.friends > 0 && +st.head === st.mine, JSON.stringify(st));
  await p.screenshot({ path: D + '170-stats.png' });
  await p.click('.sheet .hbr >> nth=0'); await p.waitForTimeout(150);
  ok('toucher une barre : liste des vins concernés', await p.evaluate(() => document.querySelectorAll('.sheet .li[data-act=wine]').length > 0));
  await p.click('.sheet [data-act=sheetback]'); await p.waitForTimeout(150);

  /* Valeur */
  const w = await p.evaluate(() => { const w = S.wines.find(x => x.kind === 'vin' && myBottles(x.id).length && x.achat?.prix); return { id: w.id, prix: w.achat.prix, n: myBottles(w.id).length }; });
  const v0 = await p.evaluate(() => caveValue());
  await p.evaluate(id => { closeSheet(); showSheet(() => wineSheet(id)); }, w.id); await p.waitForTimeout(150);
  ok('fiche vin : carte « Valeur actuelle »', /Valeur actuelle/.test(await sheet()));
  await p.click('.sheet [data-act=valueEstimate]'); await p.waitForTimeout(500);
  const v1 = await p.evaluate(id => ({ v: wine(id).valeur, total: caveValue() }), w.id);
  ok('estimation du sommelier : 42,50 € (fourchette, source, date)', v1.v?.v === 42.5 && v1.v.min === 38 && v1.v.max === 48 && v1.v.src === 'ia' && v1.v.at, JSON.stringify(v1.v));
  ok('valeur de la cave : la valeur estimée remplace le prix d’achat', Math.abs(v1.total.total - (v0.total - w.n * w.prix + w.n * 42.5)) < 0.01, `${v0.total} → ${v1.total.total}`);
  ok('écart avec le prix d’achat affiché', /par rapport au prix d’achat/.test(await sheet()));
  await p.click('.sheet [data-act=valueEdit]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=v]', '50'); await p.click('.sheet form [type=submit]'); await p.waitForTimeout(250);
  ok('valeur saisie à la main', await p.evaluate(id => wine(id).valeur.v === 50 && wine(id).valeur.src === 'manuel', w.id));
  // Estimation groupée : coût annoncé
  await p.evaluate(() => { closeSheet(); ACT.valueBatch(); }); await p.waitForTimeout(150);
  ok('estimation groupée : coût annoncé avant de lancer', /Coût indicatif/.test(await sheet()) && /il te reste/.test(await sheet()));
  const todo = await p.evaluate(() => valueTodo().length);
  await p.click('.sheet [data-act=valueBatchGo]'); await p.waitForTimeout(400 + todo * 120);
  ok('estimation groupée terminée', await p.evaluate(() => !valueTodo().length) && /Estimation terminée/.test(await sheet()), todo + ' vins');
  await p.evaluate(() => closeSheet());

  /* Cadeaux */
  const g = await p.evaluate(() => {
    const w = S.wines.find(x => x.kind === 'vin' && myBottles(x.id).length >= 2); w.cadeau = { de: 'Paul' };
    return { w: w.id, ids: myBottles(w.id).slice(0, 2).map(b => b.id) };
  });
  await p.evaluate(id => showSheet(() => outSheet(id)), g.ids[0]); await p.waitForTimeout(150);
  await p.click('.sheet label.chip:has(input[value=offerte])'); await p.fill('.sheet input[name=who]', 'Léa'); await p.fill('.sheet input[name=plat]', 'Anniversaire');
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(250);
  dialogs = [];
  await p.evaluate(id => { closeSheet(); showSheet(() => outSheet(id)); }, g.ids[1]); await p.waitForTimeout(150);
  await p.click('.sheet label.chip:has(input[value=offerte])'); await p.fill('.sheet input[name=who]', 'léa');
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(250);
  ok('offrir deux fois le même vin à Léa : l’app le signale', dialogs.some(x => /déjà offert ce vin à léa/i.test(x)), dialogs.join(' | '));
  await p.evaluate(() => { closeSheet(); ACT.giftsSheet(); }); await p.waitForTimeout(150);
  const gl = await sheet();
  ok('Cadeaux : Paul (reçu) et Léa (offerts)', /Paul/.test(gl) && /vin reçu/.test(gl) && /Léa/.test(gl) && /2 bouteilles offertes/.test(gl), gl.slice(0, 200));
  await p.fill('.sheet input[data-in=giftFind]', 'lé'); await p.waitForTimeout(100);
  ok('recherche par prénom', await p.evaluate(() => { const t = document.querySelector('#gift-list').textContent; return /Léa/.test(t) && !/Paul/.test(t); }));
  await p.click('.sheet [data-act=giftPerson]'); await p.waitForTimeout(150);
  ok('fiche de Léa : ce que tu lui as offert', /Tu lui as offert/.test(await sheet()) && /Anniversaire/.test(await sheet()));
  await p.screenshot({ path: D + '171-cadeaux.png' });
  await p.evaluate(() => closeSheet());

  /* Audit */
  await p.click('[data-act=go][data-v=boire]'); await p.waitForTimeout(150);
  await p.click('.view [data-act=auditSheet]'); await p.waitForTimeout(200);
  const a0 = await sheet();
  ok('audit : bilan calculé sans IA (calendrier, équilibre)', /Calendrier de maturité/.test(a0) && /Équilibre/.test(a0) && !calls.includes('audit'));
  await p.click('.sheet [data-act=auditRun]'); await p.waitForTimeout(500);
  const a1 = await sheet();
  ok('audit : lecture du sommelier (synthèse, constats, achats)', /Cave équilibrée/.test(a1) && /Chablis premier cru/.test(a1) && calls.filter(x => x === 'audit').length === 1);
  ok('audit conservé et daté', await p.evaluate(() => !!S.audit?.at && S.audit.ai.constats.length === 3));
  await p.screenshot({ path: D + '172-audit.png', fullPage: false });
  const c = await p.evaluate(() => { const c = auditCalc(); return { n: c.n, mine: S.bottles.filter(b => inCave(b) && !b.owner && wine(b.wineId).kind === 'vin').length, cal: c.cal.length }; });
  ok('audit : seules mes bouteilles de vin', c.n === c.mine && c.cal === 12, JSON.stringify(c));
  await p.evaluate(() => { closeSheet(); }); await p.click('[data-act=go][data-v=somm]'); await p.waitForTimeout(150);
  ok('sommelier : raccourci « Audit de ma cave »', !!(await p.$('.view [data-act=auditSheet]')) || await p.evaluate(() => S.chat.length > 0));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
