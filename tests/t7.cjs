// Test de bout en bout (Playwright) : v1.5.2 — présentation, bouton + commun, recherche « Racheter », dégustation à l'aveugle
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], calls = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()); calls.push(body);
    const text = body.system[0].text.includes('formateur') ? 'Ton nez « coing, cire » et l’acidité vive pointaient bien vers un Chenin : c’est la signature de Savennières.\n\nTu as pensé Sauvignon à cause des notes d’agrumes et de pierre à fusil, mais le Sauvignon serait plus végétal et moins cireux en bouche.\n\nRepère : la texture cireuse et le coing distinguent le Chenin du Sauvignon.' : '```json\n{"debut":2024,"pic":2028,"fin":2035,"justification":"x","confiance":"moyenne"}\n```';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1500, output_tokens: 300 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  // Présentation au premier lancement
  const introShown = !!(await p.$('#intro'));
  await p.screenshot({ path: D + '80-intro1.png' });
  await p.click('#intro [data-act=introNext]'); await p.click('#intro [data-act=introNext]'); await p.waitForTimeout(100);
  await p.screenshot({ path: D + '81-intro3.png' });
  for (let i = 0; i < 4; i++) await p.click('#intro [data-act=introNext]');
  await p.screenshot({ path: D + '82-intro7.png' });
  await p.click('#intro [data-act=introDone]'); await p.waitForTimeout(100);
  await p.reload(); await p.waitForTimeout(600);
  const introAgain = !!(await p.$('#intro'));
  // Démo : bouton + commun
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  await p.click('[data-act=add]'); await p.waitForTimeout(150);
  await p.screenshot({ path: D + '83-plus.png' });
  await p.click('.sheet [data-act=addWine]'); await p.waitForTimeout(150);
  const plocInPlus = !!(await p.$('.sheet [data-act=importPloc]'));
  await p.click('.sheet [data-act=rebuyList]'); await p.waitForTimeout(150);
  const before = await p.$$eval('#rebuy-list .li', x => x.length);
  await p.fill('.sheet input[data-in=rebuyFind]', 'loire 2019'); await p.waitForTimeout(100);
  const after = await p.$$eval('#rebuy-list .li', x => x.length);
  await p.screenshot({ path: D + '84-rebuy.png' });
  await p.click('.shead [data-act=close]');
  // Clé IA (sans estimation automatique), puis dégustation à l'aveugle
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=aiSettings]'); await p.fill('.sheet input[name=key]', 'sk-ant-x'); await p.uncheck('.sheet input[name=auto]'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(150);
  await p.click('[data-act=go][data-v=deg]');
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=newTaste]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=blindStart]'); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=tcolor][data-v=blanc]'); await p.waitForTimeout(100);
  await p.click('#wheel path[data-act=wfam][data-i="3"] >> nth=0'); await p.click('#wheel path[data-act=waro][data-a="Citron"]');
  await p.click('#wheel path[data-act=wfam][data-i="12"] >> nth=0'); await p.click('#wheel path[data-act=waro][data-a="Pierre à fusil"]');
  await p.fill('.sheet input[data-in=th][data-k=cepage]', 'Sauvignon'); await p.fill('.sheet input[data-k=region]', 'Sancerre'); await p.fill('.sheet input[data-k=millesime]', '2020'); await p.fill('.sheet input[data-in=th][data-k=prix]', '30');
  await p.screenshot({ path: D + '85-blind-form.png' });
  await p.click('.sheet button.btn.primary[data-act=tasteSave]'); await p.waitForTimeout(300);
  await p.screenshot({ path: D + '86-blind-saved.png' });
  await p.click('.sheet [data-act=close] >> text=Plus tard').catch(() => p.click('.shead [data-act=close]'));
  await p.waitForTimeout(150);
  await p.screenshot({ path: D + '87-journal-mystere.png' });
  // Révélation depuis le journal
  await p.click('.view .li[data-act=tasteView] >> nth=0'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=reveal]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[data-in=revealFind]', 'coulée'); await p.waitForTimeout(100);
  await p.click('#reveal-find [data-act=revealWine]'); await p.waitForTimeout(800);
  await p.screenshot({ path: D + '88-reveal.png' });
  const state = await p.evaluate(() => { const t = S.tastings.find(x => x.blind); return { wine: wineTitle(wine(t.wineId)), revealed: t.blind.revealed, analysis: !!t.blind.analysis, hyp: t.blind.hyp }; });
  // Séance à l'aveugle : un vin mystère reste à révéler
  await p.click('.shead [data-act=close]');
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=newTaste]'); await p.click('.sheet [data-act=newSession]'); await p.fill('.sheet input[name=titre]', 'Aveugle entre amis'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=newTaste]'); await p.click('.sheet [data-act=blindStart]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=tcolor][data-v=rouge]'); await p.click('.sheet button.btn.primary[data-act=tasteSave]'); await p.waitForTimeout(250);
  await p.screenshot({ path: D + '89-session-blind.png' });
  console.log('présentation au 1er lancement', introShown, '· revue après « Passer »', introAgain, '· Ploc dans le + :', plocInPlus);
  console.log('recherche « Racheter »', before, '→', after);
  console.log('révélation', JSON.stringify(state));
  console.log('appels IA', calls.map(c => c.system[0].text.includes('formateur') ? 'analyse' : 'autre').join(', '));
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
