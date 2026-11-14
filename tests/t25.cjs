// v2.1.8 : réanalyser les apogées de tous les vins d'une cave (sommelier simulé)
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [], calls = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  // Sommelier simulé : réajustement → fin raccourcie d'un an ; estimation groupée → fenêtre fixe
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()), user = body.messages.at(-1).content.map(c => c.text).join(''), sys = body.system.map(s => s.text).join('');
    calls.push({ model: body.model, sys, user, web: !!body.tools, max: body.max_tokens });
    let json;
    if (/fenêtre de dégustation actuelle/.test(sys)) {
      const rows = user.split('\n').filter(l => /^#\d+ \|/.test(l));
      json = { resume: 'Cave plus chaude l’été : fins avancées d’un an.', items: rows.map(l => { const i = +l.match(/^#(\d+)/)[1], m = l.match(/fenêtre (\d+|\?)-(\d+|\?)-(\d+)/);
        const deb = m[1] === '?' ? null : +m[1], pic = m[2] === '?' ? null : +m[2], fin = +m[3];
        return / Domaine Lot 0 \|/.test(l) ? { i, debut: deb || fin - 3, pic: pic || fin - 1, fin } : { i, debut: deb || fin - 3, pic: pic || fin - 2, fin: fin - 1 }; }) };
    } else {
      const n = (user.match(/^#\d+$/gm) || []).length; json = { items: Array.from({ length: n }, (_, i) => ({ i, debut: 2026, pic: 2029, fin: 2033 })) };
    }
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 800, output_tokens: 300 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);

  // Une cave de garde peuplée de 90 vins (fenêtres variées), 1 fenêtre saisie à la main, 2 vins sans fenêtre, 1 spiritueux, 1 vin surtout ailleurs
  const t = await p.evaluate(() => {
    S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; S.settings.ai.budget = 0;
    const sp = { id: uid(), siteId: S.sites[0].id, name: 'Cave test', use: 'garde', q: {} }; S.spaces.push(sp); const other = S.spaces[0], y = thisYear(), ids = {};
    const add = (o, n = 1, where = sp.id) => { const w = { id: uid(), kind: 'vin', couleur: 'rouge', format: '75', createdAt: Date.now(), ...o }; S.wines.push(w); createBottles(w, n, { spaceId: where }); return w; };
    for (let i = 0; i < 90; i++) add({ domaine: 'Domaine Lot ' + i, appellation: 'Cornas', millesime: 2010 + (i % 12), apogee: { debut: 2020 + (i % 8), pic: 2025 + (i % 8), fin: 2032 + (i % 8), src: 'ia' } });
    ids.manual = add({ domaine: 'Domaine Manuel', appellation: 'Pauillac', millesime: 2015, apogee: { debut: 2022, pic: 2028, fin: 2040, src: 'manuel' } }).id;
    ids.none = [add({ domaine: 'Domaine Sans', appellation: 'Bandol', millesime: 2020 }).id, add({ domaine: 'Domaine Rien', appellation: 'Cahors', millesime: 2019 }).id];
    ids.spirit = add({ kind: 'spirit', domaine: 'Distillerie', cat: 'whisky' }).id;
    const away = add({ domaine: 'Domaine Ailleurs', appellation: 'Morgon', millesime: 2020, apogee: { debut: 2023, pic: 2026, fin: 2030, src: 'ia' } }, 1); createBottles(away, 3, { spaceId: other.id }); ids.away = away.id;
    // Dernière dégustation d'un des vins
    S.tastings.push({ id: uid(), wineId: S.wines.find(w => w.domaine === 'Domaine Lot 0').id, at: '2026-10-01', note: 16.5, full: { evolution: 'apoint' } });
    sp.q = { temp: 'stable', humid: 'ok', light: 'sombre', vib: 'non' }; delete sp.tmin; delete sp.tmax;
    render(); return { sp: sp.id, ...ids };
  });

  // Plan : quels vins
  const plan = await p.evaluate(t => { const P = reanalPlan(t.sp), all = [...P.adjust, ...P.missing, ...P.upToDate, ...P.manual].map(w => w.id);
    return { adjust: P.adjust.length, missing: P.missing.map(w => w.id), manual: P.manual.map(w => w.id), spirit: all.includes(t.spirit), away: all.includes(t.away) }; }, t);
  ok('vins de la cave principale seulement (spiritueux et vin rangé surtout ailleurs exclus)', !plan.spirit && !plan.away, JSON.stringify(plan).slice(0, 160));
  ok('fenêtre saisie à la main mise à part, vins sans fenêtre repérés', plan.manual.join() === t.manual && t.none.every(x => plan.missing.includes(x)));

  // Modifier les conditions → proposition immédiate
  await p.evaluate(t => { ACT.sitesSheet(); showSheet(() => spaceSheet(t.sp)); }, t); await p.waitForTimeout(300);
  ok('bouton « Réanalyser les apogées des N vins » dans l’espace', await p.evaluate(() => /Réanalyser les apogées des \d+ vins de cet espace/.test(document.querySelector('.sheet').textContent)));
  await p.selectOption('.sheet select[name=q_temp]', 'saison'); await p.fill('.sheet input[name=tmin]', '5'); await p.fill('.sheet input[name=tmax]', '23');
  await p.click('.sheet form[data-form=space] [type=submit]'); await p.waitForTimeout(500);
  const offer = await p.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  ok('conditions modifiées : proposition avec le coût et « Plus tard »', /Conditions modifiées/.test(offer) && /fenêtres à réajuster/.test(offer) && /Coût indicatif/.test(offer) && /Plus tard/.test(offer), offer.replace(/\s+/g, ' ').slice(0, 200));
  ok('la proposition annonce les vins à jour et les saisies à la main', /saisie à la main/.test(offer) && /sans fenêtre/.test(offer));
  const costTxt = (offer.match(/Coût indicatif : (.*?€)/) || [])[1];
  ok('coût annoncé de l’ordre du centime', /moins de 0,01 €|environ 0,0\d/.test(costTxt || ''), costTxt);
  await p.screenshot({ path: D + '250-reanalyse-proposition.png' });

  // Lancer
  const before = await p.evaluate(() => S.usage[monthKey()]?.usd || 0);
  await p.click('.sheet [data-act=reanalGo]'); await p.waitForTimeout(2500);
  const adj = calls.filter(c => /fenêtre de dégustation actuelle/.test(c.sys)), est = calls.filter(c => !/fenêtre de dégustation actuelle/.test(c.sys));
  ok('lots de 40 : 3 appels pour 90 fenêtres', adj.length === 3, adj.map(c => (c.user.match(/^#\d+ \|/gm) || []).length).join('+'));
  ok('modèle économique, sans recherche web', adj.every(c => /haiku/.test(c.model) && !c.web), adj.map(c => c.model).join());
  ok('conditions actuelles écrites une seule fois par lot', adj.every(c => (c.user.match(/Conditions actuelles/g) || []).length === 1 && c.user.includes('Variable lentement, au fil des saisons, de 5 à 23 °C')));
  ok('anciennes conditions regroupées par lettre (pas répétées par vin)', adj.every(c => /^A : /m.test(c.user) && (c.user.match(/Stable \(10–14 °C\)/g) || []).length <= 1), adj[0].user.split('\n').slice(0, 4).join(' / '));
  const per = adj.map(c => { const rows = c.user.split('\n').filter(l => /^#\d+ \|/.test(l)); return Math.max(...rows.map(r => r.length)); });
  ok('une ligne courte par vin (moins de 160 caractères)', per.every(n => n < 160), per.join(','));
  ok('dernière dégustation indiquée sur la ligne du vin', adj.some(c => /dégusté 2026-10 16,5\/20 apoint/.test(c.user)));
  ok('réponse bornée (jetons de sortie proportionnels au lot)', adj.every(c => c.max <= 300 + 40 * 40));
  ok('vins sans fenêtre : estimation groupée habituelle', est.length === 1 && t.none.every(id => true));
  const res = await p.evaluate(t => ({ sheet: document.querySelector('.sheet')?.textContent || '', manual: wine(t.manual).apogee, none: t.none.map(id => wine(id).apogee?.fin), why: S.wines.find(w => w.domaine === 'Domaine Lot 5').apogee.why,
    stamp: S.wines.find(w => w.domaine === 'Domaine Lot 5').apogee.cond === condKey(space(t.sp)), spent: S.usage[monthKey()]?.usd || 0 }), t);
  ok('récapitulatif : fenêtres modifiées et inchangées, explication', /Fenêtres réajustées/.test(res.sheet) && /89 fenêtres modifiées/.test(res.sheet) && /1 inchangée/.test(res.sheet) && /Cave plus chaude/.test(res.sheet), res.sheet.replace(/\s+/g, ' ').slice(0, 160));
  ok('ancienne → nouvelle fenêtre affichée', /→/.test(res.sheet));
  ok('fenêtre saisie à la main non touchée', res.manual.fin === 2040 && res.manual.src === 'manuel');
  ok('vins sans fenêtre estimés', res.none.every(f => f === 2033));
  ok('fiche du vin : « Fenêtre ajustée le … aux conditions de … »', /Fenêtre ajustée le .* aux conditions de « /.test(res.why), res.why);
  ok('coût compté dans le suivi des dépenses', res.spent > before);
  await p.screenshot({ path: D + '251-reanalyse-resultat.png' });

  // Déjà à jour : plus rien à réanalyser, aucun appel
  const n0 = calls.length;
  await p.evaluate(t => { closeSheet(); ACT.reanalSpace({ dataset: { id: t.sp } }); }, t); await p.waitForTimeout(300);
  ok('relancé aussitôt : tout est à jour, aucun appel', await p.evaluate(() => /toutes les fenêtres de cette cave sont à jour/.test(document.querySelector('.sheet').textContent)) && calls.length === n0);
  // Inclure les saisies à la main
  await p.click('.sheet input[data-ch=reanalManual]'); await p.waitForTimeout(200);
  ok('option « inclure les fenêtres saisies à la main »', await p.evaluate(() => /1 fenêtre à réajuster/.test(document.querySelector('.sheet').textContent)));
  await p.evaluate(() => closeSheet());

  // Annuler la dernière réanalyse
  await p.evaluate(() => showSheet(reanalResultSheet)); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=reanalUndo]'); await p.waitForTimeout(300);
  const u = await p.evaluate(() => { const w = S.wines.find(x => x.domaine === 'Domaine Lot 5'); return { fin: w.apogee.fin, src: w.apogee.src, reanal: S.reanal }; });
  ok('« Annuler ces changements » remet les anciennes fenêtres', u.fin === 2032 + 5 && u.reanal === null, JSON.stringify(u));

  // Plafond mensuel atteint : rien n'est envoyé
  const n1 = calls.length;
  await p.evaluate(t => { S.settings.ai.budget = 0.0001; reanalOpts = { manual: false }; showSheet(() => reanalSheet(t.sp)); }, t); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=reanalGo]'); await p.waitForTimeout(800);
  ok('plafond mensuel atteint : arrêt avec un message, aucun appel', calls.length === n1 && await p.evaluate(() => /Plafond mensuel/.test(document.querySelector('.sheet')?.textContent || '')));
  await p.evaluate(() => { closeSheet(); S.settings.ai.budget = 0; });

  // Sans clé
  await p.evaluate(t => { S.settings.ai.key = ''; showSheet(() => spaceSheet(t.sp)); }, t); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=reanalSpace]'); await p.waitForTimeout(300);
  ok('sans clé : invitation à configurer le sommelier', await p.evaluate(() => /Intelligence artificielle|Clé|clé/.test(document.querySelector('.sheet')?.textContent || '')));
  // Données importées : trace de réanalyse invalide ignorée
  ok('trace de réanalyse invalide ignorée à l’import', await p.evaluate(() => normalize({ reanal: { all: 'x' } }).reanal === null));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
