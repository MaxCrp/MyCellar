// Audit des glitchs visuels (Playwright) : après un appui sur un bouton qui modifie l'écran sur place,
// la fenêtre ne doit pas être recréée (clignotement, animation rejouée) et le défilement ne doit pas sauter.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], rows = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
  if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  // Appuie sur l'élément après l'avoir amené au milieu de l'écran, puis compare l'état avant / après
  async function probe(label, sel, where = 'sheet') {
    const el = await p.$(sel); if (!el) { rows.push([label, 'absent', '', '']); return; }
    await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(80);
    const before = await p.evaluate(w => { const s = document.querySelector('.sheet'); if (s) s.__probe = 1; document.querySelector('#app').__probe = 1;
      return { st: w === 'sheet' ? s?.scrollTop : window.scrollY }; }, where);
    await el.click(); await p.waitForTimeout(350);
    const after = await p.evaluate(w => { const s = document.querySelector('.sheet');
      return { st: w === 'sheet' ? s?.scrollTop : window.scrollY, same: w === 'sheet' ? !!s?.__probe : true }; }, where);
    const jump = Math.round((after.st ?? 0) - (before.st ?? 0));
    rows.push([label, after.same ? 'non' : 'OUI', Math.abs(jump) > 4 ? `${jump}px` : 'non', before.st]);
  }
  // 1. Fiche de dégustation complète
  await p.click('.slot[data-act=slot] >> nth=3'); await p.click('.sheet [data-act=taste]'); await p.waitForTimeout(250);
  await probe('Dégustation › Complète', '.sheet [data-act=tmode][data-m=full]');
  await probe('Dégustation › teinte', '.sheet [data-act=tchip][data-k=teinte]');
  await probe('Dégustation › limpidité', '.sheet [data-act=tchip][data-k=limpidite]');
  await probe('Dégustation › roue (famille)', '#wheel path[data-act=wfam]');
  await probe('Dégustation › roue (arôme)', '#wheel path[data-act=waro]');
  await probe('Dégustation › attaque', '.sheet [data-act=tchip][data-k=attaque]');
  await probe('Dégustation › équilibre', '.sheet [data-act=tchip][data-k=equilibre]');
  await probe('Dégustation › évolution', '.sheet [data-act=tchip][data-k=evolution]');
  await probe('Dégustation › potentiel « À boire »', '.sheet [data-act=tchip][data-k=potentiel]');
  await probe('Dégustation › type de dégustation', '.sheet [data-act=tctx][data-k=type]');
  await probe('Dégustation › accord', '.sheet [data-act=tctx][data-k=accord]');
  await probe('Dégustation › Rapide', '.sheet [data-act=tmode][data-m=quick]');
  await p.click('.shead [data-act=close]');
  if (await p.$('.sheet [data-act=tasteAbandon]')) await p.click('.sheet [data-act=tasteAbandon]');
  // 2. Rangement
  await p.click('[data-act=caveMode][data-m=liste]'); await p.click('.li[data-act=wine]'); await p.click('.sheet [data-act=bottle]'); await p.click('.sheet [data-act=moveBottle]'); await p.waitForTimeout(250);
  await probe('Rangement › choisir une case', '.sheet [data-act=pickSlot] >> nth=8');
  await probe('Rangement › Suggérer', '.sheet [data-act=placeSuggest]');
  await probe('Rangement › Effacer', '.sheet [data-act=placeClear]');
  await probe('Rangement › autre espace', '.sheet [data-act=placeSpace] >> nth=1');
  await p.click('.shead [data-act=close]');
  // 3. Fiche vin : liste d'envies ; transfert
  await p.click('.li[data-act=wine] >> nth=4'); await p.waitForTimeout(150);
  await probe('Fiche vin › liste d’envies', '.sheet [data-act=wishToggle]');
  await p.click('.shead [data-act=close]');
  await p.click('[data-act=go][data-v=plus]'); await p.click('[data-act=transferSheet]'); await p.waitForTimeout(150);
  await probe('Transfert › ajouter une suggestion', '.sheet [data-act=toTransfer] >> nth=-1');
  await p.click('.shead [data-act=close]');
  // 4. Écrans principaux (défilement de la page)
  await p.click('[data-act=go][data-v=cave]'); await p.evaluate(() => window.scrollTo(0, 300));
  await probe('Cave › Liste/Plan', '[data-act=caveMode][data-m=plan]', 'page');
  await p.click('[data-act=caveMode][data-m=liste]'); await p.evaluate(() => window.scrollTo(0, 400));
  await probe('Cave › filtre « Prêts à boire »', '[data-act=lf]', 'page');
  await p.click('[data-act=go][data-v=boire]'); await p.evaluate(() => window.scrollTo(0, 250));
  await probe('À boire › catégorie', '[data-act=boireCat][data-k=apogee]', 'page');
  await p.click('[data-act=go][data-v=deg]'); await p.evaluate(() => window.scrollTo(0, 300));
  await probe('Dégustations › filtre', '[data-act=dfMin]', 'page');
  await probe('Dégustations › Par vin', '[data-act=degMode][data-m=vin]', 'page');
  console.log(['Action'.padEnd(40), 'Recréée'.padEnd(8), 'Saut'.padEnd(8), 'Défil. avant'].join(' | '));
  for (const r of rows) console.log([String(r[0]).padEnd(40), String(r[1]).padEnd(8), String(r[2]).padEnd(8), r[3]].join(' | '));
  const bad = rows.filter(r => r[1] === 'OUI' || r[2] !== 'non');
  console.log(`${bad.length} glitch(s) sur ${rows.length} actions testées`);
  console.log(errs.join('\n') || 'NO ERRORS');
  await b.close();
})();
