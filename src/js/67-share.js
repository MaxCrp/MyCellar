/* ---------- Partager (v2.1) : carte des vins, fiche de dégustation ----------
   Images dessinées sur l'appareil (canvas), PDF par l'impression iOS, texte par la feuille de partage. */
let cardOpt = { ready: false, site: '', colors: [], prices: false, counts: false, pick: null };
function cardWines() {
  const o = cardOpt;
  const ws = S.wines.filter(w => kindOn(w) && myBottles(w.id).length
    && (!o.ready || ['prio', 'apogee'].includes(status(w)) || w.kind === 'spirit')
    && (!o.site || myBottles(w.id).some(b => siteOfBottle(b) === o.site))
    && (!o.colors.length || o.colors.includes(w.kind === 'spirit' ? 'spirit' : w.couleur)));
  return o.pick ? ws.filter(w => o.pick.includes(w.id)) : ws;
}
const CARD_ORDER = ['effervescent', 'blanc', 'rose', 'rouge', 'orange', 'liquoreux', 'spirit'];
function cardSections(ws) {
  const sec = [];
  for (const c of CARD_ORDER) {
    const l = ws.filter(w => (w.kind === 'spirit' ? 'spirit' : w.couleur) === c); if (!l.length) continue;
    const reg = new Map(); for (const w of l) { const r = w.kind === 'spirit' ? SPIRIT_CATS[w.cat] || 'Spiritueux' : w.region || 'Autres régions'; reg.set(r, [...(reg.get(r) || []), w]); }
    sec.push({ c, label: c === 'spirit' ? 'Spiritueux' : COLORS[c].label + (c === 'rose' ? 's' : c === 'liquoreux' || c === 'orange' ? '' : 's'), dot: c === 'spirit' ? SPIRIT_COLOR : COLORS[c].c,
      regions: [...reg].sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([r, list]) => ({ r, list: list.sort((a, b) => norm(wineName(a)).localeCompare(norm(wineName(b))) || (a.millesime || 0) - (b.millesime || 0)) })) });
  }
  return sec;
}
const cardPrice = w => valueOf(w) ?? w.achat?.prix ?? null;
const cardSub = w => [nameIsDomaine(w) ? w.appellation : w.domaine, w.kind === 'spirit' && w.age ? w.age + ' ans' : ''].filter(Boolean).join(' · ');
function cardRight(w) { return [cardOpt.counts ? '×' + myBottles(w.id).filter(b => !cardOpt.site || siteOfBottle(b) === cardOpt.site).length : '', cardOpt.prices && cardPrice(w) != null ? eur(cardPrice(w)) : ''].filter(Boolean).join(' · '); }
const cardTitle = () => 'Carte des vins' + (cardOpt.site ? ' · ' + (site(cardOpt.site)?.name || '') : '');
function cardHtml(ws) {
  return `<div class="wcard"><h1>${esc(cardTitle())}</h1><p class="wc-date">${esc(fmtDate(today()))}</p>
    ${cardSections(ws).map(s => `<h2><span class="dot" style="background:${s.dot}"></span>${esc(s.label)}</h2>${s.regions.map(g => `<h3>${esc(g.r)}</h3>${g.list.map(w => `<div class="wc-w"><div><b>${esc(wineName(w))}${w.millesime ? ' ' + w.millesime : ''}</b><small>${esc(cardSub(w))}</small></div><span>${esc(cardRight(w))}</span></div>`).join('')}`).join('')}`).join('')}</div>`;
}
function wineCardSheet() {
  const o = cardOpt, ws = cardWines(), used = [...new Set(S.wines.filter(w => kindOn(w) && myBottles(w.id).length).map(w => w.kind === 'spirit' ? 'spirit' : w.couleur).filter(Boolean))];
  const ch = (act, v, on, l) => `<button class="chip soft${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`;
  return `${head('Carte des vins')}
    <div class="chips wrap" style="margin-top:0">${ch('cardOpt', 'ready', o.ready, 'Prêts à boire')}${ch('cardOpt', 'prices', o.prices, 'Avec les prix')}${ch('cardOpt', 'counts', o.counts, 'Nombre de bouteilles')}</div>
    ${S.sites.length > 1 ? `<div class="chips wrap">${ch('cardSite', '', !o.site, 'Tous les sites')}${S.sites.map(s => ch('cardSite', s.id, o.site === s.id, esc(s.name))).join('')}</div>` : ''}
    <div class="chips wrap">${used.map(c => ch('cardColor', c, o.colors.includes(c), `<span class="dot" style="background:${c === 'spirit' ? SPIRIT_COLOR : COLORS[c].c}"></span>${c === 'spirit' ? 'Spiritueux' : COLORS[c].label}`)).join('')}</div>
    <div class="row" style="gap:8px;margin:8px 0"><button class="btn small" data-act="cardPick">${o.pick ? `Sélection : ${o.pick.length} vin${o.pick.length > 1 ? 's' : ''}` : 'Choisir les vins à la main'}</button>${o.pick ? '<button class="btn small ghost" data-act="cardPickClear">Tous les vins</button>' : ''}</div>
    ${ws.length ? cardHtml(ws) : '<p class="muted">Aucun vin ne correspond à ces choix.</p>'}
    <div class="btns" style="margin-top:14px;position:sticky;bottom:0;background:var(--bg);padding:8px 0">
      <div class="btns2"><button class="btn primary" data-act="cardImage" ${ws.length ? '' : 'disabled'}>Partager en image</button><button class="btn" data-act="cardPdf" ${ws.length ? '' : 'disabled'}>En PDF</button></div></div>`;
}
function cardPickSheet() {
  const sel = new Set(cardOpt.pick || cardWines().map(w => w.id));
  const all = S.wines.filter(w => kindOn(w) && myBottles(w.id).length).sort((a, b) => norm(wineName(a)).localeCompare(norm(wineName(b))));
  return `${head('Choisir les vins')}<div class="list">${all.map(w => `<button class="li" data-act="cardPickW" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}</small></div><span class="chev">${sel.has(w.id) ? ICON.check : ''}</span></button>`).join('')}</div>
    <button class="btn primary wide" style="margin-top:12px;position:sticky;bottom:0" data-act="sheetback">Valider</button>`;
}
/* Dessin sur canvas : texte avec retour à la ligne */
function wrapText(ctx, text, maxW) {
  const out = []; for (const para of String(text).split('\n')) { let line = ''; for (const word of para.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } out.push(line); }
  return out;
}
const FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
function canvasBlob(cv) { return new Promise(res => cv.toBlob(b => res(b), 'image/png')); }
// Carte des vins en image : deux passes (mesure, puis dessin)
async function cardImage(ws) {
  const W = 1080, P = 80, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const draw = (paint) => {
    let y = P;
    const T = (txt, size, weight, color, x = P, align = 'left') => { ctx.font = `${weight} ${size}px ${FONT}`; if (paint) { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(txt, x, y); } };
    y += 70; T(cardTitle(), 64, 700, '#2A1F1D'); y += 50; T(fmtDate(today()), 30, 400, '#7D716B'); y += 30;
    for (const s of cardSections(ws)) {
      y += 90; if (paint) { ctx.fillStyle = s.dot; ctx.beginPath(); ctx.arc(P + 14, y - 14, 14, 0, 7); ctx.fill(); } T(s.label, 46, 700, '#6E1E2F', P + 44);
      for (const g of s.regions) {
        y += 64; T(g.r.toUpperCase(), 26, 700, '#A8844E');
        for (const w of g.list) {
          y += 54; const right = cardRight(w); ctx.font = `600 36px ${FONT}`; const rw = right ? ctx.measureText(right).width + 30 : 0;
          const lines = wrapText(ctx, wineName(w) + (w.millesime ? ' ' + w.millesime : ''), W - 2 * P - rw);
          lines.forEach((l, i) => { if (i) y += 44; T(l, 36, 600, '#2A1F1D'); });
          if (right) T(right, 32, 600, '#2A1F1D', W - P, 'right');
          const sub = cardSub(w); if (sub) { y += 40; T(sub, 28, 400, '#7D716B'); }
        }
      }
    }
    y += 90; T('MyCellar', 26, 600, '#B9AFA6', W - P, 'right');
    return y + P;
  };
  cv.width = W; cv.height = 10; const H = draw(false);
  cv.width = W; cv.height = Math.min(H, 16000);
  ctx.fillStyle = '#FBF8F3'; ctx.fillRect(0, 0, W, cv.height); draw(true);
  return canvasBlob(cv);
}
function printHtml(html) {
  let el = $('#print'); if (!el) { el = document.createElement('div'); el.id = 'print'; document.body.appendChild(el); }
  el.innerHTML = html; closeSheet();
  if (isAndroid) toast('Pour un PDF : choisis « Enregistrer au format PDF » comme imprimante');
  setTimeout(() => { try { window.print(); } catch { toast('Impression indisponible sur cet appareil'); } }, 80);
}
/* Fiche de dégustation : image et texte */
function tasteText(t) {
  const w = tastingWine(t), F = t.full || {};
  return [`${wineTitle(w)}${w.domaine && !nameIsDomaine(w) ? ' · ' + w.domaine : ''}`, `${t.note != null ? numFr(t.note) + ' / 20' : 'Sans note'} · ${fmtDate(t.at)}${t.lieu ? ' · ' + t.lieu : ''}`,
    F.teinte && `Teinte : ${F.teinte}`, F.aromes?.length && `Arômes : ${F.aromes.slice(0, 8).join(', ')}`, t.plat && `Accord : ${t.plat}${t.accord ? ' (' + ACCORDS[t.accord].toLowerCase() + ')' : ''}`,
    t.comment && `« ${t.comment} »`, '— Noté avec MyCellar'].filter(Boolean).join('\n');
}
async function tasteImage(t) {
  const w = tastingWine(t), F = t.full || {}, W = 1080, P = 90, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const teinte = F.teinte && (TEINTES[w.kind === 'spirit' ? 'spirit' : w.couleur] || []).find(x => x[0] === F.teinte)?.[1];
  const draw = paint => {
    let y = 0;
    if (paint) { ctx.fillStyle = wineColor(w); ctx.fillRect(0, 0, W, 24); }
    const T = (txt, size, weight, color, x = P, align = 'left') => { ctx.font = `${weight} ${size}px ${FONT}`; if (paint) { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(txt, x, y); } };
    const para = (txt, size, weight, color, lh) => { ctx.font = `${weight} ${size}px ${FONT}`; wrapText(ctx, txt, W - 2 * P).forEach((l, i) => { if (i) y += lh; T(l, size, weight, color); }); };
    y = 140; para(wineTitle(w), 58, 700, '#2A1F1D', 68);
    const sub = [w.domaine && !nameIsDomaine(w) ? w.domaine : w.appellation, w.region].filter(Boolean).join(' · ');
    if (sub) { y += 52; para(sub, 32, 400, '#7D716B', 42); }
    y += 150; T(t.note != null ? numFr(t.note) : '–', 150, 700, '#6E1E2F'); ctx.font = `700 150px ${FONT}`; const nw = ctx.measureText(t.note != null ? numFr(t.note) : '–').width; T('/ 20', 50, 600, '#7D716B', P + nw + 16);
    y += 60; T([fmtDate(t.at), t.lieu].filter(Boolean).join(' · '), 30, 400, '#7D716B');
    if (teinte) { y += 80; if (paint) { ctx.fillStyle = teinte; ctx.beginPath(); ctx.arc(P + 22, y - 12, 22, 0, 7); ctx.fill(); } T(F.teinte, 34, 600, '#2A1F1D', P + 62); }
    if (F.aromes?.length) { y += 80; T('ARÔMES', 26, 700, '#A8844E'); y += 50; para(F.aromes.slice(0, 10).join(' · '), 34, 500, '#2A1F1D', 46); }
    if (t.plat) { y += 80; T('ACCORD', 26, 700, '#A8844E'); y += 50; para(t.plat + (t.accord ? ' — ' + ACCORDS[t.accord].toLowerCase() : ''), 34, 500, '#2A1F1D', 46); }
    if (t.comment) { y += 80; para('« ' + t.comment.slice(0, 600) + ' »', 34, 400, '#2A1F1D', 48); }
    y += 100; T('MyCellar', 26, 600, '#B9AFA6', W - P, 'right');
    return Math.max(y + P, 1080);
  };
  cv.width = W; cv.height = 10; const H = draw(false);
  cv.width = W; cv.height = Math.min(H, 6000);
  ctx.fillStyle = '#FBF8F3'; ctx.fillRect(0, 0, W, cv.height); draw(true);
  return canvasBlob(cv);
}
async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return true; } catch (e) { if (e.name === 'AbortError') return false; } }
  try { await navigator.clipboard.writeText(text); toast('Texte copié'); return true; } catch { toast('Partage indisponible'); return false; }
}
Object.assign(ACT, {
  wineCardSheet: () => showSheet(wineCardSheet, { full: true }),
  cardOpt: t => { cardOpt[t.dataset.v] = !cardOpt[t.dataset.v]; refreshSheet(); },
  cardSite: t => { cardOpt.site = t.dataset.v || ''; refreshSheet(); },
  cardColor: t => { const c = t.dataset.v, l = cardOpt.colors; cardOpt.colors = l.includes(c) ? l.filter(x => x !== c) : [...l, c]; refreshSheet(); },
  cardPick: () => { if (!cardOpt.pick) cardOpt.pick = cardWines().map(w => w.id); showSheet(cardPickSheet); },
  cardPickW: t => { const id = t.dataset.id, l = cardOpt.pick || []; cardOpt.pick = l.includes(id) ? l.filter(x => x !== id) : [...l, id]; refreshSheet(); },
  cardPickClear: () => { cardOpt.pick = null; refreshSheet(); },
  cardImage: async () => { const b = await cardImage(cardWines()); if (b && await shareBlob(`carte-des-vins-${today()}.png`, b)) toast('Carte prête'); },
  cardPdf: () => printHtml(cardHtml(cardWines())),
  tasteShareImg: async t => { const r = byId(S.tastings, t.dataset.id); if (!r) return; const b = await tasteImage(r); if (b) await shareBlob(`degustation-${r.at || today()}.png`, b); },
  tasteShareTxt: t => { const r = byId(S.tastings, t.dataset.id); if (r) return shareText(tasteText(r)); },
});
