/* ---------- Suivi des cadeaux (v2.0) ----------
   Reçus : vins « Offert par ». Offerts : sorties « offerte » avec un destinataire. Gardés : bouteilles d'un ami. */
function giftPeople() {
  const m = new Map(), P = n => { const k = norm(n); if (!m.has(k)) m.set(k, { name: String(n).trim(), rec: [], given: [], kept: [] }); return m.get(k); };
  for (const w of S.wines) if (w.cadeau?.de?.trim()) P(w.cadeau.de).rec.push(w);
  for (const mv of S.moves) if (mv.type === 'out' && mv.motif === 'offerte' && mv.who?.trim() && wine(mv.wineId)) P(mv.who).given.push(mv);
  for (const b of S.bottles) if (inCave(b) && b.owner && wine(b.wineId)) P(b.owner).kept.push(b);
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
const lastGift = (wid, who) => S.moves.filter(m => m.type === 'out' && m.motif === 'offerte' && m.wineId === wid && who && norm(m.who) === norm(who)).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0];
// Avant d'offrir : « Tu as déjà offert ce vin à Paul en mars 2026 »
function giftAgain(wid, who) {
  const g = lastGift(wid, String(who || '').trim()); if (!g) return true;
  return confirm(`Tu as déjà offert ce vin à ${String(who).trim()} le ${fmtDate(g.at)}. L’offrir quand même ?`);
}
function giftRows(q) {
  const ps = giftPeople().filter(p => !q || norm(p.name).includes(norm(q)));
  if (!ps.length) return `<p class="muted small" style="margin:10px 4px">${q ? 'Personne ne correspond.' : 'Aucun cadeau pour l’instant. Indique « Offert par » à l’ajout d’un vin, ou le destinataire quand tu sors une bouteille « offerte ».'}</p>`;
  return `<div class="list">${ps.map(p => `<button class="li" data-act="giftPerson" data-n="${esc(p.name)}"><div class="it"><b class="ell">${esc(p.name)}</b>
    <small class="ell">${[p.rec.length && `${plural(p.rec.length, 'vin reçu', 'vins reçus')}`, p.given.length && `${plural(p.given.length, 'bouteille offerte', 'bouteilles offertes')}`, p.kept.length && `${plural(p.kept.length, 'bouteille gardée', 'bouteilles gardées')} pour ${p.name}`].filter(Boolean).join(' · ')}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}</div>`;
}
function giftsSheet() {
  return `${head('Cadeaux')}
    <p class="small" style="margin-top:-6px">Les vins reçus et offerts, par personne.</p>
    <div class="search" style="margin:0 0 4px">${ICON.search}<input type="search" placeholder="Un prénom…" data-in="giftFind" autocomplete="off">${sx()}</div>
    <div id="gift-list">${giftRows('')}</div>`;
}
INPUTS.giftFind = el => { const box = $('#gift-list'); if (box) box.innerHTML = giftRows(el.value); };
function giftPersonSheet(name) {
  const p = giftPeople().find(x => norm(x.name) === norm(name)); if (!p) return null;
  const kept = new Map(); for (const b of p.kept) kept.set(b.wineId, (kept.get(b.wineId) || 0) + 1);
  const row = (w, sub, extra = '') => `<button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(sub)}</small></div>${extra}</button>`;
  return `${head(esc(p.name))}
    <h3>${esc(p.name)} t’a offert</h3>${p.rec.length ? `<div class="list">${p.rec.map(w => row(w, [w.achat?.date && fmtDate(w.achat.date), heldBottles(w.id).length ? plural(heldBottles(w.id).length, 'bouteille en cave', 'bouteilles en cave') : 'plus en cave'].filter(Boolean).join(' · '))).join('')}</div>` : '<p class="muted small">Rien pour l’instant.</p>'}
    <h3>Tu lui as offert</h3>${p.given.length ? `<div class="list">${[...p.given].sort((a, b) => (b.at || '').localeCompare(a.at || '')).map(m => row(wine(m.wineId), [fmtDate(m.at), m.plat].filter(Boolean).join(' · '))).join('')}</div>` : '<p class="muted small">Rien pour l’instant.</p>'}
    ${kept.size ? `<h3>Gardées pour ${esc(p.name)}</h3><div class="list">${[...kept].map(([wid, n]) => row(wine(wid), wineSub(wine(wid)), `<span class="qty">×${n}</span>`)).join('')}</div>` : ''}`;
}
Object.assign(ACT, {
  giftsSheet: () => showSheet(giftsSheet),
  giftPerson: t => showSheet(() => giftPersonSheet(t.dataset.n)),
});
