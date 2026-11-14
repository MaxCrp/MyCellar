// v2.1 : export Excel (.xlsx vérifié), inventaire imprimable, carte des vins (filtres, image, PDF), partage d'une dégustation
const { chromium } = require('playwright');
const fs = require('fs'), { spawnSync } = require('child_process');
const D = __dirname + '/shots/'; fs.mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  // Pas de feuille de partage dans le navigateur de test : téléchargement ; impression simulée
  await p.evaluate(() => { navigator.canShare = () => false; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; navigator.share = async o => { window.__shared = o; }; });
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');

  /* Excel */
  await p.click('[data-act=go][data-v=plus]'); await p.waitForTimeout(150);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportXlsx]')]);
  const xf = D + 'export.xlsx'; await dl.saveAs(xf);
  ok('fichier .xlsx téléchargé', /^mycellar-.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const py = spawnSync('python3', ['-I', '-c', `
import zipfile, sys, xml.dom.minidom as m, json
z = zipfile.ZipFile(sys.argv[1]); names = z.namelist()
for n in names: m.parseString(z.read(n))
wb = m.parseString(z.read('xl/workbook.xml'))
sheets = [s.getAttribute('name') for s in wb.getElementsByTagName('sheet')]
def rows(i):
  d = m.parseString(z.read('xl/worksheets/sheet%d.xml' % i)); out = []
  for r in d.getElementsByTagName('row'):
    out.append([ (c.getElementsByTagName('t')[0].firstChild.data if c.getElementsByTagName('t') and c.getElementsByTagName('t')[0].firstChild else (c.getElementsByTagName('v')[0].firstChild.data if c.getElementsByTagName('v') else '')) for c in r.getElementsByTagName('c') ])
  return out
inv, deg, mv = rows(1), rows(2), rows(3)
print(json.dumps({'ok': z.testzip() is None, 'sheets': sheets, 'inv': len(inv), 'invHead': inv[0][:3], 'deg': len(deg), 'mv': len(mv), 'accent': any('é' in ''.join(r) for r in inv)}))
`, xf], { encoding: 'utf8' });
  let x = {}; try { x = JSON.parse(py.stdout); } catch { console.log(py.stderr); }
  const exp = await p.evaluate(() => ({ inv: S.wines.filter(w => wineBottles(w.id).length || S.bottles.some(b => b.wineId === w.id && b.state === 'primeur')).length, deg: S.tastings.filter(t => tastingWine(t)).length, mv: S.moves.filter(m => wine(m.wineId)).length }));
  ok('classeur valide : 3 onglets Inventaire, Dégustations, Mouvements', x.ok && JSON.stringify(x.sheets) === '["Inventaire","Dégustations","Mouvements"]', JSON.stringify(x.sheets));
  ok('une ligne par vin, par dégustation, par mouvement (+ en-tête)', x.inv === exp.inv + 1 && x.deg === exp.deg + 1 && x.mv === exp.mv + 1, JSON.stringify({ x, exp }));
  ok('en-têtes et accents', JSON.stringify(x.invHead) === '["Vin","Domaine","Cuvée"]' && x.accent);

  /* Inventaire imprimable */
  await p.click('[data-act=printInventory]'); await p.waitForTimeout(250);
  const pr = await p.evaluate(() => ({ printed: window.__printed, h: !!document.querySelector('#print h1'), plans: document.querySelectorAll('#print .pplan').length, grids: S.units.filter(u => !UNIT_TYPES[u.type].box).length, hidden: getComputedStyle(document.querySelector('#print')).display }));
  ok('inventaire imprimable : impression lancée, un plan par meuble', pr.printed === 1 && pr.h && pr.plans === pr.grids, JSON.stringify(pr));
  ok('la page d’impression reste invisible à l’écran', pr.hidden === 'none');
  await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: D + '190-impression.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });

  /* Carte des vins */
  await p.evaluate(() => { const y = thisYear(), w = S.wines.find(x => x.kind === 'vin' && myBottles(x.id).length); w.apogee = { debut: y + 3, pic: y + 6, fin: y + 12, src: 'manuel' }; });
  await p.click('[data-act=wineCardSheet]'); await p.waitForTimeout(200);
  const cnt = () => p.evaluate(() => ({ shown: document.querySelectorAll('.sheet .wc-w').length, exp: cardWines().length }));
  const c0 = await cnt();
  ok('carte : tous mes vins, rangés par couleur et région', c0.shown === c0.exp && c0.shown > 5 && await p.evaluate(() => document.querySelectorAll('.sheet .wcard h2').length >= 2), JSON.stringify(c0));
  ok('vins des amis absents de la carte', await p.evaluate(() => cardWines().every(w => myBottles(w.id).length)));
  await p.click('.sheet [data-act=cardOpt][data-v=ready]'); await p.waitForTimeout(150);
  const c1 = await cnt();
  ok('« Prêts à boire » : moins de vins', c1.shown === c1.exp && c1.shown < c0.shown, JSON.stringify(c1));
  await p.click('.sheet [data-act=cardOpt][data-v=prices]'); await p.waitForTimeout(150);
  ok('« Avec les prix » : prix affichés', /€/.test(await p.evaluate(() => document.querySelector('.sheet .wcard').textContent)));
  await p.click('.sheet [data-act=cardColor][data-v=blanc]'); await p.waitForTimeout(150);
  ok('filtre couleur : blancs seulement', await p.evaluate(() => cardWines().every(w => w.couleur === 'blanc') && document.querySelectorAll('.sheet .wcard h2').length === 1));
  const site2 = await p.evaluate(() => S.sites[1].id);
  await p.click(`.sheet [data-act=cardSite][data-v="${site2}"]`); await p.waitForTimeout(150);
  ok('filtre site', await p.evaluate(s => cardWines().every(w => myBottles(w.id).some(b => siteOfBottle(b) === s)), site2));
  await p.screenshot({ path: D + '191-carte.png' });
  // Sélection à la main
  await p.evaluate(() => { cardOpt = { ready: false, site: '', colors: [], prices: false, counts: true, pick: null }; refreshSheet(); });
  await p.click('.sheet [data-act=cardPick]'); await p.waitForTimeout(150);
  const all = await p.evaluate(() => document.querySelectorAll('.sheet [data-act=cardPickW]').length);
  const keep = 2;
  for (let i = keep; i < all; i++) await p.evaluate(i => document.querySelectorAll('.sheet [data-act=cardPickW]')[i].click(), i);
  await p.waitForTimeout(150); await p.click('.sheet [data-act=sheetback]'); await p.waitForTimeout(150);
  ok('sélection à la main : 2 vins', (await cnt()).shown === 2 && /×\d/.test(await p.evaluate(() => document.querySelector('.sheet .wcard').textContent)));
  const [png] = await Promise.all([p.waitForEvent('download'), p.click('.sheet [data-act=cardImage]')]);
  const pf = D + 'carte.png'; await png.saveAs(pf); const buf = fs.readFileSync(pf);
  ok('carte en image : PNG produit', buf.slice(1, 4).toString() === 'PNG' && buf.length > 5000, buf.length + ' octets');
  await p.click('.sheet [data-act=cardPdf]'); await p.waitForTimeout(250);
  ok('carte en PDF : page d’impression', await p.evaluate(() => window.__printed === 2 && !!document.querySelector('#print .wcard')));

  /* Dégustation partagée */
  const tid = await p.evaluate(() => S.tastings.find(t => t.note != null && t.full?.aromes?.length && tastingWine(t)).id);
  await p.evaluate(id => showSheet(() => tasteView(id)), tid); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=tasteShareTxt]'); await p.waitForTimeout(150);
  const txt = await p.evaluate(() => window.__shared?.text || '');
  ok('dégustation en texte : vin, note, arômes', /\/ 20/.test(txt) && /Arômes/.test(txt) && /MyCellar/.test(txt), txt.split('\n').slice(0, 3).join(' | '));
  const [img] = await Promise.all([p.waitForEvent('download'), p.click('.sheet [data-act=tasteShareImg]')]);
  const tf = D + 'degustation.png'; await img.saveAs(tf); const tb = fs.readFileSync(tf);
  ok('dégustation en image : PNG produit', tb.slice(1, 4).toString() === 'PNG' && tb.length > 5000, tb.length + ' octets');
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
