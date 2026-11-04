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
  const w = wine(wineId);
  const prev = S.dismissed.rate?.bottleId === bottleId ? S.dismissed.rate : null;
  const sess = ctx.sessionId && byId(S.sessions, ctx.sessionId);
  draft = { taste: { wineId, bottleId: bottleId || null, kind: w.kind, mode: m === 'full' ? 'full' : 'quick', note: 14, comment: '', at: sess?.date || today(), plat: prev?.plat || '',
    type: sess?.type || null, lieu: sess?.lieu || '', convives: sess?.convives || '', prix: '', achatLieu: '', provenance: '', accord: null, sessionId: sess?.id || null, fromCave: false, full: { aromes: [] } } };
  wheelState = { active: null };
  showSheet(tasteSheet, { full: true });
}
function editTaste(id) {
  const r = byId(S.tastings, id), w = wine(r.wineId);
  draft = { taste: { ...r, kind: w.kind, mode: r.full ? 'full' : 'quick', prix: r.prix != null ? numFr(r.prix, 2) : '', full: { aromes: [], ...(structuredClone(r.full || {})) }, editId: id } };
  wheelState = { active: null };
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
  const w = wine(t.wineId), F = t.full, sp = w.kind === 'spirit';
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
  return `${head('Dégustation', `<button class="link" data-act="tasteSave">OK</button>`)}
    <div class="card" style="margin-top:0"><div class="row"><div class="grow"><div class="rn">${esc(wineTitle(w))}</div><div class="rs">${esc(wineSub(w))}</div></div>${t.bottleId || t.fromCave ? '<span class="tag g">De ma cave</span>' : '<span class="tag o">Hors cave</span>'}</div>
      <div class="seg"><button class="${t.mode === 'quick' ? 'on' : ''}" data-act="tmode" data-m="quick">Rapide</button><button class="${t.mode === 'full' ? 'on' : ''}" data-act="tmode" data-m="full">Complète</button></div></div>
    ${tasteContext(t, w)}
    <div class="card"><div class="score" id="t-score">${numFr(t.note)}<small> / 20</small></div>
      <input type="range" min="0" max="20" step="0.5" value="${t.note}" data-in="tnote" aria-label="Note sur 20"></div>
    ${full}
    <div class="card form">
      <label>Commentaire<textarea data-in="tf" data-k="comment" placeholder="Tes impressions…">${esc(t.comment)}</textarea></label>
    </div>
    <button class="btn primary wide" style="margin-top:12px" data-act="tasteSave">Enregistrer la dégustation</button>`;
}
INPUTS.tnote = el => { draft.taste.note = +el.value; $('#t-score').innerHTML = `${numFr(+el.value)}<small> / 20</small>`; setRangeFill(el); };
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
    if (t.photoBlob) { await photoSave('t-' + rec.id, t.photoBlob); rec.photo = true; }
    if (S.dismissed.rate && (S.dismissed.rate.bottleId === rec.bottleId || S.dismissed.rate.wineId === rec.wineId)) delete S.dismissed.rate;
    await save(); draft = null;
    const sid = rec.sessionId;
    closeSheet(); render(); toast(t.editId ? 'Dégustation modifiée' : 'Dégustation enregistrée');
    if (sid && !t.editId) showSheet(() => sessionSheet(sid));
    if (!t.editId) afterTasting(w, rec);
  },
  tasteView: t => showSheet(() => tasteView(t.dataset.id)),
  tasteEdit: t => editTaste(t.dataset.id),
  delTaste: async t => {
    if (!confirm('Supprimer cette dégustation ?')) return;
    const r = byId(S.tastings, t.dataset.id); if (r?.photo) await photoDel('t-' + r.id);
    S.tastings = S.tastings.filter(x => x.id !== t.dataset.id); await save(); sheetBack(); refreshSheet(); render();
  },
  rateLater: async () => { delete S.dismissed.rate; await save(); render(); },
  rateNow: () => { const r = S.dismissed.rate; startTaste(r.wineId, r.bottleId, 'quick'); },
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
  const w = wine(t.wineId), F = t.full || {}, sess = t.sessionId && byId(S.sessions, t.sessionId), wished = isWished(w.id);
  const row = (k, v) => v != null && v !== '' ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const sl = k => F[k] != null ? sliderOut(k, F[k], w.kind) : null;
  return `${head('Dégustation', `<button class="icon-btn" data-act="tasteEdit" data-id="${id}" aria-label="Modifier">${ICON.edit}</button><button class="icon-btn" data-act="delTaste" data-id="${id}" aria-label="Supprimer">${ICON.trash}</button>`)}
    <p class="small" style="margin-top:-6px"><b style="color:var(--ink)">${esc(wineTitle(w))}</b> · ${esc(fmtDate(t.at))}</p>
    <div class="tags">${t.type ? `<span class="tag o">${TASTE_TYPES[t.type]}</span>` : ''}${t.bottleId ? '<span class="tag g">De ma cave</span>' : '<span class="tag">Hors cave</span>'}${t.accord ? `<span class="tag ${t.accord === 'parfait' ? 'g' : t.accord === 'rate' ? 'r' : ''}">Accord ${ACCORDS[t.accord].toLowerCase()}</span>` : ''}</div>
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
    <div class="btns" style="margin-top:14px">
      <div class="btns2"><button class="btn ${wished ? 'outline' : 'green'}" data-act="wishToggle" data-w="${w.id}" data-t="${id}">${wished ? '♥ Dans mes envies' : '♥ Je veux en acheter'}</button><button class="btn" data-act="rebuy" data-id="${w.id}">${ICON.add} Ajouter à la cave</button></div>
      ${sess ? `<button class="btn ghost wide" data-act="session" data-id="${sess.id}">Voir la séance</button>` : ''}
      <button class="btn ghost wide" data-act="wine" data-id="${w.id}">Voir la fiche du vin</button>
    </div>`;
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
