/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || !ACT[t.dataset.act]) return;
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  e.preventDefault();
  Promise.resolve(ACT[t.dataset.act](t, e)).catch(err => { console.error(err); toast('Erreur : ' + (err.message || err)); });
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, name = f.dataset.form; if (!FORMS[name]) return;
  const btn = f.querySelector('[type=submit]');
  if (btn?.disabled) return;
  try { await FORMS[name](f, formData(f)); }
  catch (err) { console.error(err); toast('Erreur : ' + (err.message || err)); if (btn) btn.disabled = false; }
});
document.addEventListener('input', e => { const k = e.target.dataset?.in; if (k && INPUTS[k]) INPUTS[k](e.target, e); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-photo') return onPhoto(t.files[0]);
  if (t.id === 'f-photo2') return onTastePhoto(t.files[0]);
  if (t.id === 'f-pdf') return onPdf(t.files[0]);
  if (t.id === 'f-backup') return onBackupFile(t.files[0]);
  const k = t.dataset?.ch; if (k && CHANGES[k]) Promise.resolve(CHANGES[k](t, e)).catch(err => toast('Erreur : ' + (err.message || err)));
});
// Entrée envoie la question au sommelier (Maj+Entrée pour aller à la ligne)
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches?.('.composer textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});

/* ---------- Verrou : création, ouverture ---------- */
FORMS.setup = async (f, d) => {
  if (d.p1.length < 10) return renderLock('setup', 'Le mot de passe doit faire au moins 10 caractères. Une phrase de quelques mots est simple à retenir et sûre.');
  if (d.p1 !== d.p2) return renderLock('setup', 'Les deux mots de passe ne correspondent pas.');
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Création…';
  const raw = rand(32);
  await adopt({ raw, data: seedStructure(emptyData()), slots: { pw: await makePwSlot(raw, d.p1) } });
  await save(); navigator.storage?.persist?.(); await clearFails();
  enterApp(); toast('Cave créée');
  if (pkAvailable()) setTimeout(() => showSheet(() => `${head('Face ID')}<p>Veux-tu ouvrir ta cave avec Face ID plutôt qu’avec ton mot de passe ?</p>
    <div class="btns"><button class="btn primary wide" data-act="pkOffer">${ICON.face} Activer Face ID</button><button class="btn ghost wide" data-act="close">Plus tard</button></div>`), 400);
};
FORMS.unlock = async (f, d) => {
  const fl = await getFails();
  if (fl.until > Date.now()) return renderLock('unlock', `Trop d’essais. Réessaie dans ${Math.ceil((fl.until - Date.now()) / 1000)} secondes.`);
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Ouverture…';
  try {
    await adopt(await openVault(await store.get('vault'), { pass: d.p1 }));
    await clearFails(); enterApp();
  } catch {
    const n = await noteFail();
    renderLock('unlock', n.until > Date.now() ? `Mot de passe incorrect. Réessaie dans ${Math.ceil((n.until - Date.now()) / 1000)} secondes.` : 'Mot de passe incorrect.');
  }
};
Object.assign(ACT, {
  pkunlock: async () => {
    try {
      const vault = await store.get('vault');
      await adopt(await openVault(vault, { prf: await prfGet(vault.slots.pk) }));
      await clearFails(); enterApp();
    } catch (e) { renderLock('unlock', e.name === 'NotAllowedError' ? '' : pkError(e)); }
  },
  pkOffer: async () => {
    try { const { slot, secret } = await pkCreate(); await pkStore(slot, secret || await prfGet(slot)); closeSheet(); toast('Face ID activé'); }
    catch (e) { sheetMsg('Face ID', pkError(e)); }
  },
  demo: async () => { S = normalize(demoData()); mode = 'demo'; enterApp(); },
});

/* ---------- Verrouillage automatique ---------- */
const veil = on => document.documentElement.classList.toggle('veil', on && mode === 'app');
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); veil(true); return; }
  const min = S?.settings.lockMin ?? 5;
  if (mode === 'app' && !S.settings.stay && min && hiddenAt && Date.now() - hiddenAt > min * 60e3) { veil(false); lockNow(); }
  else { veil(false); hiddenAt = 0; }
});
window.addEventListener('pagehide', () => veil(true));
window.addEventListener('pageshow', () => { if (!document.hidden) veil(false); });

/* ---------- Démarrage ---------- */
async function boot() {
  wipeKeys(); view = 'cave'; caveSpace = null; caveQuery = '';
  if (!window.crypto?.subtle) { app.innerHTML = '<main class="lock"><h1 class="lock-title">MyCellar</h1><p class="lock-text">Le chiffrement n’est pas disponible ici. Ouvre l’app depuis son adresse https.</p></main>'; return; }
  store ||= await openStore();
  checkCode();
  const vault = await store.get('vault');
  lockHasPk = !!vault?.slots?.pk;
  if (vault) {
    const raw = await devOpen();
    if (raw) { try { await adopt(await openVault(vault, { raw })); return enterApp(); } catch { await devDisable(); } }
  }
  renderLock(vault ? 'unlock' : 'setup');
  if (!vault && !(await store.get('introSeen'))) showIntro(0, false);
}
if (location.search.includes('u=')) history.replaceState({}, '', location.pathname);
// Le service worker ne doit jamais changer : une mise à jour approuvée passe par une désinstallation complète.
// Si l'hébergeur remplace sw.js, on alerte tout de suite, tant que le code approuvé tourne encore.
const swHadController = !!navigator.serviceWorker?.controller;
function swAlarm() {
  if (!swHadController || code.status === 'sw') return;
  code.status = 'sw'; paintCode();
  if (mode === 'app') lockNow();
}
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    if (reg.installing || reg.waiting) swAlarm();
    reg.addEventListener('updatefound', swAlarm);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', swAlarm);
}
boot();
