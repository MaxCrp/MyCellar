// Génère les icônes PNG de l'app (src/static/icon-*.png) à partir du logo SVG.
// Usage : node tools/icons.cjs   (nécessite Playwright)
const { chromium } = require('playwright');
const path = require('path');
const svg = s => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" fill="#6E1E2F"/><path d="M22 13h20l-1.6 13.5a8.4 8.4 0 0 1-16.8 0z" fill="#F7F3EC"/><path d="M23.1 21.5h17.8l-.7 5a8.2 8.2 0 0 1-16.4 0z" fill="#C2485A"/><path d="M32 35.5v12M25 49.5h14" stroke="#F7F3EC" stroke-width="3" stroke-linecap="round"/></svg>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const s of [180, 192, 512]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<html><body style="margin:0">${svg(s)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, '..', 'src', 'static', `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
