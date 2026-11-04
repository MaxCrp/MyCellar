// Test de bout en bout (Playwright) : lancé par tests/run.sh, sur http://localhost:8765
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()), schema = body.output_config?.format?.schema;
    let text;
    if (schema?.properties?.items?.items?.properties?.emplacement) text = JSON.stringify({ items: [
      { domaine: 'Domaine Jamet', nom: 'Côte-Rôtie', millesime: '2019', quantite: 3, emplacement: 'Casier A, rangée 2' },
      { domaine: 'Château Palmer', nom: 'Margaux', millesime: '2015', quantite: 2, emplacement: 'Casier B' },
      { domaine: 'Dagueneau', nom: 'Pouilly-Fumé Silex', millesime: '2020', quantite: 1, emplacement: '' }] });
    else if (schema?.properties?.items?.items?.properties?.couleur) text = JSON.stringify({ items: [
      { i: 0, couleur: 'rouge', appellation: 'Côte-Rôtie', cuvee: '', region: 'Rhône', pays: 'France', cepages: 'Syrah', debut: 2025, pic: 2030, fin: 2038 },
      { i: 1, couleur: 'rouge', appellation: 'Margaux', cuvee: '', region: 'Bordeaux', pays: 'France', cepages: 'Cabernet sauvignon, Merlot', debut: 2027, pic: 2035, fin: 2050 },
      { i: 2, couleur: 'blanc', appellation: 'Pouilly-Fumé', cuvee: 'Silex', region: 'Loire', pays: 'France', cepages: 'Sauvignon', debut: 2023, pic: 2027, fin: 2032 }] });
    else text = 'OK';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 800 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500);
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  // liste + filtres
  await p.click('[data-act=caveMode][data-m=liste]'); await p.click('[data-act=lf]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '40-list.png' });
  await p.click('.li[data-act=wine] >> nth=0'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '41-wine.png' });
  await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 2000)); await p.waitForTimeout(100);
  await p.screenshot({ path: D + '42-wine-bottom.png' });
  await p.click('.shead [data-act=close]');
  // transfert depuis À boire
  await p.click('[data-act=go][data-v=boire]'); await p.click('[data-act=awayTransfer]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '43-transfer.png' });
  await p.click('.sheet [data-act=transferDone]'); await p.waitForTimeout(300);
  await p.screenshot({ path: D + '44-arrived.png', fullPage: true });
  // primeurs
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=primeursSheet]'); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=receive]'); await p.waitForTimeout(300);
  await p.screenshot({ path: D + '45-receive.png' });
  await p.click('.sheet [data-act=placeOk]'); await p.waitForTimeout(300);
  // journal, amis
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=journalSheet]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '46-journal.png' });
  await p.click('.shead [data-act=close]'); await p.click('[data-act=friendsSheet]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '47-friends.png' });
  await p.click('.shead [data-act=close]');
  // spiritueux ouvert : niveau
  await p.click('[data-act=go][data-v=boire]'); await p.click('.li[data-act=bottle]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '48-spirit.png' });
  await p.click('.shead [data-act=close]');
  // import Ploc simulé
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=aiSettings]'); await p.fill('.sheet input[name=key]', 'sk-ant-x'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(200);
  await p.click('[data-act=importPloc]'); await p.waitForTimeout(200);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.sheet [data-act=plocPick]')]);
  await fc.setFiles({ name: 'ploc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }); await p.waitForTimeout(1200);
  await p.screenshot({ path: D + '49-ploc.png' });
  await p.click('.sheet [data-act=plocGo]'); await p.waitForTimeout(400);
  await p.screenshot({ path: D + '50-ploc-done.png', fullPage: true });
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
