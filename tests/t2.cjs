// Test de bout en bout (Playwright) : lancé par tests/run.sh, sur http://localhost:8765
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], calls = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => { d.type() === 'prompt' ? d.accept('Cerise kirschée') : d.accept(); });
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()); calls.push(body);
    const schema = body.output_config?.format?.schema;
    let text;
    if (schema?.properties?.recos) {
      const ctxt = body.system.map(s => s.text).join('\n');
      const ids = [...ctxt.matchAll(/id=(\w+) \| Rouge \| ([^|]+)/g)].map(m => [m[1], m[2]]);
      const pick = ids.find(x => x[1].includes('Crozes')) || ids[0];
      const pick2 = ids.find(x => x[1].includes('Morgon')) || ids[1];
      text = JSON.stringify({ message: 'Le canard et les cerises appellent un rouge fruité aux tanins fondus. Voici ce que j’ouvrirais :', recos: [
        { id: pick[0], role: 'Mon choix', raison: 'Fruit noir et poivre qui répondent aux cerises ; tanins fondus à 7 ans.', temperature: '16 °C', carafe: 'Carafe 30 min', plat: '' },
        { id: pick2[0], role: 'Plus frais', raison: 'Gamay de granite, croquant, pour un accord plus léger.', temperature: '14 °C', carafe: 'Sans carafe', plat: '' }], achats: [], relances: ['Moins tannique ?', 'Et pour le dessert ?'] });
    } else if (schema?.properties?.kind) {
      text = JSON.stringify({ kind: 'vin', couleur: 'rouge', domaine: 'Domaine Jean-Louis Chave', cuvee: '', appellation: 'Hermitage', region: 'Rhône', pays: 'France', millesime: '2018', cepages: 'Syrah', degre: '14', format: '75', cat: '', age: '', fut: '' });
    } else {
      text = 'J’ai cherché les critiques du millésime. ```json\n{"debut": 2026, "pic": 2032, "fin": 2045, "justification": "Grand Hermitage de garde, millésime solaire.", "confiance": "haute"}\n```';
    }
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 6000, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  // Bouteille → sortie → dégustation complète
  await p.click('.slot[data-act=slot] >> nth=3'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '10-bottle.png' });
  await p.click('.sheet [data-act=outBottle]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '11-out.png' });
  await p.fill('.sheet input[name=plat]', 'Magret aux cerises');
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '12-after-out.png' });
  await p.click('.sheet [data-act=taste][data-m=full]'); await p.waitForTimeout(300);
  await p.click('#wheel path[data-act=wfam][data-i="1"] >> nth=0'); await p.waitForTimeout(200);
  await p.click('#wheel path[data-act=waro][data-a="Mûre"]'); await p.click('#wheel path[data-act=waro][data-a="Cassis"]');
  await p.click('#aro-sel [data-act=aroAdd]'); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=tchip][data-k=evolution][data-v=declin]'); await p.waitForTimeout(200);
  const wheel = await p.$('#wheel'); await wheel.scrollIntoViewIfNeeded();
  await p.screenshot({ path: D + '13-wheel.png' });
  await p.click('.sheet button.btn.primary[data-act=tasteSave]'); await p.waitForTimeout(300);
  await p.screenshot({ path: D + '14-advice.png' });
  await p.click('.sheet [data-act=applyAdvice]'); await p.waitForTimeout(200);
  // Sommelier : clé fictive puis question
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=aiSettings]'); await p.waitForTimeout(200);
  await p.fill('.sheet input[name=key]', 'sk-ant-test'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(200);
  await p.click('[data-act=go][data-v=somm]'); await p.waitForTimeout(200);
  await p.fill('.composer textarea', 'Ce soir magret de canard aux cerises, on sera 4');
  await p.click('.composer .send'); await p.waitForTimeout(800);
  await p.screenshot({ path: D + '15-somm.png' });
  await p.click('[data-act=takeIt] >> nth=0'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '16-take.png' });
  await p.click('.shead [data-act=close]');
  // Ajout manuel → rangement
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=addWine]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '17-add.png' });
  await p.click('.sheet [data-act=newWine][data-kind=vin]'); await p.waitForTimeout(200);
  await p.fill('.sheet input[name=domaine]', 'Domaine Rostaing'); await p.fill('.sheet input[name=appellation]', 'Côte-Rôtie'); await p.fill('.sheet input[name=millesime]', '2020'); await p.fill('.sheet input[name=qty]', '3');
  await p.screenshot({ path: D + '18-form.png' });
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(400);
  await p.screenshot({ path: D + '19-place.png' });
  await p.click('.sheet [data-act=placeOk]'); await p.waitForTimeout(800);
  await p.screenshot({ path: D + '20-after-place.png', fullPage: true });
  // Campagne : rack + caisses
  await p.click('[data-act=pickSite]'); await p.click('.sheet [data-act=setSite] >> nth=1'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '21-campagne.png', fullPage: true });
  await p.click('.crate >> nth=0'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '22-box.png' });
  await p.click('.shead [data-act=close]');
  await p.click('[data-act=editUnit] >> nth=0'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '23-unit.png' });
  await p.click('.shead [data-act=close]');
  // Scan étiquette simulé
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=addWine]'); await p.waitForTimeout(100);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.sheet [data-act=scanLabel]')]);
  await fc.setFiles(__dirname + '/shots/02-cave.png'); await p.waitForTimeout(1200);
  await p.screenshot({ path: D + '24-scan.png' });
  console.log('calls', calls.length, calls.map(c => (c.tools ? 'web ' : '') + (c.output_config?.format ? 'schema' : 'text') + ' ' + c.model + ' fb=' + c.fallbacks).join(' | '));
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
