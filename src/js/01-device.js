/* ---------- Appareil (v2.1.4) ----------
   iPhone, iPad, Android ou autre, d'après l'identité annoncée par le navigateur (un iPad récent se dit « Macintosh » :
   on le reconnaît à son écran tactile). Sert à adapter les textes et quelques réglages, jamais à la sécurité.
   En cas de doute : textes neutres (« cet appareil », « Clé d'accès »). */
const DEVICE = (() => {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 0)) return 'ipad';
  if (/Android/i.test(ua)) return 'android';
  return 'autre';
})();
const isApple = DEVICE === 'iphone' || DEVICE === 'ipad', isAndroid = DEVICE === 'android';
const DEV = { iphone: 'cet iPhone', ipad: 'cet iPad', android: 'ce téléphone', autre: 'cet appareil' }[DEVICE];
const DEV_TON = { iphone: 'ton iPhone', ipad: 'ton iPad', android: 'ton téléphone', autre: 'ton appareil' }[DEVICE];
// Déverrouillage par clé d'accès : Face ID sur iPhone et iPad, empreinte ou visage sur Android
const BIO = isApple ? 'Face ID' : isAndroid ? 'Empreinte ou visage' : 'Clé d’accès';
const BIO_AVEC = isApple ? 'avec Face ID' : isAndroid ? 'avec ton empreinte ou ton visage' : 'avec une clé d’accès';
const BACKUP_DEST = isApple ? 'Fichiers ou iCloud Drive' : isAndroid ? 'Téléchargements ou Google Drive' : 'le dossier de ton choix';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* ---------- Installation (v2.1.4) ---------- */
// Chrome sur Android prévient quand l'app peut être installée : on garde l'événement pour notre bouton
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
addEventListener('appinstalled', () => { installEvt = null; if (typeof toast === 'function') toast('MyCellar est installée'); });
function installHelpHtml() {
  if (isApple) return `<p>Dans Safari, touche <b>Partager</b> (le carré avec une flèche), puis <b>« Sur l’écran d’accueil »</b>. MyCellar s’ouvrira ensuite en plein écran, comme une app, et fonctionnera sans réseau.</p>`;
  if (isAndroid) return `<p>Dans Chrome, touche le menu <b>⋮</b> en haut à droite, puis <b>« Installer l’application »</b> (ou « Ajouter à l’écran d’accueil »). MyCellar s’ouvrira ensuite en plein écran, comme une app, et fonctionnera sans réseau.</p>`;
  return `<p>Dans le menu de ton navigateur, cherche <b>« Installer »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</p>`;
}
async function installApp() {
  if (installEvt) {
    const e = installEvt; installEvt = null;
    try { e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') return; } catch {}
  }
  showSheet(() => `${head('Installer l’application')}${installHelpHtml()}<button class="btn wide" data-act="close">OK</button>`);
}

/* ---------- Clavier sur Android (v2.1.4) ---------- */
// Pendant la saisie, la barre d'onglets se cache et les champs du bas (recherche, sommelier) descendent au ras du clavier
if (isAndroid) {
  document.addEventListener('focusin', e => { if (e.target.closest?.('.csearch, .composer')) document.documentElement.classList.add('kbd'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement?.closest?.('.csearch, .composer')) document.documentElement.classList.remove('kbd'); }, 50));
}

/* ---------- Bouton retour d'Android (v2.1.4) ----------
   Une entrée d'historique « garde » existe tant que quelque chose peut être fermé (fenêtre, recherche, autre onglet).
   Le retour ferme alors cette chose ; depuis l'onglet Cave sans rien d'ouvert, il quitte l'app. Sans effet ailleurs. */
let backArmed = false, backSkip = false, backTimer = 0;
const backNeed = () => (mode === 'app' || mode === 'demo') && !!(sheetStack.length || view !== 'cave' || caveSearchOpen);
function syncBack() {
  if (!isAndroid) return;
  clearTimeout(backTimer);
  backTimer = setTimeout(() => {
    if (backSkip) return;   // un retour est en cours : on reprendra après
    const need = backNeed();
    if (need && !backArmed) { history.pushState({ mcBack: 1 }, ''); backArmed = true; }
    else if (!need && backArmed) { backArmed = false; backSkip = true; history.back(); }
  }, 0);
}
addEventListener('popstate', () => {
  if (!isAndroid) return;
  if (backSkip) { backSkip = false; return syncBack(); }
  if (!backArmed) return;
  backArmed = false;
  if (mode === 'app' || mode === 'demo') {
    if (sheetStack.length > 1) ACT.sheetback();
    else if (sheetStack.length) ACT.close();
    else if (view === 'cave' && caveSearchOpen) ACT.searchCancel();
    else if (view !== 'cave') { view = 'cave'; render(); window.scrollTo(0, 0); }
  }
  syncBack();
});

/* ---------- Données à garder (v2.1.4) ---------- */
// Demande au navigateur de ne jamais effacer les données de l'app (la cave n'existe que sur l'appareil)
let persisted = null;
async function askPersist() {
  try { persisted = await navigator.storage?.persisted?.() || await navigator.storage?.persist?.() || false; } catch { persisted = false; }
  return persisted;
}
