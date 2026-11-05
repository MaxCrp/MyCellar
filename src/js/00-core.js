// L'app ne doit jamais s'afficher dans un cadre : une page tierce pourrait superposer
// des éléments invisibles au-dessus du champ de mot de passe (clickjacking).
if (window.top !== window.self) {
  document.documentElement.textContent = 'Cette application ne peut pas s’afficher dans un cadre. Ouvre-la directement depuis son adresse.';
  throw new Error('framed');
}

/* ---------- Utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisYear = () => new Date().getFullYear();
const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const fmtDate = s => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtE = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtE2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = v => fmtE.format(Math.round(v || 0));
const numFr = (v, d = 1) => v == null ? '' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });
// Saisie d'un nombre au format français : « 12,5 », « 1 234 », « 25 € »
// « 1.234,50 » : point des milliers et virgule décimale ; « 1.234 » seul = 1234
function num(s) {
  if (s == null) return null;
  s = String(s).replace(/[\s\u00a0\u202f€%]/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const int = s => { const n = num(s); return n == null ? null : Math.round(n); };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Stockage local (IndexedDB, sinon mémoire) ---------- */
let persistent = true;
const mem = new Map();
const memStore = { get: async k => mem.get(k), set: async (k, v) => { mem.set(k, v); }, del: async k => { mem.delete(k); }, keys: async () => [...mem.keys()] };
function idbStore(db) {
  const os = mode => db.transaction('kv', mode).objectStore('kv');
  const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return { get: k => wrap(os('readonly').get(k)), set: (k, v) => wrap(os('readwrite').put(v, k)), del: k => wrap(os('readwrite').delete(k)), keys: () => wrap(os('readonly').getAllKeys()) };
}
async function openStore() {
  try {
    const db = await Promise.race([
      new Promise((res, rej) => {
        const r = indexedDB.open('mycellar', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    const s = idbStore(db);
    await s.set('_probe', 1); await s.del('_probe');
    return s;
  } catch (e) { persistent = false; return memStore; }
}
// Délai croissant après 5 mots de passe erronés (30 s, 1 min, 2 min… jusqu'à 15 min)
const getFails = async () => (await store.get('fails')) || { n: 0, until: 0 };
async function noteFail() { const f = await getFails(); f.n++; if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (f.n - 5)); await store.set('fails', f); return f; }
const clearFails = () => store.del('fails');

/* ---------- Chiffrement ----------
   Les données sont chiffrées (AES-GCM 256) avec une clé maître aléatoire.
   Cette clé maître est elle-même chiffrée dans des « emplacements » :
   - pw : clé dérivée du mot de passe (PBKDF2-SHA256, 600 000 itérations) ;
   - pk : clé dérivée d'une clé d'accès grâce à l'extension WebAuthn PRF (Face ID) ;
   - appareil (option « rester déverrouillé ») : clé non exportable propre à cet appareil,
     rangée hors du coffre et jamais incluse dans les sauvegardes.
   Les photos sont chiffrées une par une avec la même clé maître. */
const ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
const rand = n => crypto.getRandomValues(new Uint8Array(n));
function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const importDek = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
async function aesEnc(k, bytes) { const iv = rand(12); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes); return { iv: b64(iv), ct: b64(ct) }; }
async function aesDec(k, iv, ct) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct))); }
async function pwKek(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function prfKek(secret) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('mycellar'), info: enc.encode('cle-d-acces-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function makePwSlot(raw, pass) { const salt = rand(16); return { salt: b64(salt), iter: ITER, ...(await aesEnc(await pwKek(pass, salt, ITER), raw)) }; }
const openPwSlot = async (slot, pass) => aesDec(await pwKek(pass, unb64(slot.salt), slot.iter), slot.iv, slot.ct);
const iterOk = n => Number.isInteger(n) && n >= 100000 && n <= 10000000;
async function seal() {
  const k = dek, sl = slots, bytes = enc.encode(JSON.stringify(S));
  if (!k || !sl) throw new Error('coffre verrouillé');
  return { app: 'mycellar', v: 1, slots: sl, ...(await aesEnc(k, bytes)), savedAt: Date.now() };
}
async function openVault(vault, { pass, prf, raw: given }) {
  if (!vault || typeof vault !== 'object' || vault.app !== 'mycellar' || typeof vault.iv !== 'string' || typeof vault.ct !== 'string' || !vault.slots) throw new Error('format');
  let raw = given;
  if (!raw) {
    if (!prf && (!vault.slots.pw || !iterOk(vault.slots.pw.iter))) throw new Error('format');
    raw = prf ? await aesDec(await prfKek(prf), vault.slots.pk.iv, vault.slots.pk.ct) : await openPwSlot(vault.slots.pw, pass);
  }
  const data = JSON.parse(dec.decode(await aesDec(await importDek(raw), vault.iv, vault.ct)));
  return { raw, data, slots: vault.slots };
}
async function adopt(o) { dekRaw = o.raw; dek = await importDek(o.raw); slots = o.slots; S = normalize(o.data); mode = 'app'; }
function wipeKeys() {
  dekRaw?.fill(0); dekRaw = null; dek = null; slots = null; S = null;
  for (const u of photoUrls.values()) URL.revokeObjectURL(u);
  photoUrls.clear(); draft = null; wheelState = null; chatBusy = false;
  try {
    const t = $('#toast'); if (t) { t.textContent = ''; t.classList.remove('show'); }
    $$('input[type=file]').forEach(i => { i.value = ''; });
  } catch {}
}

/* ---------- Rester déverrouillé sur cet appareil ---------- */
async function devEnable() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await store.set('devkey', key);
  await store.set('devslot', await aesEnc(key, dekRaw));
}
async function devDisable() { await store.del('devkey'); await store.del('devslot'); }
async function devOpen() {
  const key = await store.get('devkey'), slot = await store.get('devslot');
  if (!key || !slot) return null;
  try { return await aesDec(key, slot.iv, slot.ct); } catch { return null; }
}

/* ---------- Photos (chiffrées une par une) ---------- */
const photoUrls = new Map();
async function photoSave(id, blob) {
  if (!dek) { photoUrls.set(id, URL.createObjectURL(blob)); return; }   // démo : en mémoire seulement
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await store.set('ph:' + id, await aesEnc(dek, bytes));
  if (photoUrls.has(id)) URL.revokeObjectURL(photoUrls.get(id));
  photoUrls.set(id, URL.createObjectURL(blob));
}
async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  if (mode === 'demo') return null;
  const e = await store.get('ph:' + id); if (!e || !dek) return null;
  try { const u = URL.createObjectURL(new Blob([await aesDec(dek, e.iv, e.ct)], { type: 'image/jpeg' })); photoUrls.set(id, u); return u; } catch { return null; }
}
async function photoDel(id) { await store.del('ph:' + id); if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); } }
// Remplit les <img data-photo> une fois la page affichée
async function paintPhotos(root = document) {
  for (const img of $$('img[data-photo]', root)) {
    const u = await photoUrl(img.dataset.photo);
    if (u) { img.src = u; img.hidden = false; }
  }
}
// Réduit une image (photo d'étiquette) : JPEG, plus grand côté = max
async function shrinkImage(file, max = 1024, q = 0.78) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch {   // repli pour les formats que createImageBitmap ne lit pas : passage par une balise <img>
    const u = URL.createObjectURL(file);
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
}
const blobB64 = async blob => b64(await blob.arrayBuffer());

/* ---------- Clé d'accès : Face ID via le trousseau iCloud ---------- */
const pkAvailable = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
function pkError(e) {
  if (e?.message === 'noprf') return 'Ce gestionnaire de clés d’accès ne permet pas de déverrouiller l’app (extension PRF non prise en charge). Supprime la clé créée et réessaie en l’enregistrant dans le trousseau iCloud.';
  if (e?.name === 'NotAllowedError') return 'Opération annulée ou expirée.';
  if (e?.name === 'SecurityError') return 'Les clés d’accès ne fonctionnent qu’à l’adresse https de l’app installée.';
  return 'La clé d’accès n’a pas pu être utilisée.';
}
async function prfGet(slot) {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: rand(32), rpId: location.hostname, userVerification: 'required', timeout: 60000,
    allowCredentials: [{ type: 'public-key', id: unb64(slot.credId) }],
    extensions: { prf: { eval: { first: unb64(slot.prfSalt) } } } } });
  const r = cred.getClientExtensionResults()?.prf?.results?.first;
  if (!r) throw new Error('noprf');
  return new Uint8Array(r);
}
async function pkCreate() {
  const prfSalt = rand(32);
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: 'MyCellar', id: location.hostname },
    user: { id: rand(16), name: 'MyCellar', displayName: 'MyCellar' },
    challenge: rand(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    timeout: 60000, extensions: { prf: { eval: { first: prfSalt } } } } });
  const ext = cred.getClientExtensionResults()?.prf;
  if (ext && ext.enabled === false) throw new Error('noprf');
  return { slot: { credId: b64(cred.rawId), prfSalt: b64(prfSalt) }, secret: ext?.results?.first ? new Uint8Array(ext.results.first) : null };
}
async function pkStore(slot, secret) {
  slots = { ...slots, pk: { ...slot, ...(await aesEnc(await prfKek(secret), dekRaw)), createdAt: Date.now() } };
  await save();
}
const sameBytes = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

/* ---------- Vérification du code de l'app ----------
   Le service worker sert toujours la version mise en cache : le code ne change
   jamais tout seul. À chaque démarrage, l'app calcule l'empreinte du code servi,
   la compare à celle que tu as approuvée, et te signale toute différence. */
const CODE_FILES = ['./', './sw.js'];   // « ./ » et non « ./index.html », que Cloudflare redirige
let code = { status: 'unknown', served: null, approved: null, net: null, at: null, err: null, checked: null };
const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, '0')).join('');
const fpLabel = h => h ? hex(unb64(h).slice(0, 8)).toUpperCase().match(/.{4}/g).join(' ') : '—';
async function fpOf(fresh) {
  const parts = [];
  for (const f of CODE_FILES) {
    const r = await fetch(fresh ? `${f}?fresh=${Date.now()}` : f, { cache: 'no-store' });
    if (!r.ok) throw new Error('Réponse ' + r.status + ' pour ' + f);
    parts.push(await r.text());
  }
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(parts.join('\u0000'))));
}
async function checkCode() {
  if (!window.isSecureContext) { code.err = 'Vérification indisponible hors https.'; return; }
  try { code.served = await fpOf(false); } catch (e) { code.err = e.message; return; }
  const saved = await store.get('code');
  if (code.status === 'sw') { code.approved = saved?.fp || null; code.at = saved?.at || null; paintCode(); return; }
  if (saved?.pending && saved.fp && saved.fp !== code.served) {
    code.approved = saved.fp; code.at = saved.at; code.status = 'changed';
  } else if (!saved || saved.pending) {
    await store.set('code', { fp: code.served, at: Date.now() });
    code.approved = code.served; code.at = Date.now(); code.status = 'ok';
  } else {
    code.approved = saved.fp; code.at = saved.at;
    code.status = saved.fp === code.served ? 'ok' : 'changed';
  }
  paintCode();
  if (code.status === 'ok') checkNetwork();
}
async function checkNetwork() {
  if (!window.isSecureContext) return false;
  if (navigator.onLine === false) { code.err = 'Pas de connexion réseau.'; return false; }
  try { code.net = await fpOf(true); code.err = null; code.checked = Date.now(); }
  catch (e) { code.err = e.message; return false; }
  if (code.net !== code.approved && code.status !== 'changed' && code.status !== 'sw') { code.status = 'update'; paintCode(); }
  return code.net !== code.approved;
}
function paintCode() {
  const el = $('#codebar'); if (!el) return;
  if (code.status === 'update') el.innerHTML = `<div class="codebar"><p>Une nouvelle version de l’app est disponible. Si tu n’en es pas à l’origine, ne l’installe pas.</p>
    <div class="row wrap"><button class="btn primary small" data-act="codeupdate">Installer la mise à jour</button><button class="btn small" data-act="codeinfo">Plus d’infos</button><button class="btn small" data-act="codelater">Plus tard</button></div></div>`;
  else if (code.status === 'sw') el.innerHTML = `<div class="codebar bad"><p><strong>Le programme de l’app vient d’être remplacé chez l’hébergeur, sans ta validation.</strong> Ne rouvre pas l’app et ne saisis pas ton mot de passe avant d’avoir vérifié l’historique de ton dépôt.</p>
    <div class="row"><button class="btn small" data-act="codeinfo">Que faire ?</button></div></div>`;
  else if (code.status === 'changed') el.innerHTML = `<div class="codebar bad"><p><strong>Le code de l’app a changé</strong> sans que tu l’aies approuvé. Ne saisis pas ton mot de passe avant d’avoir vérifié.</p>
    <div class="row"><button class="btn small" data-act="codeinfo">Que faire ?</button></div></div>`;
  else el.innerHTML = '';
}
async function applyCodeUpdate() {
  if (!confirm('Installer cette version du code ? À ne faire que si tu viens de mettre les fichiers à jour toi-même.\n\nTes données ne sont pas touchées.')) return;
  try {
    await store.set('code', { fp: code.net, at: Date.now(), pending: true });
    for (const r of await navigator.serviceWorker?.getRegistrations() || []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    location.replace(location.pathname + '?u=' + Date.now());
  } catch (e) { toast('Mise à jour impossible : ' + (e.message || 'réessaie avec du réseau')); }
}
function sheetCode() {
  if (code.status === 'sw') return openSheet(`<h2>Code remplacé</h2>
    <p>Le fichier qui installe l’app sur ton iPhone (sw.js) a changé chez l’hébergeur. Une version légitime de l’app ne le modifie jamais : si tu n’es pas à l’origine de ce changement, ton compte d’hébergement a probablement été compromis.</p>
    <p class="small">Depuis un ordinateur : consulte l’historique du dépôt, remets les fichiers d’origine, change le mot de passe du compte. Ensuite, sur l’iPhone, supprime l’app, efface les données du site dans Réglages › Safari, réinstalle-la et restaure ta dernière sauvegarde.</p>
    <button class="btn wide" data-act="close">Fermer</button>`);
  showSheet(sheetCodeHtml);
  if (code.status === 'update' && code.news == null) loadNews();
}
function sheetCodeHtml() {
  const changed = code.status === 'changed', upd = code.status === 'update';
  return `<h2>${changed ? 'Code modifié' : upd ? 'Nouvelle version disponible' : 'Vérification du code'}</h2>
    ${upd ? newsBlock() + '<h3>Vérification du code</h3>' : ''}
    <p class="small">L’empreinte est un condensé du code de l’app. Elle ne change que si le code change.</p>
    <p>Approuvée${code.at ? ' le ' + new Date(code.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}<br><span class="fp">${fpLabel(code.approved)}</span></p>
    <p>${changed ? 'Code actuellement servi' : 'Version en ligne'}<br><span class="fp">${fpLabel(changed ? code.served : code.net)}</span></p>
    <div class="btns">
    ${changed ? `<p>Si tu viens de modifier les fichiers chez ton hébergeur, c’est normal. Sinon, change le mot de passe du compte et vérifie l’historique du dépôt avant d’ouvrir l’app.</p>
      <button class="btn wide" data-act="codeapprove">Approuver cette version</button>`
      : code.status === 'update' ? '<p>N’installe cette version que si tu viens de mettre les fichiers à jour toi-même.</p><button class="btn primary wide" data-act="codeupdate">Installer la mise à jour</button>'
      : `<p class="small">${code.err ? 'Dernière vérification en échec : ' + esc(code.err) : code.checked ? 'Vérifié à ' + new Date(code.checked).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' : la version en ligne est identique.' : 'Pas encore vérifié en ligne.'}</p>
        <button class="btn primary wide" data-act="codecheck">Vérifier maintenant</button>`}
    ${upd ? '<button class="btn wide" data-act="codelaterclose">Plus tard</button>' : '<button class="btn wide" data-act="close">Fermer</button>'}</div>`;
}

/* ---------- État global ---------- */
let store, S = null, dek = null, dekRaw = null, slots = null, mode = 'boot', lockHasPk = false, hiddenAt = 0;
let view = 'cave', draft = null, wheelState = null, chatBusy = false, pendingImport = null;
async function save() {
  if (mode !== 'app' || !dek || !slots) return;
  await store.set('vault', await seal());
}
