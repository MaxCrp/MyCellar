// Test de bout en bout (Playwright) : v1.6.1 — confirmation de fermeture d'une dégustation, « OK » retiré,
// réglages indisponibles en cave fictive expliqués, ligne « Vins » supprimée
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], out = {};
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
  if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  const openTaste = async () => { await p.click('.slot[data-act=slot] >> nth=3'); await p.click('.sheet [data-act=taste]'); await p.waitForTimeout(200); };
  // Fiche vide : se ferme directement ; pas de « OK » en haut
  await openTaste();
  out.okEnHaut = !!(await p.$('.sheet .shead [data-act=tasteSave]'));
  await p.click('.shead [data-act=close]'); await p.waitForTimeout(150);
  out.videFermee = !(await p.$('.sheet'));
  // Fiche modifiée : la croix demande confirmation ; « Continuer » revient au même endroit
  await openTaste();
  await p.click('.sheet [data-act=tmode][data-m=full]'); await p.waitForTimeout(150);
  const chip = await p.$('.sheet [data-act=tchip][data-k=equilibre]'); await chip.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await chip.click(); await p.waitForTimeout(150);
  const y0 = await p.$eval('.sheet', s => s.scrollTop);
  await p.$eval('.shead [data-act=close]', e => e.click()); await p.waitForTimeout(150);   // sans faire défiler la fenêtre
  out.confirmation = (await p.textContent('.sheet h2')).trim();
  await p.screenshot({ path: D + '100-confirm.png' });
  await p.click('.sheet [data-act=tasteKeep]'); await p.waitForTimeout(200);
  out.retourMemePosition = Math.abs((await p.$eval('.sheet', s => s.scrollTop)) - y0) <= 4;
  out.saisieConservee = await p.$eval('.sheet [data-act=tchip][data-k=equilibre].on', () => true).catch(() => false);
  // Le fond grisé demande aussi confirmation ; « Abandonner » ferme tout
  await p.$eval('.backdrop', e => e.click()); await p.waitForTimeout(150);
  out.fondGrise = (await p.textContent('.sheet h2')).trim();
  await p.click('.sheet [data-act=tasteAbandon]'); await p.waitForTimeout(150);
  out.abandonFerme = !(await p.$('.sheet'));
  // Flèche de retour : depuis la fiche bouteille, « Abandonner » revient à la fiche bouteille
  await openTaste(); await p.fill('.sheet textarea[data-k=comment]', 'Très bon');
  await p.click('.shead [data-act=sheetback]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=tasteAbandon]'); await p.waitForTimeout(150);
  out.retourFicheBouteille = !!(await p.$('.sheet [data-act=outBottle]'));
  await p.click('.shead [data-act=close]');
  // Réglages : ligne « Vins » absente, explication en démo, appui sur un interrupteur grisé
  await p.click('[data-act=go][data-v=plus]'); await p.waitForTimeout(150);
  out.ligneVins = await p.evaluate(() => [...document.querySelectorAll('.set b')].some(b => b.textContent.trim() === 'Vins'));
  out.explicationsDemo = await p.$$eval('.why-off', x => x.length);
  await p.click('[data-act=usageSheet]'); await p.waitForTimeout(150);
  await p.click('.sheet .switch[data-act=demoOnly]'); await p.waitForTimeout(150);
  out.toast = (await p.textContent('#toast')).trim();
  out.exportEnDemo = !!(await p.$('.sheet [data-act=usageReport]'));
  await p.screenshot({ path: D + '101-demo-off.png' });
  console.log(JSON.stringify(out, null, 1));
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
