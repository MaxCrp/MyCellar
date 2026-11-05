/* ---------- À boire ---------- */
let boireCat = 'prio', boireBar = null;
const drinkable = () => S.wines.filter(w => w.kind === 'vin' && myBottles(w.id).length);
function vBoire() {
  const ws = drinkable(), y = thisYear();
  if (!ws.length && !(spiritsOn() && openSpirits().length)) return `<div class="empty">${ICON.boire}<p>Ajoute des vins à ta cave : je te dirai lesquels boire en priorité.</p></div>`;
  const cnt = k => ws.filter(w => status(w) === k).reduce((n, w) => n + myBottles(w.id).length, 0);
  const urgent = ws.filter(w => w.apogee?.fin && w.apogee.fin <= y);
  const nUrgent = urgent.reduce((n, w) => n + myBottles(w.id).length, 0);
  const stockSites = new Set(S.sites.filter(s => s.role === 'stock').map(s => s.id));
  const away = isMulti() ? S.bottles.filter(b => b.state === 'cave' && stockSites.has(siteOfBottle(b)) && ['prio', 'declin'].includes(status(wine(b.wineId) || {})) && !b.owner) : [];
  const list = ws.filter(w => status(w) === boireCat).sort((a, b) => (a.apogee?.fin || 9999) - (b.apogee?.fin || 9999) || norm(wineName(a)).localeCompare(norm(wineName(b))));
  const from = y - 3, to = y + 12;
  const years = Array.from({ length: 6 }, (_, i) => y + i);
  const per = years.map((yy, i) => ws.filter(w => w.apogee?.fin && (i === 0 ? w.apogee.fin <= yy : i === 5 ? w.apogee.fin >= yy : w.apogee.fin === yy)).reduce((n, w) => n + myBottles(w.id).length, 0));
  const max = Math.max(1, ...per);
  const unknown = ws.filter(w => status(w) === 'inconnu');
  return `${nUrgent ? `<div class="banner bx"><b>${plural(nUrgent, 'bouteille', 'bouteilles')} à boire d’ici la fin de ${y}</b>
      <div class="small" style="color:rgba(255,255,255,.88);margin-top:3px">${away.length ? `Dont ${away.length} sur ton site de stockage : pense à les rapatrier au prochain passage.` : 'Elles arrivent en fin de fenêtre de dégustation.'}</div>
      ${away.length ? `<button class="btn small" data-act="awayTransfer">${ICON.truck} Préparer le transfert</button>` : ''}</div>` : ''}
    ${(() => { const n = moveAdvice().reduce((t, x) => t + x.ids.length, 0); return n ? `<button class="card tap row" style="width:100%;text-align:left" data-act="adviceSheet">${ICON.move}<div class="grow"><b style="font-size:14px">Conseils de rangement</b><div class="small">${plural(n, 'bouteille à déplacer', 'bouteilles à déplacer')}</div></div><span class="chev">${ICON.chev}</span></button>` : ''; })()}
    <button class="card tap row" style="width:100%;text-align:left" data-act="auditSheet">${ICON.spark}<div class="grow"><b style="font-size:14px">Audit de ma cave</b><div class="small">Équilibre, années de maturité, suggestions d’achat${S.audit?.at ? ' · dernier audit le ' + esc(fmtDate(new Date(S.audit.at).toISOString().slice(0, 10))) : ''}</div></div><span class="chev">${ICON.chev}</span></button>
    <div class="kpis">${['prio', 'apogee', 'tot', 'declin'].map(k => `<button class="kpi${boireCat === k ? ' on' : ''}" data-act="boireCat" data-k="${k}"><b style="color:${STATUS[k].hex}">${cnt(k)}</b><span>${STATUS[k].short}</span></button>`).join('')}</div>
    ${unknown.length ? `<div class="card row"><div class="grow"><b style="font-size:14px">${plural(unknown.length, 'vin sans fenêtre', 'vins sans fenêtre')}</b><div class="small">Le sommelier peut les estimer en une fois.</div></div><button class="btn small" data-act="estimateMissing">${ICON.spark} Estimer</button></div>` : ''}
    <div class="sect">${STATUS[boireCat].label}</div>
    ${list.length ? `<div class="list">${list.map(w => `<button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(w.domaine || '')} · ${esc(windowLabel(w.apogee))}${isMulti() ? ' · ' + esc([...new Set(myBottles(w.id).map(b => site(siteOfBottle(b))?.name))].join(', ')) : ''}</small>${winBar(w.apogee, from, to)}</div>
      <span class="qty">×${myBottles(w.id).length}</span></button>`).join('')}</div>` : `<p class="muted small" style="margin:4px">Aucun vin dans cette catégorie.</p>`}
    <div class="sect">À boire avant la fin de…</div>
    <div class="card"><div class="bars${boireBar != null && per[boireBar] ? ' sel' : ''}" style="margin-top:14px">${per.map((n, i) => `<button class="${boireBar === i && n ? 'on' : ''}" style="height:${Math.max(3, n / max * 100)}%;background:${i === 0 ? 'var(--bx)' : i < 3 ? 'var(--green)' : 'var(--gold)'}" ${n ? `data-act="boireBar" data-i="${i}"` : 'disabled'} aria-label="${i === 5 ? 'À partir de ' + years[i] : 'Fin ' + years[i]} : ${plural(n, 'bouteille', 'bouteilles')}"><span>${n || ''}</span></button>`).join('')}</div>
      <div class="barl">${years.map((yy, i) => `<span>${i === 5 ? yy + '+' : yy}</span>`).join('')}</div>
      ${boireBar != null && per[boireBar] ? barDetail(ws, years, boireBar, away) : `<p class="tiny" style="margin:8px 0 0">Touche une barre pour voir les bouteilles.</p>`}</div>
    ${spiritsOn() ? spiritsBlock() : ''}`;
}
// Détail d'une barre : les vins, puis l'emplacement de chaque bouteille
function barDetail(ws, years, i, away) {
  const y = years[0], yy = years[i];
  const list = ws.filter(w => w.apogee?.fin && (i === 0 ? w.apogee.fin <= yy : i === 5 ? w.apogee.fin >= yy : w.apogee.fin === yy))
    .sort((a, b) => a.apogee.fin - b.apogee.fin || norm(wineName(a)).localeCompare(norm(wineName(b))));
  const n = list.reduce((t, w) => t + myBottles(w.id).length, 0), multi = isMulti();
  return `<div class="bar-detail"><div class="ct" style="margin:14px 0 0">${i === 5 ? `À boire à partir de ${yy}` : `À boire avant la fin de ${yy}`} · ${plural(n, 'bouteille', 'bouteilles')}</div>
    ${i === 0 && away.length ? `<button class="btn small" style="margin-top:8px" data-act="awayTransfer">${ICON.truck} Préparer le transfert</button>` : ''}
    ${list.map(w => { const st = status(w), late = w.apogee.fin < y;
      return `<div class="list res"><button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span>
        <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(windowLabel(w.apogee))} · <span style="color:${STATUS[late ? 'declin' : st].hex};font-weight:600">${late ? 'en déclin' : esc(STATUS[st].short)}</span></small></div><span class="qty">×${myBottles(w.id).length}</span></button>
        ${locGroups(myBottles(w.id)).map(g => `<button class="li loc" data-act="caveJump" data-b="${g.b.id}">${ICON.pin}<div class="it"><b>${esc(locLabel(g.b, multi))}</b></div>${g.n > 1 ? `<span class="qty">×${g.n}</span>` : ''}<span class="chev">${ICON.chev}</span></button>`).join('')}</div>`; }).join('')}</div>`;
}
const openSpirits = () => S.bottles.filter(b => b.state === 'open' && wine(b.wineId)?.kind === 'spirit' && !b.owner);
function spiritsBlock() {
  const os = openSpirits();
  if (!os.length) return '';
  const age = b => b.openedAt ? (Date.now() - new Date(b.openedAt).getTime()) / (365.25 * 864e5) : 0;
  const finish = b => (b.level ?? 100) <= 30 || ((b.level ?? 100) <= 50 && age(b) > 1);
  const sorted = [...os].sort((a, b) => (finish(b) - finish(a)) || (a.level ?? 100) - (b.level ?? 100));
  return `<div class="sect">Spiritueux ouverts</div><div class="list">${sorted.map(b => { const w = wine(b.wineId); return `<button class="li" data-act="bottle" data-b="${b.id}">
    <span class="bottle-level"><i style="height:${b.level ?? 100}%"></i></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small>${b.level ?? 100} % · ouvert ${b.openedAt ? 'le ' + esc(fmtDate(b.openedAt)) : ''}${finish(b) ? ' · <span style="color:var(--bx);font-weight:600">à finir</span>' : ''}</small></div><span class="chev">${ICON.chev}</span></button>`; }).join('')}</div>
    <p class="tiny" style="margin:6px 4px">Une bouteille entamée s’oxyde lentement : quand le niveau baisse, mieux vaut la finir dans l’année.</p>`;
}
Object.assign(ACT, {
  boireCat: t => { boireCat = t.dataset.k; render(); },
  boireBar: t => { const i = +t.dataset.i; boireBar = boireBar === i ? null : i; render(); },
  awayTransfer: async () => {
    const stock = new Set(S.sites.filter(s => s.role === 'stock').map(s => s.id));
    const ids = S.bottles.filter(b => b.state === 'cave' && stock.has(siteOfBottle(b)) && ['prio', 'declin'].includes(status(wine(b.wineId) || {})) && !b.owner).map(b => b.id);
    const to = S.sites.find(s => s.role === 'conso')?.id;
    for (const b of ids.map(id => byId(S.bottles, id))) if (!S.transfer.ids.includes(b.id)) transferAdd([b.id], to && to !== siteOfBottle(b) ? to : null);
    await save(); showSheet(transferSheet);
  },
});

/* ---------- Conseils de rangement (v1.5) ----------
   Trois règles, sans IA :
   1. « Rapatrier » : un vin à boire en priorité qui dort dans un espace de garde → vers un espace de consommation ;
   2. « Mettre en garde » : un vin de longue garde dans un espace de consommation, ou dans une cave de moindre qualité
      qu'une autre disponible → vers le meilleur espace de garde ;
   3. « Réassort » : un espace de consommation avec un nombre de places cible, en dessous de sa cible
      → on le complète avec les vins prêts à boire des espaces de garde (les plus urgents d'abord). */
function moveAdvice() {
  const y = thisYear(), out = [], taken = new Set();
  const sps = S.spaces.map(s => ({ s, q: spaceQuality(s), site: site(s.siteId), known: Object.keys(s.q || {}).length > 0 }));
  const conso = sps.filter(o => o.s.use === 'conso'), garde = sps.filter(o => o.s.use !== 'conso');
  const bestConso = () => conso.sort((a, b) => (b.site?.role === 'conso') - (a.site?.role === 'conso') || (b.s.siteId === S.settings.site) - (a.s.siteId === S.settings.site))[0];
  const bestGarde = () => garde.filter(o => o.known).sort((a, b) => b.q - a.q)[0] || garde[0];
  const push = (kind, w, bs, to, why) => { if (!bs.length || !to) return; bs.forEach(b => taken.add(b.id)); out.push({ kind, w, ids: bs.map(b => b.id), from: bs[0].spaceId, to: to.s.id, why }); };
  const groups = new Map();
  for (const b of S.bottles) if (b.state === 'cave' && b.spaceId && !b.owner && !S.transfer.ids.includes(b.id)) { const k = b.wineId + '|' + b.spaceId; groups.set(k, [...(groups.get(k) || []), b]); }
  for (const [, bs] of groups) {
    const w = wine(bs[0].wineId); if (!w || w.kind === 'spirit') continue;
    const sp = sps.find(o => o.s.id === bs[0].spaceId); if (!sp) continue;
    const st = status(w), a = w.apogee;
    if (st === 'prio' && sp.s.use !== 'conso') { const to = bestConso(); push('rapatrier', w, bs, to, `À boire avant fin ${a.fin}`); continue; }
    const longue = st === 'tot' || (a?.fin && a.fin - y >= 6);
    if (longue) {
      const to = bestGarde();
      if (to && to.s.id !== sp.s.id && (sp.s.use === 'conso' || (sp.known && to.q > sp.q + 1)))
        push('garde', w, bs, to, sp.s.use === 'conso' ? `Vin de garde (jusqu’en ${a?.fin || '?'}) rangé dans un espace de consommation` : `Cave plus adaptée à la garde (qualité ${qualityLabel(to.q).toLowerCase()})`);
    }
  }
  // Réassort des espaces de consommation qui ont une cible
  for (const c of conso) {
    const target = c.s.target; if (!target) continue;
    const have = S.bottles.filter(b => inCave(b) && b.spaceId === c.s.id).length + out.filter(o => o.to === c.s.id).reduce((n, o) => n + o.ids.length, 0);
    let missing = target - have; if (missing <= 0) continue;
    const cands = S.bottles.filter(b => b.state === 'cave' && !taken.has(b.id) && !S.transfer.ids.includes(b.id) && garde.some(g => g.s.id === b.spaceId))
      .filter(b => !b.owner).map(b => ({ b, w: wine(b.wineId) })).filter(o => o.w && o.w.kind === 'vin' && ['prio', 'apogee'].includes(status(o.w)))
      .sort((p, q) => (p.w.apogee?.fin || 9999) - (q.w.apogee?.fin || 9999));
    const by = new Map();
    for (const { b, w } of cands) { if (missing <= 0) break; const k = w.id + '|' + b.spaceId; by.set(k, [...(by.get(k) || []), b]); missing--; }
    for (const [, bs] of by) push('reassort', wine(bs[0].wineId), bs, c, `Réassort de « ${c.s.name} » (cible ${target} bouteilles)`);
  }
  return out;
}
const ADVICE_KIND = { rapatrier: 'À rapprocher', garde: 'À mettre en garde', reassort: 'Réassort' };
function adviceSheet() {
  const adv = moveAdvice();
  const where = id => { const sp = space(id); return sp ? (isMulti() ? site(sp.siteId)?.name + ' › ' : '') + sp.name : '?'; };
  return `${head('Conseils de rangement')}
    <p class="small" style="margin-top:-6px">Selon les fenêtres de dégustation, l’usage de chaque espace et ses conditions de stockage${S.spaces.some(s => s.target) ? ', et les places cibles des espaces de consommation' : ''}.</p>
    ${adv.length ? Object.keys(ADVICE_KIND).map(k => { const l = adv.filter(a => a.kind === k); return l.length ? `<h3>${ADVICE_KIND[k]}</h3><div class="list">${l.map(a => {
      const cross = space(a.from)?.siteId !== space(a.to)?.siteId, i = adv.indexOf(a);
      return `<div class="li"><button class="lb" data-act="tBrief" data-b="${a.ids[0]}"><span class="dot" style="background:${wineColor(a.w)}"></span><div class="it"><b class="ell">${esc(wineTitle(a.w))} ×${a.ids.length}</b><small>${esc(where(a.from))} → <b style="color:var(--green)">${esc(where(a.to))}</b></small><small>${esc(a.why)}</small></div></button>
        <button class="btn small ${cross ? '' : 'primary'}" data-act="adviceGo" data-i="${i}">${cross ? 'Au transfert' : 'Ranger'}</button></div>`; }).join('')}</div>` : ''; }).join('')
    : '<p class="muted">Rien à déplacer pour l’instant : chaque vin est au bon endroit.</p>'}
    ${!S.spaces.some(s => Object.keys(s.q || {}).length) ? '<p class="tiny">Astuce : renseigne les conditions de stockage de tes espaces (Réglages › Sites, espaces et meubles) pour des conseils plus fins.</p>' : ''}`;
}
Object.assign(ACT, {
  adviceSheet: () => showSheet(adviceSheet),
  adviceGo: async t => {
    const a = moveAdvice()[+t.dataset.i]; if (!a) return refreshSheet();
    if (space(a.from)?.siteId !== space(a.to)?.siteId) {
      transferAdd(a.ids, space(a.to).siteId); await save(); refreshSheet(); render(); return toast(`Ajouté au transfert vers ${site(space(a.to).siteId)?.name || ''}`);
    }
    startPlace(a.w.id, a.ids, a.to, false);
  },
});
