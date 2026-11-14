// Reproduit : 1re ouverture, puis réouverture (le service worker sert la page), puis hors ligne
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...require('./ua.cjs') }); const p = await ctx.newPage();
  const port = process.argv[2] || 8765;
  await p.goto(`http://localhost:${port}/`); await p.waitForTimeout(2000);
  for (const [label, off] of [['réouverture', false], ['hors ligne', true]]) {
    await ctx.setOffline(off);
    try { await p.goto(`http://localhost:${port}/`); await p.waitForTimeout(800); console.log(label, ':', await p.textContent('.lock-title').catch(() => 'PAS DE PAGE'), '| SW actif :', await p.evaluate(() => !!navigator.serviceWorker.controller)); }
    catch (e) { console.log(label, ': ÉCHEC', e.message.split('\n')[0]); }
  }
  await b.close();
})();
