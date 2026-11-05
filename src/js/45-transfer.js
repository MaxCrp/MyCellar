/* ---------- Transferts entre sites (v1.7.2 : dans les deux sens) ----------
   Chaque bouteille du transfert a sa destination (S.transfer.dest[id] = site). Une section par site :
   « Vers Ville · consommation », « Vers Campagne · stockage », chacune avec ses arrivées. */
function defaultDest(b) {
  const from = b && siteOfBottle(b), others = S.sites.filter(s => s.id !== from);
  if (S.transfer.to && S.transfer.to !== from && site(S.transfer.to)) return S.transfer.to;   // transfert préparé avant la v1.7.2
  const want = site(from)?.role === 'stock' ? 'conso' : 'stock';
  return (others.length === 1 ? others[0] : others.find(s => s.role === want) || others[0])?.id || null;
}
const tDest = id => { const d = S.transfer.dest?.[id]; return d && site(d) ? d : defaultDest(byId(S.bottles, id)); };
function transferAdd(ids, to) {
  S.transfer.dest ||= {};
  for (const id of ids) { const b = byId(S.bottles, id); if (!b || !inCave(b)) continue; if (!S.transfer.ids.includes(id)) S.transfer.ids.push(id); S.transfer.dest[id] = to || defaultDest(b); }
}
function transferRemove(id) { S.transfer.ids = S.transfer.ids.filter(x => x !== id); if (S.transfer.dest) delete S.transfer.dest[id]; }
const transferBottles = () => S.transfer.ids.map(id => byId(S.bottles, id)).filter(b => b && inCave(b));
const roleLabel = s => s.role === 'stock' ? 'stockage' : 'consommation';

function transferSheet() {
  const bs = transferBottles(), order = [...S.sites].sort((a, b) => (a.role === 'stock') - (b.role === 'stock'));
  return `${head('Transferts entre sites')}
    <p class="small" style="margin-top:-6px">Prépare les bouteilles à emporter, dans chaque sens. Touche une bouteille pour voir son résumé.</p>
    ${order.map(s => transferSection(s, bs.filter(b => tDest(b.id) === s.id))).join('')}`;
}
function transferSection(s, list) {
  const stock = s.role === 'stock', sugg = transferSuggestions(s.id);
  const row = b => { const w = wine(b.wineId), st = status(w);
    return `<div class="li"><button class="lb" data-act="tBrief" data-b="${b.id}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${st && st !== 'inconnu' ? esc(STATUS[st].short) + ' · ' : ''}${esc(locLabel(b, true))}${S.transfer.units?.[b.unitId] ? ' · voyage dans sa caisse' : ''}</small></div></button>
      <button class="icon-btn" data-act="toTransfer" data-b="${b.id}" aria-label="Retirer du transfert">${ICON.close}</button></div>`; };
  return `<div class="sect" data-tsect="${s.id}">Vers ${esc(s.name)} · ${roleLabel(s)}${list.length ? ' · ' + plural(list.length, 'bouteille', 'bouteilles') : ''}</div>
    ${list.length ? `<div class="list">${list.map(row).join('')}</div>
      <button class="btn primary wide" style="margin-top:10px" data-act="transferDone" data-to="${s.id}">${ICON.check} Arrivées à ${esc(s.name)}</button>`
      : `<p class="muted small" style="margin:2px 4px">Rien à emporter vers ${esc(s.name)} pour l’instant.</p>`}
    ${sugg.length ? `<p class="small" style="margin:12px 4px 0">${stock ? 'Suggestions : vins à garder, ajoutés récemment sur un autre site.' : 'Suggestions : vins prêts à boire stockés ailleurs.'}</p>
      <div class="list" style="margin-top:6px">${sugg.slice(0, 6).map(g => { const w = wine(g.b.wineId), st = status(w);
        return `<div class="li"><button class="lb" data-act="tBrief" data-b="${g.b.id}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(STATUS[st]?.short || '')} · ${esc(locLabel(g.b, true))}</small></div></button>
          <button class="btn small" data-act="tAdd" data-ids="${g.ids.join(',')}" data-to="${s.id}">Ajouter${g.ids.length > 1 ? ' ×' + g.ids.length : ''}</button></div>`; }).join('')}</div>` : ''}`;
}
// Suggestions : vers la consommation, un vin prêt à boire stocké ailleurs (une bouteille) ;
// vers le stockage, les bouteilles d'un vin à garder (« trop tôt » ou fenêtre inconnue), les plus récentes d'abord
function transferSuggestions(to) {
  const dst = site(to); if (!dst) return [];
  const ok = b => b.state === 'cave' && !S.transfer.ids.includes(b.id) && siteOfBottle(b) && siteOfBottle(b) !== to;
  if (dst.role !== 'stock') {
    const seen = new Set();
    return S.bottles.filter(b => {
      if (!ok(b)) return false;
      const w = wine(b.wineId); if (!w || b.owner || !['prio', 'apogee'].includes(status(w)) || seen.has(w.id)) return false;
      seen.add(w.id); return true;
    }).sort((a, b) => (status(wine(a.wineId)) === 'prio' ? 0 : 1) - (status(wine(b.wineId)) === 'prio' ? 0 : 1)).map(b => ({ b, ids: [b.id] }));
  }
  const groups = new Map();
  for (const b of S.bottles) {
    if (!ok(b) || site(siteOfBottle(b))?.role === 'stock') continue;
    const w = wine(b.wineId); if (!w || w.kind !== 'vin' || b.owner || !['tot', 'inconnu'].includes(status(w))) continue;
    const k = w.id + '|' + siteOfBottle(b); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b);
  }
  const last = bs => bs.reduce((m, b) => (b.addedAt || '') > m ? b.addedAt || '' : m, '');
  return [...groups.values()].sort((a, b) => last(b).localeCompare(last(a))).map(bs => ({ b: bs[0], ids: bs.map(b => b.id) }));
}
// Espace d'arrivée : consommation → espace de consommation ; stockage → meilleur espace de garde
function arrivalSpace(to) {
  const s = site(to), sps = siteSpaces(to);
  if (s?.role === 'stock') return [...sps].filter(x => x.use !== 'conso').sort((a, b) => spaceQuality(b) - spaceQuality(a))[0] || sps[0];
  return sps.find(x => x.use === 'conso') || sps[0];
}
function transferPick(id) {
  const b = byId(S.bottles, id), from = siteOfBottle(b);
  showSheet(() => `${head('Transférer vers…')}<div class="list">${S.sites.filter(s => s.id !== from).map(s => `<button class="li" data-act="tPick" data-b="${id}" data-to="${s.id}"><span class="dot" style="background:${s.role === 'stock' ? 'var(--gold)' : 'var(--green)'}"></span><div class="it"><b>${esc(s.name)}</b><small>Site de ${roleLabel(s)}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}</div>`);
}
// Résumé d'un vin, ouvert depuis les listes de transfert et les conseils de rangement
function wineBriefSheet(bid) {
  const b = byId(S.bottles, bid); if (!b) return null;
  const w = wine(b.wineId), a = w.apogee, st = status(w), y = thisYear(), sp = w.kind === 'spirit';
  const from = Math.min(a?.debut || y, y) - 1, to = Math.max(a?.fin || y + 5, y + 2) + 1;
  const bySite = S.sites.map(s => [s, wineBottles(w.id).filter(x => siteOfBottle(x) === s.id).length]).filter(([, n]) => n);
  const last = S.tastings.filter(t => t.wineId === w.id && t.note != null).sort((p, q) => (q.at || '').localeCompare(p.at || ''))[0];
  const inT = S.transfer.ids.includes(bid) && inCave(b), d = inT && site(tDest(bid));
  return `${head(esc(wineTitle(w)))}
    <p class="small" style="margin:-6px 0 6px">${esc([w.domaine, w.appellation, sp ? SPIRIT_CATS[w.cat] : COLORS[w.couleur]?.label].filter(Boolean).join(' · '))}</p>
    ${sp ? '' : `<div class="card"><div class="ct">Fenêtre de dégustation ${st && st !== 'inconnu' ? `<span class="tag ${STATUS[st].tag}">${STATUS[st].label}</span>` : ''}</div>
      ${a?.fin ? `<div class="score" style="font-size:20px;text-align:left">${a.debut || '?'} – ${a.fin}${a.pic ? `<small> · apogée ${a.pic}</small>` : ''}</div>${winBar(a, from, to, true)}<div class="winlab"><span>${from}</span><span>${to}</span></div>` : '<p class="small" style="margin:0">Pas encore de fenêtre.</p>'}</div>`}
    <dl class="kv">
      <dt>En cave</dt><dd>${bySite.length ? bySite.map(([s, n]) => `${esc(s.name)} ×${n}`).join(' · ') : 'aucune'}</dd>
      <dt>Dernière note</dt><dd>${last ? `${numFr(last.note)} / 20 · ${esc(fmtDate(last.at))}` : 'pas encore dégusté'}</dd>
      <dt>Cette bouteille</dt><dd>${esc(locLabel(b, true))}</dd>
      ${inT ? `<dt>Transfert</dt><dd>vers ${esc(d?.name || '?')}</dd>` : ''}</dl>
    <div class="btns" style="margin-top:12px">
      ${inCave(b) && isMulti() ? `<button class="btn wide ${inT ? 'outline' : 'primary'}" data-act="toTransfer" data-b="${bid}">${ICON.truck} ${inT ? 'Retirer du transfert' : 'Ajouter au transfert' + (S.sites.length === 2 ? ' vers ' + esc(site(defaultDest(b))?.name || '') : '')}</button>` : ''}
      <button class="btn ghost wide" data-act="wine" data-id="${w.id}">Fiche complète</button></div>`;
}
Object.assign(ACT, {
  transferSheet: () => showSheet(transferSheet),
  tBrief: t => showSheet(() => wineBriefSheet(t.dataset.b)),
  toTransfer: async t => {
    const id = t.dataset.b, inT = S.transfer.ids.includes(id);
    if (!inT && S.sites.length > 2) return transferPick(id);
    if (inT) { transferRemove(id); const u = byId(S.bottles, id)?.unitId; if (u && S.transfer.units?.[u]) delete S.transfer.units[u]; } else transferAdd([id]);
    await save(); refreshSheet(); render();
    toast(inT ? 'Retirée du transfert' : `Ajoutée au transfert vers ${site(tDest(id))?.name || ''}`);
  },
  tPick: async t => { transferAdd([t.dataset.b], t.dataset.to); await save(); sheetBack(); refreshSheet(); render(); toast(`Ajoutée au transfert vers ${site(t.dataset.to)?.name || ''}`); },
  tAdd: async t => {
    const ids = (t.dataset.ids || '').split(',').filter(Boolean), to = t.dataset.to;
    transferAdd(ids, to); await save();
    if (t.dataset.close) closeSheet(); else refreshSheet();
    render(); toast(`${plural(ids.length, 'bouteille ajoutée', 'bouteilles ajoutées')} au transfert vers ${site(to)?.name || ''}`);
  },
  transferDone: async t => {
    const to = t.dataset.to, dest = arrivalSpace(to), s = site(to);
    if (!dest) return toast('Ce site n’a pas encore d’espace');
    const moved = [];
    // Caisses entières : le meuble est posé dans l'espace d'arrivée avec ses bouteilles
    let boxes = 0;
    for (const [uid_, d] of Object.entries(S.transfer.units || {})) {
      const u = unit(uid_); if (d !== to || !u) continue;
      if (space(u.spaceId)?.siteId !== to) { moveBox(u, dest.id, 'transfert'); boxes++; }
      for (const b of boxBottles(uid_)) transferRemove(b.id);
      delete S.transfer.units[uid_];
    }
    for (const b of transferBottles()) {
      if (tDest(b.id) !== to) continue;
      if (siteOfBottle(b) !== to) { const from = locOf(b); Object.assign(b, { spaceId: dest.id, unitId: null, r: null, c: null }); logMove(b, 'transfert', { from, to: locOf(b) }); moved.push(b.id); }
      transferRemove(b.id);
    }
    if (!S.transfer.ids.length) S.transfer.to = null;
    S.settings.site = to; caveSpace = dest.id;
    await save(); closeSheet(); view = 'cave'; caveMode = 'plan'; render();
    if (s?.role === 'stock' && moved.length && spaceUnits(dest.id).length) {
      lastArrival = moved;
      return showSheet(() => `${head(`Arrivées à ${esc(s.name)}`)}<p>${plural(moved.length, 'bouteille est', 'bouteilles sont')} dans « ${esc(dest.name)} », sans emplacement.</p>
        <div class="btns"><button class="btn primary wide" data-act="tPlaceNow" data-space="${dest.id}">Ranger maintenant</button><button class="btn ghost wide" data-act="close">Plus tard</button></div>`);
    }
    toast(boxes && !moved.length ? `${plural(boxes, 'caisse arrivée', 'caisses arrivées')} dans « ${dest.name} »` : `${plural(moved.length, 'bouteille arrivée', 'bouteilles arrivées')}${boxes ? ` et ${plural(boxes, 'caisse', 'caisses')}` : ''} · à ranger dans « ${dest.name} »`);
  },
  tPlaceNow: t => {
    const ids = (lastArrival || []).filter(id => { const b = byId(S.bottles, id); return b && inCave(b) && !b.unitId; });
    closeSheet(); if (!ids.length) return;
    startPlace(byId(S.bottles, ids[0]).wineId, ids, t.dataset.space, true);
  },
});
let lastArrival = null;
