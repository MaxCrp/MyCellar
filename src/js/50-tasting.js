/* ---------- Dégustation ---------- */
const T_CHIPS = {
  limpidite: ['Limpide', 'Brillant', 'Voilé', 'Trouble'],
  bulles: ['Fines', 'Moyennes', 'Grossières'],
  ouverture: ['Fermé', 'Discret', 'Ouvert', 'Expressif'],
  attaque: ['Souple', 'Franche', 'Vive'],
  texture: ['Soyeux', 'Fondus', 'Serrés', 'Astringents'],
  equilibre: ['Déséquilibré', 'Équilibré', 'Harmonieux'],
  evolution: [['jeune', 'Jeune'], ['apoint', 'À point'], ['declin', 'Sur le déclin']],
  potentiel: ['À boire', '1–2 ans', '3–5 ans', '5–10 ans', '10 ans et plus'],
  eau: ['Pur', 'Quelques gouttes d’eau', 'Sur glace'],
};
const SLIDERS_VIN = [['sucre', 'Sucre', 1, 5], ['acidite', 'Acidité', 1, 5], ['tanins', 'Tanins', 1, 5], ['alcool', 'Alcool', 1, 5], ['corps', 'Corps', 1, 5], ['longueur', 'Longueur', 0, 15]];
const SLIDERS_SPIRIT = [['douceur', 'Douceur', 1, 5], ['puissance', 'Puissance', 1, 5], ['corps', 'Corps', 1, 5], ['longueur', 'Finale', 1, 5]];
const sliderOut = (k, v, kind = draft?.taste?.kind) => k === 'longueur' && kind !== 'spirit' ? `${v} s` : `${v}/5`;

// ctx : { sessionId } pour une dégustation dans une séance
function startTaste(wineId, bottleId, m, ctx = {}) {
  const w = wine(wineId) || mysteryWine();
  // Bouteille déjà sortie (liste « À noter ») : date, plat et convives de la sortie
  const b0 = bottleId && byId(S.bottles, bottleId), out = b0?.state === 'out' ? outMove(b0) : null, prev = out ? { plat: out.plat || '' } : null;
  const sess = ctx.sessionId && byId(S.sessions, ctx.sessionId);
  draft = { taste: { wineId, bottleId: bottleId || null, kind: w.kind, mode: m === 'full' ? 'full' : 'quick', note: null, comment: '', at: sess?.date || today(), plat: prev?.plat || '',
    type: sess?.type || null, lieu: sess?.lieu || '', convives: sess?.convives || '', prix: '', achatLieu: '', provenance: '', accord: null, sessionId: sess?.id || null, fromCave: false, full: { aromes: [] } } };
  wheelState = { active: null };
  if (out && !sess) Object.assign(draft.taste, { at: out.at || b0.outAt || today(), convives: out.who || '' });
  draft.taste._snap = tasteSig(draft.taste);
  showSheet(tasteSheet, { full: true });
}
// Dégustation à l'aveugle : tant que le vin n'est pas révélé, on travaille sur un « vin mystère »
const mysteryWine = b => ({ id: '', kind: b?.kind || 'vin', couleur: b?.couleur || null, cuvee: 'Vin mystère', domaine: '', appellation: '' });
const tastingWine = t => wine(t.wineId) || (t.blind ? mysteryWine(t.blind) : null);
function startBlind(sessionId) {
  startTaste(null, null, 'full', { sessionId });
  Object.assign(draft.taste, { blind: true, kind: 'vin', couleur: null, hyp: {} });
  draft.taste._snap = tasteSig(draft.taste);
  refreshSheet();
}
function editTaste(id) {
  const r = byId(S.tastings, id), w = tastingWine(r);
  draft = { taste: { ...r, blind: !!r.blind, couleur: r.blind?.couleur || null, hyp: { ...(r.blind?.hyp || {}) }, kind: w.kind, mode: r.full ? 'full' : 'quick', prix: r.prix != null ? numFr(r.prix, 2) : '', full: { aromes: [], ...(structuredClone(r.full || {})) }, editId: id } };
  wheelState = { active: null };
  draft.taste._snap = tasteSig(draft.taste);
  showSheet(tasteSheet, { full: true });
}
function tasteContext(t, w) {
  const sess = t.sessionId && byId(S.sessions, t.sessionId);
  const ch = (k, obj) => `<div class="chips wrap" style="margin-top:0">${Object.entries(obj).map(([v, l]) => `<button type="button" class="chip soft${t[k] === v ? ' on' : ''}" data-act="tctx" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const f = (k, label, ph = '', mode = '') => `<label>${label}<input value="${esc(t[k] ?? '')}" data-in="tf" data-k="${k}" placeholder="${esc(ph)}" autocomplete="off" ${mode ? `inputmode="${mode}"` : ''}></label>`;
  const canCave = !t.bottleId && !t.editId && wineBottles(w.id).length > 0;
  return `<div class="card form">
    ${sess ? `<p class="small" style="margin:0">Séance <b style="color:var(--ink)">${esc(sess.titre)}</b> · ${esc(fmtDate(sess.date))}${sess.lieu ? ' · ' + esc(sess.lieu) : ''}</p>`
      : `<div><div class="lbl" style="margin-top:0">Type de dégustation</div>${ch('type', TASTE_TYPES)}</div>
      <div class="grid2">${f('lieu', 'Lieu', 'Restaurant, salon…')}<label>Date<input type="date" value="${esc(t.at)}" data-in="tf" data-k="at"></label></div>
      ${f('convives', 'Convives', 'Avec qui ?')}`}
    ${t.bottleId ? '' : `<div class="grid2">${f('prix', 'Prix payé (€)', '', 'decimal')}${f('achatLieu', 'Lieu d’achat', 'Facultatif')}</div>
      ${f('provenance', 'Provenance', 'Carte du restaurant, offerte par…')}`}
    ${f('plat', 'Plat')}
    <div><div class="lbl" style="margin-top:0">Accord</div>${ch('accord', ACCORDS)}</div>
    ${canCave ? `<label class="check"><input type="checkbox" data-ch="tcave" ${t.fromCave ? 'checked' : ''}> Une bouteille de ma cave : la sortir du stock</label>` : ''}
    <div>${t.photoUrl || (t.photo && t.editId) ? `<img class="photo" ${t.photoUrl ? `src="${t.photoUrl}"` : `data-photo="t-${t.editId}" hidden`} alt="Photo">` : ''}
      <button type="button" class="btn small" style="margin-top:6px" data-act="tphoto">${ICON.camera} ${t.photoUrl || t.photo ? 'Changer la photo' : 'Ajouter une photo'}</button></div>
  </div>`;
}
function tasteSheet() {
  const t = draft?.taste; if (!t) return null;
  const w = t.wineId ? wine(t.wineId) : mysteryWine(t), F = t.full, sp = w.kind === 'spirit';
  const chips = (k, list) => `<div class="chips wrap" style="margin-top:0">${list.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<button type="button" class="chip soft${F[k] === v ? ' on' : ''}" data-act="tchip" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`; }).join('')}</div>`;
  const slider = ([k, l, min, max]) => `<div class="sl"><span>${l}</span><input type="range" min="${min}" max="${max}" step="1" value="${F[k] ?? Math.round((min + max) / 2)}" data-in="tv" data-k="${k}"><output id="o-${k}">${F[k] != null ? sliderOut(k, F[k]) : '–'}</output></div>`;
  const teintes = TEINTES[sp ? 'spirit' : w.couleur] || TEINTES.rouge;
  const full = t.mode === 'full' ? `
    <div class="card">
      <div class="lbl" style="margin-top:0">Œil</div>
      <div class="teintes">${teintes.map(([l, c]) => `<button type="button" class="teinte${F.teinte === l ? ' on' : ''}" style="background:${c}" data-act="tchip" data-k="teinte" data-v="${esc(l)}" aria-label="${esc(l)}" title="${esc(l)}"></button>`).join('')}</div>
      <p class="tiny" style="margin:4px 0 8px">${F.teinte ? esc(F.teinte) : 'Choisis la teinte'}</p>
      ${slider(['oeil', 'Intensité', 1, 5])}
      ${sp ? '' : chips('limpidite', T_CHIPS.limpidite)}
      ${w.couleur === 'effervescent' ? `<div class="lbl">Bulles</div>${chips('bulles', T_CHIPS.bulles)}` : ''}
      <div class="lbl">Nez</div>
      ${slider(['nez', 'Intensité', 1, 5])}
      ${sp ? chips('eau', T_CHIPS.eau) : chips('ouverture', T_CHIPS.ouverture)}
      <div class="lbl">Roue des arômes</div>
      <div class="wheel" id="wheel"></div>
      <div id="aro-sel"></div>
      <div class="lbl">Bouche</div>
      ${sp ? '' : chips('attaque', T_CHIPS.attaque)}
      <div style="margin-top:6px">${(sp ? SLIDERS_SPIRIT : SLIDERS_VIN).filter(([k]) => k !== 'tanins' || ['rouge', 'orange', 'rose'].includes(w.couleur)).map(slider).join('')}</div>
      ${!sp && w.couleur === 'rouge' ? `<div class="lbl">Tanins</div>${chips('texture', T_CHIPS.texture)}` : ''}
      ${chips('equilibre', T_CHIPS.equilibre)}
      ${sp ? '' : `<div class="lbl">Évolution</div>${chips('evolution', T_CHIPS.evolution)}<div class="lbl">Potentiel restant</div>${chips('potentiel', T_CHIPS.potentiel)}`}
    </div>` : '';
  return `${head('Dégustation')}
    <div class="card" style="margin-top:0"><div class="row"><div class="grow"><div class="rn">${esc(wineTitle(w))}</div><div class="rs">${t.blind && !t.wineId ? 'À l’aveugle : tu révéleras le vin à la fin' : esc(wineSub(w))}</div>${w.service && !(t.blind && !t.wineId) ? `<div class="rs">Servir à ${esc(w.service)}</div>` : ''}</div>${t.blind ? '<span class="tag b">À l’aveugle</span>' : t.bottleId || t.fromCave ? '<span class="tag g">De ma cave</span>' : '<span class="tag o">Hors cave</span>'}</div>
      ${t.blind && !t.wineId ? `<div class="chips wrap">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="chip soft${t.kind === 'vin' && t.couleur === k ? ' on' : ''}" data-act="tcolor" data-v="${k}"><span class="dot" style="background:${c.c}"></span>${c.label}</button>`).join('')}${spiritsOn() ? `<button type="button" class="chip soft${t.kind === 'spirit' ? ' on' : ''}" data-act="tcolor" data-v="spirit"><span class="dot" style="background:${SPIRIT_COLOR}"></span>Spiritueux</button>` : ''}</div>` : ''}
      <div class="seg"><button class="${t.mode === 'quick' ? 'on' : ''}" data-act="tmode" data-m="quick">Rapide</button><button class="${t.mode === 'full' ? 'on' : ''}" data-act="tmode" data-m="full">Complète</button></div></div>
    ${tasteContext(t, w)}
    ${t.blind ? blindHypCard(t) : ''}
    <div class="card"><div class="score" id="t-score">${t.note != null ? numFr(t.note) : '–'}<small> / 20</small></div>
      <input type="range" min="0" max="20" step="0.5" value="${t.note ?? 14}" data-in="tnote" class="${t.note == null ? 'unset' : ''}" aria-label="Note sur 20">
      ${t.note == null ? '<p class="tiny" id="t-hint" style="text-align:center;margin:2px 0 0">Touche pour noter · sans note si tu n’y touches pas</p>' : ''}</div>
    ${full}
    <div class="card form">
      <label>Commentaire<textarea data-in="tf" data-k="comment" placeholder="Tes impressions…">${esc(t.comment)}</textarea></label>
    </div>
    <button class="btn primary wide" style="margin-top:12px" data-act="tasteSave">Enregistrer la dégustation</button>`;
}
INPUTS.tnote = el => { draft.taste.note = +el.value; $('#t-score').innerHTML = `${numFr(+el.value)}<small> / 20</small>`; el.classList.remove('unset'); $('#t-hint')?.remove(); setRangeFill(el); };
INPUTS.tv = el => { draft.taste.full[el.dataset.k] = +el.value; const o = $('#o-' + el.dataset.k); if (o) o.textContent = sliderOut(el.dataset.k, +el.value); setRangeFill(el); };
INPUTS.tf = el => { draft.taste[el.dataset.k] = el.value; };

/* Roue des arômes : l'anneau intérieur porte les familles, l'anneau extérieur les arômes.
   Toucher une famille l'agrandit (140°) ; les autres restent visibles en réduit. */
function paintWheel() {
  const t = draft?.taste, el = $('#wheel'); if (!t || !el) return;
  const fams = aromaFamilies(t.kind), sel = new Set(t.full.aromes);
  const active = wheelState?.active ?? null;
  const S_ = 340, C = S_ / 2, R0 = 42, R1 = 112, R2 = 168, ACT_SPAN = active != null ? 140 : 0;
  const rad = d => (d - 90) * Math.PI / 180, pt = (r, d) => [C + r * Math.cos(rad(d)), C + r * Math.sin(rad(d))];
  const arc = (r1, r2, a1, a2) => { const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1), l = a2 - a1 > 180 ? 1 : 0; return `M${x1.toFixed(1)},${y1.toFixed(1)}A${r2},${r2} 0 ${l} 1 ${x2.toFixed(1)},${y2.toFixed(1)}L${x3.toFixed(1)},${y3.toFixed(1)}A${r1},${r1} 0 ${l} 0 ${x4.toFixed(1)},${y4.toFixed(1)}Z`; };
  const label = (txt, r, a, size, col, wgt) => { let rot = a - 90; if (a > 180) rot += 180; const [x, y] = pt(r, a); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${wgt}" fill="${col}">${esc(txt)}</text>`; };
  const others = fams.reduce((n, f, i) => i === active ? n : n + f[3].length, 0);
  let g = '', a = active != null ? -ACT_SPAN / 2 - fams.slice(0, active).reduce((n, f) => n + (360 - ACT_SPAN) * f[3].length / others, 0) : 0;
  fams.forEach(([id, name, color, list], i) => {
    const isAct = i === active, span = active == null ? 360 * list.length / fams.reduce((n, f) => n + f[3].length, 0) : isAct ? ACT_SPAN : (360 - ACT_SPAN) * list.length / others;
    const a1 = a, a2 = a + span; a = a2;
    const nSel = list.filter(x => sel.has(x)).length;
    g += `<path d="${arc(R0, R1, a1, a2)}" fill="${color}" opacity="${isAct || active == null ? 1 : .8}" stroke="#fff" stroke-width="${isAct ? 2.5 : 1.2}" data-act="wfam" data-i="${i}"/>`;
    const short = name.replace('Fruits ', 'F. ');
    const fs = isAct ? 12 : span < 16 ? 7.5 : 9;
    g += label(isAct ? name : short, (R0 + R1) / 2, (a1 + a2) / 2, fs, '#fff', isAct ? 700 : 600);
    if (nSel && !isAct) { const [x, y] = pt(R1 - 8, (a1 + a2) / 2); g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#fff"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="7.5" font-weight="700" fill="${color}">${nSel}</text>`; }
    const st = span / list.length;
    list.forEach((ar, k) => {
      const b1 = a1 + k * st, b2 = b1 + st, on = sel.has(ar);
      if (isAct) {
        g += `<path d="${arc(R1 + 2, R2, b1, b2)}" fill="${on ? '#6E1E2F' : '#F6EEE8'}" stroke="#fff" stroke-width="1.5" data-act="waro" data-a="${esc(ar)}"/>`;
        g += label(ar, (R1 + R2) / 2 + 1, (b1 + b2) / 2, ar.length > 12 ? 8 : ar.length > 8 ? 9 : 10.5, on ? '#fff' : '#2A1F1D', on ? 700 : 500);
      } else {
        g += `<path d="${arc(R1 + 2, R1 + (active == null ? 16 : 13), b1, b2)}" fill="${on ? '#6E1E2F' : color}" opacity="${on ? 1 : .35}" stroke="#fff" stroke-width=".8" data-act="wfam" data-i="${i}"/>`;
      }
    });
  });
  g += `<circle cx="${C}" cy="${C}" r="${R0 - 2}" fill="#fff" stroke="#E7DFD4"/>`;
  g += `<text x="${C}" y="${C - 6}" text-anchor="middle" font-size="22" font-weight="700" fill="#6E1E2F">${sel.size}</text><text x="${C}" y="${C + 13}" text-anchor="middle" font-size="10" fill="#7D716B">arôme${sel.size > 1 ? 's' : ''}</text>`;
  el.innerHTML = `<svg width="${S_}" height="${S_}" viewBox="0 0 ${S_} ${S_}" font-family="-apple-system,BlinkMacSystemFont,system-ui,sans-serif" role="img" aria-label="Roue des arômes">${g}</svg>`;
  $('#aro-sel').innerHTML = `<p class="tiny" style="text-align:center;margin:0 0 6px">${active == null ? 'Touche une famille pour afficher ses arômes.' : 'Touche un arôme pour le choisir · ' + esc(fams[active][1])}</p>
    <div class="chips wrap" style="justify-content:center">${[...sel].map(x => `<button type="button" class="chip soft on" data-act="waro" data-a="${esc(x)}">${esc(x)} ×</button>`).join('')}
    ${active != null ? `<button type="button" class="chip dash" data-act="aroAdd">+ Arôme perso</button>` : ''}</div>`;
}
Object.assign(ACT, {
  taste: t => { if (sheetStack.length && t.dataset.m) sheetStack.pop(); startTaste(t.dataset.w, t.dataset.b, t.dataset.m); },
  tmode: t => { draft.taste.mode = t.dataset.m; refreshSheet(); },
  tchip: t => { const F = draft.taste.full, k = t.dataset.k; F[k] = F[k] === t.dataset.v ? null : t.dataset.v; refreshSheet(); },
  wfam: t => { const i = +t.dataset.i; wheelState.active = wheelState.active === i ? null : i; paintWheel(); },
  waro: t => { const A = draft.taste.full.aromes, a = t.dataset.a, i = A.indexOf(a); if (i >= 0) A.splice(i, 1); else A.push(a); paintWheel(); },
  aroAdd: async () => {
    const t = draft.taste, fam = aromaFamilies(t.kind)[wheelState.active]; if (!fam) return;
    const name = (prompt(`Nouvel arôme dans « ${fam[1]} »`) || '').trim(); if (!name) return;
    const store_ = S.settings.aromas[t.kind] ||= {}; (store_[fam[0]] ||= []);
    if (!fam[3].includes(name)) store_[fam[0]].push(name);
    if (!t.full.aromes.includes(name)) t.full.aromes.push(name);
    await save(); paintWheel();
  },
  tctx: t => { const k = t.dataset.k; draft.taste[k] = draft.taste[k] === t.dataset.v ? null : t.dataset.v; refreshSheet(); },
  tphoto: () => { const i = $('#f-photo2'); i.value = ''; i.click(); },
  tasteSave: async () => {
    const t = draft.taste, w = wine(t.wineId);
    if (t.blind && !t.wineId && !t.couleur && t.kind !== 'spirit') return toast('Choisis d’abord la couleur du vin mystère');
    const fields = { at: t.at || today(), note: t.note, comment: t.comment, plat: t.plat, type: t.type || null, lieu: t.lieu, convives: t.convives,
      prix: num(t.prix), achatLieu: t.achatLieu, provenance: t.provenance, accord: t.accord || null, sessionId: t.sessionId || null };
    let rec;
    if (t.editId) { rec = byId(S.tastings, t.editId); Object.assign(rec, fields); if (t.mode === 'full') rec.full = { ...t.full }; else delete rec.full; }
    else {
      rec = { id: uid(), wineId: t.wineId, bottleId: t.bottleId, ...fields };
      if (t.mode === 'full') rec.full = { ...t.full };
      // « Une bouteille de ma cave » : on la sort du stock
      if (t.fromCave && !t.bottleId) {
        const b = pickBottle(w);
        if (b) { const from = locOf(b); b.state = 'out'; b.outAt = rec.at; logMove(b, 'out', { motif: 'bue', at: rec.at, from, plat: rec.plat, who: rec.convives }); rec.bottleId = b.id; S.transfer.ids = S.transfer.ids.filter(id => id !== b.id); }
      }
      S.tastings.push(rec);
    }
    rec.horsCave = !rec.bottleId;
    if (t.blind) rec.blind = { ...(rec.blind || {}), kind: t.kind, couleur: w?.couleur || t.couleur, hyp: { ...t.hyp }, revealed: !!rec.wineId };
    if (t.photoBlob) { await photoSave('t-' + rec.id, t.photoBlob); rec.photo = true; }
    if (rec.bottleId) { const b = byId(S.bottles, rec.bottleId); if (b) b.ficheTodo = false; }
    await save(); draft = null;
    const sid = rec.sessionId;
    closeSheet(); render(); toast(t.editId ? 'Dégustation modifiée' : 'Dégustation enregistrée');
    if (sid && !t.editId) showSheet(() => sessionSheet(sid));
    if (t.blind && !rec.wineId && !t.editId && !sid) return showSheet(() => `${head('Vin mystère enregistré')}<p>Ta fiche est enregistrée. Révèle le vin quand tu le connais : je comparerai tes hypothèses à la réalité.</p>
      <div class="btns"><button class="btn primary wide" data-act="reveal" data-t="${rec.id}">Révéler le vin</button><button class="btn ghost wide" data-act="close">Plus tard</button></div>
      <p class="tiny">La dégustation reste dans ton journal en « Vin mystère ».</p>`);
    if (!t.editId && w) afterTasting(w, rec);
  },
  tasteView: t => showSheet(() => tasteView(t.dataset.id)),
  tasteEdit: t => editTaste(t.dataset.id),
  delTaste: async t => {
    if (!confirm('Supprimer cette dégustation ?')) return;
    const r = byId(S.tastings, t.dataset.id); if (r?.photo) await photoDel('t-' + r.id);
    S.tastings = S.tastings.filter(x => x.id !== t.dataset.id); await save(); sheetBack(); refreshSheet(); render();
  },
  rateLater: async () => { S.dismissed.todoDay = today(); await save(); render(); },
  rateNow: () => { const l = todoBottles(); if (l.length === 1) startTaste(l[0].wineId, l[0].id, 'quick'); else showSheet(todoSheet); },
  applyAdvice: async t => {
    const w = wine(t.dataset.w), a = { ...(w.apogee || {}) };
    if (t.dataset.fin) a.fin = +t.dataset.fin; if (t.dataset.deb) a.debut = +t.dataset.deb;
    if (a.pic && a.fin && a.pic > a.fin) a.pic = a.fin;
    w.apogee = { ...a, src: 'manuel', why: (a.why ? a.why + ' ' : '') + 'Ajustée après dégustation.', at: Date.now() };
    await save(); closeSheet(); render(); toast('Fenêtre mise à jour');
  },
});
// Après une dégustation : si l'évolution observée contredit la fenêtre, on propose de l'ajuster
function tastingAdvice(w, rec) {
  if (w.kind === 'spirit' || !rec.full?.evolution) return null;
  const left = wineBottles(w.id).length, a = w.apogee, y = thisYear(), ev = rec.full.evolution;
  if (!left) return null;
  let msg = '', attrs = '';
  if (ev === 'declin' && (!a?.fin || a.fin > y)) { msg = `Tu trouves ce vin sur le déclin. Il te reste ${plural(left, 'bouteille', 'bouteilles')} : je te propose de fixer la fin de la fenêtre à ${y} pour les boire en priorité.`; attrs = `data-fin="${y}"`; }
  else if (ev === 'jeune' && a?.debut && a.debut <= y) { msg = `Tu trouves ce vin encore jeune. Je te propose de décaler le début de la fenêtre à ${y + 1} pour les ${plural(left, 'bouteille restante', 'bouteilles restantes')}.`; attrs = `data-deb="${y + 1}"${a.fin && a.fin <= y + 1 ? ` data-fin="${y + 3}"` : ''}`; }
  else return null;
  return `${head('Le sommelier')}<div class="card" style="background:var(--green-soft);border-color:#C9DCCF"><p style="margin:0">${esc(msg)}</p></div>
    <div class="btns2" style="margin-top:12px"><button class="btn green" data-act="applyAdvice" data-w="${w.id}" ${attrs}>Mettre à jour</button><button class="btn ghost" data-act="close">Garder</button></div>
    ${aiReady() ? `<button class="btn ghost wide" style="margin-top:8px" data-act="estimate" data-id="${w.id}" data-t="${rec.id}">${ICON.spark} Demander une réestimation complète</button>` : ''}`;
}
function tasteView(id) {
  const t = byId(S.tastings, id); if (!t) return null;
  const w = tastingWine(t), F = t.full || {}, sess = t.sessionId && byId(S.sessions, t.sessionId), wished = isWished(w.id), mystery = !!t.blind && !t.wineId;
  const row = (k, v) => v != null && v !== '' ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const sl = k => F[k] != null ? sliderOut(k, F[k], w.kind) : null;
  return `${head('Dégustation', `<button class="icon-btn" data-act="tasteEdit" data-id="${id}" aria-label="Modifier">${ICON.edit}</button><button class="icon-btn" data-act="delTaste" data-id="${id}" aria-label="Supprimer">${ICON.trash}</button>`)}
    <p class="small" style="margin-top:-6px"><b style="color:var(--ink)">${esc(wineTitle(w))}</b> · ${esc(fmtDate(t.at))}</p>
    <div class="tags">${t.blind ? '<span class="tag b">À l’aveugle</span>' : ''}${t.type ? `<span class="tag o">${TASTE_TYPES[t.type]}</span>` : ''}${mystery ? '' : t.bottleId ? '<span class="tag g">De ma cave</span>' : '<span class="tag">Hors cave</span>'}${t.accord ? `<span class="tag ${t.accord === 'parfait' ? 'g' : t.accord === 'rate' ? 'r' : ''}">Accord ${ACCORDS[t.accord].toLowerCase()}</span>` : ''}</div>
    <div class="score" style="margin-top:8px">${t.note != null ? numFr(t.note) : '–'}<small> / 20</small></div>
    ${t.comment ? `<p style="white-space:pre-wrap">${esc(t.comment)}</p>` : ''}
    ${t.photo ? `<img class="photo" data-photo="t-${t.id}" alt="Photo" hidden>` : ''}
    ${F.aromes?.length ? `<div class="lbl">Arômes</div><div class="chips wrap">${F.aromes.map(a => `<span class="chip soft on">${esc(a)}</span>`).join('')}</div>` : ''}
    <dl class="kv" style="margin-top:12px">${row('Séance', sess?.titre)}${row('Lieu', t.lieu)}${row('Convives', t.convives)}${row('Plat', t.plat)}
      ${row('Prix payé', t.prix != null ? fmtE2.format(t.prix) : '')}${row('Lieu d’achat', t.achatLieu)}${row('Provenance', t.provenance)}
      ${row('Teinte', F.teinte)}${row('Intensité (œil)', sl('oeil'))}${row('Limpidité', F.limpidite)}${row('Bulles', F.bulles)}
      ${row('Intensité (nez)', sl('nez'))}${row('Ouverture', F.ouverture)}${row('Service', F.eau)}${row('Attaque', F.attaque)}
      ${(w.kind === 'spirit' ? SLIDERS_SPIRIT : SLIDERS_VIN).map(([k, l]) => row(l, sl(k))).join('')}${row('Tanins', F.texture)}${row('Équilibre', F.equilibre)}
      ${row('Évolution', ({ jeune: 'Jeune', apoint: 'À point', declin: 'Sur le déclin' })[F.evolution])}${row('Potentiel', F.potentiel)}</dl>
    ${t.blind && t.wineId ? blindCompare(t, w) : ''}
    ${mystery ? `<div class="btns" style="margin-top:14px"><button class="btn primary wide" data-act="reveal" data-t="${id}">Révéler le vin</button>${sess ? `<button class="btn ghost wide" data-act="session" data-id="${sess.id}">Voir la séance</button>` : ''}</div>` : `
    <div class="btns" style="margin-top:14px">
      <div class="btns2"><button class="btn ${wished ? 'outline' : 'green'}" data-act="wishToggle" data-w="${w.id}" data-t="${id}">${wished ? '♥ Dans mes envies' : '♥ Je veux en acheter'}</button><button class="btn" data-act="rebuy" data-id="${w.id}">${ICON.add} Ajouter à la cave</button></div>
      ${sess ? `<button class="btn ghost wide" data-act="session" data-id="${sess.id}">Voir la séance</button>` : ''}
      <button class="btn ghost wide" data-act="wine" data-id="${w.id}">Voir la fiche du vin</button>
    </div>`}`;
}
// Après une dégustation : réévaluation de la fenêtre par le sommelier, ou règle simple sans IA
function afterTasting(w, rec) {
  if (w.kind === 'spirit' || !wineBottles(w.id).length) return;
  if (aiReady() && (rec.comment || rec.full?.evolution || rec.full?.potentiel)) return reevaluate(w, rec);
  const sugg = tastingAdvice(w, rec); if (sugg) showSheet(() => sugg);
}
CHANGES.tcave = el => { draft.taste.fromCave = el.checked; refreshSheet(); };
async function onTastePhoto(file) {
  if (!file || !draft?.taste) return;
  try { const blob = await shrinkImage(file, 900, 0.72); draft.taste.photoBlob = blob; draft.taste.photoUrl = URL.createObjectURL(blob); refreshSheet(); }
  catch { toast('Image illisible'); }
}

/* ---------- À l'aveugle : hypothèses, révélation, comparaison ---------- */
function blindHypCard(t) {
  const h = t.hyp || {}, f = (k, l, ph, mode = '') => `<label>${l}<input value="${esc(h[k] ?? '')}" data-in="th" data-k="${k}" placeholder="${esc(ph)}" autocomplete="off" ${mode ? `inputmode="${mode}"` : ''}></label>`;
  return `<div class="card form"><div class="lbl" style="margin:0">Tes hypothèses <span class="tiny" style="text-transform:none;letter-spacing:0">(facultatif)</span></div>
    ${t.kind === 'spirit' ? `${f('cepage', 'Catégorie, style', 'Whisky tourbé, rhum agricole…')}${f('region', 'Origine', 'Islay, Martinique…')}${f('millesime', 'Âge', 'En années', 'numeric')}`
      : `${f('cepage', 'Cépage', 'Chenin, Syrah…')}${f('region', 'Région ou appellation', 'Loire, Savennières…')}<div class="grid2">${f('millesime', 'Millésime', '2018', 'numeric')}${f('prix', 'Prix (€)', '30', 'decimal')}</div>`}</div>`;
}
INPUTS.th = el => { draft.taste.hyp[el.dataset.k] = el.value; };
const hasHyp = t => Object.values(t.blind?.hyp || {}).some(v => String(v || '').trim());
function blindCompare(t, w) {
  const h = t.blind.hyp || {}, rows = [];
  const tok = s => norm(s).split(/[\s,;/-]+/).filter(x => x.length > 2);
  const hit = (guess, real) => { const g = tok(guess), r = norm(real); return g.length && g.some(x => r.includes(x)); };
  if (h.cepage) rows.push([w.kind === 'spirit' ? 'Style' : 'Cépage', h.cepage, w.kind === 'spirit' ? [SPIRIT_CATS[w.cat], w.fut].filter(Boolean).join(', ') : w.cepages, hit(h.cepage, w.kind === 'spirit' ? [SPIRIT_CATS[w.cat], w.fut, w.cuvee].join(' ') : w.cepages) ? 'ok' : 'ko']);
  if (h.region) rows.push(['Origine', h.region, [w.appellation, w.region, w.pays].filter(Boolean).join(', '), hit(h.region, [w.appellation, w.region, w.pays].join(' ')) ? 'ok' : 'ko']);
  if (h.millesime) { const g = int(h.millesime), r = w.kind === 'spirit' ? w.age : w.millesime; rows.push([w.kind === 'spirit' ? 'Âge' : 'Millésime', h.millesime, r || '?', r && g ? (g === r ? 'ok' : Math.abs(g - r) <= 2 ? 'near' : 'ko') : '']); }
  if (h.prix) { const g = num(h.prix), r = t.prix ?? w.achat?.prix; rows.push(['Prix', eur(g), r != null ? eur(r) : '?', r && g ? (Math.abs(g - r) / r <= 0.3 ? 'ok' : 'ko') : '']); }
  const mark = { ok: '<b style="color:var(--green)">✓</b>', near: '<b style="color:var(--gold)">≈</b>', ko: '<b style="color:var(--red)">✗</b>', '': '' };
  const a = t.blind.analysis;
  return `<div class="card">
    <div class="ct">À l’aveugle : tes hypothèses</div>
    ${rows.length ? `<table class="cmp"><tr><th></th><th>Ton idée</th><th>En réalité</th><th></th></tr>${rows.map(([l, g, r, m]) => `<tr><td>${esc(l)}</td><td>${esc(g)}</td><td>${esc(r)}</td><td>${mark[m]}</td></tr>`).join('')}</table>` : '<p class="small" style="margin:0">Tu n’avais pas noté d’hypothèse.</p>'}
    ${a ? `<div class="lbl">Analyse du sommelier</div><p style="margin:0;white-space:pre-wrap;font-size:14.5px;line-height:1.45">${esc(a)}</p>`
      : blindBusy === t.id ? `<div class="lbl">Analyse du sommelier</div><span class="typing"><i></i><i></i><i></i></span>`
      : rows.length && aiReady() ? `<button class="btn small" style="margin-top:10px" data-act="blindAI" data-t="${t.id}">${ICON.spark} Analyse du sommelier</button>` : ''}
  </div>`;
}
function revealSheet(tid) {
  const t = byId(S.tastings, tid); if (!t) return null;
  return `${head('Révéler le vin')}
    <p class="small" style="margin-top:-6px">Vin mystère du ${esc(fmtDate(t.at))}${t.note != null ? ' · ' + numFr(t.note) + '/20' : ''}</p>
    <div class="big-actions">
      <button class="big-action" data-act="revealScan" data-t="${tid}">${ICON.camera}<div><b>Photo de l’étiquette</b><small>Le sommelier reconnaît le vin.</small></div></button>
      <div class="card" style="margin:0"><div class="search" style="margin:0">${ICON.search}<input type="search" placeholder="Un vin déjà connu…" data-in="revealFind" data-t="${tid}" autocomplete="off">${sx()}</div><div id="reveal-find"></div></div>
      <button class="big-action" data-act="revealManual" data-t="${tid}">${ICON.edit}<div><b>Saisie manuelle</b><small>Appellation, millésime, domaine…</small></div></button>
    </div>`;
}
INPUTS.revealFind = el => {
  const m = matcher(el.value), box = $('#reveal-find'); if (!box) return;
  if (!m) { box.innerHTML = ''; return; }
  const ws = S.wines.filter(w => kindOn(w) && m(w)).slice(0, 8);
  box.innerHTML = ws.length ? `<div class="list" style="margin-top:8px">${ws.map(w => `<button class="li" data-act="revealWine" data-w="${w.id}" data-t="${el.dataset.t}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}</small></div></button>`).join('')}</div>` : '<p class="small" style="margin:8px 4px 0">Aucun vin connu : photo ou saisie manuelle.</p>';
};
async function doReveal(tid, wid) {
  const t = byId(S.tastings, tid), w = wine(wid); if (!t || !w) return;
  t.wineId = wid; t.blind = { ...(t.blind || {}), revealed: true, revealedAt: today(), couleur: w.couleur || t.blind?.couleur };
  await save(); closeSheet(); render(); toast('Vin révélé');
  showSheet(() => tasteView(tid));
  if (hasHyp(t) && aiReady()) blindAnalysis(tid);
}
let blindBusy = null;
const BLIND_SYS = `Tu es formateur en dégustation, niveau sommelier. Un amateur a dégusté un vin à l’aveugle : il a rempli une fiche, noté ses hypothèses, puis le vin a été révélé.
Explique-lui, en t’appuyant uniquement sur ce qu’il a noté dans sa fiche et sur les caractéristiques typiques du vin révélé (cépage, appellation, millésime, élevage) :
1. quels éléments de sa fiche pointaient vers le vrai vin ;
2. pourquoi il a pu être orienté vers ses hypothèses : quels descripteurs qu’il a notés sont typiques de ce qu’il a proposé ;
3. un ou deux repères concrets pour distinguer la prochaine fois le vin réel de celui qu’il a proposé.
Pas de félicitations ni de généralités. N’invente aucun descripteur qu’il n’a pas noté. Si ses hypothèses étaient justes, dis en une phrase ce qui les justifiait. Si sa fiche est trop pauvre pour une analyse utile, dis-le en une phrase et indique quoi noter la prochaine fois.
Français, tutoiement, 130 mots maximum, sans markdown, en deux ou trois paragraphes courts.`;
async function blindAnalysis(tid) {
  const t = byId(S.tastings, tid), w = wine(t?.wineId); if (!t || !w) return;
  const F = t.full || {}, h = t.blind.hyp || {};
  const fiche = [`Note : ${t.note ?? '?'}/20`, F.teinte && `teinte ${F.teinte}`, F.oeil && `intensité visuelle ${F.oeil}/5`, F.limpidite, F.nez && `intensité du nez ${F.nez}/5`, F.ouverture && `nez ${F.ouverture.toLowerCase()}`,
    F.aromes?.length && `arômes : ${F.aromes.join(', ')}`, F.attaque && `attaque ${F.attaque.toLowerCase()}`,
    ...(w.kind === 'spirit' ? SLIDERS_SPIRIT : SLIDERS_VIN).filter(([k]) => F[k] != null).map(([k, l]) => `${l.toLowerCase()} ${sliderOut(k, F[k], w.kind)}`),
    F.texture && `tanins ${F.texture.toLowerCase()}`, F.equilibre && F.equilibre.toLowerCase(), F.evolution && `évolution : ${({ jeune: 'jeune', apoint: 'à point', declin: 'sur le déclin' })[F.evolution]}`,
    t.comment && `commentaire : « ${t.comment} »`].filter(Boolean).join(' ; ');
  const hyp = [h.cepage && `${w.kind === 'spirit' ? 'style' : 'cépage'} : ${h.cepage}`, h.region && `origine : ${h.region}`, h.millesime && `${w.kind === 'spirit' ? 'âge' : 'millésime'} : ${h.millesime}`, h.prix && `prix : ${h.prix} €`].filter(Boolean).join(' ; ');
  const real = [wineTitle(w), w.domaine && `producteur ${w.domaine}`, w.appellation, w.region, w.pays, w.cepages && `cépages ${w.cepages}`, w.kind === 'spirit' && [SPIRIT_CATS[w.cat], w.age && w.age + ' ans', w.fut].filter(Boolean).join(', '), w.degre && w.degre + ' %', (t.prix ?? w.achat?.prix) != null && `prix ${t.prix ?? w.achat.prix} €`].filter(Boolean).join(' ; ');
  blindBusy = tid; refreshSheet();
  try {
    const r = await aiCall({ tag: 'aveugle', system: BLIND_SYS, content: `Sa fiche : ${fiche || 'presque vide'}\nSes hypothèses : ${hyp}\nLe vin révélé : ${real}`, maxTokens: 2500, effort: 'medium' });
    t.blind.analysis = r.text.trim().slice(0, 1500);
    await save();
  } catch (e) { toast('Analyse impossible : ' + (e.message || '').split('\n')[0]); }
  blindBusy = null; if (sheetStack.length) refreshSheet();
}
Object.assign(ACT, {
  blindStart: t => { closeSheet(); startBlind(t.dataset.session || null); },
  tcolor: t => { const v = t.dataset.v; if (v === 'spirit') { draft.taste.kind = 'spirit'; draft.taste.couleur = null; } else { draft.taste.kind = 'vin'; draft.taste.couleur = v; } wheelState = { active: null }; refreshSheet(); },
  reveal: t => showSheet(() => revealSheet(t.dataset.t)),
  revealWine: t => doReveal(t.dataset.t, t.dataset.w),
  revealScan: t => { labelFor = { reveal: t.dataset.t }; const i = $('#f-photo'); i.value = ''; i.click(); },
  revealManual: t => { const r = byId(S.tastings, t.dataset.t); newDraft(r.blind?.kind === 'spirit' ? 'spirit' : 'vin', r.blind?.couleur ? { couleur: r.blind.couleur } : {}); draft.forReveal = t.dataset.t; showSheet(wineFormSheet, { full: true }); },
  blindAI: t => blindAnalysis(t.dataset.t),
});

/* ---------- Fermer une dégustation en cours de saisie ---------- */
const tasteSig = t => JSON.stringify([t.note, t.comment, t.plat, t.type, t.lieu, t.convives, t.prix, t.achatLieu, t.provenance, t.accord, t.fromCave, t.at, t.couleur, t.kind, t.full, t.hyp, !!t.photoBlob]);
const tasteDirty = () => !!draft?.taste && tasteSig(draft.taste) !== draft.taste._snap;
// Renvoie vrai si la fermeture est suspendue par la question « Abandonner cette dégustation ? »
function guardTaste(next) {
  const top = sheetStack[sheetStack.length - 1];
  if (top?.fn !== tasteSheet || !tasteDirty()) return false;
  showSheet(() => `${head('Abandonner cette dégustation ?')}<p>Ce que tu as saisi sera perdu.</p>
    <div class="btns"><button class="btn primary wide" data-act="tasteKeep">Continuer la dégustation</button><button class="btn danger wide" data-act="tasteAbandon" data-next="${next}">Abandonner</button></div>`);
  return true;
}
Object.assign(ACT, {
  tasteKeep: () => sheetBack(),
  tasteAbandon: t => { draft = null; if (t.dataset.next === 'back') { sheetStack.pop(); sheetStack.pop(); paintSheet(); } else closeSheet(); },
});
