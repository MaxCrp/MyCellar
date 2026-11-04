// Test de bout en bout (Playwright) : lancé par tests/run.sh, sur http://localhost:8765
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  await p.fill('input[name=p1]', 'ma cave secrète'); await p.fill('input[name=p2]', 'ma cave secrète');
  await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
  await p.screenshot({ path: D + '30-new.png' });
  console.log('après création', await p.evaluate(() => S.sites.map(s => s.name).join(', ') + ' · multi=' + S.settings.multi + ' · pastille site : ' + !!document.querySelector('.sitepill')));
  if (await p.$('.sheet')) await p.click('.shead [data-act=close]');
  // premier meuble
  await p.click('.card [data-act=addUnit]'); await p.waitForTimeout(200);
  await p.selectOption('.sheet select[name=type]', 'rack'); await p.waitForTimeout(100);
  await p.fill('.sheet input[name=rows]', '3'); await p.fill('.sheet input[name=cols]', '6');
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(300);
  // un spiritueux ? désactivé : on active
  await p.click('[data-act=go][data-v=plus]'); await p.click('input[data-ch=setSpirits]'); await p.waitForTimeout(300);
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=newWine][data-kind=spirit]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '31-spirit-form.png' });
  await p.fill('.sheet input[name=domaine]', 'Springbank'); await p.fill('.sheet input[name=cuvee]', '10 ans'); await p.fill('.sheet input[name=age]', '10');
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(400);
  await p.click('.sheet [data-act=placeOk]'); await p.waitForTimeout(400);
  // vin avec 2 bouteilles pour un ami
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=newWine][data-kind=vin]'); await p.waitForTimeout(200);
  await p.fill('.sheet input[name=domaine]', 'Château Margaux'); await p.fill('.sheet input[name=appellation]', 'Margaux'); await p.fill('.sheet input[name=millesime]', '2005'); await p.fill('.sheet input[name=qty]', '2');
  await p.click('.sheet summary'); await p.fill('.sheet input[name=owner]', 'Julie');
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(400);
  await p.click('.sheet [data-act=placeOk]'); await p.waitForTimeout(400);
  await p.screenshot({ path: D + '32-real-cave.png' });
  // verrouiller / mauvais mot de passe / bon
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=lock]'); await p.waitForTimeout(200);
  await p.fill('input[name=p1]', 'faux mot de passe'); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(2000);
  await p.screenshot({ path: D + '33-wrong.png' });
  await p.fill('input[name=p1]', 'ma cave secrète'); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(2500);
  const n1 = await p.$$eval('.rc[data-act=slot]', x => x.length);
  // sauvegarde
  await p.click('[data-act=go][data-v=plus]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export]')]);
  const file = __dirname + '/backup.json'; await dl.saveAs(file);
  // restauration dans un navigateur vierge
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('PAGEERR2 ' + e.message)); q.on('dialog', d => d.accept());
  await q.goto('http://localhost:8765/'); await q.waitForTimeout(600);
  const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-act=import]')]);
  await fc.setFiles(file); await q.waitForTimeout(300);
  await q.fill('.sheet input[name=p]', 'ma cave secrète'); await q.click('.sheet [type=submit]'); await q.waitForTimeout(2500);
  const n2 = await q.$$eval('.rc[data-act=slot]', x => x.length);
  await q.screenshot({ path: D + '34-restored.png' });
  // passage en plusieurs sites
  await q.click('[data-act=go][data-v=plus]'); await q.click('[data-act=sitesSheet]'); await q.waitForTimeout(200);
  await q.click('.sheet [data-act=setMulti][data-v="1"]'); await q.waitForTimeout(300);
  await q.screenshot({ path: D + '35-sites.png' });
  console.log('sites', await q.evaluate(() => S.sites.map(s => s.name + ' (' + s.role + ')').join(', ')));
  await q.click('.sheet [data-act=editSpace] >> nth=0'); await q.waitForTimeout(200);
  await q.screenshot({ path: D + '36-space.png' });
  console.log('bouteilles placées', n1, 'après restauration', n2);
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
