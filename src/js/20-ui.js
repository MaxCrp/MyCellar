/* ---------- Icônes ---------- */
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  cave: sv('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16"/>'),
  somm: sv('<path d="M8 3h8l-.6 6.2a3.4 3.4 0 0 1-6.8 0z"/><path d="M12 12.6V20M8.5 21h7"/>'),
  boire: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  plus: sv('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'),
  add: sv('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.2"'),
  search: sv('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  back: sv('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2"'),
  close: sv('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2"'),
  camera: sv('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  doc: sv('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h6M9.5 16h6"/>'),
  copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'),
  newchat: sv('<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1.1-4.2A7.5 7.5 0 1 1 20 12.5z"/><path d="M12.5 9v7M9 12.5h7"/>'),
  pin: sv('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  lock: sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  trash: sv('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  move: sv('<path d="M5 12h14M15 8l4 4-4 4M9 16l-4-4 4-4"/>'),
  out: sv('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
  box: sv('<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>'),
  chev: sv('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2"'),
  send: sv('<path d="M5 12h13M13 6l6 6-6 6"/>', 'stroke-width="2.2"'),
  spark: sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
  truck: sv('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  cal: sv('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  bottle: sv('<path d="M10 2h4v4l1.5 3v12h-7V9L10 6z"/><path d="M8.5 13h7"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7"/>', 'stroke-width="2.2"'),
  down: sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  up: sv('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  info: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  star: sv('<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7L8.2 13.3l-4-3.7 5.4-.6z"/>'),
  face: sv('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.6 1.2 4.4 1.2 6 0"/>'),
  notes: sv('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/><path d="M12 8h4M12 11.5h4M12 15h2.5"/><path d="M5 7H3.5M5 12H3.5M5 17H3.5"/>'),
  cork: sv('<g transform="rotate(-38 12 12)"><path d="M5.6 6.8h11.2a3.6 5.2 0 0 1 0 10.4H5.6"/><ellipse cx="5.6" cy="12" rx="3.6" ry="5.2" fill="currentColor" fill-opacity=".28"/><path d="M11 9.8h.01M14.6 12.4h.01M11.6 14.6h.01M16.8 9.6h.01M9.2 12.4h.01M17.4 14.6h.01" stroke-width="2.4"/></g>'),
  glass: sv('<path d="M7 3h10l-.8 7a4.2 4.2 0 0 1-8.4 0z"/><path d="M12 14.5V20M8.5 21h7"/>'),
};
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#6E1E2F"/><path d="M22 14h20l-1.6 13a8.4 8.4 0 0 1-16.8 0z" fill="#F7F3EC"/><path d="M23.2 22h17.6l-.6 5a8.2 8.2 0 0 1-16.4 0z" fill="#B8424F"/><path d="M32 36v11M25 49h14" stroke="#F7F3EC" stroke-width="3" stroke-linecap="round"/></svg>`;

/* ---------- Feuilles (modales) ----------
   Chaque feuille est une fonction qui renvoie son HTML : la pile permet de revenir à la feuille
   précédente, et refreshSheet() la redessine après un changement d'état. */
let sheetStack = [];
function showSheet(fn, { replace = false, full = false } = {}) {
  if (replace) sheetStack.pop();
  // La fenêtre recouverte garde sa position de défilement, retrouvée au retour
  const cur = sheetStack[sheetStack.length - 1], el = $('.sheet');
  if (cur && el && el.__top === cur) cur.y = el.scrollTop;
  sheetStack.push({ fn, full, u: uPending || fn.name || 'feuille' });
  paintSheet();
}
// Redessiner la fenêtre déjà affichée la met à jour sur place : elle n'est ni recréée ni réanimée
// (pas de clignotement), et le défilement est restauré une fois tout dessiné (roue, curseurs).
function paintSheet(keepScroll) {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) { $('#layer').innerHTML = ''; return; }
  const old = $('.sheet'), same = !!(keepScroll && old && old.__top === top);
  const y = same ? old.scrollTop : (top.y || 0);
  const back = sheetStack.length > 1 ? `<button class="icon-btn" data-act="sheetback" aria-label="Retour">${ICON.back}</button>` : '';
  let html = top.fn();
  if (html == null) { sheetStack.pop(); return paintSheet(); }
  html = html.replace('<!--back-->', back);
  let sh;
  if (same) { sh = old; sh.innerHTML = `<div class="grab"></div>${html}`; }
  else {
    $('#layer').innerHTML = `<div class="backdrop" data-act="close"></div><div class="sheet${top.full ? ' full' : ''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    sh = $('.sheet'); sh.__top = top;
  }
  afterSheet(); paintPhotos(sh);
  if (y) sh.scrollTop = y;
  uScreenCheck();
}
const refreshSheet = () => paintSheet(true);
function closeSheet() { sheetStack = []; $('#layer').innerHTML = ''; uScreenCheck(); }
function sheetBack() { sheetStack.pop(); paintSheet(); }
// Feuille ponctuelle (message, confirmation)
const openSheet = html => showSheet(() => html);
// Croix des barres de recherche : visible dès qu'un texte est saisi, efface tout d'un coup
const sx = v => `<button type="button" class="sx" data-act="searchClear" aria-label="Effacer la recherche"${v ? '' : ' hidden'}>${ICON.close}</button>`;
const head = (title, extra = '') => `<div class="shead"><!--back--><h2>${title}</h2>${extra}<button class="icon-btn" data-act="close" aria-label="Fermer">${ICON.close}</button></div>`;
const sheetMsg = (title, msg) => showSheet(() => `${head(esc(title))}<p style="white-space:pre-wrap">${esc(msg)}</p><button class="btn wide" data-act="sheetback">OK</button>`);
// Branchements effectués après chaque affichage (sliders, roue des arômes)
function afterSheet() {
  for (const r of $$('input[type=range]')) setRangeFill(r);
  if ($('#wheel')) paintWheel();
}
function setRangeFill(r) { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); }

/* ---------- Actions ----------
   Les boutons portent data-act="nom" ; chaque module ajoute ses actions à ACT.
   Les formulaires portent data-form="nom" ; FORMS reçoit (formulaire, données). */
const ACT = {}, FORMS = {}, INPUTS = {}, CHANGES = {};
// Affiche les erreurs sous les champs concernés ; renvoie vrai s'il y en a
function formErrors(f, errs) {
  $$('.ferr', f).forEach(e => e.remove()); $$('.bad', f).forEach(e => e.classList.remove('bad'));
  for (const [n, m] of errs) {
    const el = f.elements[n]; if (!el) continue;
    el.classList.add('bad');
    const s = document.createElement('span'); s.className = 'ferr'; s.textContent = m;
    (el.closest('label') || el.parentNode).appendChild(s);
  }
  if (errs.length) {
    const first = f.elements[errs[0][0]]; first?.closest('details')?.setAttribute('open', '');
    first?.scrollIntoView({ block: 'center' });
    toast(errs.length > 1 ? `${errs.length} champs à corriger` : errs[0][1]);
  }
  return errs.length > 0;
}
const formData = f => Object.fromEntries([...new FormData(f).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

/* ---------- Verrou ---------- */
const USERFIELD = '<input type="text" name="username" autocomplete="username" value="MyCellar" class="sr-only" tabindex="-1" aria-hidden="true" readonly>';
function renderLock(kind, err = '') {
  mode = 'locked'; closeSheet();
  const e = err ? `<p class="err" role="alert">${esc(err)}</p>` : '';
  const pk = kind === 'unlock' && lockHasPk && pkAvailable();
  app.innerHTML = `<main class="lock">
    <div class="lock-mark">${LOGO}</div>
    <h1 class="lock-title">MyCellar</h1>
    ${kind === 'setup' ? `
      <p class="lock-text">Ta cave reste sur cet iPhone, chiffrée avec un mot de passe que toi seul connais. Il ne peut pas être récupéré : range-le dans ton gestionnaire de mots de passe.</p>
      <form id="f-setup" class="lock-form" data-form="setup" autocomplete="on">${USERFIELD}
        <label>Mot de passe (10 caractères minimum)<input type="password" name="p1" autocomplete="new-password" required></label>
        <label>Confirmation<input type="password" name="p2" autocomplete="new-password" required></label>
        ${e}<button class="btn primary" type="submit">Créer ma cave</button>
      </form>
      <div class="lock-links"><button class="link" data-act="demo">Essayer avec une cave fictive</button><button class="link" data-act="import">Restaurer une sauvegarde</button></div>`
    : `
      <p class="lock-text">${pk ? 'Déverrouille avec Face ID, ou avec ton mot de passe.' : 'Saisis ton mot de passe pour ouvrir ta cave.'}</p>
      ${e}
      ${pk ? `<button class="btn primary wide" data-act="pkunlock">${ICON.face} Déverrouiller avec Face ID</button><p class="or">ou</p>` : ''}
      <form id="f-unlock" class="lock-form" data-form="unlock">${USERFIELD}
        <label>Mot de passe<input type="password" name="p1" autocomplete="current-password" required></label>
        <button class="btn ${pk ? '' : 'primary'}" type="submit">${pk ? 'Utiliser le mot de passe' : 'Déverrouiller'}</button>
      </form>
      <div class="lock-links"><button class="link" data-act="import">Restaurer une sauvegarde</button></div>`}
    ${!persistent ? '<p class="banner">Aperçu : rien n’est conservé dans cet environnement.</p>' : ''}
  </main>`;
}
function enterApp(via) { view = 'cave'; render(); window.scrollTo(0, 0); if (mode === 'app') { uStart(via); afterEnter(via); } }
function lockNow() {
  if (mode === 'demo') { wipeKeys(); return boot(); }
  uStop(hiddenAt ? 'auto' : 'manuel'); lockHasPk = !!slots?.pk; wipeKeys(); closeSheet(); renderLock('unlock');
}

/* ---------- Rendu principal ---------- */
function sitePill() {
  if (!isMulti()) return '';
  const s = site(S.settings.site);
  return `<button class="sitepill" data-act="pickSite"><span class="dot" style="background:${s?.role === 'stock' ? 'var(--gold)' : 'var(--green)'}"></span><span class="ell">${esc(s?.name || 'Site')}</span> ▾</button>`;
}
function banners() {
  const out = [];
  if (mode === 'demo') out.push('<p class="banner">Cave fictive : rien n’est enregistré. Touche « Quitter la démo » dans Plus pour créer ta cave.</p>');
  else if (!persistent) out.push('<p class="banner">Aperçu : rien n’est conservé dans cet environnement.</p>');
  // Relance de la note : le lendemain d'une bouteille bue sans dégustation
  const r = S.dismissed.rate, mid = new Date(); mid.setHours(0, 0, 0, 0);
  if (r && r.at < mid.getTime() && wine(r.wineId) && (view === 'cave' || view === 'boire')) out.push(`<div class="banner green"><b>${esc(wineTitle(wine(r.wineId)))}</b> : tu l’as ouvert récemment. Une note pour t’en souvenir ?
    <div class="row" style="gap:8px"><button class="btn small green" data-act="rateNow">Noter</button><button class="btn small ghost" data-act="rateLater">Non merci</button></div></div>`);
  const le = S.settings.lastExport;
  if (mode === 'app' && view === 'cave' && S.wines.length && (!le || Date.now() - le > 7 * 864e5) && S.dismissed.backup !== monthKey() + today()) out.push(`<div class="banner">${le ? 'Ta dernière sauvegarde date de plus d’une semaine.' : 'Ta cave n’est pas encore sauvegardée.'} Les données ne sont que sur cet iPhone.
    <div class="row" style="gap:8px"><button class="btn small primary" data-act="export">Sauvegarder</button><button class="btn small ghost" data-act="backupLater">Plus tard</button></div></div>`);
  return out.join('');
}
let lastView = null;
function render() {
  if (mode !== 'app' && mode !== 'demo') return;
  const keepY = lastView === view ? window.scrollY : null; lastView = view;
  const views = { cave: ['Cave', vCave], deg: ['Dégustations', vDeg], somm: ['Sommelier', vSomm], boire: ['À boire', vBoire], plus: ['Réglages', vPlus] };
  const [title, fn] = views[view];
  const tab = (v, l, i) => `<button class="tab${view === v ? ' on' : ''}" data-act="go" data-v="${v}" aria-label="${l}">${i}${l}</button>`;
  const body = fn();
  app.innerHTML = `
    <header class="top"><div class="top-row">${view === 'plus' ? `<button class="icon-btn" data-act="go" data-v="cave" aria-label="Retour" style="margin-left:-8px">${ICON.back}</button>` : ''}<h1>${title}</h1>${view === 'cave' || view === 'somm' ? sitePill() : ''}
      ${view !== 'plus' ? `<button class="icon-btn gear" data-act="go" data-v="plus" aria-label="Réglages">${ICON.gear}</button>` : ''}</div>${view === 'cave' ? caveTools() : view === 'deg' ? degTools() : ''}</header>
    <main class="view${view === 'somm' ? ' chat' : ''}">${banners()}${body}</main>
    ${view === 'somm' ? composer() : ''}
    <nav class="tabs" aria-label="Navigation">${tab('cave', 'Cave', ICON.cave)}${tab('deg', 'Dégustations', ICON.notes)}
      <button class="tab plus" data-act="add" aria-label="Ajouter"><span>${ICON.add}</span></button>
      ${tab('boire', 'À boire', ICON.boire)}${tab('somm', 'Sommelier', ICON.somm)}</nav>`;
  paintPhotos(app);
  for (const r of $$('input[type=range]', app)) setRangeFill(r);
  afterRender(); uScreenCheck();
  if (keepY) window.scrollTo(0, keepY);
}
function afterRender() {
  if (view !== 'somm') return;
  // L'espace sous la conversation suit la hauteur de l'encart flottant : la dernière réponse n'est jamais cachée
  const c = $('.composer');
  if (c) { compSize(c); if (window.ResizeObserver) { compObs ||= new ResizeObserver(es => es.forEach(e => compSize(e.target))); compObs.disconnect(); compObs.observe(c); } }
  const m = $('.chat'); if (m && chatScroll) { window.scrollTo(0, document.body.scrollHeight); chatScroll = false; }
}
let compObs = null;
const compSize = c => document.documentElement.style.setProperty('--comp-h', c.offsetHeight + 'px');
let chatScroll = false;

Object.assign(ACT, {
  go: t => { view = t.dataset.v; render(); window.scrollTo(0, view === 'somm' ? document.body.scrollHeight : 0); },
  close: () => { if (!guardTaste('close')) closeSheet(); },
  sheetback: () => { if (!guardTaste('back')) sheetBack(); },
  demoOnly: () => toast(DEMO_OFF),
  searchClear: t => {
    const i = t.closest('.search')?.querySelector('input'); if (!i) return;
    i.value = ''; t.hidden = true; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur();
  },
  codeupdate: () => applyCodeUpdate(),
  codeinfo: () => sheetCode(),
  codelater: () => { code.status = 'ok'; paintCode(); },
  codelaterclose: () => { code.status = 'ok'; paintCode(); closeSheet(); },
  codecheck: async () => { await checkNetwork(); closeSheet(); sheetCode(); },
  codeapprove: async () => {
    if (!confirm('Approuver ce code ? Ne le fais que si tu viens de mettre l’app à jour toi-même.')) return;
    await store.set('code', { fp: code.served, at: Date.now() }); code.approved = code.served; code.at = Date.now(); code.status = 'ok'; paintCode(); closeSheet();
  },
  pickSite: () => showSheet(() => `${head('Je suis à…')}
    <div class="list">${S.sites.map(s => `<button class="li" data-act="setSite" data-id="${s.id}"><span class="dot" style="background:${s.role === 'stock' ? 'var(--gold)' : 'var(--green)'}"></span>
      <div class="it"><b>${esc(s.name)}</b><small>${s.role === 'stock' ? 'Site de stockage' : 'Site de consommation'} · ${plural(S.bottles.filter(b => inCave(b) && siteOfBottle(b) === s.id).length, 'bouteille', 'bouteilles')}</small></div>
      ${s.id === S.settings.site ? `<span class="chev" style="color:var(--bx)">${ICON.check}</span>` : ''}</button>`).join('')}</div>
    <p class="small">Le sommelier te propose en priorité les bouteilles présentes sur ce site.</p>`),
  backupLater: async () => { S.dismissed.backup = monthKey() + today(); await save(); render(); },
  setSite: async t => { S.settings.site = t.dataset.id; caveSpace = null; await save(); closeSheet(); render(); },
});
