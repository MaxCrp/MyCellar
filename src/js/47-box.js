/* ---------- Caisses et cartons : actions sur toute la caisse (v1.7.4) ----------
   Une caisse ou un carton ne contient qu'un seul vin. Depuis sa fiche : sortir N bouteilles, déplacer la caisse
   (elle part avec ses bouteilles), l'ajouter au transfert, attribuer N bouteilles, modifier le vin ou l'achat. */
const boxBottles = uid_ => { const u = unit(uid_); return u ? boxContents(u, occupancy()) : []; };
const boxInTransfer = uid_ => !!S.transfer.units?.[uid_];
function boxActions(u, bs) {
  const w = wine(bs[0].wineId), inT = boxInTransfer(u.id);
  return `<div class="btns" style="margin-top:12px">
    <button class="btn primary wide" data-act="boxOut" data-u="${u.id}">${ICON.out} Sortir des bouteilles</button>
    <div class="btns2"><button class="btn" data-act="boxMove" data-u="${u.id}">${ICON.move} Déplacer la caisse</button>
      ${isMulti() ? `<button class="btn${inT ? ' outline' : ''}" data-act="boxTransfer" data-u="${u.id}">${ICON.truck} ${inT ? 'Retirer du transfert' : 'Au transfert'}</button>` : `<button class="btn" data-act="boxOwner" data-u="${u.id}">Attribuer…</button>`}</div>
    ${inT ? `<p class="tiny" style="margin:0">Au transfert vers ${esc(site(S.transfer.units[u.id])?.name || '')} : la caisse voyagera avec ses bouteilles.</p>` : ''}
    <div class="btns2">${isMulti() ? `<button class="btn" data-act="boxOwner" data-u="${u.id}">Attribuer…</button>` : ''}<button class="btn" data-act="boxBuy" data-u="${u.id}">Modifier l’achat</button>${isMulti() ? '' : `<button class="btn" data-act="editWine" data-id="${w.id}">Modifier le vin</button>`}</div>
    ${isMulti() ? `<button class="btn wide" data-act="editWine" data-id="${w.id}">Modifier le vin</button>` : ''}
    <button class="btn ghost wide" data-act="wine" data-id="${w.id}">Voir la fiche du vin</button></div>`;
}
// Sortir N bouteilles d'un coup
function boxOutSheet(uid_) {
  const bs = boxBottles(uid_); if (!bs.length) return null;
  const w = wine(bs[0].wineId), friends = bs.some(b => b.owner), sp = w.kind === 'spirit';
  const motifs = Object.keys(MOTIFS).filter(k => (k !== 'rendue' || friends) && (k !== 'terminee' || sp));
  return `${head('Sortir des bouteilles')}
    <p class="small" style="margin-top:-6px"><span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))} · ${plural(bs.length, 'bouteille', 'bouteilles')} dans la caisse</p>
    <form class="form" data-form="boxOut" data-u="${uid_}">
      <label>Nombre<input name="n" inputmode="numeric" value="1" required></label>
      <div class="chips wrap">${motifs.map(k => `<label class="chip soft${k === 'bue' ? ' on' : ''}" style="cursor:pointer"><input type="radio" name="motif" value="${k}" ${k === 'bue' ? 'checked' : ''} class="sr-only" data-ch="radioChip">${MOTIFS[k]}</label>`).join('')}</div>
      <div class="grid2"><label>Date<input type="date" name="at" value="${today()}"></label><label>Offertes à / avec<input name="who" autocomplete="off"></label></div>
      <label>Occasion ou plat<input name="plat" autocomplete="off"></label>
      <button class="btn primary wide" type="submit">Confirmer la sortie</button>
    </form>`;
}
FORMS.boxOut = async (f, d) => {
  const bs = boxBottles(f.dataset.u), raw = String(d.n || '').replace(/\s/g, '');
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > bs.length) return formErrors(f, [['n', `Un nombre de 1 à ${bs.length}`]]);
  if (d.motif === 'offerte' && d.who && !giftAgain(bs[0].wineId, d.who)) return;
  // « Rendue » : d'abord les bouteilles des amis ; sinon d'abord les miennes
  const pick = [...bs].sort((a, b) => d.motif === 'rendue' ? !!b.owner - !!a.owner : !!a.owner - !!b.owner).slice(0, +raw);
  const tasteM = ['bue', 'bouchonnee', 'terminee'].includes(d.motif);
  for (const b of pick) {
    const from = locOf(b); b.state = 'out'; b.outAt = d.at || today();
    logMove(b, 'out', { motif: d.motif, at: d.at || today(), from, who: d.who, plat: d.plat });
    transferRemove(b.id); b.ficheTodo = tasteM && !b.owner;
  }
  await save(); render();
  const todo = pick.filter(b => b.ficheTodo);
  if (pick.length === 1 && todo.length) return tastedSheet(wine(pick[0].wineId), pick[0]);
  closeSheet(); toast(`${plural(pick.length, 'bouteille sortie', 'bouteilles sorties')}${todo.length ? ' · à noter dans Dégustations' : ''}`);
};
// Déplacer la caisse : le meuble change d'espace (ou de site), ses bouteilles restent dedans
function boxMoveSheet(uid_) {
  const u = unit(uid_); if (!u) return null;
  return `${head('Déplacer la caisse')}<p class="small" style="margin-top:-6px">${esc(u.name || UNIT_TYPES[u.type].label)} · ${plural(boxBottles(uid_).length, 'bouteille', 'bouteilles')}</p>
    <div class="list">${S.spaces.filter(s => s.id !== u.spaceId).map(s => `<button class="li" data-act="boxMoveTo" data-u="${uid_}" data-s="${s.id}"><div class="it"><b>${esc(S.sites.length > 1 ? site(s.siteId)?.name + ' › ' : '')}${esc(s.name)}</b><small>${esc(s.use === 'conso' ? 'Consommation' : 'Garde')}</small></div><span class="chev">${ICON.chev}</span></button>`).join('') || '<p class="muted small" style="padding:12px">Aucun autre espace.</p>'}</div>`;
}
function moveBox(u, spaceId, type) {
  for (const b of boxBottles(u.id)) { const from = locOf(b); b.spaceId = spaceId; logMove(b, type || (from.siteId !== space(spaceId)?.siteId ? 'transfert' : 'move'), { from, to: locOf(b) }); }
  u.spaceId = spaceId; u.order = S.units.length;
}
// Attribuer N bouteilles à un ami (ou à moi)
function boxOwnerSheet(uid_) {
  const bs = boxBottles(uid_); if (!bs.length) return null;
  const w = wine(bs[0].wineId);
  return `${head('Attribuer des bouteilles')}
    <p class="small" style="margin-top:-6px"><span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))}${bs.some(b => b.owner) ? ' · ' + esc(ownerSummary(w, bs)) : ''}</p>
    <form class="form" data-form="boxOwner" data-u="${uid_}">
      <div class="grid2"><label>Nombre<input name="n" inputmode="numeric" value="${bs.length}" required></label><label>À qui<input name="o" list="dl-friends" placeholder="Vide = à moi" autocomplete="off"></label></div>
      ${dl('dl-friends', friendNames())}
      <button class="btn primary wide" type="submit">Attribuer</button>
    </form>`;
}
FORMS.boxOwner = async (f, d) => {
  const bs = boxBottles(f.dataset.u), raw = String(d.n || '').replace(/\s/g, ''), o = String(d.o || '').trim().slice(0, 40);
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > bs.length) return formErrors(f, [['n', `Un nombre de 1 à ${bs.length}`]]);
  // D'abord les bouteilles qui n'appartiennent pas encore à cette personne
  const pick = [...bs].sort((a, b) => ((a.owner || '') === o) - ((b.owner || '') === o)).slice(0, +raw);
  for (const b of pick) b.owner = o || null;
  if (o && !S.settings.friends.includes(o)) S.settings.friends.push(o);
  await save(); sheetBack(); refreshSheet(); render(); toast(o ? `${plural(pick.length, 'bouteille attribuée', 'bouteilles attribuées')} à ${o}` : `${plural(pick.length, 'bouteille', 'bouteilles')} à moi`);
};
// Modifier l'achat : le prix, la date et la source sont ceux du vin (toutes ses bouteilles)
function boxBuySheet(uid_) {
  const bs = boxBottles(uid_); if (!bs.length) return null;
  const w = wine(bs[0].wineId), a = w.achat || {};
  return `${head('Modifier l’achat')}
    <p class="small" style="margin-top:-6px"><span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))}</p>
    <form class="form" data-form="boxBuy" data-w="${w.id}">
      <div class="grid2"><label>Prix unitaire (€)<input name="prix" inputmode="decimal" value="${esc(numFr(a.prix, 2))}"></label><label>Date d’achat<input type="date" name="adate" value="${esc(a.date || '')}"></label></div>
      <label>Lieu d’achat<input name="lieu" value="${esc(a.lieu || '')}" autocomplete="off"></label>
      <label>Offert par<input name="offertPar" value="${esc(w.cadeau?.de || '')}" placeholder="Si c’est un cadeau" autocomplete="off"></label>
      <p class="tiny" style="margin:0">L’achat est celui du vin : il vaut pour ses ${plural(heldBottles(w.id).length, 'bouteille', 'bouteilles')}, dans cette caisse et ailleurs.</p>
      <button class="btn primary wide" type="submit">Enregistrer</button>
    </form>`;
}
FORMS.boxBuy = async (f, d) => {
  const w = wine(f.dataset.w), p = d.prix ? num(d.prix) : null;
  if (d.prix && (p == null || p < 0 || p > 100000)) return formErrors(f, [['prix', 'Un prix entre 0 et 100 000 €']]);
  w.achat = { ...(w.achat || {}), prix: p, date: d.adate || null, lieu: String(d.lieu || '').trim() };
  w.cadeau = String(d.offertPar || '').trim() ? { de: String(d.offertPar).trim() } : null;
  await save(); sheetBack(); refreshSheet(); render(); toast('Achat modifié');
};
function boxTransferPick(uid_) {
  const u = unit(uid_), from = space(u.spaceId)?.siteId;
  showSheet(() => `${head('Transférer la caisse vers…')}<div class="list">${S.sites.filter(s => s.id !== from).map(s => `<button class="li" data-act="boxTransferTo" data-u="${uid_}" data-to="${s.id}"><div class="it"><b>${esc(s.name)}</b><small>Site de ${roleLabel(s)}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}</div>`);
}
async function boxToTransfer(uid_, to) {
  const bs = boxBottles(uid_); if (!bs.length) return;
  transferAdd(bs.map(b => b.id), to); (S.transfer.units ||= {})[uid_] = to;
  await save(); refreshSheet(); render(); toast(`Caisse au transfert vers ${site(to)?.name || ''}`);
}
Object.assign(ACT, {
  boxOut: t => showSheet(() => boxOutSheet(t.dataset.u)),
  boxMove: t => showSheet(() => boxMoveSheet(t.dataset.u)),
  boxMoveTo: async t => {
    const u = unit(t.dataset.u), sp = space(t.dataset.s); if (!u || !sp) return;
    moveBox(u, sp.id); if (S.transfer.units) delete S.transfer.units[u.id];
    for (const b of boxBottles(u.id)) transferRemove(b.id);
    if (isMulti()) S.settings.site = sp.siteId;
    caveSpace = sp.id; await save(); closeSheet(); view = 'cave'; caveMode = 'plan'; render(); toast(`Caisse déplacée dans « ${sp.name} »`);
  },
  boxTransfer: async t => {
    const id = t.dataset.u;
    if (boxInTransfer(id)) {
      delete S.transfer.units[id]; for (const b of boxBottles(id)) transferRemove(b.id);
      await save(); refreshSheet(); render(); return toast('Caisse retirée du transfert');
    }
    const from = space(unit(id).spaceId)?.siteId, others = S.sites.filter(s => s.id !== from);
    if (others.length > 1) return boxTransferPick(id);
    if (others[0]) return boxToTransfer(id, others[0].id);
  },
  boxTransferTo: async t => { await boxToTransfer(t.dataset.u, t.dataset.to); sheetBack(); refreshSheet(); },
  boxOwner: t => showSheet(() => boxOwnerSheet(t.dataset.u)),
  boxBuy: t => showSheet(() => boxBuySheet(t.dataset.u)),
  boxAdd: t => {
    const u = unit(t.dataset.u), occ = occupancy(), free = freeSlots(u, occ)[0];
    if (free) addTarget = { unitId: u.id, r: free[0], c: free[1] };
    showSheet(() => addBottlesSheet(t.dataset.w));
  },
});
