/* ---------- Statistiques et valeur estimée (v2.0) ----------
   Seules mes bouteilles sont comptées (pas celles des amis). Chaque barre se touche pour voir les vins concernés. */
let statsLists = new Map();
const TASTE_OUT = ['bue', 'bouchonnee', 'terminee'];
const valueOf = w => w.valeur?.v ?? null;
// Valeur d'une bouteille : valeur actuelle, sinon prix d'achat
const bottleValue = w => valueOf(w) ?? w.achat?.prix ?? null;
function caveValue() {
  const bs = S.bottles.filter(b => inCave(b) && !b.owner);
  let est = 0, buy = 0, nEst = 0, nBuy = 0, none = 0, cost = 0;
  for (const b of bs) {
    const w = wine(b.wineId); if (!w) continue;
    if (valueOf(w) != null) { est += valueOf(w); nEst++; if (w.achat?.prix != null) cost += w.achat.prix; }
    else if (w.achat?.prix != null) { buy += w.achat.prix; nBuy++; }
    else none++;
  }
  return { total: est + buy, est, buy, nEst, nBuy, none, n: bs.length, gain: nEst ? est - cost : null };
}
function hbars(rows, key) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<div class="hb">${rows.map((r, i) => { const k = key + ':' + i; statsLists.set(k, { title: r.label, ids: r.ids });
    return `<button class="hbr" data-act="statsPick" data-k="${esc(k)}"><span class="hl ell">${r.dot ? `<span class="dot" style="background:${r.dot}"></span>` : ''}${esc(r.label)}</span><span class="hbar"><i style="width:${Math.max(3, r.n / max * 100)}%;background:${r.c || 'var(--bx)'}"></i></span><span class="hn">${r.n}</span></button>`; }).join('')}</div>`;
}
// Regroupe des bouteilles (ou des sorties) par une clé ; ids = vins concernés
function groupBy(list, keyFn, wineOf = x => wine(x.wineId)) {
  const m = new Map();
  for (const x of list) { const w = wineOf(x); if (!w) continue; const k = keyFn(w, x); if (k == null || k === '') continue; const g = m.get(k) || { n: 0, ids: new Set() }; g.n++; g.ids.add(w.id); m.set(k, g); }
  return [...m].map(([label, g]) => ({ label: String(label), n: g.n, ids: [...g.ids] }));
}
const topN = (rows, n) => { rows.sort((a, b) => b.n - a.n); if (rows.length <= n) return rows; const rest = rows.slice(n); return [...rows.slice(0, n), { label: 'Autres', n: rest.reduce((t, r) => t + r.n, 0), ids: rest.flatMap(r => r.ids) }]; };
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function statsSheet() {
  statsLists = new Map();
  const mine = S.bottles.filter(b => inCave(b) && !b.owner), y = thisYear();
  if (!mine.length) return `${head('Statistiques')}<p class="muted">Ajoute des bouteilles pour voir tes statistiques.</p>`;
  const colorRows = groupBy(mine, w => w.kind === 'spirit' ? 'Spiritueux' : COLORS[w.couleur]?.label || 'Couleur inconnue').map(r => {
    const k = Object.keys(COLORS).find(c => COLORS[c].label === r.label); return { ...r, dot: k ? COLORS[k].c : r.label === 'Spiritueux' ? SPIRIT_COLOR : '#B9AFA6', c: k ? COLORS[k].c : SPIRIT_COLOR };
  }).sort((a, b) => b.n - a.n);
  const region = topN(groupBy(mine, w => w.region || (w.kind === 'spirit' ? null : 'Région non renseignée')), 8);
  const pays = topN(groupBy(mine, w => w.pays || 'Pays non renseigné'), 6);
  const mill = groupBy(mine, w => w.kind === 'spirit' ? null : w.millesime || 'Non millésimé').sort((a, b) => String(b.label).localeCompare(String(a.label)));
  const fmt = groupBy(mine, w => (FORMATS[w.kind] || FORMATS.vin).find(f => f[0] === w.format)?.[1] || 'Autre format').sort((a, b) => b.n - a.n);
  const stat = ['prio', 'apogee', 'tot', 'declin', 'inconnu'].map(k => { const g = groupBy(mine.filter(b => status(wine(b.wineId)) === k), () => STATUS[k].label)[0]; return g && { ...g, c: STATUS[k].hex, dot: STATUS[k].hex }; }).filter(Boolean);
  const where = groupBy(mine, (w, b) => { const sp = space(b.spaceId); return sp ? (S.sites.length > 1 ? site(sp.siteId)?.name + ' › ' : '') + sp.name : null; }).sort((a, b) => b.n - a.n);
  // Consommation : 12 derniers mois
  const outs = S.moves.filter(m => m.type === 'out' && TASTE_OUT.includes(m.motif) && !byId(S.bottles, m.bottleId)?.owner);
  const now = new Date(), months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return d.toISOString().slice(0, 7); });
  const perMonth = months.map(mo => outs.filter(m => (m.at || '').startsWith(mo)));
  const maxM = Math.max(1, ...perMonth.map(l => l.length));
  perMonth.forEach((l, i) => statsLists.set('mois:' + i, { title: 'Bues en ' + MONTHS[+months[i].slice(5) - 1] + ' ' + months[i].slice(0, 4), ids: [...new Set(l.map(m => m.wineId))] }));
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10), year = outs.filter(m => (m.at || '') >= since);
  const drunkColor = groupBy(year, w => w.kind === 'spirit' ? 'Spiritueux' : COLORS[w.couleur]?.label || '?').sort((a, b) => b.n - a.n);
  const notes = S.tastings.filter(t => t.note != null && wine(t.wineId)), avg = notes.length ? notes.reduce((t, x) => t + x.note, 0) / notes.length : null;
  const best = new Map(); for (const t of notes) if (!best.has(t.wineId) || best.get(t.wineId) < t.note) best.set(t.wineId, t.note);
  const top = [...best].sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Achats : bouteilles entrées (les miennes), par année
  const bought = S.bottles.filter(b => !b.owner && b.addedAt && wine(b.wineId));
  const byYear = groupBy(bought, (w, b) => b.addedAt.slice(0, 4)).sort((a, b) => b.label.localeCompare(a.label)).slice(0, 6);
  const spend = yy => bought.filter(b => b.addedAt.startsWith(yy)).reduce((t, b) => t + (wine(b.wineId).achat?.prix || 0), 0);
  const priced = bought.filter(b => wine(b.wineId).achat?.prix != null), avgPrice = priced.length ? priced.reduce((t, b) => t + wine(b.wineId).achat.prix, 0) / priced.length : null;
  const lieux = topN(groupBy(bought, w => w.achat?.lieu || null), 5);
  const v = caveValue();
  return `${head('Statistiques')}
    <div class="card"><div class="grid2" style="text-align:center">
      <div><div class="score" style="font-size:26px">${mine.length}</div><div class="small">bouteilles à moi</div></div>
      <div><div class="score" style="font-size:22px">${v.total ? eur(v.total) : '–'}</div><div class="small">valeur de la cave</div></div></div>
      <p class="tiny" style="margin:8px 0 0;text-align:center">${v.nEst ? `${plural(v.nEst, 'bouteille estimée', 'bouteilles estimées')}, ` : ''}${v.nBuy ? `${plural(v.nBuy, 'bouteille', 'bouteilles')} au prix d’achat` : ''}${v.none ? `, ${v.none} sans prix` : ''}${v.gain != null ? ` · ${v.gain >= 0 ? '+' : ''}${eur(v.gain)} par rapport à l’achat sur les vins estimés` : ''}</p>
      <button class="btn small wide" style="margin-top:10px" data-act="valueBatch">${ICON.spark} Estimer la valeur des vins sans estimation</button></div>
    <div class="sect">La cave aujourd’hui</div>
    <div class="card"><div class="ct">Par couleur</div>${hbars(colorRows, 'coul')}</div>
    <div class="card"><div class="ct">Par statut${spiritsOn() ? ' (vins)' : ''}</div>${hbars(stat, 'stat')}</div>
    <div class="card"><div class="ct">Par région</div>${hbars(region, 'reg')}</div>
    <div class="card"><div class="ct">Par pays</div>${hbars(pays, 'pays')}</div>
    <div class="card"><div class="ct">Par millésime</div>${hbars(mill, 'mill')}</div>
    <div class="card"><div class="ct">Par format</div>${hbars(fmt, 'fmt')}</div>
    <div class="card"><div class="ct">Par emplacement</div>${hbars(where, 'ou')}</div>
    <div class="sect">Consommation</div>
    <div class="card"><div class="ct">Bues ces 12 derniers mois <span class="small">${year.length}</span></div>
      <div class="bars" style="margin-top:14px">${perMonth.map((l, i) => `<button style="height:${Math.max(3, l.length / maxM * 100)}%;background:var(--bx)" ${l.length ? `data-act="statsPick" data-k="mois:${i}"` : 'disabled'} aria-label="${MONTHS[+months[i].slice(5) - 1]} : ${l.length}"><span>${l.length || ''}</span></button>`).join('')}</div>
      <div class="barl">${months.map(mo => `<span>${MONTHS[+mo.slice(5) - 1].slice(0, 1).toUpperCase()}</span>`).join('')}</div>
      <p class="small" style="margin:10px 0 0">Rythme : ${plural(year.length, 'bouteille', 'bouteilles')} par an${avg != null ? ` · note moyenne ${numFr(avg)} / 20` : ''}.</p></div>
    ${drunkColor.length ? `<div class="card"><div class="ct">Bues par couleur (12 mois)</div>${hbars(drunkColor, 'bc')}</div>` : ''}
    ${top.length ? `<div class="card"><div class="ct">Les mieux notés</div><div class="list" style="margin-top:6px">${top.map(([wid, n]) => { const w = wine(wid); return `<button class="li" data-act="wine" data-id="${wid}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}</small></div>${noteBadge(n)}</button>`; }).join('')}</div></div>` : ''}
    <div class="sect">Achats</div>
    <div class="card"><div class="ct">Bouteilles entrées par année</div>${hbars(byYear.map(r => ({ ...r, label: `${r.label} · ${spend(r.label) ? eur(spend(r.label)) : 'prix inconnu'}` })), 'an')}
      ${avgPrice != null ? `<p class="small" style="margin:10px 0 0">Prix moyen : ${fmtE2.format(avgPrice)} la bouteille.</p>` : ''}</div>
    ${lieux.length ? `<div class="card"><div class="ct">Lieux d’achat</div>${hbars(lieux, 'lieu')}</div>` : ''}`;
}
function statsListSheet(k) {
  const l = statsLists.get(k); if (!l) return null;
  const ws = l.ids.map(wine).filter(Boolean).sort((a, b) => norm(wineName(a)).localeCompare(norm(wineName(b))));
  return `${head(esc(l.title))}<div class="list">${ws.map(w => wineRow(w)).join('') || '<p class="muted small" style="padding:12px">Aucun vin.</p>'}</div>`;
}

/* Valeur actuelle d'un vin : à la main, ou estimée par le sommelier (recherche web), à la demande */
const VAL_SYS = `Tu es un expert du marché du vin en France. On te donne un vin d’une cave personnelle.
Estime sa valeur actuelle de revente ou de rachat chez un caviste, en euros par bouteille, dans son format.
Si un outil de recherche web est disponible, fais une ou deux recherches ciblées (cotes, prix chez les cavistes, enchères récentes) avant de conclure.
Termine ta réponse par un bloc JSON : {"valeur": nombre, "min": nombre, "max": nombre, "justification": "une ou deux phrases en français", "confiance": "haute|moyenne|faible"}.`;
async function estimateValue(wid, { quiet = false } = {}) {
  const w = wine(wid); if (!w) return false;
  if (!quiet) toast('Le sommelier estime la valeur…');
  try {
    const r = await aiCall({ tag: 'valeur', system: VAL_SYS, content: wineBrief(w) + (w.achat?.prix != null ? `\nPrix d’achat : ${w.achat.prix} €` : ''), maxTokens: 4000, effort: 'low', web: aiClaude() && aiCfg().web });
    const j = lastJson(r.text), v = num(j?.valeur), lo = num(j?.min), hi = num(j?.max);
    if (v == null || v <= 0 || v > 100000) throw new AIError('Estimation illisible ou impossible. Réessaie, ou saisis la valeur à la main.');
    w.valeur = { v: Math.round(v * 100) / 100, min: lo > 0 && lo <= v ? lo : null, max: hi >= v && hi < 200000 ? hi : null, src: 'ia', why: String(j.justification || '').slice(0, 300), conf: j.confiance, sources: r.sources.slice(0, 3), at: Date.now() };
    await save(); render(); if (sheetStack.length) refreshSheet();
    if (!quiet) toast(`Valeur estimée : ${eur(w.valeur.v)}`);
    return true;
  } catch (e) {
    if (quiet) throw e;
    errSheet('Estimation impossible', e.message || String(e));
    return false;
  }
}
function valueCard(w) {
  const v = w.valeur, buy = w.achat?.prix, diff = v && buy ? (v.v - buy) / buy * 100 : null;
  return `<div class="card"><div class="ct">Valeur actuelle ${v ? `<span class="tag">${v.src === 'ia' ? 'estimée par le sommelier' : 'saisie manuelle'}</span>` : ''}</div>
    ${v ? `<div class="score" style="font-size:22px;text-align:left">${fmtE2.format(v.v)}${v.min && v.max ? `<small> · ${eur(v.min)} à ${eur(v.max)}</small>` : ''}</div>
      <p class="small" style="margin:4px 0 0">${diff != null ? `${diff >= 0 ? '+' : ''}${Math.round(diff)} % par rapport au prix d’achat (${fmtE2.format(buy)}) · ` : ''}${esc(fmtDate(new Date(v.at).toISOString().slice(0, 10)))}</p>
      ${v.why ? `<p class="small" style="margin:6px 0 0">${esc(v.why)}</p>` : ''}` : `<p class="small" style="margin:0">Pas encore de valeur${buy != null ? ` : le prix d’achat (${fmtE2.format(buy)}) compte dans la valeur de la cave` : ''}.</p>`}
    <div class="btns2" style="margin-top:10px"><button class="btn small" data-act="valueEstimate" data-id="${w.id}">${ICON.spark} ${v ? 'Réestimer' : 'Estimer'}</button><button class="btn small" data-act="valueEdit" data-id="${w.id}">Saisir</button></div></div>`;
}
function valueEditSheet(wid) {
  const w = wine(wid); if (!w) return null;
  return `${head('Valeur actuelle')}<p class="small" style="margin-top:-6px">${esc(wineTitle(w))}</p>
    <form class="form" data-form="valueEdit" data-w="${wid}"><label>Valeur par bouteille (€)<input name="v" inputmode="decimal" value="${esc(numFr(w.valeur?.v, 2))}" placeholder="Vide = aucune valeur"></label>
      <button class="btn primary wide" type="submit">Enregistrer</button></form>`;
}
FORMS.valueEdit = async (f, d) => {
  const w = wine(f.dataset.w), raw = String(d.v || '').trim(), v = raw ? num(raw) : null;
  if (raw && (v == null || v < 0 || v > 100000)) return formErrors(f, [['v', 'Une valeur entre 0 et 100 000 €']]);
  w.valeur = v == null ? null : { v, src: 'manuel', at: Date.now() };
  await save(); sheetBack(); refreshSheet(); render(); toast(v == null ? 'Valeur effacée' : 'Valeur enregistrée');
};
// Estimation groupée : coût annoncé avant, arrêt au plafond mensuel
const valueTodo = () => S.wines.filter(w => !w.valeur && S.bottles.some(b => b.wineId === w.id && inCave(b) && !b.owner));
Object.assign(ACT, {
  statsSheet: () => showSheet(statsSheet, { full: true }),
  statsPick: t => showSheet(() => statsListSheet(t.dataset.k)),
  valueEstimate: t => { if (!aiReady()) return sheetMsg('Valeur', 'Ajoute une clé IA dans Réglages › Intelligence artificielle, ou saisis la valeur à la main.'); return estimateValue(t.dataset.id); },
  valueEdit: t => showSheet(() => valueEditSheet(t.dataset.id)),
  valueBatch: () => {
    const l = valueTodo();
    if (!l.length) return toast('Tous tes vins ont déjà une valeur');
    if (!aiReady()) return sheetMsg('Valeur', 'Ajoute une clé IA dans Réglages › Intelligence artificielle, ou saisis les valeurs à la main sur chaque fiche.');
    const cost = l.length * 0.015 * (S.settings.rate || 0.92), left = Math.max(0, aiCfg().budget - monthSpend());
    showSheet(() => `${head('Estimer la valeur')}<p>${plural(l.length, 'vin n’a', 'vins n’ont')} pas encore de valeur. Le sommelier les estime un par un, avec une recherche web.</p>
      <p class="small">Coût indicatif : environ ${fmtE2.format(cost)} (il te reste ${fmtE2.format(left)} ce mois-ci). L’estimation s’arrête si le plafond mensuel est atteint.</p>
      <button class="btn primary wide" data-act="valueBatchGo">Lancer l’estimation</button>`);
  },
  valueBatchGo: async () => {
    const l = valueTodo(); let ok = 0, stop = '';
    for (const [i, w] of l.entries()) {
      showSheet(() => `${head('Estimation en cours')}<p>${i + 1} / ${l.length} · ${esc(wineTitle(w))}</p><div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`, { replace: true });
      try { if (await estimateValue(w.id, { quiet: true })) ok++; }
      catch (e) { if (/Plafond/.test(e.message || '')) { stop = e.message; break; } }
    }
    showSheet(() => `${head('Estimation terminée')}<p>${plural(ok, 'vin estimé', 'vins estimés')} sur ${l.length}.</p>${stop ? `<p class="small">${esc(stop)}</p>` : ''}<button class="btn wide" data-act="close">Fermer</button>`, { replace: true });
  },
});
