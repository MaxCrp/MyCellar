/* ---------- À boire ---------- */
let boireCat = 'prio';
const drinkable = () => S.wines.filter(w => w.kind === 'vin' && !isFriend(w) && wineBottles(w.id).length);
function vBoire() {
  const ws = drinkable(), y = thisYear();
  if (!ws.length && !(spiritsOn() && openSpirits().length)) return `<div class="empty">${ICON.boire}<p>Ajoute des vins à ta cave : je te dirai lesquels boire en priorité.</p></div>`;
  const cnt = k => ws.filter(w => status(w) === k).reduce((n, w) => n + wineBottles(w.id).length, 0);
  const urgent = ws.filter(w => w.apogee?.fin && w.apogee.fin <= y);
  const nUrgent = urgent.reduce((n, w) => n + wineBottles(w.id).length, 0);
  const stockSites = new Set(S.sites.filter(s => s.role === 'stock').map(s => s.id));
  const away = isMulti() ? S.bottles.filter(b => b.state === 'cave' && stockSites.has(siteOfBottle(b)) && ['prio', 'declin'].includes(status(wine(b.wineId) || {})) && !isFriend(wine(b.wineId))) : [];
  const list = ws.filter(w => status(w) === boireCat).sort((a, b) => (a.apogee?.fin || 9999) - (b.apogee?.fin || 9999) || norm(wineName(a)).localeCompare(norm(wineName(b))));
  const from = y - 3, to = y + 12;
  const years = Array.from({ length: 6 }, (_, i) => y + i);
  const per = years.map((yy, i) => ws.filter(w => w.apogee?.fin && (i === 0 ? w.apogee.fin <= yy : i === 5 ? w.apogee.fin >= yy : w.apogee.fin === yy)).reduce((n, w) => n + wineBottles(w.id).length, 0));
  const max = Math.max(1, ...per);
  const unknown = ws.filter(w => status(w) === 'inconnu');
  return `${nUrgent ? `<div class="banner bx"><b>${plural(nUrgent, 'bouteille', 'bouteilles')} à boire d’ici la fin de ${y}</b>
      <div class="small" style="color:rgba(255,255,255,.88);margin-top:3px">${away.length ? `Dont ${away.length} sur ton site de stockage : pense à les rapatrier au prochain passage.` : 'Elles arrivent en fin de fenêtre de dégustation.'}</div>
      ${away.length ? `<button class="btn small" data-act="awayTransfer">${ICON.truck} Préparer le transfert</button>` : ''}</div>` : ''}
    <div class="kpis">${['prio', 'apogee', 'tot', 'declin'].map(k => `<button class="kpi${boireCat === k ? ' on' : ''}" data-act="boireCat" data-k="${k}"><b style="color:${STATUS[k].hex}">${cnt(k)}</b><span>${STATUS[k].short}</span></button>`).join('')}</div>
    ${unknown.length ? `<div class="card row"><div class="grow"><b style="font-size:14px">${plural(unknown.length, 'vin sans fenêtre', 'vins sans fenêtre')}</b><div class="small">Le sommelier peut les estimer en une fois.</div></div><button class="btn small" data-act="estimateMissing">${ICON.spark} Estimer</button></div>` : ''}
    <div class="sect">${STATUS[boireCat].label}</div>
    ${list.length ? `<div class="list">${list.map(w => `<button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(w.domaine || '')} · ${esc(windowLabel(w.apogee))}${isMulti() ? ' · ' + esc([...new Set(wineBottles(w.id).map(b => site(siteOfBottle(b))?.name))].join(', ')) : ''}</small>${winBar(w.apogee, from, to)}</div>
      <span class="qty">×${wineBottles(w.id).length}</span></button>`).join('')}</div>` : `<p class="muted small" style="margin:4px">Aucun vin dans cette catégorie.</p>`}
    <div class="sect">À boire avant la fin de…</div>
    <div class="card"><div class="bars" style="margin-top:14px">${per.map((n, i) => `<div style="height:${Math.max(3, n / max * 100)}%;background:${i === 0 ? 'var(--bx)' : i < 3 ? 'var(--green)' : 'var(--gold)'}"><span>${n || ''}</span></div>`).join('')}</div>
      <div class="barl">${years.map((yy, i) => `<span>${i === 5 ? yy + '+' : yy}</span>`).join('')}</div></div>
    ${spiritsOn() ? spiritsBlock() : ''}`;
}
const openSpirits = () => S.bottles.filter(b => b.state === 'open' && wine(b.wineId)?.kind === 'spirit' && !isFriend(wine(b.wineId)));
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
  awayTransfer: async () => {
    const stock = new Set(S.sites.filter(s => s.role === 'stock').map(s => s.id));
    const ids = S.bottles.filter(b => b.state === 'cave' && stock.has(siteOfBottle(b)) && ['prio', 'declin'].includes(status(wine(b.wineId) || {})) && !isFriend(wine(b.wineId))).map(b => b.id);
    for (const id of ids) if (!S.transfer.ids.includes(id)) S.transfer.ids.push(id);
    S.transfer.to = S.sites.find(s => s.role === 'conso')?.id || S.transfer.to;
    await save(); showSheet(transferSheet);
  },
});
