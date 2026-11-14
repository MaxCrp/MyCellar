// v2.1.4 : adaptation à Android (téléphone Android simulé), et noms selon l'appareil
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: ANDROID, viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  const noIphone = async label => { const t = await p.evaluate(() => document.body.innerText + ' ' + (document.querySelector('#layer')?.innerText || '')); ok(`aucun « iPhone » affiché : ${label}`, !/iPhone|iCloud/.test(t), (t.match(/.{0,40}(iPhone|iCloud).{0,40}/) || [''])[0]); };

  /* ---------- Détection et textes ---------- */
  ok('appareil reconnu : Android', await p.evaluate(() => DEVICE === 'android' && isAndroid && !isApple));
  if (await p.$('#intro')) {
    const it = await p.evaluate(() => document.querySelector('#intro').innerText);
    ok('présentation : « ton téléphone », sans iPhone', it.includes('ton téléphone') && !/iPhone|iCloud/.test(it), it.slice(0, 120));
    await p.click('#intro [data-act=introDone]');
  }
  ok('écran de création : « ce téléphone » et lien d’installation', await p.evaluate(() => document.body.innerText.includes('ce téléphone') && !!document.querySelector('[data-act=installApp]')));
  await noIphone('création de la cave');
  await p.screenshot({ path: D + '220-android-creation.png' });

  /* ---------- Installation ---------- */
  const man = await p.evaluate(async () => {
    const m = await (await fetch('manifest.webmanifest')).json();
    const icons = await Promise.all(m.icons.map(async i => ({ ...i, st: (await fetch(i.src)).status })));
    return { m, icons, sw: !!(await navigator.serviceWorker.getRegistration()) };
  });
  ok('manifeste : plein écran, adresse de départ, identifiant', man.m.display === 'standalone' && !!man.m.start_url && !!man.m.id);
  ok('icônes 192 et 512 présentes', ['192x192', '512x512'].every(s => man.icons.some(i => i.sizes === s && i.st === 200 && !i.purpose)));
  ok('icône adaptée à Android (maskable) présente', man.icons.some(i => i.purpose === 'maskable' && i.st === 200));
  ok('fichier d’installation actif (hors ligne)', man.sw);
  // Bouton « Installer » : utilise la fenêtre d'installation d'Android quand Chrome la propose
  const prompted = await p.evaluate(async () => {
    let called = false; const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { called = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(e); await installApp(); return { called, prevented: e.defaultPrevented, sheet: !!document.querySelector('.sheet') };
  });
  ok('« Installer » ouvre la fenêtre d’installation d’Android', prompted.called && prompted.prevented && !prompted.sheet, JSON.stringify(prompted));
  await p.click('[data-act=installApp]'); await p.waitForTimeout(200);
  ok('sans fenêtre d’Android : marche à suivre pour Chrome', await p.evaluate(() => /Chrome.*⋮.*Installer l’application/s.test(document.querySelector('.sheet')?.innerText || '')));
  await p.evaluate(() => closeSheet());

  /* ---------- Création de la cave, déverrouillage biométrique ---------- */
  await p.fill('input[name=p1]', 'ma cave secrète android'); await p.fill('input[name=p2]', 'ma cave secrète android');
  await p.click('#f-setup [type=submit]'); await p.waitForTimeout(2500);
  const offer = await p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  ok('proposition au premier lancement : « Empreinte ou visage »', offer.includes('Empreinte ou visage') && offer.includes('empreinte') && !offer.includes('Face ID'), offer.slice(0, 120));
  ok('icône d’empreinte', await p.evaluate(() => !!document.querySelector('.sheet [data-act=pkOffer] svg') && document.querySelector('.sheet [data-act=pkOffer]').innerHTML === document.querySelector('.sheet [data-act=pkOffer]').innerHTML.replace(ICON.face, '')));
  // Téléphone sans extension PRF : message clair, option signalée
  await p.evaluate(() => { window.pkCreate = async () => { throw new Error('noprf'); }; });
  await p.click('.sheet [data-act=pkOffer]'); await p.waitForTimeout(400);
  const msg = await p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  ok('sans prise en charge : message pour Android, sans trousseau iCloud', msg.includes('empreinte ou le visage') && msg.includes('mot de passe') && !msg.includes('iCloud'), msg.slice(0, 160));
  await p.evaluate(() => { closeSheet(); view = 'plus'; render(); }); await p.waitForTimeout(400);
  const set = await p.evaluate(() => document.querySelector('.view').innerText);
  ok('Réglages : « Empreinte ou visage », pas encore pris en charge', set.includes('Empreinte ou visage') && set.includes('Pas encore pris en charge par ce téléphone') && !set.includes('Face ID'));
  ok('Réglages : « Rester déverrouillé » sur ce téléphone', set.includes('sans mot de passe sur ce téléphone'));
  ok('Réglages : données protégées (stockage persistant)', /Données protégées/.test(set) && await p.evaluate(() => persisted !== null));
  ok('Réglages : « Installer l’application » (ouverte dans le navigateur)', set.includes('Installer l’application'));
  await noIphone('Réglages');
  await p.screenshot({ path: D + '221-android-reglages.png', fullPage: true });
  // Écran de verrouillage avec une clé d'accès enregistrée
  await p.evaluate(() => { lockHasPk = true; renderLock('unlock'); });
  const lock = await p.evaluate(() => document.body.innerText);
  ok('verrouillage : « Déverrouiller avec ton empreinte ou ton visage »', lock.includes('Déverrouiller avec ton empreinte ou ton visage') && !lock.includes('Face ID'));
  await p.screenshot({ path: D + '222-android-verrou.png' });
  await p.fill('input[name=p1]', 'ma cave secrète android'); await p.click('#f-unlock [type=submit]'); await p.waitForTimeout(2500);

  /* ---------- Démo : bouton retour, clavier, impression, autres écrans ---------- */
  await p.evaluate(() => { S = normalize(demoData()); mode = 'demo'; enterApp(); }); await p.waitForTimeout(400);
  for (const v of ['cave', 'deg', 'boire', 'somm', 'plus']) { await p.evaluate(v => { view = v; render(); }, v); await p.waitForTimeout(150); await noIphone('onglet ' + v); }
  await p.evaluate(() => { view = 'cave'; caveMode = 'plan'; render(); }); await p.waitForTimeout(300);
  const back = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(300); };
  const st = () => p.evaluate(() => ({ sheets: sheetStack.length, view, search: caveSearchOpen, armed: backArmed }));
  ok('onglet Cave sans rien d’ouvert : pas de garde (le retour quitte l’app)', !(await st()).armed);
  await p.evaluate(() => { showSheet(() => wineSheet(S.wines[0].id)); }); await p.waitForTimeout(200);
  await p.evaluate(() => { showSheet(() => bottleSheet(S.bottles.find(x => inCave(x)).id)); }); await p.waitForTimeout(200);
  ok('deux fenêtres ouvertes : garde posée', (await st()).armed && (await st()).sheets === 2);
  await back(); let s = await st();
  ok('retour : revient à la fenêtre précédente', s.sheets === 1 && s.armed, JSON.stringify(s));
  await back(); s = await st();
  ok('retour : ferme la fenêtre', s.sheets === 0 && !s.armed, JSON.stringify(s));
  await p.click('[data-act=go][data-v=boire]'); await p.waitForTimeout(300);
  await back(); s = await st();
  ok('retour depuis « À boire » : onglet Cave', s.view === 'cave' && !s.armed, JSON.stringify(s));
  await p.click('.sfab'); await p.waitForTimeout(300);
  const kb = await p.evaluate(() => ({ kbd: document.documentElement.classList.contains('kbd'), tabs: getComputedStyle(document.querySelector('.tabs')).display, bottom: getComputedStyle(document.querySelector('.csearch')).bottom }));
  ok('recherche : clavier, barre d’onglets cachée, champ au ras du clavier', kb.kbd && kb.tabs === 'none' && kb.bottom === '0px', JSON.stringify(kb));
  await p.screenshot({ path: D + '223-android-recherche.png' });
  // Toucher la croix ou « Annuler » ne déplace pas la barre sous le doigt
  const y0 = await p.evaluate(() => { document.querySelector('.csearch input').blur(); return document.querySelector('.csearch').getBoundingClientRect().top; }); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.csearch .cancel').focus()); await p.waitForTimeout(150);
  ok('bouton touché (clavier fermé) : la barre ne bouge pas', await p.evaluate(() => !document.documentElement.classList.contains('kbd')));
  await p.evaluate(() => document.querySelector('.csearch input').focus()); await p.waitForTimeout(100);
  await back(); s = await st();
  ok('retour : ferme la recherche', !s.search && await p.evaluate(() => !document.querySelector('.csearch')), JSON.stringify(s));
  ok('clavier fermé : barre d’onglets revenue', await p.evaluate(() => !document.documentElement.classList.contains('kbd') && getComputedStyle(document.querySelector('.tabs')).display !== 'none'));
  // Fenêtre fermée par son bouton : la garde est retirée, le retour suivant quitterait l'app
  await p.evaluate(() => showSheet(() => wineSheet(S.wines[0].id))); await p.waitForTimeout(200);
  await p.click('.sheet .shead [data-act=close]'); await p.waitForTimeout(300);
  ok('fenêtre fermée par sa croix : garde retirée', !(await st()).armed);
  // Impression en PDF
  await p.evaluate(() => { window.print = () => {}; printInventory(); }); await p.waitForTimeout(200);
  ok('PDF : conseil « Enregistrer au format PDF »', await p.evaluate(() => (document.querySelector('#toast')?.innerText || '').includes('Enregistrer au format PDF')));
  // Export : téléchargement quand la feuille de partage n'accepte pas le fichier
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.evaluate(() => { navigator.canShare = () => false; exportXlsx(); })]);
  ok('export Excel : fichier téléchargé', !!dl && /\.xlsx$/.test(dl.suggestedFilename()), dl?.suggestedFilename());
  // Photo (v2.1.5) : Android propose « Prendre une photo » (appareil photo) ou « Choisir dans mes photos » (galerie)
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.evaluate(() => { closeSheet(); window.__got = []; window.onPhoto = f => __got.push('label:' + f?.name); window.onTastePhoto = f => __got.push('taste:' + f?.name); ACT.addWine(); }); await p.waitForTimeout(200);
  await p.click('.sheet [data-act=scanLabel]'); await p.waitForTimeout(200);
  const ch = await p.evaluate(() => ({ cam: !!document.querySelector('.sheet [data-act=photoCam]'), lib: !!document.querySelector('.sheet [data-act=photoLib]'), t: document.querySelector('.sheet')?.innerText || '' }));
  ok('Android : « Prendre une photo » ou « Choisir dans mes photos »', ch.cam && ch.lib && ch.t.includes('Prendre une photo'), ch.t.slice(0, 80));
  await p.screenshot({ path: D + '224-android-photo.png' });
  const pick = async (act, name) => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(`.sheet [data-act=${act}]`)]); const el = await fc.element().evaluate(e => ({ id: e.id, cap: e.getAttribute('capture') })); await fc.setFiles({ name, mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(200); return el; };
  const c1 = await pick('photoCam', 'cam.png');
  ok('« Prendre une photo » ouvre l’appareil photo', c1.cap === 'environment' && c1.id === 'f-cam', JSON.stringify(c1));
  ok('le choix se ferme, on revient à la fiche du vin', await p.evaluate(() => sheetStack.length === 1 && !document.querySelector('.sheet [data-act=photoCam]')));
  await p.click('.sheet [data-act=scanLabel]'); await p.waitForTimeout(200);
  const c2 = await pick('photoLib', 'galerie.png');
  ok('« Choisir dans mes photos » ouvre la galerie', c2.id === 'f-photo3' && !c2.cap, JSON.stringify(c2));
  await p.evaluate(() => { closeSheet(); startTaste(S.wines.find(w => w.kind === 'vin').id); }); await p.waitForTimeout(300);
  await p.click('.sheet [data-act=tphoto]'); await p.waitForTimeout(200);
  await pick('photoCam', 'degust.png');
  const got = await p.evaluate(() => __got);
  ok('photos remises à la bonne lecture (étiquette, dégustation)', got.join() === 'label:cam.png,label:galerie.png,taste:degust.png', got.join());
  await p.evaluate(() => closeSheet());
  ok('photo d’étiquette : sélecteur d’images sans prise de vue imposée', await p.evaluate(() => { const i = document.querySelector('#f-photo3'); return i.accept.includes('image/*') && !i.hasAttribute('capture'); }));
  ok('fenêtre adaptée au clavier d’Android (resizes-content)', await p.evaluate(() => document.querySelector('meta[name=viewport]').content.includes('interactive-widget=resizes-content')));
  ok('aucune erreur (Android)', !errs.length, errs.join(' | '));
  await ctx.close();

  /* ---------- iPhone et iPad : Face ID, textes inchangés ---------- */
  for (const [name, ua, dev] of [['iPhone', IPHONE, 'iphone'], ['iPad', IPAD, 'ipad']]) {
    const c = await b.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const q = await c.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto('http://localhost:8765/'); await q.waitForTimeout(500); if (await q.$('#intro')) await q.click('#intro [data-act=introDone]');
    const r = await q.evaluate(() => ({ dev: DEVICE, bio: BIO, txt: document.body.innerText }));
    ok(`${name} reconnu, déverrouillage « Face ID »`, r.dev === dev && r.bio === 'Face ID', `${r.dev} · ${r.bio}`);
    ok(`${name} : « cet ${name} » sur l’écran de création`, r.txt.includes('cet ' + name));
    await q.evaluate(() => { history.pushState({}, ''); }); await q.click('[data-act=demo]'); await q.waitForTimeout(300);
    await q.evaluate(() => showSheet(() => wineSheet(S.wines[0].id))); await q.waitForTimeout(300);
    ok(`${name} : pas de garde de retour`, await q.evaluate(() => !backArmed));
    ok(`${name} : aucune erreur`, !e2.length, e2.join(' | '));
    await c.close();
  }
  const c3 = await b.newContext({ viewport: { width: 1200, height: 800 } }); const q3 = await c3.newPage();
  await q3.goto('http://localhost:8765/'); await q3.waitForTimeout(500);
  ok('ordinateur : textes neutres (« Clé d’accès », « cet appareil »)', await q3.evaluate(() => DEVICE === 'autre' && BIO === 'Clé d’accès' && DEV === 'cet appareil'));
  await c3.close();

  await b.close();
  console.log(fail ? `${fail} échec(s)` : 'Tout est bon');
  process.exit(fail ? 1 : 0);
})();
