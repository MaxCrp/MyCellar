/* ---------- Suivi des mises à jour (v1.6) ----------
   CHANGELOG et APP_VERSION sont injectés par build.mjs depuis src/changelog.json.
   Le même journal est publié à part (changelog.json) : la version installée le lit en ligne
   pour montrer le contenu d'une mise à jour avant de l'installer. C'est du texte affiché, jamais du code. */
function cmpVer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
// Versions plus récentes que « v » (toutes si v est vide), de la plus récente à la plus ancienne
const newerThan = (list, v) => list.filter(e => !v || cmpVer(e.version, v) > 0).sort((a, b) => cmpVer(b.version, a.version));
function versionsHtml(list) {
  return list.map(e => `<div class="card"><div class="ct"><span>Version ${esc(e.version)}${e.titre ? ' · ' + esc(e.titre) : ''}</span><span class="small">${esc(fmtDate(e.date))}</span></div>
    <ul class="notes">${(e.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');
}
// Au déverrouillage : la fenêtre « Nouveautés » s'affiche une fois après une mise à jour
async function afterEnter(via) {
  let last = null; try { last = await store.get('lastVersion'); } catch {}
  try { await store.set('lastVersion', APP_VERSION); } catch {}
  if (via === 'creation' || via === 'restauration' || last === APP_VERSION) return;   // nouvel appareil : rien à annoncer
  // Sans trace de version : l'app vient d'une version antérieure à la 1.6, qui ne la notait pas
  const list = last ? newerThan(CHANGELOG, last) : CHANGELOG.filter(e => e.version === APP_VERSION);
  if (!list.length || introAt != null) return;
  setTimeout(() => { if (!sheetStack.length) showSheet(() => `${head('Nouveautés')}<p class="small" style="margin-top:-6px">${last ? `Depuis la version ${esc(last)}` : `Version ${esc(APP_VERSION)}`}</p>${versionsHtml(list)}
    <button class="btn primary wide" style="margin-top:12px" data-act="close">C’est noté</button>`); }, 300);
}
function historySheet() {
  return `${head('Historique des versions')}<p class="small" style="margin-top:-6px">Version installée : <b style="color:var(--ink)">${esc(APP_VERSION)}</b></p>${versionsHtml(newerThan(CHANGELOG, null))}`;
}
// Contenu d'une mise à jour disponible : journal publié en ligne, filtré depuis la version installée
async function loadNews() {
  code.news = 'chargement'; refreshSheet();
  try {
    const r = await fetch('./changelog.json?fresh=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('format');
    code.news = newerThan(j.filter(e => e && typeof e.version === 'string' && Array.isArray(e.items)).map(e => ({ version: e.version, date: String(e.date || ''), titre: String(e.titre || ''), items: e.items.map(String).slice(0, 30) })), APP_VERSION);
  } catch { code.news = 'erreur'; }
  refreshSheet();
}
function newsBlock() {
  if (code.news === 'chargement' || code.news == null) return '<p class="small">Chargement du contenu de la mise à jour…</p>';
  if (code.news === 'erreur') return '<p class="small">Le contenu de la mise à jour n’a pas pu être récupéré (pas de connexion, ou journal absent).</p>';
  if (!code.news.length) return '<p class="small">Le journal des versions ne décrit pas encore cette mise à jour.</p>';
  return `<h3>Ce qui change depuis ta version (${esc(APP_VERSION)})</h3>${versionsHtml(code.news)}`;
}
Object.assign(ACT, { historySheet: () => showSheet(historySheet) });
