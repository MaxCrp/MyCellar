// Test de bout en bout (Playwright) : v1.6 — suivi d'utilisation, rapport, signaler un problème, nouveautés, « Plus d'infos »
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D = __dirname + '/shots/'; fs.mkdirSync(D, { recursive: true });
const PUB = path.join(__dirname, '..', 'public');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  const pw = 'ma cave secrète';
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.fill('input[name=p1]', pw); await p.fill('input[name=p2]', pw);
  await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
  if (await p.$('.sheet')) await p.click('.shead [data-act=close]');
  const newsAtCreation = await p.$$eval('.sheet h2', h => h.map(x => x.textContent).join('|'));
  // Activer le suivi, puis quelques gestes
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=usageSheet]'); await p.waitForTimeout(200);
  await p.click('.sheet input[data-ch=setUsage]'); await p.waitForTimeout(300);
  await p.click('.shead [data-act=close]');
  await p.click('[data-act=add]'); await p.click('.sheet [data-act=addWine]'); await p.click('.sheet [data-act=newWine][data-kind=vin]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=domaine]', 'Domaine Secret Absolu'); await p.fill('.sheet input[name=appellation]', 'Appellation Confidentielle'); await p.fill('.sheet input[name=millesime]', '2015');
  await p.click('.sheet [type=submit]'); await p.waitForTimeout(400);
  if (await p.$('.sheet [data-act=placeOk]')) await p.click('.sheet [data-act=placeOk]');
  await p.click('[data-act=go][data-v=deg]'); await p.click('[data-act=go][data-v=boire]'); await p.click('[data-act=go][data-v=cave]');
  await p.click('[data-act=caveMode][data-m=liste]'); await p.waitForTimeout(100);
  await p.click('.li[data-act=wine]'); await p.waitForTimeout(150); await p.click('.shead [data-act=close]');
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=usageSheet]'); await p.waitForTimeout(200);
  await p.screenshot({ path: D + '90-usage.png' });
  // Exporter le rapport avec un avis
  await p.click('.sheet [data-act=usageReport]'); await p.waitForTimeout(150);
  await p.fill('.sheet textarea[name=avis]', 'Très pratique, mais le plan est petit.');
  await p.screenshot({ path: D + '91-report.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sheet [type=submit]')]);
  const repFile = D + 'rapport.json'; await dl.saveAs(repFile);
  const raw = fs.readFileSync(repFile, 'utf8'), rep = JSON.parse(raw);
  const leak = /Secret Absolu|Confidentielle/.test(raw);
  // Signaler un problème
  await p.click('.shead [data-act=close]').catch(() => {});
  await p.click('[data-act=problem]'); await p.waitForTimeout(150);
  await p.fill('.sheet textarea[name=desc]', 'Le bouton Ranger ne répond pas.');
  await p.screenshot({ path: D + '92-problem.png' });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('.sheet [type=submit]')]);
  const pbFile = D + 'probleme.json'; await dl2.saveAs(pbFile);
  const pb = JSON.parse(fs.readFileSync(pbFile, 'utf8'));
  // Nouveautés : on simule une installation venant de la v1.5, puis on déverrouille
  await p.evaluate(() => store.set('lastVersion', '1.5'));
  await p.click('[data-act=lock]'); await p.waitForTimeout(200);
  await p.fill('input[name=p1]', pw); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(3000);
  await p.screenshot({ path: D + '93-news.png' });
  const newsTitles = await p.$$eval('.sheet .ct span:first-child', x => x.map(e => e.textContent));
  await p.click('.sheet [data-act=close] >> text=C’est noté');
  // Historique dans les réglages
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=historySheet]'); await p.waitForTimeout(150);
  const histCount = await p.$$eval('.sheet .card', x => x.length);
  await p.click('.shead [data-act=close]');
  // « Plus d'infos » : on publie une version fictive (code et journal modifiés), l'app installée la détecte
  const idx = path.join(PUB, 'index.html'), clg = path.join(PUB, 'changelog.json');
  const idx0 = fs.readFileSync(idx, 'utf8'), clg0 = fs.readFileSync(clg, 'utf8');
  try {
    fs.writeFileSync(idx, idx0 + '\n<!-- version fictive de test -->\n');
    fs.writeFileSync(clg, JSON.stringify([{ version: '99.0', date: '2026-11-20', titre: 'Version fictive de test', items: ['Le plan est plus grand sur iPhone mini.', 'Correction du bouton Ranger.'] }, ...JSON.parse(clg0)]));
    await p.reload(); await p.waitForTimeout(2500);
    const banner = await p.textContent('#codebar').catch(() => '');
    await p.screenshot({ path: D + '94-banner.png' });
    await p.click('#codebar [data-act=codeinfo]'); await p.waitForTimeout(800);
    await p.screenshot({ path: D + '95-plusinfos.png' });
    const upd = await p.$$eval('.sheet .ct span:first-child', x => x.map(e => e.textContent));
    console.log('bandeau :', banner.includes('Plus d’infos') ? 'avec « Plus d’infos »' : banner.slice(0, 80), '| contenu affiché :', JSON.stringify(upd));
  } finally { fs.writeFileSync(idx, idx0); fs.writeFileSync(clg, clg0); }
  console.log('nouveautés à la création :', JSON.stringify(newsAtCreation), '| après passage de 1.5 à 1.6 :', JSON.stringify(newsTitles), '| historique :', histCount, 'versions');
  console.log('rapport :', rep.format, '· avis', JSON.stringify(rep.avis), '·', rep.events.rows.length, 'événements ·', rep.summary.tasks.length, 'tâches · fuite de nom de vin :', leak);
  console.log('problème :', pb.format, '·', JSON.stringify(pb.description), '·', pb.recentEvents?.rows.length, 'événements récents ·', pb.recentErrors.length, 'erreurs');
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
