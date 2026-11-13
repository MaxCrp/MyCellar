// Campagne de tests (Playwright) : fuzzing des saisies, doubles appuis, combinaisons inattendues,
// réponses anormales de l'IA, sauvegardes corrompues, affichage étroit, volume, verrouillage.
// Usage : node tests/serve.cjs 8765 & node tests/campagne.cjs   → résumé à l'écran, détail dans tests/shots/campagne.json
const { chromium } = require('playwright');
const fs = require('fs');
const D = __dirname + '/shots/'; fs.mkdirSync(D, { recursive: true });
const URL_ = 'http://localhost:8765/';
const XSS = '<img data-xss src=x>"><b data-xss>x</b>';
const R = [];
const note = (zone, test, ok, detail = '') => { R.push({ zone, test, ok, detail }); console.log(`${ok ? '  ok ' : '  KO '} [${zone}] ${test}${detail ? ' — ' + detail : ''}`); };

let aiMode = 'ok', aiCalls = [];
async function mockAI(page) {
  await page.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() || '{}'); aiCalls.push(body);
    const schema = body.output_config?.format?.schema;
    const reply = (text, extra = {}) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 100 }, ...extra }) });
    if (aiMode === 'net') return route.abort('failed');
    if (aiMode === '401') return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ error: { message: 'invalid x-api-key' } }) });
    if (aiMode === '429') return route.fulfill({ status: 429, headers: cors, body: '{"error":{"message":"rate limited"}}' });
    if (aiMode === '500html') return route.fulfill({ status: 500, headers: cors, body: '<html>oops</html>' });
    if (aiMode === 'refusal') return reply('', { stop_reason: 'refusal', content: [] });
    if (aiMode === 'pause') return reply('', { stop_reason: 'pause_turn' });
    if (aiMode === 'maxtok') return reply('{"message":"tron', { stop_reason: 'max_tokens' });
    if (aiMode === 'badjson') return reply('{"message": "pas fini"');
    if (aiMode === 'empty') return reply('');
    if (schema?.properties?.recos) {
      const ids = [...(body.system || []).map(s => s.text).join('\n').matchAll(/id=(\w+)/g)].map(m => m[1]);
      if (aiMode === 'xss') return reply(JSON.stringify({ message: 'Voici ' + XSS, recos: [{ id: ids[0], role: XSS, raison: XSS, temperature: XSS, carafe: XSS, plat: XSS }], achats: [XSS], relances: [XSS] }));
      if (aiMode === 'badid') return reply(JSON.stringify({ message: 'Choix', recos: [{ id: 'inexistant', role: 'x', raison: 'x', temperature: '', carafe: '', plat: '' }], achats: [], relances: [] }));
      if (aiMode === 'missing') return reply(JSON.stringify({ message: 'Sans recos' }));
      return reply(JSON.stringify({ message: 'Choix', recos: [{ id: ids[0], role: 'Mon choix', raison: 'Bien', temperature: '16 °C', carafe: 'Sans', plat: '' }], achats: [], relances: ['Autre ?'] }));
    }
    if (schema?.properties?.kind) return reply(JSON.stringify(aiMode === 'weird'
      ? { kind: 'biere', couleur: 'violet', domaine: XSS, cuvee: '', appellation: '', region: '', pays: '', millesime: '20xx', cepages: '', degre: 'fort', format: '9999', cat: 'vodka', age: '-3', fut: '' }
      : { kind: 'vin', couleur: 'rouge', domaine: 'Test', cuvee: '', appellation: 'Test', region: '', pays: '', millesime: '2020', cepages: '', degre: '13', format: '75', cat: '', age: '', fut: '' }));
    if (schema?.properties?.changer) return reply(JSON.stringify(aiMode === 'weird' ? { changer: true, debut: 2090, pic: 1500, fin: 2030, justification: XSS } : { changer: false, debut: 0, pic: 0, fin: 0, justification: '' }));
    if (schema?.properties?.vins) {
      const V = o => ({ numero: 0, titre: '', millesime: '', couleur: '', alcool: '', apogee: '', estimation: '', producteur: '', pays: '', region: '', appellation: '', cepages: '', cuvee: '', contenance: '', stock: 0, caves: [], servir: '', accords: '', note: '', ...o });
      return reply(JSON.stringify(aiMode === 'weird'
        ? { caves: [{ nom: XSS, lignes: 999, colonnes: -3, cases: [{ ligne: 1, colonne: 1, numero: 1 }] }, { nom: 'Cave B', lignes: 3, colonnes: 3, cases: [{ ligne: 9, colonne: 9, numero: 1 }, { ligne: 1, colonne: 1, numero: -2 }, { ligne: 2, colonne: 2, numero: 1 }, { ligne: 2, colonne: 2, numero: 3 }] }],
          vins: [V({ numero: 1, titre: XSS, millesime: '2O19', couleur: 'violet', alcool: 'fort', apogee: '2040/2010', estimation: '-9€', note: '999', stock: 999999, caves: [{ nom: XSS, quantite: 999999 }], servir: XSS, accords: XSS }),
            V({ titre: '', caves: [{ nom: 'Cave B', quantite: -4 }] }), V({ numero: 3, titre: 'Ok', millesime: '2018', caves: [{ nom: 'Cave B', quantite: 0 }], contenance: '99 litres' })] }
        : { caves: [], vins: [] }));
    }
    if (schema?.properties?.items?.items?.properties?.couleur) return reply(JSON.stringify({ items: [{ i: 0, couleur: 'rouge', appellation: '', cuvee: '', region: '', pays: '', cepages: '', debut: 3000, pic: -5, fin: 1200 }] }));
    if (schema?.properties?.items) return reply(JSON.stringify({ items: [{ i: 0, debut: 2030, pic: 2020, fin: 2010 }, { i: 99, debut: 1, pic: 1, fin: 1 }] }));
    if (aiMode === 'weird') return reply('Voici : ```json\n{"debut": 2040, "pic": 2025, "fin": 2030, "justification": "' + XSS.replace(/"/g, '\\"') + '"}\n```');
    return reply('```json\n{"debut":2024,"pic":2027,"fin":2032,"justification":"ok","confiance":"moyenne"}\n```');
  });
}
async function newPage(b, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: opts.w || 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage();
  p.__errs = [];
  p.on('pageerror', e => p.__errs.push(e.message));
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(p.__prompt ?? XSS) : d.accept());
  await mockAI(p);
  await p.goto(URL_); await p.waitForTimeout(600);
  if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  return { p, ctx };
}
const demo = async p => { await p.click('[data-act=demo]'); await p.waitForTimeout(300); };
const errs = p => { const e = p.__errs.splice(0); return e.length ? 'erreurs JS : ' + e.join(' | ').slice(0, 300) : ''; };
const xssCount = p => p.evaluate(() => document.querySelectorAll('[data-xss]').length);
const closeAll = async p => { await p.evaluate(() => { draft = null; closeSheet(); }); };
const act = (p, js, arg) => p.evaluate(js, arg);
const setKey = p => p.evaluate(() => { S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; });

(async () => {
  const b = await chromium.launch();
  const t0 = Date.now();

  /* ===== A. Fuzzing des saisies ===== */
  console.log('A. Fuzzing des saisies');
  {
    const { p, ctx } = await newPage(b); await demo(p);
    // A1. Fiche vin avec des valeurs hostiles : refus avec message, ou valeur complétée de façon visible
    const cases = [
      { label: 'quantité négative', qty: '-5', refus: true }, { label: 'quantité texte', qty: 'abc', refus: true }, { label: 'quantité 1e9', qty: '1e9', refus: true },
      { label: 'quantité 0', qty: '0', refus: true }, { label: 'quantité décimale', qty: '2,7', refus: true }, { label: 'millésime 3000', mill: '3000', refus: true },
      { label: 'millésime 1800', mill: '1800', refus: true }, { label: 'millésime texte (confirmé non millésimé)', mill: 'abcd', want: r => r.mill === null },
      { label: 'millésime 2 chiffres « 19 »', mill: '19', want: r => r.mill === 2019 }, { label: 'millésime 2 chiffres « 98 »', mill: '98', want: r => r.mill === 1998 },
      { label: 'prix négatif', prix: '-5', refus: true }, { label: 'prix énorme', prix: '1e12', refus: true }, { label: 'prix « 1.234,50 »', prix: '1.234,50', want: r => r.prix === 1234.5 },
      { label: 'degré 300', degre: '300', refus: true }, { label: 'fenêtre fin < début', adeb: '2035', afin: '2020', refus: true },
      { label: 'apogée hors fenêtre', adeb: '2020', apic: '2050', afin: '2030', refus: true }, { label: 'fenêtre sans fin', adeb: '2024', refus: true },
      { label: 'fenêtre correcte', adeb: '2024', apic: '2027', afin: '2032', want: r => r.apogee?.fin === 2032 && r.apogee?.pic === 2027 },
    ];
    for (const c of cases) {
      const before = await act(p, () => ({ w: S.wines.length, b: S.bottles.length }));
      await p.click('[data-act=add]'); await p.click('.sheet [data-act=addWine]'); await p.click('.sheet [data-act=newWine][data-kind=vin]'); await p.waitForTimeout(80);
      await p.fill('.sheet input[name=domaine]', 'Fuzz ' + c.label); await p.fill('.sheet input[name=appellation]', 'Test');
      if (c.qty) await p.fill('.sheet input[name=qty]', c.qty);
      if (c.mill) await p.fill('.sheet input[name=millesime]', c.mill);
      if (c.prix) await p.fill('.sheet input[name=prix]', c.prix);
      if (c.degre) await p.fill('.sheet input[name=degre]', c.degre);
      if (c.adeb || c.afin) { await p.click('.sheet summary'); if (c.adeb) await p.fill('.sheet input[name=adeb]', c.adeb); if (c.apic) await p.fill('.sheet input[name=apic]', c.apic); if (c.afin) await p.fill('.sheet input[name=afin]', c.afin); }
      await p.click('.sheet [type=submit]'); await p.waitForTimeout(250);
      const msg = await p.$eval('.sheet .ferr', e => e.textContent).catch(() => '');
      if (msg) await closeAll(p);
      else if (await p.$('.sheet [data-act=placeOk]')) await p.click('.sheet [data-act=placeOk]');
      await p.waitForTimeout(150);
      const r = await act(p, b0 => { const w = S.wines.at(-1); return { added: S.bottles.length - b0.b, newWine: S.wines.length > b0.w, mill: w.millesime, prix: w.achat?.prix, apogee: w.apogee }; }, before);
      const e = errs(p);
      const ok = !e && (c.refus ? !!msg && !r.newWine : !msg && r.newWine && c.want(r));
      note('Saisie', 'Fiche vin : ' + c.label, ok, (c.refus ? (msg ? `refusée : « ${msg} »` : `acceptée (${r.added} bouteille(s))`) : msg ? `refusée à tort : « ${msg} »` : JSON.stringify({ mill: r.mill, prix: r.prix, apogee: r.apogee && [r.apogee.debut, r.apogee.pic, r.apogee.fin] })) + (e ? ' · ' + e : ''));
    }
    // A1 bis. Lecture des nombres au format français
    const nums = await act(p, () => [['1 234,50', 1234.5], ['1.234,50', 1234.5], ['1.234', 1234], ['12,5', 12.5], ['12.5', 12.5], ['25 €', 25], ['1,2,3', null], ['abc', null], ['', null]].map(([s, v]) => [s, num(s), v]));
    const badNums = nums.filter(([, got, want]) => got !== want);
    note('Saisie', 'Nombres au format français (9 écritures)', !badNums.length, badNums.map(([s, g, w]) => `« ${s} » → ${g} au lieu de ${w}`).join(' ; '));
    // A2. Injection HTML dans tous les champs texte d'une fiche vin, puis affichage partout
    await p.click('[data-act=add]'); await p.click('.sheet [data-act=addWine]'); await p.click('.sheet [data-act=newWine][data-kind=vin]'); await p.waitForTimeout(80);
    for (const n of ['domaine', 'cuvee', 'appellation', 'region', 'pays', 'cepages', 'lieu', 'offertPar']) await p.fill(`.sheet input[name=${n}]`, XSS);
    await p.click('.sheet summary'); await p.fill('.sheet input[name=owner]', ''); await p.fill('.sheet input[name=short]', XSS); await p.fill('.sheet textarea[name=notes]', XSS);
    await p.click('.sheet [type=submit]'); await p.waitForTimeout(250); if (await p.$('.sheet [data-act=placeOk]')) await p.click('.sheet [data-act=placeOk]');
    let x = 0;
    for (const v of ['cave', 'deg', 'boire', 'somm', 'plus']) { await act(p, vv => { view = vv; render(); }, v); x += await xssCount(p); }
    await act(p, () => { caveMode = 'liste'; render(); }); x += await xssCount(p);
    await act(p, () => showSheet(() => wineSheet(S.wines.at(-1).id))); x += await xssCount(p);
    await act(p, () => { const b0 = S.bottles.find(b => b.wineId === S.wines.at(-1).id); showSheet(() => bottleSheet(b0.id)); }); x += await xssCount(p);
    await closeAll(p);
    note('Sécurité', 'Injection HTML dans la fiche vin (8 vues et fiches)', x === 0, x ? `${x} élément(s) injecté(s) dans la page` : errs(p));
    // A3. Dégustation, séance, arôme personnel, sommelier : injection HTML
    await act(p, () => startTaste(S.wines.at(-1).id, null, 'full'));
    for (const k of ['lieu', 'convives', 'prix', 'achatLieu', 'provenance', 'plat']) { const el = await p.$(`.sheet input[data-k=${k}]`); if (el) await el.fill(XSS); }
    await p.fill('.sheet textarea[data-k=comment]', XSS);
    await p.click('#wheel path[data-act=wfam] >> nth=0'); p.__prompt = XSS; await p.click('#aro-sel [data-act=aroAdd]'); await p.waitForTimeout(150);
    x = await xssCount(p);
    await p.click('.sheet button.btn.primary[data-act=tasteSave]'); await p.waitForTimeout(250); await closeAll(p);
    await act(p, () => { view = 'deg'; render(); }); x += await xssCount(p);
    await act(p, () => showSheet(() => tasteView(S.tastings.at(-1).id))); x += await xssCount(p); await closeAll(p);
    await act(p, () => { S.sessions.push({ id: 'sxss', titre: '<b data-xss>t</b>', type: 'salon', lieu: '<b data-xss>l</b>', date: today(), convives: '<b data-xss>c</b>' }); S.tastings.at(-1).sessionId = 'sxss'; render(); showSheet(() => sessionSheet('sxss')); });
    x += await xssCount(p); await closeAll(p);
    await setKey(p); aiMode = 'xss'; await act(p, () => { view = 'somm'; render(); });
    await p.fill('.composer textarea', XSS); await p.click('.composer .send'); await p.waitForTimeout(600);
    x += await xssCount(p); aiMode = 'ok';
    note('Sécurité', 'Injection HTML : dégustation, arôme personnel, séance, réponse du sommelier', x === 0, x ? `${x} élément(s) injecté(s)` : errs(p));
    // A4. Recherches avec caractères spéciaux
    let bad = [];
    for (const q of ['(', '[', '\\', '.*', '%', '?', '$1', 'é è', '🍷', 'a'.repeat(600), '"><b data-xss>x</b>']) {
      await act(p, () => { view = 'cave'; caveMode = 'plan'; caveSearchOpen = true; render(); });
      await p.fill('input[data-in=caveSearch]', q); await p.waitForTimeout(40);
      await act(p, () => { view = 'deg'; render(); }); await p.fill('input[data-in=degSearch]', q); await p.waitForTimeout(40);
      const e = errs(p); if (e || await xssCount(p)) bad.push(q.slice(0, 10) + ' : ' + (e || 'injection'));
    }
    note('Saisie', 'Recherche (cave, dégustations) : 11 chaînes piégées', !bad.length, bad.join(' ; '));
    await ctx.close();
  }
  {
    const { p, ctx } = await newPage(b); await demo(p);
    // A5. Meubles : dimensions hostiles
    const res = [];
    for (const [rows, cols] of [['0', '5'], ['41', '5'], ['-1', '3'], ['abc', '4'], ['2,5', '3'], ['1e3', '2'], ['40', '40']]) {
      const n0 = await act(p, () => S.units.length);
      await act(p, () => { view = 'cave'; render(); showSheet(() => unitSheet(null, S.spaces[0].id)); });
      await p.fill('.sheet input[name=rows]', rows); await p.fill('.sheet input[name=cols]', cols);
      await p.click('.sheet [type=submit]'); await p.waitForTimeout(200);
      const u = await act(p, n => S.units.length > n ? S.units.at(-1) : null, n0);
      res.push(`${rows}×${cols} → ${u ? u.rows + '×' + u.cols : 'refusé'}`);
      await closeAll(p);
    }
    const t1 = Date.now(); await act(p, () => { caveSpace = S.units.at(-1).spaceId; render(); }); const ms = Date.now() - t1;
    const e = errs(p);
    note('Saisie', 'Meuble : dimensions hostiles', !e && !res.some(r => /^(0|41|-1|abc)/.test(r) && !r.endsWith('refusé')), res.join(' ; ') + ` · affichage d’un meuble 40×40 : ${ms} ms` + (e ? ' · ' + e : ''));
    // A6. Sites et espaces : noms vides ou faits d'espaces, cible négative
    await act(p, () => showSheet(() => siteSheet(S.sites[0].id)));
    await p.fill('.sheet input[name=name]', '    '); await p.click('.sheet [type=submit]'); await p.waitForTimeout(150);
    const nm = await act(p, () => S.sites[0].name), nmMsg = await p.$eval('.sheet .ferr', e => e.textContent).catch(() => ''); await closeAll(p);
    note('Saisie', 'Site : nom composé uniquement d’espaces', nm.trim() !== '' && !!nmMsg, `nom conservé : « ${nm} » · message : « ${nmMsg} »`);
    await act(p, () => showSheet(() => spaceSheet(S.spaces[0].id)));
    await p.fill('.sheet input[name=target]', '-3'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(150);
    const tg = await act(p, () => S.spaces[0].target), tgMsg = await p.$eval('.sheet .ferr', e => e.textContent).catch(() => ''); await closeAll(p);
    note('Saisie', 'Espace : places cibles négatives', !(tg < 0) && !!tgMsg, `cible : ${tg} · message : « ${tgMsg} »`);
    await ctx.close();
  }

  /* ===== B. Doubles appuis ===== */
  console.log('B. Doubles appuis');
  {
    const { p, ctx } = await newPage(b); await demo(p);
    const dbl = async (label, prep, sel, measure) => {
      await prep(); await p.waitForTimeout(150);
      const before = await act(p, measure);
      await p.$eval(sel, el => { el.click(); el.click(); });
      await p.waitForTimeout(600);
      const after = await act(p, measure);
      note('Doubles appuis', label, after - before <= 1, `effet appliqué ${after - before} fois` + (errs(p) ? ' · ' + errs(p) : ''));
      await closeAll(p);
    };
    const wid = await act(p, () => S.wines.find(w => w.kind === 'vin' && !w.owner).id);
    await dbl('« Ajouter » (bouteilles à une fiche) touché deux fois', () => act(p, id => showSheet(() => addBottlesSheet(id)), wid), '.sheet [type=submit]', () => S.bottles.length);
    await dbl('« Confirmer la sortie » touché deux fois', () => act(p, id => showSheet(() => outSheet(S.bottles.find(b => b.wineId === id && b.state === 'cave').id)), wid), '.sheet [type=submit]', () => S.moves.filter(m => m.type === 'out').length);
    await dbl('« Enregistrer la dégustation » touché deux fois', () => act(p, id => startTaste(id, null, 'quick'), wid), '.sheet button.btn.primary[data-act=tasteSave]', () => S.tastings.length);
    await dbl('« Nouveau meuble » validé deux fois', () => act(p, () => showSheet(() => unitSheet(null, S.spaces[0].id))), '.sheet [type=submit]', () => S.units.length);
    await dbl('« Démarrer la séance » touché deux fois', () => act(p, () => showSheet(() => sessionForm(null))).then(() => p.fill('.sheet input[name=titre]', 'Double')), '.sheet [type=submit]', () => S.sessions.length);
    await setKey(p);
    await dbl('Envoi au sommelier touché deux fois', () => act(p, () => { view = 'somm'; render(); }).then(() => p.fill('.composer textarea', 'Un rouge')), '.composer .send', () => S.chat.filter(m => m.role === 'user').length);
    await ctx.close();
  }

  /* ===== C. Combinaisons inattendues ===== */
  console.log('C. Combinaisons inattendues');
  {
    const { p, ctx } = await newPage(b); await demo(p);
    const run = async (label, fn) => { const r = (await act(p, fn).catch(e => ({ crash: e.message }))) || {}; const e = errs(p) + (r.crash ? ' · plantage du scénario : ' + r.crash : ''); return { r, e }; };
    // C1. Supprimer un vin présent dans le transfert, la liste d'envies et une séance
    let { r, e } = await run('', () => {
      const w = S.wines.find(x => x.domaine === 'Nicolas Joly') || S.wines[0];
      const b0 = S.bottles.find(x => x.state === 'cave');
      S.transfer.ids.push(b0.id);
      const victim = wine(b0.wineId);
      S.wishes.push({ id: 'wx', wineId: victim.id, at: today() });
      S.tastings.push({ id: 'tx', wineId: victim.id, at: today(), note: 15, sessionId: S.sessions[0]?.id });
      window.confirm = () => true;
      ACT.delWine({ dataset: { id: victim.id } });
      return { tr: S.transfer.ids.length, wishLeft: S.wishes.filter(x => x.wineId === victim.id).length };
    });
    await p.waitForTimeout(200);
    await act(p, () => { view = 'deg'; render(); showSheet(() => sessionSheet(S.sessions[0].id)); }); await closeAll(p);
    await act(p, () => showSheet(wishSheet)); await closeAll(p);
    await act(p, () => showSheet(transferSheet)); await closeAll(p);
    e = e || errs(p);
    note('Combinaisons', 'Supprimer un vin à la fois dans le transfert, les envies et une séance', !e && !r.crash && !r.wishLeft, r.crash || (r.wishLeft ? `l’envie du vin supprimé reste enregistrée (${r.wishLeft})` : 'envie et transfert nettoyés') + (e ? ' · ' + e : ''));
    // C2. Réduire un rack plein, changer le type d'un meuble, supprimer un meuble plein
    ({ r, e } = await run('', () => {
      const u = S.units.find(x => x.type === 'rack'); const n = S.bottles.filter(b => b.unitId === u.id && inCave(b)).length;
      const tot = S.bottles.filter(inCave).length;
      Object.assign(u, { rows: 1, cols: 2 });
      cleanData(S); render();
      const inUnit = S.bottles.filter(b => b.unitId === u.id && inCave(b)).length, unplaced = S.bottles.filter(b => inCave(b) && b.spaceId === u.spaceId && !b.unitId).length;
      return { n, inUnit, unplaced, tot, after: S.bottles.filter(inCave).length };
    }));
    note('Combinaisons', 'Positions impossibles (meuble réduit hors formulaire) corrigées au chargement', !e && r.after === r.tot && r.inUnit <= 2 && r.unplaced >= r.n - 2, `${r.n} bouteilles dans le meuble → ${r.inUnit} gardées à leur place, ${r.unplaced} « non placées », aucune perdue` + (e ? ' · ' + e : ''));
    // C3. Passer en site unique avec un transfert en cours et un site actuel sur le 2e site
    ({ r, e } = await run('', () => { S.settings.site = S.sites[1].id; S.transfer.ids = S.bottles.filter(inCave).slice(0, 3).map(b => b.id); window.confirm = () => true; return ACT.setMulti({ dataset: { v: '0' } }).then(() => ({ sites: S.sites.length, site: S.settings.site === S.sites[0].id, tr: S.transfer.ids.length })); }));
    await act(p, () => { view = 'cave'; render(); });
    e = e || errs(p);
    note('Combinaisons', 'Passage en site unique avec un transfert en cours', !e && r.site && r.tr === 0, JSON.stringify(r) + (e ? ' · ' + e : ''));
    // C4. Spiritueux désactivés alors qu'il y en a en cave
    ({ r, e } = await run('', () => { S.settings.spirits = false; view = 'cave'; caveMode = 'plan'; render();
      const onPlan = [...document.querySelectorAll('.slot b')].some(x => /Lagavulin|Clément|Glenfarclas/.test(x.textContent)), greyed = document.querySelectorAll('.slot.off').length;
      caveMode = 'liste'; render();
      const inList = [...document.querySelectorAll('.li b')].some(x => /Lagavulin|Clément|Glenfarclas/.test(x.textContent));
      const ctx = caveContext(true).includes('SPIRITUEUX');
      view = 'boire'; render(); const openBlock = !!document.querySelector('.bottle-level');
      return { onPlan, greyed, inList, ctx, openBlock }; }));
    note('Combinaisons', 'Spiritueux désactivés avec des spiritueux en cave', !r.inList && !r.ctx && !r.onPlan && r.greyed > 0, `plan : ${r.onPlan ? 'noms visibles' : r.greyed + ' cases grisées sans nom'} · liste : ${r.inList ? 'visibles' : 'masqués'} · sommelier : ${r.ctx ? 'inclus' : 'exclus'} · bloc « ouverts » : ${r.openBlock ? 'affiché' : 'masqué'}` + (e ? ' · ' + e : ''));
    await act(p, () => { S.settings.spirits = true; caveMode = 'plan'; });
    // C5. Primeur dont l'espace de livraison a été supprimé
    ({ r, e } = await run('', () => { const pr = S.bottles.find(b => b.state === 'primeur'); if (!pr) return { none: true }; pr.delivery.spaceId = 'disparu'; return ACT.receive({ dataset: { b: pr.id } }).then(() => ({ ok: true, placed: !!document.querySelector('.sheet [data-act=placeOk]') })); }));
    await closeAll(p);
    note('Combinaisons', 'Réceptionner un primeur dont l’espace de destination n’existe plus', !e && !r.crash, JSON.stringify(r) + (e ? ' · ' + e : ''));
    // C6. Ranger plus de bouteilles qu'il n'y a de places libres
    ({ r, e } = await run('', () => { const w = S.wines.find(x => x.kind === 'vin' && !x.owner); const sp = S.spaces[0]; const ids = createBottles(w, 120, { spaceId: sp.id }); startPlace(w.id, ids, sp.id, true);
      const sel = draft.place.sel.length, warn = document.querySelector('.sheet .banner')?.textContent.trim().slice(0, 90) || ''; ACT.placeOk(); return { sel, warn, unplaced: S.bottles.filter(b => ids.includes(b.id) && !b.unitId).length }; }));
    await p.waitForTimeout(200); await closeAll(p);
    note('Combinaisons', 'Ranger 120 bouteilles dans un espace presque plein', !e && /manque/.test(r.warn), `${r.sel} places proposées · avertissement : « ${r.warn} »` + (e ? ' · ' + e : ''));
    // C7. Vins des amis jamais envoyés au sommelier
    ({ r, e } = await run('', () => { const f = S.wines.filter(isFriend); return { friends: f.length, leak: f.some(w => caveContext(true).includes(w.id) || caveContext(true).includes(w.domaine)) }; }));
    note('Combinaisons', 'Vins des amis exclus du contexte du sommelier', !r.leak, `${r.friends} vin(s) d’ami testé(s)`);
    // C8. Dégustation à l'aveugle : révélée puis vin supprimé ; mystère en vue par vin et filtres
    ({ r, e } = await run('', () => { const w = S.wines.find(x => x.kind === 'vin');
      S.tastings.push({ id: 'b1', wineId: null, at: today(), note: 12, blind: { kind: 'vin', couleur: 'blanc', hyp: { cepage: '<b data-xss>x</b>' } }, horsCave: true });
      S.tastings.push({ id: 'b2', wineId: w.id, at: today(), note: 13, blind: { kind: 'vin', couleur: w.couleur, hyp: { cepage: 'x', millesime: 'abc', prix: 'cher' }, revealed: true }, horsCave: true });
      view = 'deg'; degMode = 'vin'; render(); degMode = 'journal'; degF.color = 'blanc'; render(); degF.color = null; render();
      showSheet(() => tasteView('b2')); showSheet(() => tasteView('b1')); return { x: document.querySelectorAll('[data-xss]').length }; }));
    await closeAll(p);
    note('Combinaisons', 'Aveugle : hypothèses incohérentes, vin mystère dans les filtres', !e && !r.x && !r.crash, (r.crash || '') + (r.x ? 'injection HTML dans les hypothèses · ' : '') + e);
    // C9. Modifier une dégustation à l'aveugle non révélée
    ({ r, e } = await run('', () => { editTaste('b1'); }));
    await p.waitForTimeout(250); r = await act(p, () => ({ open: !!document.querySelector('.sheet') && draft?.taste?.editId === 'b1', sheet: !!document.querySelector('.sheet'), editId: draft?.taste?.editId, b1: !!byId(S.tastings, 'b1'), stack: sheetStack.length }));
    await closeAll(p);
    note('Combinaisons', 'Modifier une dégustation à l’aveugle non révélée', !e && r.open, e);
    // C10. Fenêtre incohérente : statut et barre
    ({ r, e } = await run('', () => { const w = S.wines.find(x => x.kind === 'vin'); w.apogee = { debut: 2035, pic: 2040, fin: 2020, src: 'manuel' }; cleanData(S); return { a: w.apogee && [w.apogee.debut, w.apogee.pic, w.apogee.fin], st: status(w) }; }));
    note('Combinaisons', 'Fenêtre incohérente déjà enregistrée (2035–2020) : corrigée au chargement', !e && r.a && !(r.a[0] > r.a[2]), `fenêtre après chargement : ${JSON.stringify(r.a)} · statut « ${r.st} »` + (e ? ' · ' + e : ''));
    // C11. Dégustation enregistrée sans toucher au curseur : sans note
    ({ r, e } = await run('', () => { closeSheet(); const w = S.wines.find(x => x.kind === 'vin'); startTaste(w.id, null, 'quick'); draft.taste.comment = 'Sans note'; const hint = !!document.querySelector('#t-hint'); return ACT.tasteSave().then(() => ({ hint, note: S.tastings.at(-1).note })); }));
    await closeAll(p);
    note('Combinaisons', 'Dégustation enregistrée sans toucher au curseur', !e && r.note == null && r.hint, `note enregistrée : ${r.note} · mention « Touche pour noter » : ${r.hint}` + (e ? ' · ' + e : ''));
    // C12. Recommandation du sommelier qui ne correspond plus à la cave
    ({ r, e } = await run('', () => { S.chat = [{ role: 'user', text: 'x' }, { role: 'assistant', data: { message: 'Voici', recos: [{ id: 'disparu', role: 'x', raison: 'x', temperature: '', carafe: '', plat: '' }], achats: [], relances: [] } }]; view = 'somm'; render(); return { txt: [...document.querySelectorAll('.tiny')].map(x => x.textContent).find(t => /ne correspond/.test(t)) || '' }; }));
    note('Combinaisons', 'Recommandation qui ne correspond plus à la cave', !e && !!r.txt, `mention : « ${r.txt} »` + (e ? ' · ' + e : ''));
    await ctx.close();
  }

  /* ===== D. Réponses anormales de l'IA ===== */
  console.log('D. Réponses anormales de l’IA');
  {
    const { p, ctx } = await newPage(b); await demo(p); await setKey(p);
    for (const m of ['net', '401', '429', '500html', 'refusal', 'pause', 'maxtok', 'badjson', 'empty', 'badid', 'missing']) {
      aiMode = m; aiCalls = [];
      await act(p, () => { S.chat = []; view = 'somm'; render(); });
      await p.fill('.composer textarea', 'Un vin pour ce soir'); await p.click('.composer .send'); await p.waitForTimeout(900);
      const r = await act(p, () => ({ busy: chatBusy, last: S.chat.at(-1), bubbles: document.querySelectorAll('.bubble').length, err: document.querySelector('.bubble.err')?.textContent || '' }));
      const e = errs(p);
      const ok = !e && !r.busy && (r.last?.error || r.last?.data);
      let det = r.last?.error ? 'message : ' + r.last.error.split('\n')[0].slice(0, 90) : r.last?.data ? `réponse affichée (${(r.last.data.recos || []).length} reco)` : 'rien';
      if (m === 'pause') det += ` · ${aiCalls.length} appels envoyés`;
      if (m === 'missing' && !e) det += ' · champs manquants tolérés';
      if (m === 'badid') det += ' · la carte du vin inexistant est ignorée, mais le message ne dit pas qu’il manque une recommandation';
      note('IA', `Sommelier, réponse « ${m} »`, ok && !(m === 'missing' && e), det + (e ? ' · ' + e : ''));
    }
    aiMode = 'weird';
    // Lecture d'étiquette absurde
    await act(p, async () => { closeSheet(); });
    const lab = await act(p, async () => { const blob = await (await fetch('icon-192.png')).blob(); await onPhoto(new File([blob], 'x.png', { type: 'image/png' })); await new Promise(r => setTimeout(r, 400)); return { kind: draft?.w?.kind, couleur: draft?.w?.couleur, mill: draft?.w?.millesime, format: draft?.w?.format, cat: draft?.w?.cat, age: draft?.w?.age, x: document.querySelectorAll('[data-xss]').length }; });
    note('IA', 'Lecture d’étiquette : valeurs hors liste (« biere », « violet », âge -3…)', !errs(p) && !lab.x && ['rouge', 'blanc', 'rose', 'effervescent', 'liquoreux', 'orange', undefined].includes(lab.couleur) && !(lab.age < 0), JSON.stringify(lab));
    await closeAll(p);
    // Apogée incohérente renvoyée par l'IA
    const apo = await act(p, async () => { const w = S.wines.find(x => x.kind === 'vin' && !x.owner); await estimateApogee(w.id, { quiet: true }); return w.apogee; });
    note('IA', 'Apogée renvoyée incohérente (début 2040, apogée 2025, fin 2030)', !(apo?.debut > apo?.fin) && !(apo?.pic > apo?.fin), JSON.stringify({ debut: apo?.debut, pic: apo?.pic, fin: apo?.fin }));
    const batch = await act(p, async () => { const ws = S.wines.filter(x => x.kind === 'vin').slice(0, 2); ws.forEach(w => w.apogee = null); await estimateBatch(ws); return ws.map(w => w.apogee && [w.apogee.debut, w.apogee.pic, w.apogee.fin]); });
    note('IA', 'Estimation groupée : années incohérentes et index inconnu', !(batch[0] && batch[0][0] > batch[0][2]), JSON.stringify(batch));
    // Réévaluation incohérente
    await act(p, async () => { closeSheet(); const w = S.wines.find(x => x.kind === 'vin' && wineBottles(x.id).length); await reevaluate(w, { at: today(), note: 10, comment: 'fatigué', full: {} }); });
    await p.waitForTimeout(300);
    const rv = await act(p, () => ({ shown: !!document.querySelector('[data-act=applyReeval]'), txt: document.querySelector('.sheet .card')?.textContent.slice(0, 160), x: document.querySelectorAll('[data-xss]').length }));
    note('IA', 'Réévaluation renvoyée incohérente (début 2090, apogée 1500, fin 2030)', !rv.shown && !rv.x, rv.shown ? 'la proposition s’affiche quand même : ' + rv.txt : 'proposition écartée');
    await closeAll(p);
    // Import Ploc : quantités absurdes, lignes vides
    await act(p, async () => { await onPdf(new File([new Uint8Array([37, 80, 68, 70])], 'p.pdf', { type: 'application/pdf' })); });
    await p.waitForTimeout(600);
    const pl = await act(p, () => ({ rows: plocData?.wines.length, q: plocData?.wines.map(x => x.per.map(y => y.q)), x: document.querySelectorAll('[data-xss]').length, btn: document.querySelector('[data-act=plocGo]')?.textContent }));
    note('IA', 'Import Ploc : quantité 999 999, quantité négative, ligne vide, grille absurde, injection', !pl.x && !/999/.test(pl.btn || ''), JSON.stringify(pl));
    await closeAll(p);
    // Budget dépassé
    aiMode = 'ok';
    const bud = await act(p, async () => { S.usage[monthKey()] = { usd: 999, n: 1 }; S.chat = []; await chatSend('test'); return S.chat.at(-1)?.error || ''; });
    note('IA', 'Plafond mensuel dépassé', /Plafond/.test(bud), bud.slice(0, 100));
    await ctx.close();
  }

  /* ===== E. Sauvegardes corrompues ===== */
  console.log('E. Sauvegardes');
  {
    const { p, ctx } = await newPage(b);
    await p.fill('input[name=p1]', 'mot de passe solide'); await p.fill('input[name=p2]', 'mot de passe solide'); await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
    await closeAll(p);
    const [dl] = await Promise.all([p.waitForEvent('download'), act(p, () => exportBackup())]);
    const good = D + 'camp-backup.json'; await dl.saveAs(good);
    const orig = JSON.parse(fs.readFileSync(good, 'utf8'));
    const variants = {
      'fichier vide': '', 'JSON invalide': '{"app":', 'autre application': JSON.stringify({ app: 'patrimoine', v: 2 }),
      'données altérées': JSON.stringify({ ...orig, ct: orig.ct.slice(0, -8) + 'AAAAAAAA' }), 'sans emplacement de mot de passe': JSON.stringify({ ...orig, slots: {} }),
      'itérations piégées': JSON.stringify({ ...orig, slots: { pw: { ...orig.slots.pw, iter: 999999999 } } }), 'photos piégées': JSON.stringify({ ...orig, photos: { x: 'pas un objet' } }),
    };
    for (const [label, content] of Object.entries(variants)) {
      const f = D + 'camp-bad.json'; fs.writeFileSync(f, content);
      const { p: q, ctx: c2 } = await newPage(b);
      const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-act=import]')]); await fc.setFiles(f); await q.waitForTimeout(300);
      let msg = '';
      if (await q.$('.sheet input[name=p]')) { await q.fill('.sheet input[name=p]', 'mot de passe solide'); await q.click('.sheet [type=submit]'); await q.waitForTimeout(2500); msg = await q.textContent('#ierr').catch(() => ''); }
      else msg = await q.textContent('#toast').catch(() => '');
      const opened = await q.evaluate(() => mode === 'app');
      const e = errs(q);
      const wantMsg = { 'données altérées': /incorrect, ou fichier endommagé/, 'sans emplacement de mot de passe': /endommagée/, 'itérations piégées': /endommagée/ }[label];
      note('Sauvegarde', `Restaurer : ${label}`, !e && (!opened || label === 'photos piégées') && (!wantMsg || wantMsg.test(msg || '')), `${opened ? 'cave ouverte' : 'refusée'} · message : « ${(msg || '').trim().slice(0, 80)} »` + (e ? ' · ' + e : ''));
      await c2.close();
    }
    await ctx.close();
  }

  /* ===== F. Affichage étroit et noms très longs ===== */
  console.log('F. Affichage');
  {
    const { p, ctx } = await newPage(b, { w: 320 }); await demo(p);
    await act(p, () => { const w = S.wines.find(x => x.kind === 'vin'); w.domaine = 'Domaine ' + 'Extraordinairementlong'.repeat(4); w.cuvee = 'Cuvée ' + 'Interminable '.repeat(6); });
    const over = [];
    const check = async label => { const r = await act(p, () => { const W = document.documentElement.clientWidth; return document.documentElement.scrollWidth > W + 1 ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > W + 2 && !e.closest('.rack-scroll,.chips')).slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 20)) : null; }); if (r) over.push(`${label} : ${r.join(', ')}`); };
    for (const v of ['cave', 'deg', 'boire', 'somm', 'plus']) { await act(p, vv => { closeSheet(); view = vv; render(); }, v); await check(v); }
    await act(p, () => { caveMode = 'liste'; render(); }); await check('liste');
    for (const [label, js] of [['fiche vin', () => showSheet(() => wineSheet(S.wines.find(x => x.kind === 'vin').id))], ['dégustation complète', () => startTaste(S.wines[0].id, null, 'full')],
      ['rangement', () => { const b0 = S.bottles.find(inCave); startPlace(b0.wineId, [b0.id], b0.spaceId, false); }], ['nouveau vin', () => { newDraft('vin'); showSheet(wineFormSheet, { full: true }); }],
      ['réglages IA', () => showSheet(aiSheet)], ['conseils', () => showSheet(adviceSheet)]]) { await act(p, () => { draft = null; closeSheet(); }); await act(p, js); await p.waitForTimeout(150); await check(label); }
    await p.screenshot({ path: D + 'camp-320.png' });
    note('Affichage', 'Largeur 320 px (iPhone SE 1re génération) et noms très longs : débordement horizontal', !over.length, over.join(' ; ') + (errs(p) ? ' · ' + errs(p) : ''));
    await ctx.close();
  }

  /* ===== G. Volume ===== */
  console.log('G. Volume');
  {
    const { p, ctx } = await newPage(b); await demo(p);
    const r = await act(p, () => {
      const sp = S.spaces[1]; for (let i = 0; i < 10; i++) S.units.push({ id: 'vol' + i, spaceId: sp.id, type: 'rack', name: 'Rack ' + i, rows: 10, cols: 10, order: 99 + i });
      for (let i = 0; i < 1000; i++) { const w = { id: 'w' + i, kind: 'vin', domaine: 'Domaine ' + i, appellation: 'Appellation ' + (i % 50), couleur: ['rouge', 'blanc', 'rose'][i % 3], millesime: 1990 + (i % 35), apogee: { debut: 2020, pic: 2026, fin: 2020 + (i % 30) } }; S.wines.push(w);
        for (let k = 0; k < 3; k++) S.bottles.push({ id: 'b' + i + '_' + k, wineId: w.id, state: 'cave', spaceId: sp.id, unitId: null }); }
      for (let i = 0; i < 2000; i++) S.tastings.push({ id: 't' + i, wineId: 'w' + (i % 1000), at: '2025-' + String(1 + i % 12).padStart(2, '0') + '-10', note: 10 + i % 10 });
      const t = {}; const time = (k, f) => { const s = performance.now(); f(); t[k] = Math.round(performance.now() - s); };
      S.settings.site = sp.siteId;
      time('cave (plan)', () => { view = 'cave'; caveMode = 'plan'; caveSpace = null; render(); });
      time('cave (liste)', () => { caveMode = 'liste'; render(); });
      time('dégustations', () => { view = 'deg'; render(); });
      time('à boire', () => { view = 'boire'; render(); });
      time('conseils', () => moveAdvice());
      time('recherche', () => { view = 'cave'; caveMode = 'liste'; caveQuery = 'domaine 99'; render(); caveQuery = ''; });
      const c = caveContext(true); t['contexte sommelier (caractères)'] = c.length;
      return t;
    });
    const slow = Object.entries(r).filter(([k, v]) => !k.includes('caract') && v > 400);
    note('Volume', '1 000 vins, 3 000 bouteilles, 2 000 dégustations', !slow.length && r['contexte sommelier (caractères)'] < 80000, Object.entries(r).map(([k, v]) => `${k} ${v}${k.includes('caract') ? '' : ' ms'}`).join(' · ') + (errs(p) ? ' · ' + errs(p) : ''));
    await ctx.close();
  }

  /* ===== H. Verrouillage et mots de passe ===== */
  console.log('H. Verrouillage');
  {
    const { p, ctx } = await newPage(b);
    const pw = 'Cave 🍷 « été » ' + 'x'.repeat(200);
    await p.fill('input[name=p1]', pw); await p.fill('input[name=p2]', pw); await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500); await closeAll(p);
    await act(p, () => lockNow()); await p.waitForTimeout(150);
    await p.fill('input[name=p1]', pw); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(2500);
    note('Verrou', 'Mot de passe avec emoji, guillemets, accents, 200 caractères', await act(p, () => mode === 'app'), errs(p));
    await act(p, () => lockNow());
    let last = '';
    for (let i = 0; i < 6; i++) { await p.fill('input[name=p1]', 'faux ' + i); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(1800); last = await p.textContent('.err').catch(() => ''); }
    note('Verrou', '6 mauvais mots de passe d’affilée', /Réessaie dans/.test(last), `dernier message : « ${last.trim()} »`);
    // Feuille ouverte puis verrouillage automatique : rien ne doit rester affiché
    await ctx.close();
  }

  const ko = R.filter(r => !r.ok);
  fs.writeFileSync(D + 'campagne.json', JSON.stringify({ date: new Date().toISOString(), dureeSecondes: Math.round((Date.now() - t0) / 1000), total: R.length, echecs: ko.length, resultats: R }, null, 1));
  console.log(`\n${R.length} tests · ${ko.length} anomalie(s) · ${Math.round((Date.now() - t0) / 1000)} s`);
  await b.close();
})();
