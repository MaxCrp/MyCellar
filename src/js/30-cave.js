/* ---------- Vue Cave ---------- */
let caveMode = 'plan', caveSpace = null, caveQuery = '', caveJumped = false, caveSearchOpen = false;
// Filtres de la liste (v2.1.3) : dans un groupe les choix s'additionnent, entre groupes ils se combinent
const caveF = { st: new Set(), col: new Set(), site: new Set(), reg: new Set(), y: new Set(), own: new Set() };

const visibleSpaces = () => isMulti() ? siteSpaces(S.settings.site) : S.spaces;
function wineText(w) {
  return norm([w.domaine, w.cuvee, w.appellation, w.region, w.pays, w.millesime, w.cepages, COLORS[w.couleur]?.label, SPIRIT_CATS[w.cat], ...new Set(heldBottles(w.id).map(b => b.owner).filter(Boolean)), w.notes, w.short].filter(Boolean).join(' '));
}
function matcher(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  const cache = new Map();
  return w => { if (!cache.has(w.id)) { const t = wineText(w); cache.set(w.id, toks.every(k => t.includes(k))); } return cache.get(w.id); };
}

function caveTools() {
  return `<div class="seg">${[['plan', 'Plan'], ['liste', 'Liste']].map(([k, l]) => `<button class="${caveMode === k ? 'on' : ''}" data-act="caveMode" data-m="${k}">${l}</button>`).join('')}</div>
    <div id="cstrip">${caveMode === 'liste' ? listBar() : unitStrip()}</div>`;
}

/* ---------- Recherche flottante (v2.1.3) ---------- */
// Une loupe ronde au-dessus de la barre d'onglets ; le champ s'ouvre en bas, juste au-dessus du clavier
function caveSearchUI() {
  if (!caveSearchOpen) return `<button class="sfab${caveQuery ? ' dot' : ''}" data-act="searchOpen" aria-label="Rechercher">${ICON.search}</button>`;
  return `<div class="csearch"><div class="in"><div class="search">${ICON.search}<input type="search" placeholder="Vin, domaine, millésime…" value="${esc(caveQuery)}" data-in="caveSearch" autocomplete="off" enterkeyhint="search" aria-label="Rechercher">${sx(caveQuery)}</div>
    <button class="cancel" data-act="searchCancel">Annuler</button></div></div>`;
}
function placeSearch() {
  const vv = window.visualViewport, bar = $('.csearch'); if (!vv || !bar) return;
  const kb = innerHeight - vv.height - vv.offsetTop;
  bar.style.bottom = kb > 80 ? kb + 'px' : '';
}
window.visualViewport?.addEventListener('resize', placeSearch);
window.visualViewport?.addEventListener('scroll', placeSearch);

/* ---------- Aperçu des meubles (v2.1.3) ---------- */
// Barre sous « Plan / Liste » : chaque meuble du site en miniature, regroupés par espace ; toucher = aller au meuble
let occMemo = null, uActive = null, spyLock = 0, spyRaf = 0;
const stripUnits = id => { const us = spaceUnits(id); return [...us.filter(u => !UNIT_TYPES[u.type].box), ...us.filter(u => UNIT_TYPES[u.type].box).sort((a, b) => String(a.pile || '').localeCompare(String(b.pile || '')) || (b.level || 0) - (a.level || 0))]; };
function unitStrip() {
  if (caveMode !== 'plan' || (matcher(caveQuery) && !caveJumped)) return '';
  const occ = occMemo || occupancy(), groups = visibleSpaces().map(sp => ({ sp, units: stripUnits(sp.id) })).filter(g => g.units.length);
  if (groups.reduce((t, g) => t + g.units.length, 0) < 2) return '';
  return `<div class="ustrip" aria-label="Aperçu des meubles">${groups.map((g, i) => `${i ? '<span class="usep"></span>' : ''}<div class="ugrp"><div class="ugl">${esc(g.sp.name)}</div>
    <div class="ugu">${g.units.map(u => uMini(u, occ)).join('')}</div></div>`).join('')}</div>`;
}
const r2 = x => Math.round(x * 100) / 100;
function gridArt(u, occ) {
  // Taille des pastilles : la grille entière tient dans 104 × 40 points ; espacement réduit pour les grands meubles
  const fit = g => Math.min(5, (104 - (u.cols - 1) * g) / u.cols, (40 - (u.rows - 1) * g) / u.rows);
  const g = fit(1) < 2.2 ? .5 : 1, sz = Math.max(1.2, fit(g));
  const W = r2(u.cols * sz + (u.cols - 1) * g), H = r2(u.rows * sz + (u.rows - 1) * g), rx = r2(sz / 3.5);
  let out = '';
  for (let r = 0; r < u.rows; r++) for (let c = 0; c < u.cols; c++) {
    const b = occ.get(`${u.id}:${r}:${c}`), x = r2(c * (sz + g)), y = r2(r * (sz + g));
    if (!b) { out += `<rect x="${r2(x + .3)}" y="${r2(y + .3)}" width="${r2(sz - .6)}" height="${r2(sz - .6)}" rx="${rx}" style="fill:none;stroke:var(--line);stroke-width:.6"/>`; continue; }
    const w = wine(b.wineId);
    out += `<rect x="${x}" y="${y}" width="${r2(sz)}" height="${r2(sz)}" rx="${rx}" style="fill:${w && kindOn(w) ? wineColor(w) : 'var(--line)'}"/>`;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out}</svg>`;
}
function boxArt(u, occ) {
  const bs = boxContents(u, occ), n = capacity(u), cols = n <= 6 ? 3 : n <= 12 ? 4 : 6, rows = Math.ceil(n / cols), d = 6;
  const w = bs.length ? wine(bs[0].wineId) : null, col = w && kindOn(w) ? wineColor(w) : 'var(--line)';
  const W = cols * d + 4, H = rows * d + 4;
  let out = `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="3" style="fill:#F6EEE2;stroke:#B99B72;stroke-width:1.5"/>`;
  for (let i = 0; i < n; i++) { const cx = 2 + (i % cols) * d + d / 2, cy = 2 + Math.floor(i / cols) * d + d / 2;
    out += i < bs.length ? `<circle cx="${cx}" cy="${cy}" r="2.3" style="fill:${col}"/>` : `<circle cx="${cx}" cy="${cy}" r="2" style="fill:none;stroke:#D9C8AE;stroke-width:.6"/>`; }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out}</svg>`;
}
function uMini(u, occ) {
  const t = UNIT_TYPES[u.type], used = capacity(u) - freeSlots(u, occ).length, name = u.name || t.label;
  return `<button class="umini${uActive === u.id ? ' on' : ''}" data-act="uGo" data-u="${u.id}" aria-label="${esc(name)} : ${used} sur ${capacity(u)}">
    <span class="uart">${t.box ? boxArt(u, occ) : gridArt(u, occ)}</span><span class="unm">${esc(name)}</span><span class="uct">${used}/${capacity(u)}</span></button>`;
}
// Aller au meuble : défilement doux sous l'en-tête, jamais au-delà de la fin de la page (sinon iPhone fait glisser tout l'écran)
function goUnit(id) {
  const v = $('.view'), el = v && (v.querySelector(`[data-unit="${id}"]`) || v.querySelector(`.crate[data-u="${id}"]`)); if (!el) return;
  const card = el.closest('.card') || el, top = ($('header.top')?.getBoundingClientRect().bottom || 0) + 8;
  const want = window.scrollY + card.getBoundingClientRect().top - top, max = document.documentElement.scrollHeight - innerHeight;
  window.scrollTo({ top: Math.max(0, Math.min(want, max)), behavior: 'smooth' });
  uActive = id; spyLock = Date.now(); markMini();
  el.classList.remove('uflash'); void el.offsetWidth; el.classList.add('uflash'); setTimeout(() => el.classList.remove('uflash'), 1200);
}
function markMini() {
  const s = $('.ustrip'); if (!s) return;
  let on = null; for (const m of $$('.umini', s)) { const y = m.dataset.u === uActive; m.classList.toggle('on', y); if (y) on = m; }
  if (on) s.scrollTo({ left: Math.max(0, on.offsetLeft - s.clientWidth / 2 + on.offsetWidth / 2), behavior: 'smooth' });
}
// Suivi : la miniature du meuble visible sous l'en-tête s'encadre
function unitSpy() {
  if (view !== 'cave' || caveMode !== 'plan' || Date.now() - spyLock < 800 || !$('.ustrip')) return;
  const lim = ($('header.top')?.getBoundingClientRect().bottom || 0) + 30;
  const els = $$('.view [data-unit], .view .crate[data-u]'); let best = els[0] || null;
  for (const c of els) { if (c.getBoundingClientRect().top <= lim) best = c; else break; }
  const id = best?.dataset.unit || best?.dataset.u;
  if (id && id !== uActive) { uActive = id; markMini(); }
}
addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; unitSpy(); }); }, { passive: true });

/* ---------- Filtres de la liste (v2.1.3) ---------- */
const CF_ST = ['prio', 'apogee', 'tot', 'declin'];
const listBase = () => S.wines.filter(w => kindOn(w) && S.bottles.some(b => b.wineId === w.id && (inCave(b) || b.state === 'primeur')));
// Tranches de millésimes calculées sur la cave (par tiers), et « Sans millésime »
function yBuckets(ws) {
  const ys = ws.map(w => w.millesime).filter(Boolean).sort((a, b) => a - b), out = [];
  if (ys.length) {
    const a = ys[Math.floor((ys.length - 1) / 3)], b = ys[Math.floor(2 * (ys.length - 1) / 3)];
    out.push(`le:${a}`); if (b > a) out.push(b > a + 1 ? `rg:${a + 1}-${b}` : `rg:${b}-${b}`); if (ys.at(-1) > b) out.push(`ge:${b + 1}`);
  }
  if (ws.some(w => !w.millesime)) out.push('nv');
  return out;
}
function yTest(k, y) {
  if (k === 'nv') return !y;
  const [t, v] = k.split(':'); if (!y) return false;
  if (t === 'le') return y <= +v;
  if (t === 'ge') return y >= +v;
  const [a, b] = v.split('-').map(Number); return y >= a && y <= b;
}
const yLabel = k => { if (k === 'nv') return 'Sans millésime'; const [t, v] = k.split(':'); if (t === 'le') return '≤ ' + v; if (t === 'ge') return v + ' et +'; const [a, b] = v.split('-'); return a === b ? a : `${a}–${b}`; };
const CF_TEST = {
  st: (w, v) => status(w) === v,
  col: (w, v) => v === 'spirit' ? w.kind === 'spirit' : w.kind !== 'spirit' && w.couleur === v,
  site: (w, v) => wineBottles(w.id).some(b => siteOfBottle(b) === v),
  reg: (w, v) => (w.region || '').trim() === v,
  y: (w, v) => yTest(v, w.millesime),
  own: (w, v) => v === 'ami' ? hasFriend(w) : heldBottles(w.id).some(b => !b.owner),
};
const cfCount = () => Object.values(caveF).reduce((t, s) => t + s.size, 0);
function cfPass(w, skip) {
  for (const g in caveF) if (g !== skip && caveF[g].size && ![...caveF[g]].some(v => CF_TEST[g](w, v))) return false;
  return true;
}
function cfLabel(g, v) {
  if (g === 'st') return [STATUS[v].short, STATUS[v].hex];
  if (g === 'col') return v === 'spirit' ? ['Spiritueux', SPIRIT_COLOR] : [COLORS[v]?.label || v, COLORS[v]?.c];
  if (g === 'site') return [site(v)?.name || '?'];
  if (g === 'y') return [yLabel(v)];
  if (g === 'own') return [v === 'ami' ? 'Vins des amis' : 'Mes vins'];
  return [v];
}
// Groupes proposés : seulement ce qui existe dans la cave
function cfGroups(ws) {
  const g = [['st', 'Maturité', CF_ST.filter(k => ws.some(w => w.kind !== 'spirit'))]];
  const cols = Object.keys(COLORS).filter(c => ws.some(w => w.kind !== 'spirit' && w.couleur === c));
  if (spiritsOn() && ws.some(w => w.kind === 'spirit')) cols.push('spirit');
  g.push(['col', 'Couleur', cols]);
  if (isMulti()) g.push(['site', 'Site', S.sites.map(s => s.id)]);
  g.push(['reg', 'Région', [...new Set(ws.map(w => (w.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))]);
  g.push(['y', 'Millésime', yBuckets(ws)]);
  if (S.wines.some(hasFriend)) g.push(['own', 'À qui', ['moi', 'ami']]);
  return g.filter(x => x[2].length);
}
const cfDot = c => c ? `<span class="dot" style="background:${c}"></span>` : '';
function listBar() {
  const on = Object.entries(caveF).flatMap(([g, set]) => [...set].map(v => [g, v]));
  return `<div class="fbar"><div class="row" style="gap:10px"><button class="fbtn" data-act="cfOpen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtres${on.length ? ` <b>${on.length}</b>` : ''}</button>
      ${on.length ? '<button class="link" style="padding:0;font-size:14px" data-act="cfClear">Tout effacer</button>' : '<span class="small ell">Maturité, couleur, région, millésime…</span>'}</div>
    <div class="factive">${on.length ? on.map(([g, v]) => { const [l, c] = cfLabel(g, v); return `<button class="chip on" data-act="cfToggle" data-g="${g}" data-v="${esc(v)}" aria-label="Retirer le filtre ${esc(l)}">${cfDot(c)}${esc(l)}<span class="rm">✕</span></button>`; }).join('') : '<span class="tiny">Aucun filtre : tous les vins sont affichés.</span>'}</div></div>`;
}
function cfSheet() {
  const m = matcher(caveQuery), ws = listBase().filter(w => !m || m(w)), n = ws.filter(w => cfPass(w)).length;
  return `${head('Filtres', cfCount() ? '<button class="link" style="padding:0 6px;font-size:15px" data-act="cfClear">Tout effacer</button>' : '')}
    ${cfGroups(listBase()).map(([g, title, vals]) => `<h3>${title}</h3><div class="chips wrap">${vals.map(v => {
      const on = caveF[g].has(v), k = ws.filter(w => cfPass(w, g) && CF_TEST[g](w, v)).length, [l, c] = cfLabel(g, v);
      return `<button class="chip${on ? ' on' : ''}${!k && !on ? ' zero' : ''}" data-act="cfToggle" data-g="${g}" data-v="${esc(v)}">${cfDot(c)}${esc(l)} <em>${k}</em></button>`; }).join('')}</div>`).join('')}
    <button class="btn primary wide" style="margin-top:18px" data-act="close">Voir ${plural(n, 'vin', 'vins')}</button>`;
}
function vCave() {
  if (caveMode === 'liste') return vCaveList();
  const m = matcher(caveQuery), occ = occupancy();
  if (m && !caveJumped) return caveResults(m);
  const sps = visibleSpaces();   // v2.1.3 : tout le site ; la barre d'aperçu mène à chaque meuble
  occMemo = occ;
  const ctx = { occ, m, pick: null };
  let found = 0;
  if (m) found = S.bottles.filter(b => inCave(b) && sps.some(s => s.id === b.spaceId) && m(wine(b.wineId))).length;
  const nothing = !S.wines.length;
  return `${nothing ? `<div class="card"><b>Bienvenue dans ta cave</b><p class="small" style="margin:6px 0 10px">Commence par décrire tes meubles (armoire, rack, caisses), puis ajoute tes bouteilles avec le bouton +.</p>
      <button class="btn primary small" data-act="addUnit" data-space="${sps[0]?.id || ''}">Ajouter un meuble</button><p class="tiny" style="margin:8px 0 0">Tu viens de Ploc ? L’import se trouve dans les réglages.</p></div>` : ''}
    ${m ? `<p class="small" style="margin:10px 4px 0">${found ? plural(found, 'bouteille trouvée', 'bouteilles trouvées') + ' ici : elles sont encadrées sur le plan.' : 'Aucune bouteille ne correspond ici.'} <button class="link" style="padding:0;font-size:13px" data-act="caveResults">Tous les résultats</button></p>` : ''}
    ${sps.map(sp => spaceBlock(sp, ctx, sps.length > 1)).join('')}
    ${transferChip()}`;
}
/* ---------- Recherche sur tous les sites ---------- */
// Emplacements des bouteilles trouvées : une ligne par case, par caisse, par lot « non placées » d'un espace, par lot en primeur
function locGroups(bs) {
  const cur = S.settings.site, groups = new Map();
  for (const b of bs) {
    const u = b.unitId && unit(b.unitId);
    const k = b.state === 'primeur' ? 'primeur' : !u ? 'np:' + b.spaceId : UNIT_TYPES[u.type].box ? 'box:' + u.id : 'c:' + b.id;
    if (!groups.has(k)) groups.set(k, { b, n: 0, primeur: b.state === 'primeur' });
    groups.get(k).n++;
  }
  return [...groups.values()].sort((a, b) => (a.primeur - b.primeur) || ((siteOfBottle(b.b) === cur) - (siteOfBottle(a.b) === cur)) || locLabel(a.b, true).localeCompare(locLabel(b.b, true), 'fr'));
}
function caveLocs(m) {
  const out = [];
  for (const w of S.wines) {
    if (!kindOn(w) || !m(w)) continue;
    const bs = S.bottles.filter(b => b.wineId === w.id && (inCave(b) || b.state === 'primeur'));
    if (!bs.length) continue;
    out.push({ w, n: bs.length, locs: locGroups(bs) });
  }
  return out.sort((a, b) => norm(wineName(a.w)).localeCompare(norm(wineName(b.w))) || (a.w.millesime || 0) - (b.w.millesime || 0));
}
function caveResults(m) {
  const res = caveLocs(m), n = res.reduce((t, r) => t + r.n, 0), multi = S.sites.length > 1;
  if (!res.length) return `<p class="small" style="margin:12px 4px">Aucune bouteille ne correspond${multi ? ', sur aucun site' : ''}.</p>`;
  return `<p class="small" style="margin:10px 4px 0">${plural(n, 'bouteille trouvée', 'bouteilles trouvées')}${multi ? ' sur tous les sites' : ''}. Touche un emplacement pour y aller.</p>
    ${res.map(r => `<div class="list res"><button class="li" data-act="wine" data-id="${r.w.id}"><span class="dot" style="background:${wineColor(r.w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(r.w))}</b><small class="ell">${esc(wineSub(r.w))}${hasFriend(r.w) ? ' · ' + esc(ownerSummary(r.w)) : ''}</small></div><span class="qty">×${r.n}</span></button>
      ${r.locs.slice(0, 8).map(g => g.primeur ? `<div class="li loc">${ICON.pin}<div class="it"><b>Primeur, pas encore livrée</b></div><span class="qty">×${g.n}</span></div>`
        : `<button class="li loc" data-act="caveJump" data-b="${g.b.id}">${ICON.pin}<div class="it"><b>${esc(locLabel(g.b, multi))}</b></div>${g.n > 1 ? `<span class="qty">×${g.n}</span>` : ''}<span class="chev">${ICON.chev}</span></button>`).join('')}
      ${r.locs.length > 8 ? `<div class="li loc"><div class="it"><small>et ${plural(r.locs.length - 8, 'autre emplacement', 'autres emplacements')} : ouvre la fiche du vin</small></div></div>` : ''}</div>`).join('')}`;
}
// Aller à une bouteille : bon site (comme le sélecteur), bon espace, défilement jusqu'à la case qui clignote
async function jumpToBottle(bid) {
  const b = byId(S.bottles, bid), sp = b && space(b.spaceId);
  if (!b || !inCave(b) || !sp) return toast('Cette bouteille n’est plus en cave');
  if (isMulti() && sp.siteId !== S.settings.site) { S.settings.site = sp.siteId; await save(); }
  closeSheet();
  view = 'cave'; caveMode = 'plan'; caveSpace = sp.id; caveJumped = true;
  render();
  const u = b.unitId && unit(b.unitId), box = u && UNIT_TYPES[u.type].box, v = $('.view');
  const el = !u ? v.querySelector(`.unplaced [data-w="${b.wineId}"]`) : box ? v.querySelector(`.crate[data-u="${u.id}"]`) : v.querySelector(`[data-b="${b.id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 3300);
  if (box) setTimeout(() => { if (view === 'cave' && !sheetStack.length) showSheet(() => boxSheet(u.id)); }, 900);
}
// Touche « Rechercher » du clavier : un seul emplacement, on y va directement
function caveEnter() {
  const m = matcher(caveQuery); if (!m || caveMode !== 'plan' || caveJumped) return;
  const locs = caveLocs(m).flatMap(r => r.locs).filter(g => !g.primeur);
  if (locs.length === 1) jumpToBottle(locs[0].b.id);
}
function transferChip() {
  const n = S.transfer.ids.filter(id => byId(S.bottles, id)).length;
  return n ? `<button class="card tap row" style="width:100%" data-act="transferSheet">${ICON.truck}<div class="grow" style="text-align:left"><b>Transfert en préparation</b><div class="small">${plural(n, 'bouteille', 'bouteilles')} à emporter</div></div><span class="chev">${ICON.chev}</span></button>` : '';
}
function spaceBlock(sp, ctx, titled) {
  const units = spaceUnits(sp.id), grid = units.filter(u => !UNIT_TYPES[u.type].box), boxes = units.filter(u => UNIT_TYPES[u.type].box);
  const unplaced = S.bottles.filter(b => inCave(b) && b.spaceId === sp.id && !b.unitId);
  return `<div class="sect">${esc(sp.name)}${titled || !isMulti() ? '' : ' · ' + esc(site(sp.siteId)?.name || '')}</div>
    ${!units.length ? `<div class="card"><div class="small">Aucun meuble dans « ${esc(sp.name)} ».</div><button class="btn small" style="margin-top:8px" data-act="addUnit" data-space="${sp.id}">${ICON.add} Ajouter un meuble</button></div>` : ''}
    ${grid.map(u => `<div class="card" data-unit="${u.id}">${unitHead(u, ctx)}${renderGrid(u, ctx)}</div>`).join('')}
    ${boxes.length ? `<div class="card"><div class="ct">Caisses et cartons <span class="small">${boxes.length} · ${boxes.reduce((t, u) => t + capacity(u) - freeSlots(u, ctx.occ).length, 0)} bouteilles</span></div>${renderBoxes(boxes, ctx)}</div>` : ''}
    ${unplaced.length && !ctx.pick ? unplacedBlock(unplaced, ctx) : ''}
    ${units.length && !ctx.pick ? `<button class="link" data-act="addUnit" data-space="${sp.id}">+ Ajouter un meuble</button>` : ''}`;
}
function unitHead(u, ctx) {
  const t = UNIT_TYPES[u.type], used = capacity(u) - freeSlots(u, ctx.occ).length;
  const hid = spiritsOn() ? 0 : S.bottles.filter(b => b.unitId === u.id && inCave(b) && !kindOn(wine(b.wineId))).length;
  const meta = `${u.rows} ${(u.rows > 1 ? t.rows : t.row1).toLowerCase()} · ${capacity(u)} places · ${used} occupée${used > 1 ? 's' : ''}${hid ? ` · ${plural(hid, 'spiritueux masqué', 'spiritueux masqués')}` : ''}`;
  return `<div class="ct" style="margin-bottom:2px"><span class="ell">${esc(u.name || t.label)}</span>${ctx.pick ? '' : `<button class="icon-btn" data-act="editUnit" data-id="${u.id}" aria-label="Modifier le meuble">${ICON.edit}</button>`}</div><div class="tiny">${meta}</div>`;
}
function slotState(b, ctx) {
  const w = wine(b.wineId), cls = [];
  if (ctx.m) cls.push(ctx.m(w) ? 'hl' : 'dim');
  if (b.owner) cls.push('ami');
  return { w, cls };
}
function renderGrid(u, ctx) {
  const t = UNIT_TYPES[u.type], rows = [];
  for (let r = 0; r < u.rows; r++) {
    const cells = [];
    for (let c = 0; c < u.cols; c++) {
      const k = `${u.id}:${r}:${c}`, b = ctx.occ.get(k);
      const sel = ctx.pick?.sel.some(s => s.unitId === u.id && s.r === r && s.c === c);
      if (u.type === 'rack') {
        if (!b) { cells.push(`<button class="rc${sel ? ' sel' : ''}" ${ctx.pick ? `data-act="pickSlot" data-u="${u.id}" data-r="${r}" data-c="${c}"` : `data-act="emptySlot" data-u="${u.id}" data-r="${r}" data-c="${c}"`} aria-label="${t.row1} ${r + 1}, place ${c + 1} : libre"></button>`); continue; }
        const { w, cls } = slotState(b, ctx);
        if (!kindOn(w)) { cells.push(`<button class="rc off" ${ctx.pick ? 'disabled' : 'data-act="spiritOff"'} aria-label="Spiritueux masqué"></button>`); continue; }
        const bg = wineColor(w), light = wineLight(w);
        cells.push(`<button class="rc ${cls.join(' ')}${light ? ' light' : ''}${ctx.pick ? ' dim' : ''}" style="background:${bg};border-color:${bg}" ${b.owner ? `data-ini="${esc(ownerInitial(b))}"` : ''} ${ctx.pick ? 'disabled' : `data-act="slot" data-b="${b.id}"`} aria-label="${esc(wineTitle(w))}">${esc(abbr(w))}</button>`);
        continue;
      }
      if (!b) { cells.push(`<button class="slot empty${sel ? ' sel' : ''}" ${ctx.pick ? `data-act="pickSlot" data-u="${u.id}" data-r="${r}" data-c="${c}"` : `data-act="emptySlot" data-u="${u.id}" data-r="${r}" data-c="${c}"`} aria-label="Place libre"></button>`); continue; }
      const { w, cls } = slotState(b, ctx);
      if (!kindOn(w)) { cells.push(`<button class="slot off" ${ctx.pick ? 'disabled' : 'data-act="spiritOff"'} aria-label="Spiritueux masqué"><i></i><b>&nbsp;</b><small>&nbsp;</small></button>`); continue; }
      cells.push(`<button class="slot ${cls.join(' ')}${ctx.pick ? ' dim' : ''}" ${ctx.pick ? 'disabled' : `data-act="slot" data-b="${b.id}"`}><i style="background:${wineColor(w)}"></i><b>${esc(shortName(w))}</b><small>${esc(shortSub(w))}${b.state === 'open' ? ' · ouverte' : ''}</small>${b.owner ? `<span class="ini">${esc(ownerInitial(b))}</span>` : ''}</button>`);
    }
    const cols = u.type === 'rack' ? `repeat(${u.cols},minmax(26px,1fr))` : `repeat(${u.cols},minmax(${u.cols > 6 ? 54 : 0}px,1fr))`;
    const cls = u.type === 'rack' ? 'rack' : 'shelf';
    rows.push(`${u.type !== 'rack' ? `<div class="shelf-l">${t.row1} ${r + 1}</div>` : ''}<div class="${cls}" style="grid-template-columns:${cols}${u.type === 'rack' && r ? ';margin-top:6px' : ''}">${cells.join('')}</div>`);
  }
  const wide = u.type === 'rack' ? u.cols > 11 : u.cols > 6;
  return wide ? `<div class="rack-scroll">${rows.join('')}</div>` : rows.join('');
}
function boxContents(u, occ) { return positions(u).map(([r, c]) => occ.get(`${u.id}:${r}:${c}`)).filter(Boolean); }
function renderBoxes(boxes, ctx) {
  const sorted = [...boxes].sort((a, b) => String(a.pile || '').localeCompare(String(b.pile || '')) || (b.level || 0) - (a.level || 0));
  return `<div class="pile">${sorted.map(u => {
    const bs = boxContents(u, ctx.occ), ws = [...new Set(bs.map(b => b.wineId))].map(wine);
    const off = ws.length && ws.every(w => !kindOn(w));
    const title = off ? 'Spiritueux masqués' : ws.length === 1 ? wineTitle(ws[0]) : ws.length ? 'Assortiment · à répartir' : 'Vide';
    const hit = ctx.m && ws.some(ctx.m), dim = ctx.m && !hit;
    const act = ctx.pick ? `data-act="pickBox" data-u="${u.id}"` : `data-act="box" data-u="${u.id}"`;
    const picked = ctx.pick?.sel.filter(s => s.unitId === u.id).length || 0;
    return `<button class="crate${u.type === 'carton' ? ' carton' : ''}${hit ? ' hl' : ''}${dim ? ' dim' : ''}" ${act}>
      <span class="ell" style="display:block">${esc(title)}</span>
      <small class="ell">${esc(u.name || UNIT_TYPES[u.type].label)}${u.pile ? ' · ' + esc(u.pile) + (u.level ? ' niv. ' + u.level : '') : ''}${ws.length === 1 && bs.some(b => b.owner) ? ' · ' + esc(ownerSummary(ws[0], bs)) : ''}</small>
      <span class="cnt">${bs.length} / ${capacity(u)}${picked ? ' · +' + picked : ''}</span></button>`;
  }).join('')}</div>`;
}
function unplacedBlock(list, ctx) {
  list = list.filter(b => kindOn(wine(b.wineId)));
  if (!list.length) return '';
  const by = new Map();
  for (const b of list) by.set(b.wineId, (by.get(b.wineId) || 0) + 1);
  return `<div class="card"><div class="ct">Non placées <span class="small">${list.length}</span></div><div class="unplaced">${[...by].map(([wid, n]) => {
    const w = wine(wid), dim = ctx.m && !ctx.m(w);
    return `<button class="chip${dim ? '' : ctx.m ? ' on' : ''}" ${dim ? 'style="opacity:.4"' : ''} data-act="placeUnplaced" data-w="${wid}" data-space="${list[0].spaceId}"><span class="dot" style="background:${wineColor(w)}"></span>${esc(shortName(w))} ${esc(vintage2(w))} ×${n}</button>`;
  }).join('')}</div><p class="tiny" style="margin:8px 0 0">Touche un vin pour le ranger dans un meuble.</p></div>`;
}

/* ---------- Liste ---------- */
function listWines() {
  const m = matcher(caveQuery);
  return listBase().filter(w => (!m || m(w)) && cfPass(w))
    .sort((a, b) => norm(wineName(a)).localeCompare(norm(wineName(b))) || (a.millesime || 0) - (b.millesime || 0));
}
function wineRow(w, extra = '') {
  const bs = wineBottles(w.id), pr = S.bottles.filter(b => b.wineId === w.id && b.state === 'primeur').length, st = status(w);
  const where = isMulti() ? [...new Set(bs.map(siteOfBottle))].map(id => `${site(id)?.name || '?'} ×${bs.filter(b => siteOfBottle(b) === id).length}`).join(' · ') : '';
  return `<button class="li" data-act="wine" data-id="${w.id}">${w.photo ? `<img class="thumb" data-photo="${w.id}" alt="" hidden>` : `<span class="dot" style="background:${wineColor(w)}"></span>`}
    <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}</small>
      <small class="ell">${st && st !== 'inconnu' ? `<span style="color:${STATUS[st].hex};font-weight:600">${STATUS[st].short}</span> · ${esc(windowLabel(w.apogee))}` : ''}${where ? (st && st !== 'inconnu' ? ' · ' : '') + esc(where) : ''}${hasFriend(w) ? ' · ' + esc(ownerSummary(w)) : ''}${pr ? ' · ' + pr + ' en primeur' : ''}</small>${extra}</div>
    <span class="qty">×${bs.length}</span></button>`;
}
function vCaveList() {
  const ws = listWines();
  if (!S.wines.length) return `<div class="empty">${ICON.bottle}<p>Ta cave est vide. Ajoute une bouteille avec le bouton +.</p></div>`;
  const total = ws.reduce((t, w) => t + wineBottles(w.id).length, 0);
  return `<p class="small" style="margin:10px 4px 0">${plural(ws.length, 'référence', 'références')} · ${plural(total, 'bouteille', 'bouteilles')}</p>
    ${ws.length ? `<div class="list">${ws.map(w => wineRow(w)).join('')}</div>` : '<div class="empty">Aucun vin ne correspond.</div>'}`;
}

/* ---------- Meubles ---------- */
function unitSheet(id, spaceId) {
  const u = id ? unit(id) : { type: 'armoire', rows: 4, cols: 6, cap: 12, spaceId };
  const t = UNIT_TYPES[u.type];
  const sps = S.spaces.map(s => `<option value="${s.id}" ${s.id === u.spaceId ? 'selected' : ''}>${esc(isMulti() ? site(s.siteId)?.name + ' › ' : '')}${esc(s.name)}</option>`).join('');
  return `${head(id ? 'Modifier le meuble' : 'Nouveau meuble')}
    <form class="form" data-form="unit" data-id="${id || ''}">
      <label>Type<select name="type" data-ch="unitType">${Object.entries(UNIT_TYPES).map(([k, v]) => `<option value="${k}" ${k === u.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Nom<input name="name" value="${esc(u.name || '')}" placeholder="${esc(t.label)}"></label>
      <div id="unit-dims">${unitDims(u.type, u)}</div>
      <label>Emplacement<select name="spaceId">${sps}</select></label>
      <button class="btn primary wide" type="submit">${id ? 'Enregistrer' : 'Ajouter le meuble'}</button>
      ${id ? `<button class="btn danger wide" type="button" data-act="delUnit" data-id="${id}">Supprimer ce meuble</button>` : ''}
    </form>`;
}
function unitDims(type, u = {}) {
  const t = UNIT_TYPES[type];
  if (t.box) return `<div class="grid3"><label>Capacité<select name="cap">${[1, 2, 3, 6, 12, 24].map(n => `<option ${n === (u.cap || t.def[1]) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Pile<input name="pile" value="${esc(u.pile || '')}" placeholder="A"></label><label>Niveau<input name="level" inputmode="numeric" value="${esc(u.level || '')}" placeholder="1 = bas"></label></div>`;
  return `<div class="grid2"><label>${t.rows}<input name="rows" inputmode="numeric" value="${u.rows && u.type === type ? u.rows : t.def[0]}" required></label>
    <label>${t.cols}<input name="cols" inputmode="numeric" value="${u.cols && u.type === type ? u.cols : t.def[1]}" required></label></div>`;
}
CHANGES.unitType = el => { $('#unit-dims').innerHTML = unitDims(el.value); };
FORMS.unit = async (f, d) => {
  const id = f.dataset.id, t = UNIT_TYPES[d.type];
  const o = { type: d.type, name: d.name, spaceId: d.spaceId };
  if (t.box) Object.assign(o, { cap: int(d.cap) || 6, pile: d.pile, level: int(d.level), rows: 1, cols: int(d.cap) || 6 });
  else {
    const rows = int(d.rows), cols = int(d.cols);
    if (!rows || !cols || rows < 1 || cols < 1 || rows > 40 || cols > 40) return toast('Dimensions entre 1 et 40');
    Object.assign(o, { rows, cols });
  }
  if (id) {
    const u = unit(id);
    // Bouteilles hors des nouvelles dimensions, ou meuble déplacé : elles redeviennent non placées
    const oldType = u.type;
    Object.assign(u, o);
    const valid = new Set(positions(u).map(([r, c]) => `${r}:${c}`));
    let moved = 0;
    for (const b of S.bottles) if (b.unitId === id && inCave(b)) {
      if (oldType !== u.type || !valid.has(`${b.r}:${b.c}`)) { b.unitId = null; b.r = b.c = null; moved++; }
      b.spaceId = u.spaceId;
    }
    await save(); closeSheet(); render(); toast(moved ? `Meuble modifié · ${plural(moved, 'bouteille non placée', 'bouteilles non placées')}` : 'Meuble modifié');
  } else {
    S.units.push({ id: uid(), order: S.units.length, ...o });
    caveSpace = d.spaceId;
    await save(); closeSheet(); render(); toast('Meuble ajouté');
  }
};
Object.assign(ACT, {
  caveMode: t => { caveMode = t.dataset.m; render(); },
  caveSpace: t => { caveSpace = t.dataset.id || null; render(); },
  cfOpen: () => showSheet(cfSheet),
  cfToggle: t => { const set = caveF[t.dataset.g], v = t.dataset.v; set.has(v) ? set.delete(v) : set.add(v); render(); if (sheetStack.length) refreshSheet(); },
  cfClear: () => { Object.values(caveF).forEach(x => x.clear()); render(); if (sheetStack.length) refreshSheet(); },
  uGo: t => goUnit(t.dataset.u),
  searchOpen: () => { caveSearchOpen = true; render(); const i = $('.csearch input'); if (i) { i.focus(); placeSearch(); } },
  searchCancel: () => { caveSearchOpen = false; caveQuery = ''; caveJumped = false; render(); },
  addUnit: t => showSheet(() => unitSheet(null, t.dataset.space || visibleSpaces()[0]?.id)),
  editUnit: t => showSheet(() => unitSheet(t.dataset.id)),
  delUnit: async t => {
    const id = t.dataset.id, n = S.bottles.filter(b => b.unitId === id && inCave(b)).length;
    if (!confirm(n ? `Supprimer ce meuble ? Ses ${n} bouteilles resteront dans la cave, sans emplacement.` : 'Supprimer ce meuble ?')) return;
    for (const b of S.bottles) if (b.unitId === id) { b.unitId = null; b.r = b.c = null; }
    S.units = S.units.filter(u => u.id !== id);
    await save(); closeSheet(); render(); toast('Meuble supprimé');
  },
  slot: t => showSheet(() => bottleSheet(t.dataset.b)),
  spiritOff: () => toast('Spiritueux masqués : réactive-les dans Réglages › Contenu'),
  emptySlot: t => showSheet(() => emptySlotSheet(t.dataset.u, +t.dataset.r, +t.dataset.c)),
  box: t => showSheet(() => boxSheet(t.dataset.u)),
  caveJump: t => jumpToBottle(t.dataset.b),
  planGo: t => jumpToBottle(t.dataset.b),
  caveResults: () => { caveJumped = false; render(); window.scrollTo(0, 0); },
});
INPUTS.caveSearch = el => {
  caveQuery = el.value; caveJumped = false;
  const v = $('.view'); if (v) { v.innerHTML = banners() + vCave(); paintPhotos(v); }
  const st = $('#cstrip'); if (st && caveMode === 'plan') st.innerHTML = unitStrip();
  const f = $('.sfab'); if (f) f.classList.toggle('dot', !!caveQuery);
};

function emptySlotSheet(uid_, r, c) {
  const u = unit(uid_), t = UNIT_TYPES[u.type];
  const waiting = S.wines.filter(w => kindOn(w) && S.bottles.some(b => b.wineId === w.id && inCave(b) && !b.unitId));
  return `${head('Place libre')}
    <p class="small" style="margin-top:-4px">${esc(u.name || t.label)} · ${t.row1} ${r + 1}, place ${c + 1}</p>
    ${waiting.length ? `<h3>Ranger ici une bouteille non placée</h3><div class="list">${waiting.map(w => `<button class="li" data-act="putHere" data-w="${w.id}" data-u="${u.id}" data-r="${r}" data-c="${c}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small>${S.bottles.filter(b => b.wineId === w.id && inCave(b) && !b.unitId).length} non placée(s)</small></div></button>`).join('')}</div>` : ''}
    <h3>Ou déplacer ici une bouteille</h3>
    <p class="small">Ouvre la bouteille à déplacer, puis « Déplacer ». Tu pourras choisir cette place.</p>
    <button class="btn primary wide" data-act="add" data-u="${u.id}" data-r="${r}" data-c="${c}">${ICON.add} Ajouter une nouvelle bouteille ici</button>`;
}
function boxSheet(uid_) {
  const u = unit(uid_), occ = occupancy(), bs = boxContents(u, occ), free = capacity(u) - bs.length;
  const by = new Map(); for (const b of bs) by.set(b.wineId, [...(by.get(b.wineId) || []), b]);
  return `${head(esc(u.name || UNIT_TYPES[u.type].label), `<button class="icon-btn" data-act="editUnit" data-id="${u.id}" aria-label="Modifier">${ICON.edit}</button>`)}
    <p class="small" style="margin-top:-4px">${bs.length} / ${capacity(u)} bouteilles${u.pile ? ' · pile ' + esc(u.pile) + (u.level ? ', niveau ' + u.level : '') : ''}</p>
    ${by.size > 1 ? `<p class="banner" style="margin:8px 0">Cette caisse contient plusieurs vins : à répartir. Une caisse ou un carton ne contient qu’un seul vin ; pour un assortiment, utilise une étagère ou un rack.</p>` : ''}
    ${by.size ? `<div class="list">${[...by].map(([wid, list]) => { const w = wine(wid); return `<div class="li"><span class="dot" style="background:${wineColor(w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}${list.some(b => b.owner) ? ' · ' + esc(ownerSummary(w, list)) : ''}</small></div><span class="qty">×${list.length}</span>
      ${by.size > 1 ? `<button class="btn small primary" data-act="outBottle" data-b="${list[0].id}">Sortir</button>` : ''}</div>`; }).join('')}</div>` : '<p class="muted">Cette caisse est vide.</p>'}
    ${by.size === 1 ? boxActions(u, [...by.values()][0]) : ''}
    <div class="btns" style="margin-top:10px">
      ${free ? by.size === 1 ? `<button class="btn wide" data-act="boxAdd" data-u="${u.id}" data-w="${[...by.keys()][0]}">${ICON.add} Ajouter des bouteilles de ce vin</button>`
        : !by.size ? `<button class="btn wide" data-act="add" data-u="${u.id}" data-r="0" data-c="${freeSlots(u, occ)[0][1]}">${ICON.add} Ajouter des bouteilles dans cette caisse</button>` : '' : ''}
    </div>`;
}

/* ---------- Changer de site en glissant (v1.7.3) ---------- */
// Glisser vers la gauche : site suivant ; vers la droite : site précédent (en boucle). Mode Plan, plusieurs sites, aucune fenêtre ouverte.
let caveSwipe = null;
const siteDots = () => isMulti() && view === 'cave' && caveMode === 'plan' ? `<div class="sdots" aria-hidden="true">${S.sites.map(s => `<i class="${s.id === S.settings.site ? 'on' : ''}"></i>`).join('')}</div>` : '';
async function switchSite(dir) {
  const i = S.sites.findIndex(s => s.id === S.settings.site), n = S.sites.length;
  const next = S.sites[((i < 0 ? 0 : i) + dir + n) % n];
  S.settings.site = next.id; caveSpace = null; await save();
  render(); window.scrollTo(0, 0);
  const v = $('.view'); if (v) { v.classList.remove('slide-l', 'slide-r'); void v.offsetWidth; v.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }
  toast(next.name);
}
document.addEventListener('touchstart', e => {
  caveSwipe = null;
  if ((mode !== 'app' && mode !== 'demo') || view !== 'cave' || caveMode !== 'plan' || !isMulti() || sheetStack.length || introAt != null || e.touches.length !== 1) return;
  if (e.target.closest?.('.rack-scroll, .chips, .ustrip, .factive, .csearch, .pgrid, input, textarea, select, .sheet, .tabs, #layer')) return;
  const t = e.touches[0]; caveSwipe = { x: t.clientX, y: t.clientY, at: Date.now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  const s0 = caveSwipe; caveSwipe = null;
  if (!s0 || sheetStack.length) return;
  const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - s0.at < 800) switchSite(dx < 0 ? 1 : -1);
}, { passive: true });
