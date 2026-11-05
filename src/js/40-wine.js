/* ---------- Mouvements ---------- */
const locOf = b => ({ siteId: siteOfBottle(b), spaceId: b.spaceId || null, unitId: b.unitId || null, r: b.r ?? null, c: b.c ?? null });
function logMove(b, type, extra = {}) {
  S.moves.push({ id: uid(), at: today(), ts: Date.now(), wineId: b.wineId, bottleId: b.id, type, ...extra });
}
const occupancyExcept = ids => { const m = occupancy(); for (const [k, b] of m) if (ids.has(b.id)) m.delete(k); return m; };

/* ---------- Ajouter ---------- */
let addTarget = null;   // place choisie avant l'ajout (case libre touchée sur le plan)
// Bouton + commun à tous les onglets : deux choix, puis les écrans détaillés
function plusSheet() {
  return `${head('Ajouter')}
    <div class="big-actions">
      <button class="big-action" data-act="newTaste">${ICON.notes}<div><b>Nouvelle dégustation</b><small>Un vin de ta cave ou bu ailleurs, une séance, à l’aveugle.</small></div></button>
      <button class="big-action" data-act="addWine">${ICON.bottle}<div><b>Nouveau vin</b><small>Ajouter des bouteilles à ta cave.</small></div></button>
    </div>`;
}
function addSheet() {
  const ai = aiReady();
  return `${head('Nouveau vin')}
    <div class="big-actions">
      <button class="big-action" data-act="scanLabel">${ICON.camera}<div><b>Photo de l’étiquette</b><small>${ai ? 'Le sommelier remplit la fiche, tu valides.' : 'Nécessite une clé IA (Plus › Intelligence artificielle).'}</small></div></button>
      <button class="big-action" data-act="newWine" data-kind="vin">${ICON.edit}<div><b>Saisie manuelle</b><small>Domaine, cuvée, millésime, quantité.</small></div></button>
      ${spiritsOn() ? `<button class="big-action" data-act="newWine" data-kind="spirit">${ICON.bottle}<div><b>Spiritueux</b><small>Whisky, rhum, cognac, mignonnettes…</small></div></button>` : ''}
      ${S.wines.length ? `<button class="big-action" data-act="rebuyList">${ICON.copy}<div><b>Racheter un vin de la cave</b><small>Ajouter des bouteilles à une référence existante.</small></div></button>` : ''}
    </div>`;
}
function newDraft(kind, w = {}) {
  const base = kind === 'spirit' ? { kind, cat: 'whisky', format: '70', pays: '' } : { kind, couleur: 'rouge', format: '75', pays: 'France' };
  draft = { w: { ...base, ...w }, qty: 1, state: 'cave', spaceId: null, photo: null, edit: null };
}
const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.label)}</option>`).join('');
const optsArr = (arr, sel) => arr.map(([k, v]) => `<option value="${k}" ${k === String(sel) ? 'selected' : ''}>${esc(v)}</option>`).join('');
const uniq = f => [...new Set(S.wines.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
const dl = (id, list) => `<datalist id="${id}">${list.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
function spaceOptions(sel) {
  return S.spaces.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(isMulti() ? site(s.siteId)?.name + ' › ' : '')}${esc(s.name)}</option>`).join('');
}
function wineFormSheet() {
  const d = draft, w = d.w, sp = w.kind === 'spirit', editing = !!d.edit;
  const v = k => esc(w[k] ?? '');
  const sugg = suggestSpace(w);
  const vinFields = `
    <div class="fieldset"><div class="ft">Le vin</div>
      <label>Couleur<select name="couleur">${opts(COLORS, w.couleur)}</select></label>
      <label>Domaine ou château<input name="domaine" value="${v('domaine')}" list="dl-dom" required autocomplete="off"></label>
      <label>Cuvée<input name="cuvee" value="${v('cuvee')}" placeholder="Facultatif" autocomplete="off"></label>
      <label>Appellation<input name="appellation" value="${v('appellation')}" list="dl-app" autocomplete="off"></label>
      <div class="grid2"><label>Millésime<input name="millesime" inputmode="numeric" value="${v('millesime')}" placeholder="vide = non millésimé"></label>
        <label>Format<select name="format">${optsArr(FORMATS.vin, w.format)}</select></label></div>
      <div class="grid2"><label>Région<input name="region" value="${v('region')}" list="dl-reg" autocomplete="off"></label><label>Pays<input name="pays" value="${v('pays')}" autocomplete="off"></label></div>
      <label>Cépages<input name="cepages" value="${v('cepages')}" placeholder="Syrah, Grenache…" autocomplete="off"></label>
      <div class="grid2"><label>Degré<input name="degre" inputmode="decimal" value="${esc(numFr(w.degre))}" placeholder="13,5"></label>
        <label>Servir à<input name="service" value="${v('service')}" placeholder="16-18 °C" autocomplete="off"></label></div>
      <div class="grid2"><label class="check"><input type="checkbox" name="bio" ${w.bio ? 'checked' : ''}> Bio</label><label class="check"><input type="checkbox" name="nature" ${w.nature ? 'checked' : ''}> Nature</label></div>
    </div>`;
  const spiritFields = `
    <div class="fieldset"><div class="ft">Le spiritueux</div>
      <label>Catégorie<select name="cat">${opts(SPIRIT_CATS, w.cat)}</select></label>
      <label>Distillerie ou maison<input name="domaine" value="${v('domaine')}" list="dl-dom" required autocomplete="off"></label>
      <label>Nom de l’expression<input name="cuvee" value="${v('cuvee')}" placeholder="Ex. 12 ans Sherry Cask" autocomplete="off"></label>
      <div class="grid2"><label>Pays<input name="pays" value="${v('pays')}" autocomplete="off"></label><label>Région<input name="region" value="${v('region')}" list="dl-reg" autocomplete="off"></label></div>
      <div class="grid3"><label>Âge (ans)<input name="age" inputmode="numeric" value="${v('age')}"></label><label>Distillé en<input name="millesime" inputmode="numeric" value="${v('millesime')}"></label><label>Embouteillé<input name="bottled" inputmode="numeric" value="${v('bottled')}"></label></div>
      <div class="grid2"><label>Degré<input name="degre" inputmode="decimal" value="${esc(numFr(w.degre))}"></label><label>Contenance<select name="format">${optsArr(FORMATS.spirit, w.format)}</select></label></div>
      <label>Fût, finition<input name="fut" value="${v('fut')}" placeholder="Ex-bourbon, finition sherry…" autocomplete="off"></label>
      <div class="grid2"><label class="check"><input type="checkbox" name="bruteDeFut" ${w.bruteDeFut ? 'checked' : ''}> Brut de fût</label><label class="check"><input type="checkbox" name="singleCask" ${w.singleCask ? 'checked' : ''}> Single cask</label></div>
      <div class="grid2"><label>Embouteilleur indépendant<input name="independant" value="${v('independant')}" autocomplete="off"></label><label>N° de fût ou bouteille<input name="numero" value="${v('numero')}" autocomplete="off"></label></div>
    </div>`;
  const ft = d.forTaste || d.forReveal;
  const stock = editing || ft ? '' : `
    <div class="fieldset"><div class="ft">Bouteilles</div>
      <div class="grid2"><label>Quantité<input name="qty" inputmode="numeric" value="${d.qty}" required></label>
        <label>État<select name="state" data-ch="draftState"><option value="cave" ${d.state === 'cave' ? 'selected' : ''}>En cave</option><option value="primeur" ${d.state === 'primeur' ? 'selected' : ''}>Primeur, pas encore livré</option></select></label></div>
      <div id="primeur-f" ${d.state === 'primeur' ? '' : 'hidden'}><label>Livraison prévue<input type="date" name="delivery" value="${esc(d.delivery || '')}"></label></div>
      <label>${d.state === 'primeur' ? 'Destination à la livraison' : 'Ranger dans'}<select name="spaceId">${spaceOptions(addTarget ? unit(addTarget.unitId)?.spaceId : d.spaceId || sugg?.id)}</select></label>
      ${addTarget ? `<p class="tiny" style="margin:0">La première bouteille ira à la place que tu as touchée.</p>` : ''}
    </div>`;
  const friends = uniq(x => x.owner).concat(S.settings.friends || []);
  return `${head(editing ? 'Modifier' : ft ? 'Quel vin ?' : sp ? 'Nouveau spiritueux' : 'Nouveau vin')}
    <form class="form" data-form="wine">
      ${d.photo || (editing && w.photo) ? `<img class="photo" ${d.photo ? `src="${d.photoUrl}"` : `data-photo="${w.id}" hidden`} alt="Étiquette">` : ''}
      ${sp ? spiritFields : vinFields}
      ${stock}
      ${ft ? '' : `<div class="fieldset"><div class="ft">Achat</div>
        <div class="grid2"><label>Prix unitaire (€)<input name="prix" inputmode="decimal" value="${esc(numFr(w.achat?.prix, 2))}"></label><label>Date<input type="date" name="adate" value="${esc(w.achat?.date || (editing ? '' : today()))}"></label></div>
        <label>Lieu d’achat<input name="lieu" value="${esc(w.achat?.lieu || '')}" list="dl-lieu" autocomplete="off"></label>
        <label>Offert par<input name="offertPar" value="${esc(w.cadeau?.de || '')}" placeholder="Si c’est un cadeau" autocomplete="off"></label>
      </div>
      <div class="fieldset"><div class="ft">Propriétaire</div>
        <label>À qui appartiennent ces bouteilles ?<input name="owner" value="${esc(w.owner || '')}" list="dl-friends" placeholder="Vide = à moi · sinon prénom de l’ami" autocomplete="off"></label>
        <p class="tiny" style="margin:0">Les bouteilles gardées pour un ami ne sont jamais proposées par le sommelier.</p>
      </div>`}
      <details class="fieldset"><summary class="ft" style="cursor:pointer">Plus de détails</summary>
        ${sp ? '' : `<div class="grid3"><label>Début<input name="adeb" inputmode="numeric" value="${esc(w.apogee?.debut || '')}"></label><label>Apogée<input name="apic" inputmode="numeric" value="${esc(w.apogee?.pic || '')}"></label><label>Fin<input name="afin" inputmode="numeric" value="${esc(w.apogee?.fin || '')}"></label></div>
        <p class="tiny" style="margin:0">Fenêtre de dégustation. Laisse vide : le sommelier l’estimera.</p>`}
        <div class="grid2"><label>Nom court (plan)<input name="short" value="${v('short')}" placeholder="${esc(shortName({ ...w, short: '' }))}"></label><label>Abréviation (rack)<input name="abbr" value="${v('abbr')}" placeholder="${esc(abbr({ ...w, abbr: '' }))}" maxlength="3"></label></div>
        <label>Notes<textarea name="notes">${esc(w.notes || '')}</textarea></label>
      </details>
      <button class="btn primary wide" type="submit">${editing ? 'Enregistrer' : d.forReveal ? 'Révéler ce vin' : ft ? 'Continuer vers la dégustation' : 'Ajouter à la cave'}</button>
    </form>
    ${dl('dl-dom', uniq(x => x.domaine))}${dl('dl-app', uniq(x => x.appellation))}${dl('dl-reg', uniq(x => x.region))}${dl('dl-lieu', uniq(x => x.achat?.lieu))}${dl('dl-friends', [...new Set(friends)])}`;
}
CHANGES.draftState = el => { $('#primeur-f').hidden = el.value !== 'primeur'; };
function readWineForm(d, w) {
  const sp = w.kind === 'spirit';
  const t = s => s || '';
  Object.assign(w, {
    domaine: t(d.domaine), cuvee: t(d.cuvee), region: t(d.region), pays: t(d.pays), format: d.format,
    millesime: readYear(d.millesime, thisYear() + 1).v || null, degre: num(d.degre), owner: t(d.owner) || null, short: t(d.short), abbr: t(d.abbr).toUpperCase(), notes: t(d.notes),
    achat: { prix: num(d.prix), date: d.adate || null, lieu: t(d.lieu) }, cadeau: d.offertPar ? { de: d.offertPar } : null,
  });
  if (sp) Object.assign(w, { cat: d.cat, age: int(d.age), bottled: int(d.bottled), fut: t(d.fut), bruteDeFut: !!d.bruteDeFut, singleCask: !!d.singleCask, independant: t(d.independant), numero: t(d.numero) });
  else {
    Object.assign(w, { couleur: d.couleur, appellation: t(d.appellation), cepages: t(d.cepages), service: t(d.service).slice(0, 40), bio: !!d.bio, nature: !!d.nature });
    const cw = cleanWindow(int(d.adeb), int(d.apic), int(d.afin), w.millesime), a = w.apogee || {};
    const fin = cw?.fin, deb = cw?.debut, pic = cw?.pic;
    if (fin && (fin !== a.fin || deb !== a.debut || pic !== a.pic)) w.apogee = { ...a, debut: deb, pic, fin, src: 'manuel', at: Date.now() };
    else if (!fin && a.src === 'manuel') w.apogee = null;
  }
  if (w.owner && !S.settings.friends.includes(w.owner)) S.settings.friends.push(w.owner);
}
// Contrôles de la fiche vin : valeurs hors bornes signalées sous le champ, fiche non enregistrée
function checkWineForm(f, d, kind, creating) {
  const errs = [], add = (n, m) => errs.push([n, m]), sp = kind === 'spirit', yr = thisYear();
  const m = readYear(d.millesime, sp ? yr : yr + 1);
  if (m.err) add('millesime', m.err);
  else if (m.bad) {
    if (confirm(`« ${d.millesime} » n’est pas une année. ${sp ? 'Laisser sans année de distillation' : 'Laisser ce vin non millésimé'} ?`)) { d.millesime = ''; f.elements.millesime.value = ''; }
    else add('millesime', 'Une année, par exemple 2019');
  } else if (m.filled) { d.millesime = String(m.v); f.elements.millesime.value = d.millesime; }
  if (d.prix) { const p = num(d.prix); if (p == null) add('prix', 'Prix non reconnu (ex. 24,50)'); else if (p < 0 || p > 100000) add('prix', 'Un prix entre 0 et 100 000 €'); }
  if (d.degre) { const g = num(d.degre), mx = sp ? 80 : 25; if (g == null || g <= 0 || g > mx) add('degre', `Un degré entre 0 et ${mx} %`); }
  if (creating && 'qty' in d) { const q = String(d.qty).replace(/\s/g, ''); if (!/^\d+$/.test(q) || +q < 1 || +q > 500) add('qty', 'Un nombre entier de 1 à 500'); }
  if (sp) {
    if (d.age) { const a = num(d.age); if (a == null || !Number.isInteger(a) || a < 0 || a > 100) add('age', 'De 0 à 100 ans'); }
    if (d.bottled) { const b = readYear(d.bottled, yr); if (b.err || b.bad) add('bottled', `Une année entre 1900 et ${yr}`); else if (b.filled) { d.bottled = String(b.v); f.elements.bottled.value = d.bottled; } }
  } else if (d.adeb || d.apic || d.afin) {
    if (!int(d.afin)) add('afin', 'Indique au moins l’année de fin');
    else if (!cleanWindow(int(d.adeb), int(d.apic), int(d.afin), readYear(d.millesime, yr + 1).v)) add('afin', 'Fenêtre incohérente : début ≤ apogée ≤ fin, et pas avant le millésime');
  }
  return !formErrors(f, errs);
}
FORMS.wine = async (f, d) => {
  const dr = draft; if (!dr) return closeSheet();
  if (!checkWineForm(f, d, dr.w.kind, !dr.edit)) return;
  if (dr.edit) {
    const w = wine(dr.edit); readWineForm(d, w); w.updatedAt = Date.now();
    if (dr.photo) { await photoSave(w.id, dr.photo); w.photo = true; }
    await save(); draft = null; sheetBack(); render(); return toast('Fiche modifiée');
  }
  const w = { id: uid(), ...dr.w, createdAt: Date.now() };
  readWineForm(d, w);
  // Vin dégusté hors cave : une fiche sans bouteille (ou la fiche existante), puis la dégustation
  if (dr.forTaste || dr.forReveal) {
    const same = S.wines.find(x => x.kind === w.kind && norm(x.domaine) === norm(w.domaine) && norm(x.cuvee) === norm(w.cuvee) && norm(x.appellation) === norm(w.appellation) && (x.millesime || null) === w.millesime);
    const target = same || w;
    if (!same) { delete w.achat; S.wines.push(w); }
    if (dr.photo && !target.photo) { await photoSave(target.id, dr.photo); target.photo = true; }
    await save(); draft = null; closeSheet();
    if (target.kind === 'vin' && !target.apogee?.fin && aiReady() && S.settings.ai.auto && !same) estimateApogee(target.id, { quiet: true });
    if (dr.forReveal) return doReveal(dr.forReveal, target.id);
    return startTaste(target.id, null, 'quick', { sessionId: dr.forTaste.sessionId });
  }
  const qty = clamp(int(d.qty) || 1, 1, 500);
  const same = S.wines.find(x => x.kind === w.kind && norm(x.domaine) === norm(w.domaine) && norm(x.cuvee) === norm(w.cuvee) && norm(x.appellation) === norm(w.appellation) && (x.millesime || null) === w.millesime && (x.owner || null) === w.owner && x.format === w.format);
  let target = w;
  if (same && confirm(`« ${wineTitle(same)} » est déjà dans ta cave. Ajouter ces ${qty} bouteille(s) à cette fiche ?`)) target = same;
  else S.wines.push(w);
  if (dr.photo) { await photoSave(target.id, dr.photo); target.photo = true; }
  const ids = createBottles(target, qty, d.state === 'primeur' ? { state: 'primeur', delivery: { date: d.delivery || null, spaceId: d.spaceId } } : { spaceId: d.spaceId });
  await save(); draft = null;
  afterAdd(target, ids, d.state === 'primeur');
};
function createBottles(w, n, { state = 'cave', spaceId = null, delivery = null } = {}) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const b = { id: uid(), wineId: w.id, state, spaceId: state === 'cave' ? spaceId : null, unitId: null, r: null, c: null, addedAt: today(), delivery };
    S.bottles.push(b); ids.push(b.id); logMove(b, state === 'primeur' ? 'primeur' : 'in', { to: locOf(b) });
  }
  return ids;
}
function afterAdd(w, ids, primeur) {
  const autoAI = w.kind === 'vin' && !w.apogee?.fin && aiReady() && S.settings.ai.auto;
  if (autoAI) estimateApogee(w.id, { quiet: true });
  if (primeur) { closeSheet(); render(); return toast(`${plural(ids.length, 'bouteille ajoutée', 'bouteilles ajoutées')} en primeur`); }
  // Une place a été touchée sur le plan : la première bouteille y va directement
  const b0 = byId(S.bottles, ids[0]);
  if (addTarget && b0) {
    const u = unit(addTarget.unitId), occ = occupancy();
    if (u && !occ.has(`${u.id}:${addTarget.r}:${addTarget.c}`)) { Object.assign(b0, { spaceId: u.spaceId, unitId: u.id, r: addTarget.r, c: addTarget.c }); }
  }
  addTarget = null;
  const rest = ids.filter(id => !byId(S.bottles, id).unitId);
  const spId = byId(S.bottles, ids[0]).spaceId;
  save();
  const ask = stockAskFor(w, spId);
  if (rest.length && spaceUnits(spId).length) {
    closeSheet();
    startPlace(w.id, rest, spId, true);
    if (ask) { draft.place.stockAsk = ask; refreshSheet(); }
  } else {
    closeSheet(); render(); toast(`${plural(ids.length, 'bouteille ajoutée', 'bouteilles ajoutées')}${autoAI ? ' · estimation de l’apogée en cours' : ''}`);
    if (ask) showSheet(() => `${head('Vin à garder')}<p>${esc(wineTitle(w))} est encore trop jeune. À emporter au prochain transfert vers ${esc(site(ask).name)} ?</p>
      <div class="btns"><button class="btn primary wide" data-act="tAdd" data-ids="${ids.join(',')}" data-to="${ask}" data-close="1">${ICON.truck} Oui, au transfert</button><button class="btn ghost wide" data-act="close">Non</button></div>`);
  }
}
// Achat sur un site de consommation d'un vin à garder : on propose de l'emporter vers le stockage
function stockAskFor(w, spId) {
  if (!isMulti() || w.kind !== 'vin' || isFriend(w) || status(w) !== 'tot') return null;
  const here = site(space(spId)?.siteId); if (!here || here.role === 'stock') return null;
  return S.sites.find(s => s.id !== here.id && s.role === 'stock')?.id || null;
}

/* ---------- Rangement ---------- */
function startPlace(wineId, ids, spaceId, fresh) {
  draft = { place: { wineId, ids, spaceId: spaceId || suggestSpace(wine(wineId)).id, sel: [], fresh } };
  draft.place.sel = suggestFor(draft.place);
  showSheet(placeSheet, { full: true });
}
const suggestFor = p => suggestSlots(p.spaceId, p.ids.length, new Set()).filter(s => !occupancyExcept(new Set(p.ids)).has(`${s.unitId}:${s.r}:${s.c}`));
function placeSheet() {
  const p = draft?.place; if (!p) return null;
  const w = wine(p.wineId), occ = occupancyExcept(new Set(p.ids)), sp = space(p.spaceId), nw = new Set(p.ids.map(id => byId(S.bottles, id)?.wineId)).size;
  const ask = p.stockAsk && site(p.stockAsk);
  const ctx = { occ, m: null, pick: p };
  const units = spaceUnits(sp.id), grid = units.filter(u => !UNIT_TYPES[u.type].box), boxes = units.filter(u => UNIT_TYPES[u.type].box);
  return `${head(`Ranger ${p.ids.length > 1 ? p.ids.length + ' bouteilles' : 'la bouteille'}`)}
    <p class="small" style="margin-top:-6px">${nw > 1 ? plural(nw, 'vin', 'vins') : `<span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))}`}</p>
    ${ask ? `<div class="banner green" style="margin-top:6px"><b>Vin à garder</b> : à emporter au prochain transfert vers ${esc(ask.name)} ?
      <div class="row" style="gap:8px"><button class="btn small green" data-act="placeToTransfer">Oui, au transfert</button><button class="btn small ghost" data-act="placeNoAsk">Non</button></div></div>` : ''}
    <div class="chips">${S.spaces.map(s => `<button class="chip${s.id === p.spaceId ? ' on' : ''}" data-act="placeSpace" data-id="${s.id}">${esc(isMulti() ? site(s.siteId)?.name + ' › ' : '')}${esc(s.name)}</button>`).join('')}</div>
    <p class="small"><b style="color:var(--ink)">${p.sel.length} / ${p.ids.length}</b> place${p.ids.length > 1 ? 's' : ''} choisie${p.sel.length > 1 ? 's' : ''}. Touche les cases libres pour choisir.</p>
    ${!units.length ? `<div class="card small">Aucun meuble dans cet espace : les bouteilles y seront rangées sans emplacement précis.</div>` : placeShortage(p, units, occ)}
    ${grid.map(u => `<div class="card">${unitHead(u, ctx)}${renderGrid(u, ctx)}</div>`).join('')}
    ${boxes.length ? `<div class="card"><div class="ct">Caisses et cartons</div>${renderBoxes(boxes, ctx)}</div>` : ''}
    <div class="btns" style="margin-top:14px;position:sticky;bottom:0;background:var(--bg);padding:8px 0">
      <div class="btns2"><button class="btn" data-act="placeSuggest">Suggérer</button><button class="btn" data-act="placeClear">Effacer</button></div>
      <button class="btn primary wide" data-act="placeOk">${p.sel.length ? 'Valider le rangement' : 'Laisser sans emplacement'}</button>
    </div>`;
}
function placeToggle(unitId, r, c) {
  const p = draft.place, i = p.sel.findIndex(s => s.unitId === unitId && s.r === r && s.c === c);
  if (i >= 0) p.sel.splice(i, 1);
  else { if (p.sel.length >= p.ids.length) p.sel.shift(); p.sel.push({ unitId, r, c }); }
  refreshSheet();
}
Object.assign(ACT, {
  add: t => {
    addTarget = t.dataset?.u ? { unitId: t.dataset.u, r: +t.dataset.r, c: +t.dataset.c } : null;
    if (addTarget) { closeSheet(); return showSheet(addSheet); }   // case libre du plan : directement « Nouveau vin »
    showSheet(plusSheet);
  },
  addWine: () => showSheet(addSheet),
  newWine: t => { newDraft(t.dataset.kind); showSheet(wineFormSheet, { full: true }); },
  rebuyList: () => showSheet(() => `${head('Racheter un vin')}
    <div class="search" style="margin:0 0 4px">${ICON.search}<input type="search" placeholder="Domaine, cuvée, appellation, millésime…" data-in="rebuyFind" autocomplete="off">${sx()}</div>
    <div id="rebuy-list">${rebuyRows('')}</div>`),
  rebuy: t => showSheet(() => addBottlesSheet(t.dataset.id)),
  placeSpace: t => { draft.place.spaceId = t.dataset.id; draft.place.sel = suggestFor(draft.place); refreshSheet(); },
  pickSlot: t => placeToggle(t.dataset.u, +t.dataset.r, +t.dataset.c),
  pickBox: t => {
    const p = draft.place, u = unit(t.dataset.u), occ = occupancyExcept(new Set(p.ids));
    const mine = p.sel.filter(s => s.unitId === u.id), free = freeSlots(u, occ).filter(([r, c]) => !mine.some(s => s.c === c));
    if (!free.length || p.sel.length >= p.ids.length) { p.sel = p.sel.filter(s => s.unitId !== u.id); return refreshSheet(); }
    const room = p.ids.length - p.sel.length;
    for (const [r, c] of free.slice(0, room)) p.sel.push({ unitId: u.id, r, c });
    refreshSheet();
  },
  placeSuggest: () => { draft.place.sel = suggestFor(draft.place); refreshSheet(); },
  placeNoAsk: () => { draft.place.stockAsk = null; refreshSheet(); },
  placeToTransfer: async () => {
    const p = draft?.place; if (!p?.stockAsk) return;
    transferAdd(p.ids, p.stockAsk); await save(); draft = null; closeSheet(); render();
    toast(`${plural(p.ids.length, 'bouteille', 'bouteilles')} au transfert vers ${site(p.stockAsk)?.name || ''} · sans emplacement d’ici là`);
  },
  placeClear: () => { draft.place.sel = []; refreshSheet(); },
  placeOk: async () => {
    const p = draft.place;
    p.ids.forEach((id, i) => {
      const b = byId(S.bottles, id), s = p.sel[i], from = locOf(b);
      Object.assign(b, { spaceId: p.spaceId, unitId: s?.unitId || null, r: s?.r ?? null, c: s?.c ?? null });
      if (!p.fresh && (from.spaceId !== b.spaceId || from.unitId !== b.unitId || from.r !== b.r || from.c !== b.c)) logMove(b, from.siteId !== siteOfBottle(b) ? 'transfert' : 'move', { from, to: locOf(b) });
    });
    S.transfer.ids = S.transfer.ids.filter(id => !p.ids.includes(id) || !p.sel.length);
    await save(); draft = null; closeSheet();
    caveSpace = p.spaceId; if (isMulti()) S.settings.site = space(p.spaceId).siteId;
    view = 'cave'; render(); toast(p.sel.length ? (p.fresh ? 'Bouteilles rangées' : 'Bouteille déplacée') : 'Enregistré, sans emplacement');
  },
  placeUnplaced: t => {
    const ids = S.bottles.filter(b => b.wineId === t.dataset.w && inCave(b) && !b.unitId && b.spaceId === t.dataset.space).map(b => b.id);
    startPlace(t.dataset.w, ids, t.dataset.space, false);
  },
  putHere: async t => {
    const u = unit(t.dataset.u), cand = S.bottles.filter(b => b.wineId === t.dataset.w && inCave(b) && !b.unitId);
    const b = cand.find(x => x.spaceId === u.spaceId) || cand[0]; if (!b) return;
    const from = locOf(b);
    Object.assign(b, { spaceId: u.spaceId, unitId: u.id, r: +t.dataset.r, c: +t.dataset.c });
    logMove(b, 'move', { from, to: locOf(b) });
    await save(); closeSheet(); render(); toast('Bouteille rangée');
  },
  moveBottle: t => { const b = byId(S.bottles, t.dataset.b); startPlace(b.wineId, [b.id], b.spaceId || suggestSpace(wine(b.wineId)).id, false); },
});

/* ---------- Ajouter des bouteilles à une fiche ---------- */
function addBottlesSheet(wid) {
  const w = wine(wid);
  return `${head('Ajouter des bouteilles')}
    <p class="small" style="margin-top:-6px"><span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))}</p>
    <form class="form" data-form="addBottles" data-w="${wid}">
      <div class="grid2"><label>Quantité<input name="qty" inputmode="numeric" value="1" required></label>
        <label>État<select name="state" data-ch="draftState"><option value="cave">En cave</option><option value="primeur">Primeur, pas encore livré</option></select></label></div>
      <div id="primeur-f" hidden><label>Livraison prévue<input type="date" name="delivery"></label></div>
      <label>Ranger dans<select name="spaceId">${spaceOptions(suggestSpace(w)?.id)}</select></label>
      <div class="grid2"><label>Prix unitaire (€)<input name="prix" inputmode="decimal" value="${esc(numFr(w.achat?.prix, 2))}"></label><label>Date d’achat<input type="date" name="adate" value="${today()}"></label></div>
      <button class="btn primary wide" type="submit">Ajouter</button>
    </form>`;
}
FORMS.addBottles = async (f, d) => {
  const errs = [], q = String(d.qty).replace(/\s/g, ''), p = d.prix ? num(d.prix) : null;
  if (!/^\d+$/.test(q) || +q < 1 || +q > 500) errs.push(['qty', 'Un nombre entier de 1 à 500']);
  if (d.prix && (p == null || p < 0 || p > 100000)) errs.push(['prix', 'Un prix entre 0 et 100 000 €']);
  if (formErrors(f, errs)) return;
  const w = wine(f.dataset.w), qty = +q;
  if (num(d.prix) != null) w.achat = { ...(w.achat || {}), prix: num(d.prix), date: d.adate || w.achat?.date };
  const ids = createBottles(w, qty, d.state === 'primeur' ? { state: 'primeur', delivery: { date: d.delivery || null, spaceId: d.spaceId } } : { spaceId: d.spaceId });
  S.wishes = S.wishes.filter(x => x.wineId !== w.id);   // acheté : il sort de la liste d'envies
  await save(); afterAdd(w, ids, d.state === 'primeur');
};

/* ---------- Fiche d'un vin ---------- */
function wineSheet(id) {
  const w = wine(id); if (!w) return null;
  const bs = wineBottles(id), pr = S.bottles.filter(b => b.wineId === id && b.state === 'primeur');
  const st = status(w), a = w.apogee, y = thisYear();
  const tastes = S.tastings.filter(t => t.wineId === id).sort((p, q) => (q.at || '').localeCompare(p.at || ''));
  const outs = S.moves.filter(m => m.wineId === id && m.type === 'out').sort((p, q) => (q.ts || 0) - (p.ts || 0));
  const from = Math.min(a?.debut || y, y) - 1, to = Math.max(a?.fin || y + 5, y + 2) + 1;
  const dlrow = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const sp = w.kind === 'spirit';
  return `${head(esc(wineTitle(w)), `<button class="icon-btn" data-act="editWine" data-id="${id}" aria-label="Modifier">${ICON.edit}</button>`)}
    ${w.photo ? `<img class="photo" data-photo="${id}" alt="Étiquette" hidden>` : ''}
    <p class="small" style="margin:-4px 0 6px">${esc(wineSub(w))}</p>
    <div class="tags">${st && st !== 'inconnu' ? `<span class="tag ${STATUS[st].tag}">${STATUS[st].label}</span>` : ''}${isFriend(w) ? `<span class="tag o">Appartient à ${esc(w.owner)}</span>` : ''}${w.bio ? '<span class="tag g">Bio</span>' : ''}${w.nature ? '<span class="tag g">Nature</span>' : ''}${w.cadeau?.de ? `<span class="tag">Offert par ${esc(w.cadeau.de)}</span>` : ''}</div>
    ${sp ? '' : `<div class="card">
      <div class="ct">Fenêtre de dégustation ${a?.src === 'ia' ? '<span class="tag">estimée par le sommelier</span>' : a?.src === 'manuel' ? '<span class="tag">saisie manuelle</span>' : a?.src === 'ploc' ? '<span class="tag">reprise de Ploc</span>' : ''}</div>
      ${a?.fin ? `<div class="score" style="font-size:22px;text-align:left">${a.debut || '?'} – ${a.fin}${a.pic ? `<small> · apogée ${a.pic}</small>` : ''}</div>${winBar(a, from, to, true)}<div class="winlab"><span>${from}</span><span>${to}</span></div>
        ${a.why ? `<p class="small" style="margin:8px 0 0">${esc(a.why)}</p>` : ''}
        ${a.sources?.length ? `<p class="tiny" style="margin:6px 0 0">Sources : ${a.sources.slice(0, 3).map(s => esc(s.title || s.url)).join(' · ')}</p>` : ''}`
      : `<p class="small" style="margin:0">Pas encore de fenêtre.</p>`}
      <div class="btns2" style="margin-top:10px"><button class="btn small" data-act="estimate" data-id="${id}">${ICON.spark} ${a?.fin ? 'Réestimer' : 'Estimer'}</button><button class="btn small" data-act="editWine" data-id="${id}">Saisir</button></div>
    </div>`}
    <h3>En cave · ${bs.length}${pr.length ? ` <span class="small">+ ${pr.length} en primeur</span>` : ''}</h3>
    ${bs.length || pr.length ? `<div class="list">${[...bs, ...pr].map(b => `<div class="li"><button class="lb" data-act="bottle" data-b="${b.id}"><div class="it"><b style="font-weight:500;font-size:14px">${esc(locLabel(b))}</b>${b.state === 'open' ? `<small>Ouverte · niveau ${b.level ?? 100} %</small>` : ''}</div><span class="chev">${ICON.chev}</span></button>${inCave(b) ? `<button class="icon-btn" style="width:34px;height:34px;color:var(--bx)" data-act="planGo" data-b="${b.id}" aria-label="Voir sur le plan">${ICON.pin}</button>` : ''}</div>`).join('')}</div>` : `<p class="muted small">${S.tastings.some(t => t.wineId === id) && !S.bottles.some(b => b.wineId === id) ? 'Vin dégusté, jamais en cave.' : 'Plus aucune bouteille en cave.'}</p>`}
    <div class="btns2" style="margin-top:10px"><button class="btn" data-act="rebuy" data-id="${id}">${ICON.add} ${bs.length ? 'Ajouter' : 'Ajouter à la cave'}</button><button class="btn" data-act="taste" data-w="${id}">${ICON.cork} Déguster</button></div>
    <button class="btn wide ${isWished(id) ? 'outline' : 'ghost'}" style="margin-top:8px" data-act="wishToggle" data-w="${id}">${isWished(id) ? '♥ Dans ma liste d’envies' : '♥ Ajouter à ma liste d’envies'}</button>
    <h3>Fiche</h3>
    <dl class="kv">${dlrow(sp ? 'Distillerie' : 'Domaine', w.domaine)}${dlrow(sp ? 'Expression' : 'Cuvée', w.cuvee)}${dlrow('Appellation', w.appellation)}${dlrow('Région', [w.region, w.pays].filter(Boolean).join(', '))}
      ${dlrow('Cépages', w.cepages)}${dlrow(sp ? 'Distillé en' : 'Millésime', w.millesime)}${dlrow('Âge', w.age ? w.age + ' ans' : '')}${dlrow('Embouteillé en', w.bottled)}${dlrow('Fût', w.fut)}
      ${dlrow('Embouteilleur', w.independant)}${dlrow('Numéro', w.numero)}${dlrow('Degré', w.degre ? numFr(w.degre) + ' %' : '')}${dlrow('Servir à', w.service)}${dlrow('Format', (FORMATS[w.kind] || FORMATS.vin).find(f => f[0] === w.format)?.[1])}
      ${dlrow('Prix', w.achat?.prix != null ? fmtE2.format(w.achat.prix) : '')}${dlrow('Acheté', [w.achat?.lieu, w.achat?.date && fmtDate(w.achat.date)].filter(Boolean).join(', '))}</dl>
    ${w.notes ? `<p class="small" style="white-space:pre-wrap">${esc(w.notes)}</p>` : ''}
    ${tastes.length ? `<h3>Dégustations</h3><div class="list">${tastes.map(t => `<button class="li" data-act="tasteView" data-id="${t.id}"><div class="it"><b>${t.note != null ? numFr(t.note) + ' / 20' : 'Sans note'}${t.full?.evolution ? ' · ' + esc({ jeune: 'jeune', apoint: 'à point', declin: 'sur le déclin' }[t.full.evolution] || '') : ''}</b><small class="ell">${esc(fmtDate(t.at))}${t.plat ? ' · ' + esc(t.plat) : ''}${t.comment ? ' · ' + esc(t.comment) : ''}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}</div>` : ''}
    ${outs.length ? `<h3>Historique</h3><div class="list">${outs.slice(0, 12).map(m => `<div class="li"><div class="it"><b style="font-weight:500;font-size:14px">${esc(MOTIFS[m.motif] || 'Sortie')}${m.who ? ' à ' + esc(m.who) : ''}</b><small>${esc(fmtDate(m.at))}${m.occasion ? ' · ' + esc(m.occasion) : ''}${m.plat ? ' · ' + esc(m.plat) : ''}</small></div></div>`).join('')}</div>` : ''}
    <button class="btn danger wide" style="margin-top:18px" data-act="delWine" data-id="${id}">Supprimer cette référence</button>`;
}

/* ---------- Fiche d'une bouteille ---------- */
function bottleSheet(bid) {
  const b = byId(S.bottles, bid); if (!b) return null;
  const w = wine(b.wineId), st = status(w), sp = w.kind === 'spirit', inT = S.transfer.ids.includes(bid);
  return `${head(esc(wineTitle(w)))}
    <p class="small" style="margin:-6px 0 6px">${esc(wineSub(w))}</p>
    <div class="tags">${st && st !== 'inconnu' ? `<span class="tag ${STATUS[st].tag}">${STATUS[st].label} · ${esc(windowLabel(w.apogee))}</span>` : ''}${isFriend(w) ? `<span class="tag o">Appartient à ${esc(w.owner)}</span>` : ''}${b.state === 'open' ? `<span class="tag">Ouverte le ${esc(fmtDate(b.openedAt))}</span>` : ''}</div>
    <div class="loc" style="font-size:14px;margin:12px 0">${ICON.pin}${esc(locLabel(b))}</div>
    ${b.state === 'open' ? `<div class="card"><div class="ct">Niveau restant</div><div class="level"><span class="bottle-level"><i style="height:${b.level ?? 100}%"></i></span><input type="range" min="0" max="100" step="5" value="${b.level ?? 100}" data-in="level" data-b="${bid}" style="flex:1"><output id="lvl-out">${b.level ?? 100} %</output></div></div>` : ''}
    <div class="btns">
      ${b.state === 'primeur' ? `<button class="btn primary wide" data-act="receive" data-b="${bid}">${ICON.down} Réceptionner</button>`
      : `<button class="btn primary wide" data-act="outBottle" data-b="${bid}">${ICON.out} ${sp && b.state === 'open' ? 'Bouteille terminée' : isFriend(w) ? 'Sortir (rendre, boire…)' : 'Sortir de la cave'}</button>
        ${sp && b.state !== 'open' ? `<button class="btn wide" data-act="openBottle" data-b="${bid}">Ouvrir la bouteille</button>` : ''}
        <div class="btns2"><button class="btn" data-act="moveBottle" data-b="${bid}">${ICON.move} Déplacer</button><button class="btn" data-act="taste" data-w="${w.id}" data-b="${bid}">${ICON.cork} Déguster</button></div>
        ${isMulti() ? `<button class="btn wide ${inT ? 'outline' : ''}" data-act="toTransfer" data-b="${bid}">${ICON.truck} ${inT ? 'Retirer du transfert vers ' + esc(site(tDest(bid))?.name || '') : S.sites.length === 2 ? 'Ajouter au transfert vers ' + esc(site(defaultDest(b))?.name || '') : 'Ajouter au prochain transfert'}</button>` : ''}`}
      ${inCave(b) ? `<button class="btn wide" data-act="planGo" data-b="${bid}">${ICON.pin} Voir sur le plan</button>` : ''}
      <button class="btn ghost wide" data-act="wine" data-id="${w.id}">Voir la fiche du vin</button>
    </div>`;
}
INPUTS.level = el => { const o = $('#lvl-out'); if (o) o.textContent = el.value + ' %'; const i = el.closest('.level').querySelector('i'); if (i) i.style.height = el.value + '%'; };
CHANGES.level = async el => { const b = byId(S.bottles, el.dataset.b); b.level = +el.value; await save(); };

/* ---------- Sortie ---------- */
function outSheet(bid) {
  const b = byId(S.bottles, bid), w = wine(b.wineId), sp = w.kind === 'spirit';
  const def = isFriend(w) ? 'rendue' : sp && b.state === 'open' ? 'terminee' : 'bue';
  const motifs = Object.keys(MOTIFS).filter(k => (k !== 'rendue' || isFriend(w)) && (k !== 'terminee' || sp));
  return `${head('Sortir de la cave')}
    <p class="small" style="margin-top:-6px"><span class="dot" style="background:${wineColor(w)}"></span> ${esc(wineTitle(w))} · ${esc(locLabel(b, false))}</p>
    <form class="form" data-form="out" data-b="${bid}">
      <div class="chips wrap">${motifs.map(k => `<label class="chip soft${k === def ? ' on' : ''}" style="cursor:pointer"><input type="radio" name="motif" value="${k}" ${k === def ? 'checked' : ''} class="sr-only" data-ch="radioChip">${MOTIFS[k]}</label>`).join('')}</div>
      <div class="grid2"><label>Date<input type="date" name="at" value="${today()}"></label><label>Offerte à / avec<input name="who" autocomplete="off"></label></div>
      <label>Occasion ou plat<input name="plat" placeholder="Magret aux cerises, anniversaire…" autocomplete="off"></label>
      <button class="btn primary wide" type="submit">Confirmer la sortie</button>
    </form>`;
}
CHANGES.radioChip = el => { for (const l of $$(`input[name="${el.name}"]`, el.form)) l.closest('.chip').classList.toggle('on', l.checked); };
FORMS.out = async (f, d) => {
  const b = byId(S.bottles, f.dataset.b), w = wine(b.wineId), from = locOf(b);
  b.state = 'out'; b.outAt = d.at || today();
  logMove(b, 'out', { motif: d.motif, at: d.at || today(), from, who: d.who, plat: d.plat });
  S.transfer.ids = S.transfer.ids.filter(id => id !== b.id);
  const taste = ['bue', 'bouchonnee', 'terminee'].includes(d.motif) && !isFriend(w);
  b.ficheTodo = taste;   // dans « À noter » jusqu'à la fiche, ou « Sans fiche »
  await save(); render();
  if (!taste) { closeSheet(); return toast('Bouteille sortie'); }
  showSheet(() => `${head('Bonne dégustation !')}<p>${esc(wineTitle(w))} est sorti${w.kind === 'spirit' ? '' : ''} de la cave. Tu veux noter ce vin ?</p>
    <div class="btns"><button class="btn primary wide" data-act="taste" data-w="${w.id}" data-b="${b.id}" data-m="quick">Note rapide</button><button class="btn wide" data-act="taste" data-w="${w.id}" data-b="${b.id}" data-m="full">Fiche complète</button><button class="btn wide" data-act="close">Plus tard</button><button class="btn ghost wide" data-act="todoSkip" data-b="${b.id}">Sortir sans fiche</button></div>
    <p class="tiny">« Plus tard » : la bouteille t’attend dans Dégustations › À noter, et je te la rappellerai demain.</p>`, { replace: true });
};

/* ---------- Transfert entre sites ---------- */
Object.assign(ACT, {
  receive: async t => {
    const b = byId(S.bottles, t.dataset.b), w = wine(b.wineId);
    const ids = S.bottles.filter(x => x.wineId === w.id && x.state === 'primeur').map(x => x.id);
    const n = ids.length > 1 && confirm(`Réceptionner les ${ids.length} bouteilles en primeur de ce vin ?`) ? ids : [b.id];
    const dest = space(b.delivery?.spaceId) || suggestSpace(w);
    for (const id of n) { const x = byId(S.bottles, id); Object.assign(x, { state: 'cave', spaceId: dest.id, unitId: null, r: null, c: null, addedAt: today() }); logMove(x, 'in', { to: locOf(x), primeur: true }); }
    await save(); closeSheet();
    if (spaceUnits(dest.id).length) startPlace(w.id, n, dest.id, true); else { render(); toast('Primeur réceptionné'); }
  },
  openBottle: async t => { const b = byId(S.bottles, t.dataset.b); b.state = 'open'; b.openedAt = today(); b.level = 100; logMove(b, 'open'); await save(); refreshSheet(); render(); },
  outBottle: t => showSheet(() => outSheet(t.dataset.b)),
  bottle: t => showSheet(() => bottleSheet(t.dataset.b)),
  wine: t => showSheet(() => wineSheet(t.dataset.id)),
  editWine: t => { const w = wine(t.dataset.id); draft = { w: structuredClone(w), edit: w.id }; showSheet(wineFormSheet, { full: true }); },
  delWine: async t => {
    const w = wine(t.dataset.id), n = wineBottles(w.id).length + S.bottles.filter(b => b.wineId === w.id && b.state === 'primeur').length;
    if (!confirm(n ? `Supprimer « ${wineTitle(w)} » et ses ${n} bouteilles encore en cave ? Pour une bouteille bue, utilise plutôt « Sortir ».` : `Supprimer « ${wineTitle(w)} » et son historique ?`)) return;
    const ids = new Set(S.bottles.filter(b => b.wineId === w.id).map(b => b.id));
    S.wines = S.wines.filter(x => x.id !== w.id); S.bottles = S.bottles.filter(b => b.wineId !== w.id);
    S.moves = S.moves.filter(m => m.wineId !== w.id); S.tastings = S.tastings.filter(x => x.wineId !== w.id);
    S.transfer.ids = S.transfer.ids.filter(id => !ids.has(id));
    S.wishes = S.wishes.filter(x => x.wineId !== w.id);
    if (w.photo) await photoDel(w.id);
    await save(); closeSheet(); render(); toast('Référence supprimée');
  },
});

function rebuyRows(q) {
  const m = matcher(q);
  const ws = [...S.wines].filter(w => kindOn(w) && (!m || m(w))).sort((a, b) => wineName(a).localeCompare(wineName(b), 'fr') || (a.millesime || 0) - (b.millesime || 0));
  return ws.length ? `<div class="list">${ws.map(w => `<button class="li" data-act="rebuy" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))} · ${wineBottles(w.id).length ? wineBottles(w.id).length + ' en cave' : 'pas en cave'}</small></div></button>`).join('')}</div>`
    : '<p class="small" style="margin:10px 4px">Aucun vin ne correspond.</p>';
}
INPUTS.rebuyFind = el => { const box = $('#rebuy-list'); if (box) box.innerHTML = rebuyRows(el.value); };

// Places libres insuffisantes dans l'espace choisi : on le dit, et on propose l'espace le plus libre
function placeShortage(p, units, occ) {
  const free = units.reduce((n, u) => n + freeSlots(u, occ).length, 0), miss = p.ids.length - free;
  if (miss <= 0) return '';
  const others = S.spaces.filter(s => s.id !== p.spaceId).map(s => ({ s, n: spaceUnits(s.id).reduce((t, u) => t + freeSlots(u, occ).length, 0) })).sort((a, b) => b.n - a.n);
  const best = others[0];
  return `<div class="banner">Il manque ${plural(miss, 'place', 'places')} dans cet espace : ${plural(miss, 'bouteille restera', 'bouteilles resteront')} « non placée${miss > 1 ? 's' : ''} ».
    ${best && best.n > free ? `<br><button class="btn small" data-act="placeSpace" data-id="${best.s.id}">Aller dans « ${esc(best.s.name)} » (${plural(best.n, 'place libre', 'places libres')})</button>` : ''}</div>`;
}
