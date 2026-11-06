// v2.1 : import des dégustations Ploc (CSV). Fichier fictif au format exact de l'export reçu (Windows-1252, « ; », mêmes colonnes).
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
// Encodage Windows-1252 (latin-1, plus € → 0x80, ’ → 0x92)
const cp1252 = s => Buffer.from([...s].map(ch => ch === '€' ? 0x80 : ch === '’' ? 0x92 : ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 0x3F));
const HEAD = '"Date";"Nom du vin";"Millésime";"Lieu";"Note";"EmotiPLOC";"Couleur";"Personnes présentes";"Plats";"Commentaires";"IdVin"';
const ROWS = [
  '"16/01/2023";"Domaine Fictif - Côte Imaginaire";2020;"Salle Test";70;"COOL";"#751A17";"Club Test,";"";"";""',
  '"16/01/2023";"Chablis - Jean Exemple";2021;"";84;"WAOUH";"#FFD464";"";"Poisson";"Très minéral, 30€";""',
  '"16/01/2023";"Morgon Côte du Py - Jean Foillard";2022;"";76;"COOL";"#C3233A";"";"";"Notes ""fines""\r\nsur deux lignes";"ID-1"',
  '"25/12/2022";"Effervescent Test Brut";;"";;"";"#F3A200";"";"";"À compléter ";""',
  '"01/02/2024";"Seul Vin";2019;"";100;"WAOUH";"";"";"";"";""',
  '"32/13/2023";"Ligne invalide";2019;"";50;"";"";"";"";"";""',
];
const FILE = cp1252([HEAD, ...ROWS].join('\r\n') + '\r\n');
const AI = {
  'Domaine Fictif - Côte Imaginaire': { domaine: 'Domaine Fictif', appellation: 'Côte Imaginaire', cuvee: '', region: 'Sud-Ouest', pays: 'France', couleur: '' },
  'Chablis - Jean Exemple': { domaine: 'Jean Exemple', appellation: 'Chablis', cuvee: '', region: 'Bourgogne', pays: 'France', couleur: '' },
  'Morgon Côte du Py - Jean Foillard': { domaine: 'Jean Foillard', appellation: 'Morgon', cuvee: 'Côte du Py', region: 'Beaujolais', pays: 'France', couleur: '' },
  'Effervescent Test Brut': { domaine: 'Maison Test', appellation: 'Crémant', cuvee: 'Brut', region: '', pays: 'France', couleur: 'effervescent' },
  'Seul Vin': { domaine: '', appellation: '', cuvee: 'Seul Vin', region: '', pays: '', couleur: 'rouge' },
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  let aiCalls = 0;
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://api.anthropic.com/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData()), msg = body.messages.at(-1).content.map(c => c.text || '').join('\n');
    aiCalls++;
    const items = [...msg.matchAll(/#(\d+) nom « (.*?) »/g)].map(m => ({ i: +m[1], ...(AI[m[2]] || { domaine: '', appellation: '', cuvee: m[2], region: '', pays: '', couleur: '' }) }));
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items }) }], usage: { input_tokens: 2000, output_tokens: 800 } }) });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  await p.evaluate(() => { S.settings.ai.key = 'sk-ant-test'; S.settings.ai.auto = false; });
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  const pick = async () => {
    await p.evaluate(() => { closeSheet(); ACT.importPloc(); }); await p.waitForTimeout(150);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.sheet [data-act=plocCsvPick]')]);
    await fc.setFiles({ name: 'Dégustations.csv', mimeType: 'text/csv', buffer: FILE }); await p.waitForTimeout(400);
  };

  /* Lecture : fichier Windows-1252 */
  await pick();
  const s0 = await sheet();
  ok('5 dégustations lues, 1 ligne ignorée (date illisible)', /5 dégustations lues/.test(s0) && /1 ligne ignorée/.test(s0) && /ligne 7/.test(s0), s0.slice(0, 200));
  const parsed = await p.evaluate(() => degImport.items.map(x => ({ nom: x.nom, at: x.at, mill: x.mill, note: x.note, coul: x.couleur, conv: x.convives, plat: x.plat, com: x.comment })));
  ok('accents et € lus correctement (Windows-1252)', parsed[0].nom === 'Domaine Fictif - Côte Imaginaire' && parsed[1].com === 'Très minéral, 30€', parsed[1].com);
  ok('dates, notes sur 100 → sur 20, millésime vide', parsed[0].at === '2023-01-16' && parsed[0].note === 14 && parsed[1].note === 17 && parsed[4].note === 20 && parsed[3].note === null && parsed[3].mill === null, JSON.stringify(parsed.map(x => [x.at, x.note, x.mill])));
  ok('guillemets et retour à la ligne dans un commentaire', parsed[2].com === 'Notes "fines"\nsur deux lignes', JSON.stringify(parsed[2].com));
  ok('convives sans virgule finale, « À compléter » ignoré, plat repris', parsed[0].conv === 'Club Test' && parsed[3].com === '' && parsed[1].plat === 'Poisson');
  ok('couleurs : codes connus traduits, ambigu laissé au sommelier', parsed[0].coul === 'rouge' && parsed[1].coul === 'blanc' && parsed[2].coul === 'rouge' && parsed[3].coul === '' && parsed[4].coul === '');
  ok('coût annoncé avant le sommelier', /Coût indicatif/.test(s0));
  /* Sommelier, vérification */
  await p.click('.sheet [data-act=degAi]'); await p.waitForTimeout(600);
  const rv = await sheet();
  ok('écran de vérification : séance du 16 janv. 2023 · Salle Test · 3', /Séance du 16 janv\. 2023 · Salle Test · 3/.test(rv), rv.slice(0, 300));
  ok('vin de la cave reconnu (Morgon Côte du Py 2022)', await p.evaluate(() => { const w = degImport.wines.find(x => /Morgon/.test(x.nom)); return !!w.match && wine(w.match).domaine === 'Jean Foillard'; }));
  ok('champs complétés par le sommelier « à vérifier »', /à vérifier : région/.test(rv) || /à vérifier : .*région/.test(rv), (rv.match(/à vérifier[^·]*/g) || []).join(' | '));
  ok('effervescent reconnu malgré le code ambigu', await p.evaluate(() => degImport.wines.find(x => /Effervescent/.test(x.nom)).couleur === 'effervescent'));
  ok('vin sans domaine ni appellation : « à compléter »', /à compléter/.test(rv));
  await p.screenshot({ path: D + '180-deg-verif.png' });
  // Corriger un vin
  const k = await p.evaluate(() => degImport.wines.find(x => x.nom === 'Seul Vin').k);
  await p.click(`.sheet [data-act=degEdit][data-k="${k}"]`); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=domaine]', 'Domaine Solitaire'); await p.fill('.sheet input[name=appellation]', 'Cahors');
  await p.click('.sheet form [type=submit]'); await p.waitForTimeout(200);
  ok('vin corrigé à la main', await p.evaluate(k => { const w = degImport.wines.find(x => x.k === k); return w.domaine === 'Domaine Solitaire' && w.appellation === 'Cahors'; }, k));
  /* Import */
  const before = await p.evaluate(() => ({ t: S.tastings.length, s: S.sessions.length, w: S.wines.length }));
  await p.click('.sheet [data-act=degGo]'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const T = S.tastings.filter(t => t.ploc), sess = S.sessions.find(s => s.date === '2023-01-16');
    return { n: T.length, sessT: sess ? T.filter(t => t.sessionId === sess.id).length : 0, sessTitle: sess?.titre, single: T.find(t => t.at === '2024-02-01'), mor: T.find(t => t.at === '2023-01-16' && wine(t.wineId).domaine === 'Jean Foillard'),
      eff: wine(T.find(t => t.at === '2022-12-25').wineId).couleur, solo: wine(T.find(t => t.at === '2024-02-01').wineId).domaine, horsStock: S.bottles.filter(b => b.state === 'out').length };
  });
  ok('5 dégustations importées', r.n === 5, r.n);
  ok('séance du 16/01/2023 : 3 dégustations, titre « Salle Test »', r.sessT === 3 && r.sessTitle === 'Salle Test', JSON.stringify({ n: r.sessT, t: r.sessTitle }));
  ok('date isolée : dégustation simple, sans séance', r.single && !r.single.sessionId);
  ok('dégustation rattachée au vin de la cave', !!r.mor);
  ok('couleur et correction reprises sur les nouveaux vins', r.eff === 'effervescent' && r.solo === 'Domaine Solitaire');
  ok('journal : « importée de Ploc »', /importée de Ploc/.test(await p.evaluate(() => document.querySelector('.view').textContent)));
  await p.screenshot({ path: D + '181-deg-journal.png' });
  /* Second import : sans doublon */
  await pick();
  await p.click('.sheet [data-act=degAi]'); await p.waitForTimeout(600);
  ok('second import : tout est « déjà importée »', /Rien de nouveau à importer/.test(await sheet()) && (await sheet()).match(/déjà importée/g)?.length === 5);
  await p.evaluate(() => closeSheet());

  /* Variantes : UTF-8, « , », sans en-tête, dates ISO et en toutes lettres, notes sur 20 */
  const v = await p.evaluate(() => {
    const txt = '2024-03-12,"Vin A, cuvée B",2018,Paris,15.5,,#8E1521,,,"ok",\n12 mars 2024,Vin C,2019,,17,,,,,,\n';
    const rows = parseCsv(decodeText(new TextEncoder().encode(txt).buffer)), r = csvTastings(rows);
    return { n: r.items.length, a: r.items[0] && [r.items[0].at, r.items[0].nom, r.items[0].note, r.items[0].lieu], c: r.items[1] && [r.items[1].at, r.items[1].note], scale: r.scale100 };
  });
  ok('variante UTF-8 « , » sans en-tête, notes sur 20 gardées', v.n === 2 && JSON.stringify(v.a) === '["2024-03-12","Vin A, cuvée B",15.5,"Paris"]' && JSON.stringify(v.c) === '["2024-03-12",17]' && !v.scale, JSON.stringify(v));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
