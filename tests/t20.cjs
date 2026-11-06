// v2.1.1 : photo d'étiquette prise ou choisie dans la photothèque
const { chromium } = require('playwright');
const fs = require('fs');
const D = __dirname + '/shots/'; fs.mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
const PNG = fs.readFileSync(__dirname + '/../src/static/icon-192.png');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData());
    const text = JSON.stringify({ kind: 'vin', couleur: 'blanc', domaine: 'Domaine Photothèque', cuvee: 'Souvenir', appellation: 'Vouvray', region: 'Loire', pays: 'France', millesime: '2021', cepages: 'Chenin', degre: '12', format: '75', cat: '', age: '', fut: '' });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1500, output_tokens: 200 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  await p.evaluate(() => { S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; });
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  const choose = async (sel, file) => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(sel)]); const id = await fc.element().evaluate(e => e.id); await fc.setFiles(file); await p.waitForTimeout(600); return id; };

  const att = await p.evaluate(() => ({ cam: document.querySelector('#f-photo').getAttribute('capture'), lib: document.querySelector('#f-photo3').hasAttribute('capture') }));
  ok('appareil photo imposé seulement pour « Prendre une photo »', att.cam === 'environment' && att.lib === false, JSON.stringify(att));
  // Nouveau vin
  await p.evaluate(() => ACT.addWine()); await p.waitForTimeout(150);
  ok('« Photo de l’étiquette » : deux choix', /Prendre une photo/.test(await sheet()) && /Choisir dans mes photos/.test(await sheet()));
  await p.screenshot({ path: D + '200-photo-choix.png' });
  const used = await choose('.sheet [data-act=scanLabel][data-lib]', { name: 'IMG_0420.png', mimeType: 'image/png', buffer: PNG });
  ok('« Choisir dans mes photos » ouvre la photothèque', used === 'f-photo3', used);
  const f = await p.evaluate(() => ({ dom: document.querySelector('.sheet input[name=domaine]')?.value, photo: !!draft?.photo, img: !!document.querySelector('.sheet img.photo') }));
  ok('photo choisie lue par le sommelier, fiche pré-remplie', f.dom === 'Domaine Photothèque' && f.photo && f.img, JSON.stringify(f));
  await p.evaluate(() => { draft = null; closeSheet(); });
  // Prendre une photo : toujours l'appareil photo
  await p.evaluate(() => ACT.addWine()); await p.waitForTimeout(150);
  ok('« Prendre une photo » : appareil photo', await choose('.sheet [data-act=scanLabel]:not([data-lib])', { name: 'cam.png', mimeType: 'image/png', buffer: PNG }) === 'f-photo');
  await p.evaluate(() => { draft = null; closeSheet(); });
  // Format illisible
  await p.evaluate(() => ACT.addWine()); await p.waitForTimeout(150);
  await choose('.sheet [data-act=scanLabel][data-lib]', { name: 'abime.heic', mimeType: 'image/heic', buffer: Buffer.from('pas une image') });
  ok('photo illisible : message clair', /Photo illisible/.test(await sheet()) && /Prendre une photo/.test(await sheet()));
  await p.evaluate(() => closeSheet());
  // Dégustation et révélation : mêmes deux choix
  await p.evaluate(() => ACT.newTaste({ dataset: {} })); await p.waitForTimeout(150);
  ok('nouvelle dégustation : deux choix', !!(await p.$('.sheet [data-act=scanTaste][data-lib]')) && !!(await p.$('.sheet [data-act=scanTaste]:not([data-lib])')));
  await p.evaluate(() => closeSheet());
  // Modifier une fiche : changer la photo depuis la photothèque
  const wid = await p.evaluate(() => S.wines.find(w => w.kind === 'vin' && !w.photo).id);
  await p.evaluate(id => ACT.editWine({ dataset: { id } }), wid); await p.waitForTimeout(150);
  ok('modifier une fiche : « Choisir dans mes photos »', !!(await p.$('.sheet [data-act=editPhoto][data-lib]')));
  await choose('.sheet [data-act=editPhoto][data-lib]', { name: 'IMG_0421.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForFunction(() => !!draft?.photo, null, { timeout: 8000 }).catch(() => {});
  ok('photo remplacée sans nouvelle lecture', await p.evaluate(() => !!draft?.photo && !!document.querySelector('.sheet img.photo[src]')));
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(400);
  ok('photo enregistrée avec la fiche', await p.evaluate(id => !!wine(id).photo, wid));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
