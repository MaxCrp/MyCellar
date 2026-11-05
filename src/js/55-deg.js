/* ---------- Onglet Dégustations ----------
   Le journal unique de toutes les dégustations : bouteilles de la cave et vins bus ailleurs.
   Un vin dégusté hors cave est une fiche vin ordinaire, sans bouteille. */
let degMode = 'journal', degQuery = '', degF = { min: false, src: 'all', type: null, color: null }, labelFor = null;

function degTastings() {
  const m = matcher(degQuery), f = degF;
  const q = norm(degQuery);
  return S.tastings.filter(t => {
    const w = tastingWine(t); if (!w || !kindOn(w)) return false;
    if (f.min && !(t.note >= 16)) return false;
    if (f.src === 'hors' && t.bottleId) return false;
    if (f.src === 'cave' && !t.bottleId) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.color && w.couleur !== f.color) return false;
    if (m && !m(w) && !norm([t.lieu, t.comment, t.plat, t.convives, byId(S.sessions, t.sessionId)?.titre].join(' ')).includes(q)) return false;
    return true;
  }).sort((a, b) => (b.at || '').localeCompare(a.at || '') || (b.note ?? 0) - (a.note ?? 0));
}
function degTools() {
  const f = degF, ch = (act, v, on, l) => `<button class="chip soft${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`;
  const colors = [...new Set(S.tastings.map(t => tastingWine(t)?.couleur).filter(Boolean))];
  return `<div class="search">${ICON.search}<input type="search" placeholder="Rechercher un vin, un lieu, un plat…" value="${esc(degQuery)}" data-in="degSearch" autocomplete="off" enterkeyhint="search"></div>
    <div class="seg"><button class="${degMode === 'journal' ? 'on' : ''}" data-act="degMode" data-m="journal">Journal</button><button class="${degMode === 'vin' ? 'on' : ''}" data-act="degMode" data-m="vin">Par vin</button></div>
    <div class="chips">${ch('dfMin', '1', f.min, '16 et plus')}${ch('dfSrc', 'hors', f.src === 'hors', 'Hors cave')}${ch('dfSrc', 'cave', f.src === 'cave', 'De ma cave')}
      ${Object.entries(TASTE_TYPES).map(([k, l]) => ch('dfType', k, f.type === k, l)).join('')}
      ${colors.map(c => ch('dfColor', c, f.color === c, `<span class="dot" style="background:${COLORS[c]?.c}"></span>${COLORS[c]?.label}`)).join('')}</div>`;
}
const noteBadge = n => `<span class="qty" style="color:var(--bx);background:var(--bx-soft)">${n != null ? numFr(n) : '–'}</span>`;
function tasteRow(t, rank) {
  const w = tastingWine(t), mystery = t.blind && !t.wineId;
  const sub = [mystery ? 'à l’aveugle · à révéler' : w.domaine && !nameIsDomaine(w) ? w.domaine : w.appellation, t.blind && !mystery ? 'à l’aveugle' : '', t.type ? TASTE_TYPES[t.type] : '', t.lieu, mystery ? '' : t.bottleId ? 'de ma cave' : 'hors cave', !mystery && isWished(w.id) ? '♥ envie' : ''].filter(Boolean).join(' · ');
  return `<button class="li" data-act="tasteView" data-id="${t.id}">${rank ? `<span class="rank">${rank}</span>` : `<span class="dot" style="background:${wineColor(w)}"></span>`}
    <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(sub)}</small>${t.plat || t.accord ? `<small class="ell">${t.accord ? 'Accord ' + ACCORDS[t.accord].toLowerCase() : ''}${t.accord && t.plat ? ' · ' : ''}${esc(t.plat || '')}</small>` : ''}</div>${noteBadge(t.note)}</button>`;
}
const monthLabel = s => s ? cap(new Date(s.slice(0, 7) + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })) : 'Sans date';
function vDeg() {
  if (!S.tastings.length) return `<div class="empty">${ICON.notes}<p>Aucune dégustation pour l’instant.</p><p class="small">Note les vins de ta cave, ou ceux bus au restaurant, chez des amis, dans un salon.</p>
    <button class="btn primary" data-act="newTaste">${ICON.add} Nouvelle dégustation</button></div>`;
  const ts = degTastings();
  if (!ts.length) return '<div class="empty">Aucune dégustation ne correspond.</div>';
  if (degMode === 'vin') return vDegByWine(ts);
  // Journal : les dégustations d'une séance forment un bloc, daté par la séance
  const items = [], seen = new Set();
  for (const t of ts) {
    if (t.sessionId && byId(S.sessions, t.sessionId)) {
      if (seen.has(t.sessionId)) continue; seen.add(t.sessionId);
      const s = byId(S.sessions, t.sessionId);
      items.push({ at: s.date || t.at, s, ts: ts.filter(x => x.sessionId === s.id).sort((a, b) => (b.note ?? -1) - (a.note ?? -1)) });
    } else items.push({ at: t.at, t });
  }
  items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  let out = '', month = null, open = false;
  for (const it of items) {
    const m = monthLabel(it.at);
    if (m !== month) { if (open) out += '</div>'; out += `<div class="sect">${esc(m)}</div>`; month = m; open = false; }
    if (it.s) {
      if (open) { out += '</div>'; open = false; }
      const n = S.tastings.filter(x => x.sessionId === it.s.id).length;
      out += `<div class="card" style="padding:0;overflow:hidden"><button class="row" style="padding:12px;background:var(--gold-soft);width:100%;border:0;text-align:left" data-act="session" data-id="${it.s.id}">
        <span style="color:var(--bx)">${ICON.glass}</span><div class="grow"><b style="font-size:14.5px">${esc(it.s.titre)}</b><div class="small">Séance${it.s.type ? ' · ' + TASTE_TYPES[it.s.type] : ''}${it.s.lieu ? ' · ' + esc(it.s.lieu) : ''} · ${esc(fmtDate(it.s.date))} · ${plural(n, 'vin', 'vins')}</div></div><span class="chev">${ICON.chev}</span></button>
        ${it.ts.slice(0, 3).map((t, i) => tasteRow(t, i + 1)).join('')}
        ${n > 3 ? `<button class="li" style="justify-content:center;color:var(--bx);font-weight:600;font-size:13.5px" data-act="session" data-id="${it.s.id}">Voir les ${n} vins</button>` : ''}</div>`;
    } else {
      if (!open) { out += '<div class="list">'; open = true; }
      out += tasteRow(it.t);
    }
  }
  if (open) out += '</div>';
  return `<p class="small" style="margin:10px 4px 0">${plural(ts.length, 'dégustation', 'dégustations')}</p>${out}`;
}
function vDegByWine(ts) {
  const by = new Map();
  for (const t of ts) if (t.wineId) by.set(t.wineId, [...(by.get(t.wineId) || []), t]);
  const rows = [...by].map(([wid, l]) => ({ w: wine(wid), l, avg: l.filter(t => t.note != null).reduce((n, t, _, a) => n + t.note / a.length, 0) }))
    .sort((a, b) => (b.l[0].at || '').localeCompare(a.l[0].at || ''));
  return `<p class="small" style="margin:10px 4px 0">${plural(rows.length, 'vin', 'vins')}</p><div class="list">${rows.map(({ w, l, avg }) => `<button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span>
    <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${plural(l.length, 'dégustation', 'dégustations')} · dernière le ${esc(fmtDate(l[0].at))}${wineBottles(w.id).length ? ` · ${wineBottles(w.id).length} en cave` : ''}</small>
    ${l.length > 1 ? `<small class="ell">${l.slice(0, 6).map(t => `${numFr(t.note)}`).reverse().join(' → ')}</small>` : ''}</div>${noteBadge(Math.round(avg * 2) / 2)}</button>`).join('')}</div>`;
}
INPUTS.degSearch = el => { degQuery = el.value; const v = $('.view'); if (v) { v.innerHTML = banners() + vDeg(); paintPhotos(v); } };

/* ---------- Nouvelle dégustation ---------- */
function newTasteSheet(sessionId) {
  const s = sessionId && byId(S.sessions, sessionId);
  return `${head(s ? 'Ajouter un vin' : 'Nouvelle dégustation')}
    ${s ? `<p class="small" style="margin-top:-6px">Séance « ${esc(s.titre)} »</p>` : ''}
    <div class="big-actions">
      <button class="big-action" data-act="scanTaste" data-session="${sessionId || ''}">${ICON.camera}<div><b>Photo de l’étiquette</b><small>${aiReady() && aiClaude() ? 'Le sommelier reconnaît le vin.' : 'Sans clé Claude, la photo est gardée et tu remplis la fiche.'}</small></div></button>
      <div class="card" style="margin:0"><div class="search" style="margin:0">${ICON.search}<input type="search" placeholder="Un vin déjà connu (cave, dégustations)…" data-in="tasteFind" data-session="${sessionId || ''}" autocomplete="off"></div><div id="taste-find"></div></div>
      <button class="big-action" data-act="newTasteWine" data-kind="vin" data-session="${sessionId || ''}">${ICON.edit}<div><b>Saisie manuelle</b><small>Domaine, cuvée, millésime.</small></div></button>
      ${spiritsOn() ? `<button class="big-action" data-act="newTasteWine" data-kind="spirit" data-session="${sessionId || ''}">${ICON.bottle}<div><b>Un spiritueux</b><small>Whisky, rhum, cognac…</small></div></button>` : ''}
      <button class="big-action" data-act="blindStart" data-session="${sessionId || ''}">${ICON.glass}<div><b>À l’aveugle</b><small>La fiche d’abord, le vin ensuite : compare tes hypothèses.</small></div></button>
      ${s ? '' : `<button class="big-action" style="border-color:var(--bx)" data-act="newSession">${ICON.glass}<div><b>Démarrer une séance</b><small>Salon, verticale, soirée : plusieurs vins, un seul contexte.</small></div></button>`}
    </div>`;
}
INPUTS.tasteFind = el => {
  const m = matcher(el.value), box = $('#taste-find'); if (!box) return;
  if (!m) { box.innerHTML = ''; return; }
  const ws = S.wines.filter(w => kindOn(w) && m(w)).slice(0, 8);
  box.innerHTML = ws.length ? `<div class="list" style="margin-top:8px">${ws.map(w => {
    const n = wineBottles(w.id).length, last = S.tastings.filter(t => t.wineId === w.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0];
    return `<button class="li" data-act="tasteWine" data-w="${w.id}" data-session="${el.dataset.session}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small>${[n ? n + ' en cave' : '', last ? 'déjà dégusté · ' + numFr(last.note) + '/20' : ''].filter(Boolean).join(' · ') || esc(wineSub(w))}</small></div></button>`;
  }).join('')}</div>` : '<p class="small" style="margin:8px 4px 0">Aucun vin connu : utilise la photo ou la saisie manuelle.</p>';
};
Object.assign(ACT, {
  newTaste: t => showSheet(() => newTasteSheet(t.dataset?.session || null)),
  tasteWine: t => { closeSheet(); startTaste(t.dataset.w, null, 'quick', { sessionId: t.dataset.session || null }); },
  newTasteWine: t => { newDraft(t.dataset.kind); draft.forTaste = { sessionId: t.dataset.session || null }; showSheet(wineFormSheet, { full: true }); },
  scanTaste: t => { labelFor = { sessionId: t.dataset.session || null }; const i = $('#f-photo'); i.value = ''; i.click(); },
  degMode: t => { degMode = t.dataset.m; render(); },
  dfMin: () => { degF.min = !degF.min; render(); },
  dfSrc: t => { degF.src = degF.src === t.dataset.v ? 'all' : t.dataset.v; render(); },
  dfType: t => { degF.type = degF.type === t.dataset.v ? null : t.dataset.v; render(); },
  dfColor: t => { degF.color = degF.color === t.dataset.v ? null : t.dataset.v; render(); },
});

/* ---------- Séances ---------- */
function sessionForm(id) {
  const s = id ? byId(S.sessions, id) : { titre: '', type: 'salon', lieu: '', date: today(), convives: '' };
  return `${head(id ? 'Modifier la séance' : 'Nouvelle séance')}
    <form class="form" data-form="session" data-id="${id || ''}">
      <label>Titre<input name="titre" value="${esc(s.titre)}" required placeholder="Salon des vins de Loire, verticale de Morgon…" autocomplete="off"></label>
      <label>Type<select name="type">${Object.entries(TASTE_TYPES).map(([k, l]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="grid2"><label>Lieu<input name="lieu" value="${esc(s.lieu || '')}" autocomplete="off"></label><label>Date<input type="date" name="date" value="${esc(s.date || today())}"></label></div>
      <label>Convives<input name="convives" value="${esc(s.convives || '')}" autocomplete="off"></label>
      <button class="btn primary wide" type="submit">${id ? 'Enregistrer' : 'Démarrer la séance'}</button>
      ${id ? `<button class="btn danger wide" type="button" data-act="delSession" data-id="${id}">Supprimer la séance</button>` : ''}
    </form>`;
}
FORMS.session = async (f, d) => {
  if (formErrors(f, d.titre ? [] : [['titre', 'Donne un titre à la séance']])) return;
  const id = f.dataset.id, o = { titre: d.titre, type: d.type, lieu: d.lieu, date: d.date || today(), convives: d.convives };
  if (id) {
    Object.assign(byId(S.sessions, id), o);
    for (const t of S.tastings) if (t.sessionId === id) Object.assign(t, { at: o.date, type: o.type, lieu: o.lieu, convives: o.convives });
    await save(); sheetBack(); refreshSheet(); render();
  } else {
    const s = { id: uid(), ...o }; S.sessions.push(s);
    await save(); render(); showSheet(() => sessionSheet(s.id), { replace: true });
  }
};
function sessionSheet(id) {
  const s = byId(S.sessions, id); if (!s) return null;
  const ts = S.tastings.filter(t => t.sessionId === id).sort((a, b) => (b.note ?? -1) - (a.note ?? -1));
  return `${head(esc(s.titre), `<button class="icon-btn" data-act="editSession" data-id="${id}" aria-label="Modifier">${ICON.edit}</button>`)}
    <p class="small" style="margin-top:-6px">${s.type ? `<span class="tag o">${TASTE_TYPES[s.type]}</span> ` : ''}${[s.lieu, fmtDate(s.date), s.convives && 'avec ' + s.convives].filter(Boolean).map(esc).join(' · ')}</p>
    ${ts.length ? `<div class="sect">Classement de la séance</div><div class="list">${ts.map((t, i) => tasteRow(t, i + 1)).join('')}</div>` : '<p class="muted">Aucun vin pour l’instant.</p>'}
    <button class="btn primary wide" style="margin-top:12px" data-act="newTaste" data-session="${id}">${ICON.add} Ajouter un vin à la séance</button>
    ${ts.some(t => t.blind && !t.wineId) ? `<p class="tiny" style="margin-top:8px">${plural(ts.filter(t => t.blind && !t.wineId).length, 'vin mystère reste', 'vins mystère restent')} à révéler : touche-les pour les révéler.</p>` : ''}`;
}
Object.assign(ACT, {
  newSession: () => showSheet(() => sessionForm(null), { replace: true }),
  editSession: t => showSheet(() => sessionForm(t.dataset.id)),
  session: t => showSheet(() => sessionSheet(t.dataset.id)),
  delSession: async t => {
    if (!confirm('Supprimer cette séance ? Ses dégustations sont conservées, sans séance.')) return;
    for (const x of S.tastings) if (x.sessionId === t.dataset.id) x.sessionId = null;
    S.sessions = S.sessions.filter(s => s.id !== t.dataset.id);
    await save(); closeSheet(); render();
  },
});

/* ---------- Liste d'envies ---------- */
const isWished = wid => S.wishes.some(x => x.wineId === wid);
function wishSheet() {
  const ws = [...S.wishes].sort((a, b) => (b.at || '').localeCompare(a.at || '')).filter(x => wine(x.wineId));
  return `${head('Liste d’envies')}
    ${ws.length ? `<div class="list">${ws.map(x => { const w = wine(x.wineId), best = S.tastings.filter(t => t.wineId === w.id && t.note != null).sort((a, b) => b.note - a.note)[0];
      return `<div class="li"><span class="dot" style="background:${wineColor(w)}"></span><button class="it" style="background:none;border:0;padding:0;text-align:left" data-act="wine" data-id="${w.id}"><b class="ell">${esc(wineTitle(w))}</b>
        <small>${[best ? `dégusté ${numFr(best.note)}/20${best.lieu ? ' · ' + best.lieu : ''}` : '', x.prix != null ? '~' + eur(x.prix) : '', x.lieu].filter(Boolean).map(esc).join(' · ')}</small></button>
        <button class="btn small primary" data-act="wishBought" data-w="${w.id}">Acheté</button><button class="icon-btn" data-act="wishToggle" data-w="${w.id}" aria-label="Retirer">${ICON.close}</button></div>`; }).join('')}</div>
      <p class="tiny">« Acheté » ouvre l’ajout en cave sur la même fiche, avec son historique de dégustation.</p>`
    : '<p class="muted">Ta liste est vide. Après une dégustation, touche « Je veux en acheter ».</p>'}`;
}
Object.assign(ACT, {
  wishSheet: () => showSheet(wishSheet),
  wishToggle: async t => {
    const wid = t.dataset.w;
    if (isWished(wid)) { S.wishes = S.wishes.filter(x => x.wineId !== wid); toast('Retiré de la liste d’envies'); }
    else { const ts = t.dataset.t && byId(S.tastings, t.dataset.t); S.wishes.push({ id: uid(), wineId: wid, at: today(), prix: ts?.prix ?? null, lieu: ts?.achatLieu || '' }); toast('Ajouté à la liste d’envies'); }
    await save(); refreshSheet(); render();
  },
  wishBought: t => showSheet(() => addBottlesSheet(t.dataset.w)),
});
