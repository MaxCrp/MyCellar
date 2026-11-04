/* ---------- Suivi d'utilisation (v1.6) ----------
   Journal local des gestes : écrans affichés et temps passé, boutons touchés, formulaires validés,
   noms des champs modifiés, appels IA (type, durée, coût), erreurs.
   Ne contient jamais de nom de vin, de note, de commentaire, de prix, de lieu ni de contenu saisi :
   seulement des noms d'actions du code, des écrans et des horodatages. Chiffré avec la clé du coffre,
   jamais envoyé : l'utilisateur exporte lui-même un rapport.
   Chaque événement : [horodatage ms, n° de session, type, nom, écran, détail]. */
const USE_MAX = 20000;
let U = null, uSess = 0, uScreen = '', uPending = null, uDirty = 0, uTimer = null;
const usageOn = () => mode === 'app' && !!S?.settings.usage?.on && !!U;
const uNew = () => ({ v: 1, since: Date.now(), n: 0, ev: [] });
const uBase = () => view + (view === 'cave' ? '/' + caveMode : view === 'deg' ? '/' + degMode : '');
// Détail sûr d'un geste : uniquement des codes courts du programme (jamais un identifiant, un nom ou un texte saisi)
const U_KEYS = ['v', 'm', 'k', 'kind'];
function uDetail(el) {
  const d = el.dataset, out = [];
  for (const k of U_KEYS) if (d[k] != null && /^[a-z0-9_-]{1,16}$/i.test(d[k]) && !/^[0-9a-f]{12}$/.test(d[k])) out.push(d[k]);
  if (d.session) out.push('seance');
  return out.join(',') || undefined;
}
function uLog(k, a, x) {
  if (!usageOn()) return;
  const e = [Date.now(), uSess, k, a || '', uScreen];
  if (x != null) e.push(x);
  U.ev.push(e);
  if (U.ev.length > USE_MAX) U.ev.splice(0, U.ev.length - USE_MAX);
  uDirty++;
  clearTimeout(uTimer); uTimer = setTimeout(() => uFlush(), 4000);
}
// Après chaque affichage : note un changement d'écran (onglet, mode, feuille ouverte)
function uScreenCheck() {
  if (!usageOn()) return;
  const top = sheetStack[sheetStack.length - 1];
  const sc = uBase() + (top ? ' > ' + (top.u || 'feuille') : '') + (introAt != null ? ' > presentation' : '');
  if (sc === uScreen) return;
  uScreen = sc; uLog('screen', sc);
}
async function uFlush(key = dek) {
  if (!U || !key || !uDirty || mode !== 'app') return;
  uDirty = 0;
  try { await store.set('usage', await aesEnc(key, enc.encode(JSON.stringify(U)))); } catch { uDirty++; }
}
async function uLoad() {
  if (U) return;
  try { const r = await store.get('usage'); U = r ? JSON.parse(dec.decode(await aesDec(dek, r.iv, r.ct))) : null; } catch { U = null; }
  if (!U || U.v !== 1 || !Array.isArray(U.ev)) U = uNew();
}
async function uStart(via) {
  if (mode !== 'app') return;
  await uLoad();
  if (!S?.settings.usage?.on) return;
  uSess = ++U.n; uScreen = '';
  uLog('start', via || 'inconnu', `${innerWidth}x${innerHeight}${matchMedia('(display-mode: standalone)').matches ? ',app' : ',navigateur'}`);
  uScreenCheck();
}
function uStop(reason) {
  if (usageOn()) uLog('end', reason);
  const k = dek; clearTimeout(uTimer); uFlush(k); U = null;
}

/* ---------- Erreurs récentes ----------
   Gardées même quand le suivi est désactivé (30 au plus, messages techniques seulement), pour « Signaler un problème ». */
function errLog(where, e) {
  const msg = String(e?.message || e || '').replace(/\s+/g, ' ').slice(0, 240);
  if (S?.diag) { S.diag.errors.push({ t: Date.now(), where, msg, screen: uScreen || uBase() }); if (S.diag.errors.length > 30) S.diag.errors.splice(0, S.diag.errors.length - 30); }
  uLog('error', where, msg.slice(0, 120));
}
window.addEventListener('error', e => { try { errLog('js', e.error || e.message); } catch {} });
window.addEventListener('unhandledrejection', e => { try { errLog('promesse', e.reason); } catch {} });
// Message d'erreur avec raccourci vers « Signaler un problème »
function errSheet(title, msg) {
  showSheet(() => `${head(esc(title))}<p style="white-space:pre-wrap">${esc(msg)}</p>
    <div class="btns"><button class="btn wide" data-act="sheetback">OK</button>${mode === 'app' ? '<button class="btn ghost wide" data-act="problem">Signaler ce problème</button>' : ''}</div>`);
}

/* ---------- Synthèse ---------- */
const U_DONE = new Set(['tasteSave', 'placeOk', 'putHere', 'receive', 'transferDone', 'chatAsk', 'export', 'applyReeval', 'applyAdvice', 'adviceGo', 'wishToggle',
  'revealWine', 'openBottle', 'delWine', 'delUnit', 'estimate', 'estimateMissing', 'plocGo', 'toTransfer', 'awayTransfer', 'takeIt', 'blindAI', 'usageExport', 'problemSend']);
const uMed = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const uTop = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
function uSummary() {
  const ev = U?.ev || [], bySess = new Map();
  for (const e of ev) { if (!bySess.has(e[1])) bySess.set(e[1], []); bySess.get(e[1]).push(e); }
  const acts = {}, screens = {}, tasks = {}, grams = {}, ai = {}, errors = {}, hours = Array(24).fill(0), days = Array(7).fill(0), sess = [];
  for (const list of bySess.values()) {
    let cur = null, since = null, dur = 0, gestures = 0, path = [], t0 = list[0][0], seq = [];
    const close = t => { if (cur && since != null) { const d = t - since; dur += d; const o = screens[cur]; o.ms += d; o.d.push(d); } since = null; };
    for (const [t, , k, a, , x] of list) {
      if (k === 'screen') {
        if (cur?.includes(' > ') && !a.includes(' > ')) { path = []; t0 = t; }   // feuille refermée sans rien valider
        close(t); cur = a; since = t;
        const o = screens[a] ||= { n: 0, ms: 0, d: [], taps: [], via: {} };
        o.n++; o.taps.push(path.length);
        if (path.length) { const p = path.slice(-6).join(' › '); o.via[p] = (o.via[p] || 0) + 1; }
      } else if (k === 'pause' || k === 'end') close(t);
      else if (k === 'resume') since = t;
      else if (k === 'start') { t0 = t; path = []; }
      else if (k === 'ai') { const o = ai[a] ||= { n: 0, err: 0, ms: [], usd: 0 }; const [st, ms, usd] = String(x || '').split(','); o.n++; if (st !== 'ok') o.err++; o.ms.push(+ms || 0); o.usd += +usd || 0; }
      else if (k === 'error') errors[a] = (errors[a] || 0) + 1;
      else if (k === 'tap' || k === 'submit' || k === 'change') {
        const name = k === 'submit' ? 'valide:' + a : k === 'change' ? 'champ:' + a : a + (x ? ':' + x : '');
        acts[name] = (acts[name] || 0) + 1;
        const d = new Date(t); hours[d.getHours()]++; days[(d.getDay() + 6) % 7]++;
        if (k !== 'submit') gestures++;
        if (k === 'tap' && a === 'go') { path = []; t0 = t; }   // un onglet touché démarre un nouveau chemin
        path.push(name); seq.push(name);
        if (seq.length >= 3) { const g = seq.slice(-3).join(' › '); grams[g] = (grams[g] || 0) + 1; }
        if ((k === 'submit' && !['unlock', 'setup'].includes(a)) || (k === 'tap' && U_DONE.has(a))) {
          const o = tasks[name] ||= { n: 0, taps: [], secs: [], paths: {} };
          o.n++; o.taps.push(path.filter(p => !p.startsWith('valide:')).length); o.secs.push((t - t0) / 1000);
          const p = path.slice(-8).join(' › '); o.paths[p] = (o.paths[p] || 0) + 1;
          path = []; t0 = t;
        }
      }
    }
    close(list[list.length - 1][0]);
    sess.push({ dur, gestures });
  }
  const r1 = x => Math.round(x * 10) / 10;
  return {
    period: ev.length ? { from: new Date(ev[0][0]).toISOString(), to: new Date(ev[ev.length - 1][0]).toISOString() } : null,
    sessions: { n: sess.length, medianSeconds: r1(uMed(sess.map(s => s.dur / 1000))), medianGestures: uMed(sess.map(s => s.gestures)), totalGestures: sess.reduce((t, s) => t + s.gestures, 0) },
    actions: uTop(acts, 60).map(([action, n]) => ({ action, n })),
    screens: Object.entries(screens).sort((a, b) => b[1].n - a[1].n).map(([screen, o]) => ({ screen, visits: o.n, totalSeconds: Math.round(o.ms / 1000),
      medianSeconds: r1(uMed(o.d) / 1000), medianTapsToReach: uMed(o.taps), topPaths: uTop(o.via, 3).map(([path, n]) => ({ path, n })) })),
    tasks: Object.entries(tasks).sort((a, b) => b[1].n - a[1].n).map(([task, o]) => ({ task, n: o.n, medianTaps: uMed(o.taps), medianSeconds: r1(uMed(o.secs)),
      topPaths: uTop(o.paths, 3).map(([path, n]) => ({ path, n })) })),
    sequences: uTop(grams, 25).map(([seq, n]) => ({ seq, n })),
    ai: Object.entries(ai).map(([kind, o]) => ({ kind, n: o.n, errors: o.err, medianMs: uMed(o.ms), usd: Math.round(o.usd * 1e4) / 1e4 })),
    errors: Object.entries(errors).map(([where, n]) => ({ where, n })),
    byHour: hours, byWeekday: { order: 'lun→dim', counts: days },
  };
}
// Libellés lisibles pour la synthèse affichée dans l'app (le rapport garde les noms du code)
const U_LABELS = {
  'go:cave': 'Onglet Cave', 'go:deg': 'Onglet Dégustations', 'go:boire': 'Onglet À boire', 'go:somm': 'Onglet Sommelier', 'go:plus': 'Réglages',
  add: 'Bouton +', addWine: '+ › Nouveau vin', newTaste: '+ › Nouvelle dégustation', newWine: 'Saisie manuelle d’un vin', scanLabel: 'Photo d’étiquette',
  slot: 'Case du plan', emptySlot: 'Case libre du plan', bottle: 'Fiche bouteille', wine: 'Fiche vin', outBottle: 'Sortir une bouteille', moveBottle: 'Déplacer',
  taste: 'Déguster', tasteSave: 'Enregistrer une dégustation', tasteView: 'Voir une dégustation', placeOk: 'Valider un rangement', pickSlot: 'Choisir une case',
  chatAsk: 'Question au sommelier', takeIt: 'Je la prends', blindStart: 'Dégustation à l’aveugle', reveal: 'Révéler un vin', revealWine: 'Vin révélé',
  caveMode: 'Plan / Liste', degMode: 'Journal / Par vin', adviceSheet: 'Conseils de rangement', transferSheet: 'Transfert', export: 'Sauvegarder',
  'valide:wine': 'Valider une fiche vin', 'valide:out': 'Valider une sortie', 'valide:chat': 'Envoyer au sommelier', 'valide:unit': 'Valider un meuble',
  close: 'Fermer une fenêtre', sheetback: 'Retour', problem: 'Signaler un problème', usageSheet: 'Suivi d’utilisation',
  cave: 'Cave', deg: 'Dégustations', boire: 'À boire', somm: 'Sommelier', plus: 'Réglages',
};
const uLabel = n => n.includes(' > ') ? n.split(' > ').map(uLabel).join(' › ') : U_LABELS[n] || U_LABELS[n.split(',')[0]] || U_LABELS[n.split('/')[0]] || U_LABELS[n.split(':')[0]] || n;

/* ---------- Écrans : Réglages › Aide › Suivi d'utilisation ---------- */
function usageSheet() {
  const on = !!S.settings.usage?.on, s = U ? uSummary() : null, n = U?.ev.length || 0;
  const li = (l, v) => `<dt>${esc(l)}</dt><dd>${esc(String(v))}</dd>`;
  const dur = x => x >= 60 ? `${Math.floor(x / 60)} min ${String(Math.round(x % 60)).padStart(2, '0')}` : `${Math.round(x)} s`;
  return `${head('Suivi d’utilisation')}
    <div class="card row"><div class="grow"><b style="font-size:15px">Noter mon utilisation</b><div class="small">Sur cet iPhone uniquement, chiffré, jamais envoyé sans toi.</div>${whyOff(mode === 'demo')}</div>${sw('setUsage', on, false, mode === 'demo')}</div>
    <p class="small">Ce qui est noté : les écrans affichés et le temps passé, les boutons touchés, le nom des champs modifiés, les erreurs, les appels au sommelier (durée, coût). Jamais tes vins, tes notes, tes commentaires, tes prix ni tes questions.</p>
    ${s?.sessions.n ? `<h3>Synthèse</h3><p class="small" style="margin-top:-4px">Du ${esc(fmtDate(s.period.from))} au ${esc(fmtDate(s.period.to))} · ${plural(n, 'événement', 'événements')}</p>
      <dl class="kv">${li('Ouvertures de l’app', s.sessions.n)}${li('Durée médiane d’une ouverture', dur(s.sessions.medianSeconds))}${li('Gestes médians par ouverture', s.sessions.medianGestures)}</dl>
      <h3>Gestes les plus fréquents</h3><dl class="kv">${s.actions.slice(0, 8).map(a => li(uLabel(a.action), a.n)).join('')}</dl>
      ${s.tasks.length ? `<h3>Tâches accomplies</h3><p class="tiny" style="margin-top:-4px">Nombre de fois · gestes médians pour y arriver</p><dl class="kv">${s.tasks.slice(0, 8).map(t => li(uLabel(t.task), `${t.n} · ${t.medianTaps}`)).join('')}</dl>` : ''}
      <h3>Écrans les plus consultés</h3><p class="tiny" style="margin-top:-4px">Visites · temps médian</p><dl class="kv">${s.screens.slice(0, 8).map(x => li(uLabel(x.screen), `${x.visits} · ${dur(x.medianSeconds)}`)).join('')}</dl>`
    : `<p class="muted small">${on ? 'Utilise l’app quelques jours : la synthèse se remplira.' : 'Le suivi est désactivé.'}</p>`}
    ${mode === 'app' ? `<div class="btns" style="margin-top:16px"><button class="btn primary wide" data-act="usageReport" ${n ? '' : 'disabled'}>${ICON.up} Exporter le rapport</button>
      ${n ? '<button class="btn danger wide" data-act="usageClear">Effacer le journal</button>' : ''}</div>` : ''}`;
}
CHANGES.setUsage = async el => {
  if (mode !== 'app') return;
  S.settings.usage = { ...(S.settings.usage || {}), on: el.checked };
  await save(); await uLoad();
  if (el.checked) { await uStart('activation'); toast('Suivi activé'); } else { uLog('end', 'desactivation'); toast('Suivi désactivé'); }
  refreshSheet();
};
function usageReportSheet() {
  return `${head('Exporter le rapport')}
    <p class="small" style="margin-top:-4px">Le rapport contient la synthèse et le journal des gestes, sans aucune donnée de ta cave. Ajoute ton avis si tu veux : il sera joint tel quel.</p>
    <form class="form" data-form="usageExport"><label>Ton avis <span class="tiny">(facultatif)</span><textarea name="avis" placeholder="Ce qui te plaît, ce qui te gêne, ce qui te manque…"></textarea></label>
      <button class="btn primary wide" type="submit">${ICON.up} Exporter et partager</button></form>`;
}
function reportContext() {
  return { screen: `${screen.width}x${screen.height}`, viewport: `${innerWidth}x${innerHeight}`, standalone: matchMedia('(display-mode: standalone)').matches,
    userAgent: navigator.userAgent.slice(0, 160), appVersion: APP_VERSION, appFingerprint: code.served ? fpLabel(code.served) : null,
    references: S ? S.wines.filter(w => wineBottles(w.id).length).length : null, bottles: S ? S.bottles.filter(inCave).length : null,
    sites: S?.sites.length, spaces: S?.spaces.length, units: S?.units.length, tastings: S?.tastings.length, sessions: S?.sessions.length, wishes: S?.wishes.length,
    multiSites: S ? isMulti() : null, spirits: S?.settings.spirits, ai: S ? (aiReady() ? aiCfg().provider || 'anthropic' : 'non') : null, usageTracking: !!S?.settings.usage?.on };
}
async function shareJson(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return true;
}
const U_LEGEND = {
  kinds: { start: 'ouverture (détail = taille de la fenêtre, app ou navigateur)', end: 'verrouillage ou désactivation', pause: 'app en arrière-plan', resume: 'retour dans l’app',
    screen: 'écran affiché (onglet/mode > feuille ouverte)', tap: 'bouton touché (nom = action du code, détail = paramètres courts)', submit: 'formulaire validé',
    change: 'champ modifié (nom du champ, jamais sa valeur)', ai: 'appel IA (détail = ok|err, durée ms, coût $)', error: 'erreur technique (détail = message)' },
  note: 'Aucun nom de vin, note, commentaire, prix, lieu, convive ni question au sommelier. Les « paths » listent les derniers gestes avant d’atteindre un écran ou une tâche.',
};
FORMS.usageExport = async (f, d) => {
  if (!U) return;
  uLog('tap', 'usageExport'); await uFlush();
  const out = { format: 'mycellar-usage-v1', exportedAt: new Date().toISOString(), trackingSince: new Date(U.since).toISOString(), avis: d.avis || null,
    context: reportContext(), legend: U_LEGEND, summary: uSummary(), recentErrors: S.diag.errors,
    events: { columns: ['time', 'session', 'kind', 'name', 'screen', 'detail'], rows: U.ev.map(([t, ...r]) => [new Date(t).toISOString(), ...r]) } };
  if (await shareJson(`mycellar-rapport-${today()}.json`, out)) { sheetBack(); toast('Rapport exporté'); }
};

/* ---------- Signaler un problème ---------- */
function problemSheet() {
  const on = usageOn();
  return `${head('Signaler un problème')}
    <form class="form" data-form="problemSend"><label>Que s’est-il passé ?<textarea name="desc" required placeholder="Ce que tu faisais, ce que tu attendais, ce qui s’est produit…"></textarea></label>
      <p class="tiny" style="margin:0">${on ? 'Le rapport joint les 15 dernières minutes d’utilisation, les erreurs récentes et l’écran affiché.' : 'Le suivi d’utilisation est désactivé : le rapport joint seulement les erreurs récentes et le contexte (version, écran, options).'} Aucune donnée de ta cave n’y figure.</p>
      <button class="btn primary wide" type="submit">${ICON.up} Exporter et partager</button></form>`;
}
FORMS.problemSend = async (f, d) => {
  if (!d.desc) return toast('Décris le problème en quelques mots');
  uLog('tap', 'problemSend'); await uFlush();
  const since = Date.now() - 15 * 60e3;
  const out = { format: 'mycellar-probleme-v1', exportedAt: new Date().toISOString(), description: d.desc, screen: uScreen || uBase(),
    context: reportContext(), recentErrors: S.diag.errors.slice(-20),
    recentEvents: U && S.settings.usage?.on ? { columns: ['time', 'session', 'kind', 'name', 'screen', 'detail'], rows: U.ev.filter(e => e[0] >= since).map(([t, ...r]) => [new Date(t).toISOString(), ...r]) } : null };
  if (await shareJson(`mycellar-probleme-${today()}.json`, out)) { closeSheet(); toast('Rapport prêt à envoyer'); }
};
Object.assign(ACT, {
  usageSheet: async () => { await uLoad(); showSheet(usageSheet); },
  usageReport: () => showSheet(usageReportSheet),
  usageClear: async () => { if (!confirm('Effacer tout le journal d’utilisation ?')) return; U = uNew(); uDirty++; await uFlush(); if (S.settings.usage?.on) await uStart('effacement'); refreshSheet(); toast('Journal effacé'); },
  problem: () => showSheet(problemSheet),
});
