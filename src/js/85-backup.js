/* ---------- Sauvegarde automatique sur Google Drive (v2.2) ----------
   Chaque utilisateur connecte son propre compte Google. Les sauvegardes (le même fichier chiffré que la sauvegarde
   manuelle) vont directement de l'appareil vers le dossier caché de l'app dans son Drive (appDataFolder, droit
   drive.appdata : l'app ne voit rien d'autre du Drive). Le petit service Cloudflare (worker/) ne sert qu'à échanger et
   renouveler l'autorisation avec le secret du projet Google ; il ne garde rien et ne voit jamais les sauvegardes.
   L'autorisation de longue durée est chiffrée avec la clé de la cave, à part (elle n'est pas dans les fichiers de sauvegarde).
   Rythme : quelques minutes après une modification (ou à la mise en arrière-plan), une nouvelle version au plus par heure
   (sinon la plus récente est mise à jour), 30 versions gardées. Rien n'est envoyé si la cave n'a pas changé. */
const GD_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GD_API = 'https://www.googleapis.com/drive/v3/files', GD_UP = 'https://www.googleapis.com/upload/drive/v3/files';
const GD_KEEP = 30, GD_HOUR = 3600e3;
let GD_SIMPLE_MAX = 4.5e6;   // au-delà : envoi en deux temps (abaissé par les tests)
let BK_DELAY = 120e3;   // attente après une modification avant d'envoyer (raccourcie par les tests)
const gd = { refresh: null, access: null, exp: 0, busy: false, timer: 0, ret: null, restoreFiles: null };
const gdConfigured = () => !!(GDRIVE_CFG.clientId && GDRIVE_CFG.workerUrl);
const gdOn = () => gdConfigured() && !!gd.refresh;
const bkState = () => S?.settings.autoBk || {};
class GdError extends Error { constructor(msg, kind = 'err') { super(msg); this.kind = kind; } }
const b64url = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const gdRedirect = () => location.origin + location.pathname;

/* ---------- Autorisation ---------- */
async function gdStoreToken(refresh) {
  if (!dek) return;
  if (!refresh) return store.del('gdrive');
  await store.set('gdrive', await aesEnc(dek, enc.encode(JSON.stringify({ refresh, at: Date.now() }))));
}
async function gdLoadToken() {
  gd.refresh = null; gd.access = null; gd.exp = 0;
  try { const e = await store.get('gdrive'); if (e && dek) gd.refresh = JSON.parse(dec.decode(await aesDec(dek, e.iv, e.ct))).refresh || null; } catch { gd.refresh = null; }
}
function gdWipe() { gd.refresh = null; gd.access = null; gd.exp = 0; clearTimeout(gd.timer); gd.restoreFiles = null; }
// Départ vers Google : le vérificateur PKCE et un état aléatoire attendent le retour, à part, le temps de l'aller-retour
async function gdStart(purpose) {
  if (!gdConfigured()) return toast('Sauvegarde automatique non configurée');
  if (navigator.onLine === false) return toast('Pas de réseau');
  const verifier = b64url(rand(32)), state = b64url(rand(16));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
  await store.set('gdPending', { verifier, state, purpose, at: Date.now() });
  const q = new URLSearchParams({ client_id: GDRIVE_CFG.clientId, redirect_uri: gdRedirect(), response_type: 'code', scope: GD_SCOPE,
    access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state });
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
}
// Retour de Google (?code=…&state=… ou ?error=…) : lu au démarrage, l'adresse est aussitôt nettoyée
function gdReadReturn() {
  const u = new URLSearchParams(location.search);
  if (!u.has('state') || (!u.has('code') && !u.has('error'))) return;
  gd.ret = { code: u.get('code'), state: u.get('state'), error: u.get('error') };
  history.replaceState({}, '', location.pathname);
}
gdReadReturn();
async function gdTakeReturn(purpose) {
  const r = gd.ret; if (!r) return null;
  const p = await store.get('gdPending');
  if (!p || p.purpose !== purpose) return null;
  gd.ret = null; await store.del('gdPending');
  if (r.error) throw new GdError(r.error === 'access_denied' ? 'Connexion annulée : l’accès à Google Drive n’a pas été autorisé.' : 'Google a refusé la connexion (' + r.error.slice(0, 40) + ').');
  if (r.state !== p.state || Date.now() - p.at > 30 * 60e3) throw new GdError('Retour de Google non reconnu ou trop tardif : recommence la connexion.');
  const j = await gdWorker('/token', { code: r.code, code_verifier: p.verifier });
  if (!j.refresh_token) throw new GdError('Google n’a pas donné d’autorisation durable : recommence la connexion.');
  gd.access = j.access_token; gd.exp = Date.now() + (j.expires_in || 3000) * 1000;
  return j.refresh_token;
}
async function gdWorker(path, body) {
  let r;
  try { r = await fetch(GDRIVE_CFG.workerUrl.replace(/\/$/, '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new GdError('Service d’autorisation injoignable. Vérifie ta connexion.', 'net'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (r.ok && j.access_token) return j;
  if (j.error === 'invalid_grant') throw new GdError('L’autorisation Google a expiré ou a été retirée : reconnecte Google Drive.', 'reconnect');
  throw new GdError(`Service d’autorisation : erreur ${r.status}${j.error ? ' (' + String(j.error).slice(0, 40) + ')' : ''}.`);
}
async function gdAccess() {
  if (gd.access && Date.now() < gd.exp - 60e3) return gd.access;
  if (!gd.refresh) throw new GdError('Google Drive n’est pas connecté.', 'reconnect');
  try {
    const j = await gdWorker('/refresh', { refresh_token: gd.refresh });
    gd.access = j.access_token; gd.exp = Date.now() + (j.expires_in || 3000) * 1000;
    return gd.access;
  } catch (e) {
    if (e.kind === 'reconnect') { gd.refresh = null; await gdStoreToken(null); }
    throw e;
  }
}
async function gdFetch(url, opts = {}, retry = true) {
  if (navigator.onLine === false) throw new GdError('Pas de réseau.', 'net');
  const tok = await gdAccess();
  let r;
  try { r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), authorization: 'Bearer ' + tok } }); }
  catch { throw new GdError('Google Drive injoignable. Vérifie ta connexion.', 'net'); }
  if (r.status === 401 && retry) { gd.access = null; return gdFetch(url, opts, false); }
  if (!r.ok) {
    let reason = ''; try { reason = (await r.json()).error?.errors?.[0]?.reason || ''; } catch {}
    if (reason === 'storageQuotaExceeded') throw new GdError('Ton Google Drive est plein : libère de la place pour reprendre les sauvegardes.');
    throw new GdError(`Google Drive : erreur ${r.status}${reason ? ' (' + reason.slice(0, 40) + ')' : ''}.`);
  }
  return r;
}

/* ---------- Fichiers ---------- */
async function gdList() {
  const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'files(id,name,createdTime,modifiedTime,size)', orderBy: 'createdTime desc', pageSize: '100', q: "name contains 'mycellar-' and trashed = false" });
  const j = await (await gdFetch(`${GD_API}?${q}`)).json();
  return (j.files || []).filter(f => typeof f.id === 'string' && /^[\w-]{10,200}$/.test(f.id));
}
async function gdUpload(blob, name, updateId) {
  const meta = updateId ? {} : { name, parents: ['appDataFolder'], mimeType: 'application/json' };
  const fields = 'fields=id,name,createdTime,modifiedTime,size';
  if (blob.size <= GD_SIMPLE_MAX) {
    const b = 'mycellar' + b64url(rand(9));
    const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n`, blob, `\r\n--${b}--`]);
    const url = updateId ? `${GD_UP}/${updateId}?uploadType=multipart&${fields}` : `${GD_UP}?uploadType=multipart&${fields}`;
    return (await gdFetch(url, { method: updateId ? 'PATCH' : 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body })).json();
  }
  // Grosse sauvegarde (photos) : envoi en deux temps, toujours comme nouvelle version
  const start = await gdFetch(`${GD_UP}?uploadType=resumable&${fields}`, { method: 'POST', headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'application/json' }, body: JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }) });
  const loc = start.headers.get('location');
  if (!loc || !loc.startsWith(GD_UP)) throw new GdError('Google Drive n’a pas accepté l’envoi (adresse d’envoi absente).');
  return (await gdFetch(loc, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: blob })).json();
}
async function gdDelete(id) { await gdFetch(`${GD_API}/${id}`, { method: 'DELETE' }); }
async function gdDownload(id) { return (await gdFetch(`${GD_API}/${id}?alt=media`)).text(); }

/* ---------- Sauvegarde ---------- */
// Empreinte du contenu (hors compteurs de dépense et état de la sauvegarde) : rien n'est envoyé si rien n'a changé
async function bkPrint() {
  const { usage, ...rest } = S; const st = rest.settings.autoBk; rest.settings = { ...rest.settings, autoBk: undefined };
  const ph = (await store.keys()).filter(k => String(k).startsWith('ph:')).sort().join();
  const h = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(rest) + ph))));
  rest.settings.autoBk = st; return h;
}
let bkQuiet = false;   // les enregistrements faits par la sauvegarde elle-même ne déclenchent pas de nouvelle sauvegarde
function bkTouch() {
  if (bkQuiet || mode !== 'app' || !gdOn()) return;
  store.set('gdDirty', Date.now()).catch(() => {});
  clearTimeout(gd.timer); gd.timer = setTimeout(() => runBackup(), BK_DELAY);
}
async function bkSetState(o) { S.settings.autoBk = { ...bkState(), ...o }; bkQuiet = true; try { await save(); } finally { bkQuiet = false; } }
async function runBackup({ force = false } = {}) {
  if (gd.busy || mode !== 'app' || !gdOn()) return null;
  gd.busy = true; clearTimeout(gd.timer);
  try {
    const fp = await bkPrint();
    if (!force && fp === await store.get('gdFp')) { await store.del('gdDirty'); await bkSetState({ checked: Date.now(), err: null, errAt: null }); return 'same'; }
    const { blob, name } = await backupBlob();
    const files = await gdList(), last = files[0];
    const recent = last && Date.now() - Date.parse(last.createdTime) < GD_HOUR && blob.size <= GD_SIMPLE_MAX;
    const f = await gdUpload(blob, name, recent ? last.id : null);
    // 30 versions au plus : les plus anciennes partent
    const all = recent ? files : [f, ...files];
    for (const old of all.slice(GD_KEEP)) await gdDelete(old.id).catch(() => {});
    await store.set('gdFp', fp); await store.del('gdDirty');
    await bkSetState({ last: Date.now(), checked: Date.now(), err: null, errAt: null, size: blob.size });
    if (view === 'plus') render(); if (sheetStack.length) refreshSheet();
    return 'ok';
  } catch (e) {
    await bkSetState({ err: e.message || String(e), errAt: Date.now(), reconnect: e.kind === 'reconnect' || undefined });
    if (e.kind !== 'reconnect') gd.timer = setTimeout(() => runBackup(), 15 * 60e3);   // nouvel essai plus tard
    if (view === 'plus') render(); if (sheetStack.length) refreshSheet();
    return 'err';
  } finally { gd.busy = false; }
}
// Le même fichier que la sauvegarde manuelle : cave chiffrée, mot de passe seulement, photos chiffrées
async function backupBlob() {
  const v = await seal();
  v.slots = { pw: slots.pw };
  v.photos = {};
  for (const k of await store.keys()) if (String(k).startsWith('ph:')) v.photos[k.slice(3)] = await store.get(k);
  const d = new Date(), stamp = `${today()}-${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  return { blob: new Blob([JSON.stringify(v)], { type: 'application/json' }), name: `mycellar-sauvegarde-${stamp}.json` };
}
// Après déverrouillage : autorisation relue, retour de Google traité, sauvegarde en attente envoyée
async function gdOnEnter() {
  if (mode !== 'app' || !gdConfigured()) return;
  await gdLoadToken();
  if (gd.ret) {
    try { const t = await gdTakeReturn('connect'); if (t) { gd.refresh = t; await gdStoreToken(t); await bkSetState({ err: null, errAt: null, reconnect: undefined, since: Date.now() }); toast('Google Drive connecté'); setTimeout(() => runBackup({ force: true }), 300); render(); return; } }
    catch (e) { return sheetMsg('Google Drive', e.message || String(e)); }
  }
  if (!gd.refresh) return;
  const st = bkState(), dirty = await store.get('gdDirty');
  if (dirty || !st.checked || Date.now() - st.checked > 24 * GD_HOUR) gd.timer = setTimeout(() => runBackup(), 5000);
}
// Une restauration change la clé de la cave : l'autorisation est rechiffrée avec la nouvelle
async function gdAfterAdopt(tok) {
  if (!tok) return;
  gd.refresh = tok; await gdStoreToken(tok);
  // Restaurée depuis le Drive : ce contenu y est déjà, inutile de le renvoyer
  if (gd.fromDrive) await store.set('gdFp', await bkPrint()); else await store.del('gdFp');
  gd.fromDrive = false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'app' && gdOn()) store.get('gdDirty').then(d => { if (d) runBackup(); }).catch(() => {}); });
const autoBkOk = () => gdOn() && bkState().last && Date.now() - Math.max(bkState().last, bkState().checked || 0) < 7 * 24 * GD_HOUR && !bkState().err;

/* ---------- Écrans ---------- */
const fmtDT = t => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtSize = n => n > 1e6 ? numFr(n / 1e6) + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' ko';
function bkSummary() {
  if (!gdConfigured()) return 'Non configurée pour cette installation';
  if (!gdOn()) return bkState().reconnect ? '<span style="color:var(--bx);font-weight:600">Reconnexion nécessaire</span>' : 'Connecter Google Drive';
  const st = bkState();
  if (st.err) return `<span style="color:var(--bx);font-weight:600">Échec</span> · ${esc(st.err.split('\n')[0].slice(0, 60))}`;
  return st.last ? `Google Drive · dernière : ${esc(fmtDT(st.last))}` : 'Google Drive · première sauvegarde en cours';
}
function bkSheet() {
  const st = bkState();
  if (!gdConfigured()) return `${head('Sauvegarde automatique')}<p>Cette installation de MyCellar n’a pas encore de service de sauvegarde automatique. La personne qui l’héberge doit d’abord suivre la marche à suivre (docs/sauvegarde-google-drive.md).</p><p class="small">En attendant, pense à « Sauvegarder » régulièrement.</p><button class="btn wide" data-act="close">OK</button>`;
  if (!gdOn()) return `${head('Sauvegarde automatique')}
    ${st.reconnect ? `<p class="banner">${esc(st.err || 'L’autorisation Google a expiré.')}</p>` : ''}
    <p>Ta cave est sauvegardée toute seule dans ton Google Drive, chiffrée avec ton mot de passe : quelques minutes après chaque modification, 30 versions gardées.</p>
    <p class="small">Les sauvegardes vont dans un dossier caché, propre à MyCellar : l’app ne voit rien d’autre de ton Drive, et personne ne peut lire tes sauvegardes sans ton mot de passe. Tu vas passer par la page de Google, puis revenir ici et déverrouiller ta cave.</p>
    <button class="btn primary wide" data-act="gdConnect">Connecter Google Drive</button>`;
  return `${head('Sauvegarde automatique')}
    <div class="card">${st.err ? `<p style="margin:0 0 6px;color:var(--bx)"><b>Dernier essai échoué</b> (${esc(fmtDT(st.errAt))}) : ${esc(st.err)}</p>` : ''}
      <p style="margin:0"><b>Dernière sauvegarde réussie</b> : ${st.last ? esc(fmtDT(st.last)) + (st.size ? ' · ' + fmtSize(st.size) : '') : 'pas encore'}</p>
      ${st.checked && st.last && st.checked > st.last ? `<p class="small" style="margin:6px 0 0">Vérifiée le ${esc(fmtDT(st.checked))} : ta cave n’a pas changé depuis.</p>` : ''}</div>
    <p class="small">Google Drive, dossier caché de MyCellar. Envoi quelques minutes après une modification ou quand tu quittes l’app ; une nouvelle version par heure au plus, 30 versions gardées.</p>
    <div class="btns"><button class="btn primary wide" data-act="gdNow">Sauvegarder maintenant</button>
      <button class="btn wide" data-act="gdVersions">Restaurer une version</button>
      <button class="btn ghost wide" data-act="gdDisconnect">Déconnecter Google Drive</button></div>`;
}
function gdVersionsSheet() {
  const fs = gd.restoreFiles;
  if (!fs) return `${head('Versions sur Google Drive')}<p class="muted">Chargement…</p>`;
  return `${head('Versions sur Google Drive')}
    <p class="small" style="margin-top:-6px">${fs.length ? 'Touche une version pour la restaurer. Il faudra le mot de passe de la cave au moment de cette sauvegarde.' : 'Aucune sauvegarde trouvée dans ce Google Drive.'}</p>
    ${fs.length ? `<div class="list">${fs.map(f => `<button class="li" data-act="gdPick" data-id="${esc(f.id)}"><div class="it"><b>${esc(fmtDT(Date.parse(f.modifiedTime || f.createdTime)))}</b><small>${f.size ? fmtSize(+f.size) : ''}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}</div>` : ''}`;
}
async function gdOpenVersions() {
  gd.restoreFiles = null; showSheet(gdVersionsSheet);
  try { gd.restoreFiles = await gdList(); refreshSheet(); }
  catch (e) { sheetBack(); sheetMsg('Google Drive', e.message || String(e)); }
}
// Premier lancement : restaurer depuis Google Drive (connexion, liste des versions, puis mot de passe)
let gdRestoreTok = null;
async function gdSetupReturn() {
  if (!gd.ret || !gdConfigured()) return;
  try {
    const t = await gdTakeReturn('restore'); if (!t) return;
    gd.refresh = t; gdRestoreTok = t;
    await gdOpenVersions();
  } catch (e) { sheetMsg('Google Drive', e.message || String(e)); }
}
Object.assign(ACT, {
  bkSheet: () => showSheet(bkSheet),
  gdConnect: () => gdStart('connect'),
  gdRestoreStart: () => gdStart('restore'),
  gdNow: async t => { t.disabled = true; t.textContent = 'Sauvegarde en cours…'; const r = await runBackup({ force: true }); toast(r === 'ok' ? 'Sauvegardée sur Google Drive' : 'Sauvegarde impossible'); refreshSheet(); },
  gdVersions: () => gdOpenVersions(),
  gdPick: async t => {
    t.disabled = true;
    try { const txt = await gdDownload(t.dataset.id); gd.fromDrive = true; sheetBack(); await onBackupFile(new File([txt], 'sauvegarde.json', { type: 'application/json' })); }
    catch (e) { t.disabled = false; sheetMsg('Google Drive', e.message || String(e)); }
  },
  gdDisconnect: async () => {
    if (!confirm('Déconnecter Google Drive ? Les sauvegardes déjà faites restent dans ton Drive ; les nouvelles s’arrêtent.')) return;
    const tok = gd.refresh;
    gdWipe(); await gdStoreToken(null); await store.del('gdFp'); await store.del('gdDirty');
    S.settings.autoBk = {}; await save();
    if (tok) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(tok) }).catch(() => {});
    closeSheet(); render(); toast('Google Drive déconnecté');
  },
});
