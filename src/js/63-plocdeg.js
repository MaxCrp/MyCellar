/* ---------- Import des dégustations depuis Ploc (CSV, v2.1) ----------
   Format reçu : Windows-1252, « ; », en-tête Date ; Nom du vin ; Millésime ; Lieu ; Note ; EmotiPLOC ; Couleur ;
   Personnes présentes ; Plats ; Commentaires ; IdVin. Le sommelier démêle le nom (domaine, appellation, cuvée),
   l'utilisateur vérifie, les dégustations d'une même date (au moins deux) forment une séance. */
let degImport = null;
// Texte : UTF-8 si valide, sinon Windows-1252 (export Ploc)
function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}
// CSV : séparateur deviné sur la première ligne, guillemets, "" échappés, retours à la ligne dans un champ
function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '', count = c => first.split(c).length - 1;
  const sep = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else if (!(ch === '\r' && text[i + 1] === '\n')) cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
const CSV_COLS = { date: /^date/, nom: /^(nom|vin)/, mill: /^mill/, lieu: /^lieu/, note: /^note/, emoji: /^emot/, couleur: /^coul/, convives: /^(personne|convive)/, plat: /^plat/, comment: /^comment/, idvin: /^idvin|^id/ };
const CSV_ORDER = ['date', 'nom', 'mill', 'lieu', 'note', 'emoji', 'couleur', 'convives', 'plat', 'comment', 'idvin'];
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
function readDate(s) {
  s = String(s || '').trim(); let m;
  const ok = (y, mo, d) => { const dt = new Date(Date.UTC(y, mo - 1, d)); return y > 1900 && y < 2200 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null; };
  if ((m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/))) return ok(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
  if ((m = norm(s).match(/^(\d{1,2})(?:er)? ([a-z]+) (\d{4})$/))) { const mo = MOIS.indexOf(m[2]) + 1; return mo ? ok(+m[3], mo, +m[1]) : null; }
  return null;
}
// Codes couleur de Ploc : connus → couleur ; ambigus ou vides → le sommelier décide
const PLOC_HEX = {
  rouge: ['#8E1521', '#751A17', '#C3233A', '#C9193A', '#E4113F'], blanc: ['#F9F2B0', '#FFD464', '#F0C701', '#FFD374'],
  rose: ['#F39869', '#D97666', '#EFA58F', '#F3390B'], liquoreux: ['#9EC3C7'],
};
const hexColor = h => Object.keys(PLOC_HEX).find(k => PLOC_HEX[k].includes(String(h || '').trim().toUpperCase())) || '';
function csvTastings(rows) {
  const hdr = rows[0].map(c => norm(c).replace(/[^a-z]/g, ''));
  const hasHead = hdr.some(h => CSV_COLS.date.test(h)) && hdr.some(h => CSV_COLS.nom.test(h));
  const idx = {};
  if (hasHead) for (const [k, re] of Object.entries(CSV_COLS)) { const i = hdr.findIndex(h => re.test(h)); if (i >= 0) idx[k] = i; }
  else CSV_ORDER.forEach((k, i) => { idx[k] = i; });
  const body = hasHead ? rows.slice(1) : rows, get = (r, k) => idx[k] != null ? String(r[idx[k]] ?? '').trim() : '';
  const raw = body.map(r => num(get(r, 'note'))).filter(n => n != null);
  const scale100 = raw.some(n => n > 20);
  const items = [], bad = [];
  body.forEach((r, n) => {
    const line = n + (hasHead ? 2 : 1), at = readDate(get(r, 'date')), nom = get(r, 'nom').replace(/\s+/g, ' ').slice(0, 160);
    if (!at || !nom) return bad.push({ line, why: !nom ? 'nom du vin vide' : 'date illisible « ' + get(r, 'date').slice(0, 20) + ' »' });
    const nr = num(get(r, 'note')), note = nr == null || nr < 0 ? null : scale100 ? (nr > 100 ? null : Math.round(nr / 5 * 2) / 2) : nr > 20 ? null : Math.round(nr * 2) / 2;
    const comment = get(r, 'comment').replace(/^à compléter\s*$/i, '').slice(0, 1000);
    items.push({ n: line, at, nom, mill: readYear(get(r, 'mill'), thisYear() + 1).v || null, lieu: get(r, 'lieu').slice(0, 80), note, hex: get(r, 'couleur').slice(0, 9), couleur: hexColor(get(r, 'couleur')),
      convives: get(r, 'convives').replace(/[\s,;]+$/, '').slice(0, 120), plat: get(r, 'plat').replace(/[\s,;]+$/, '').slice(0, 120), comment, idvin: get(r, 'idvin').slice(0, 60), on: true });
  });
  return { items, bad, scale100 };
}
// Vins distincts du fichier (même IdVin, ou même nom et millésime)
function degWines(items) {
  const m = new Map();
  for (const it of items) {
    const k = it.idvin ? 'id:' + it.idvin : 'n:' + norm(it.nom) + '|' + (it.mill || '');
    if (!m.has(k)) m.set(k, { k, nom: it.nom, mill: it.mill, hex: it.hex, couleur: it.couleur, hint: it.comment.slice(0, 120), domaine: '', appellation: '', cuvee: '', region: '', pays: '', fill: [], match: null });
    it.wk = k;
  }
  return [...m.values()];
}
const DEG_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['i', 'domaine', 'appellation', 'cuvee', 'region', 'pays', 'couleur'],
  properties: { i: { type: 'integer' }, domaine: { type: 'string' }, appellation: { type: 'string' }, cuvee: { type: 'string' }, region: { type: 'string' }, pays: { type: 'string' },
    couleur: { type: 'string', enum: ['', 'rouge', 'blanc', 'rose', 'effervescent', 'liquoreux', 'orange'] } } } } } };
const DEG_SYS = `Tu aides à importer des dégustations depuis l’application Ploc. Le champ « nom » y est unique et mélange, dans n’importe quel ordre, le domaine (ou château, ou producteur), l’appellation et le nom de cuvée (ex. « Chablis - Jean Dauvissat », « Les Argiles, François Chidaine », « La Planche - Jean louis Mauler »).
Pour chaque vin numéroté i :
- sépare domaine, appellation et cuvée ; écris-les proprement (accents, majuscules) ; un château sans cuvée va dans « domaine » ;
- complète le domaine, l’appellation, la région et le pays si tu les reconnais avec une bonne certitude (un second vin ou une cuvée connue de son domaine, une appellation déduite du nom) ; sinon laisse vide, l’utilisateur complétera ;
- écris de façon identique les variantes d’un même vin (« Chateau Margaux » et « Château Margaux » ; « Les Haut De Smith » et « Les Hauts De Smith ») ;
- couleur : vide si le code couleur de Ploc est indiqué comme fiable ; sinon déduis-la (rouge, blanc, rose, effervescent, liquoreux, orange). Signale « effervescent » pour un champagne, un crémant ou une méthode traditionnelle, même si un code est indiqué ;
- le commentaire éventuel (cépages, appellation) est un indice.
N’invente pas de domaine ni d’appellation incertains.`;
async function degFill(ws, progress) {
  for (let k = 0; k < ws.length; k += 40) {
    const chunk = ws.slice(k, k + 40);
    const r = await aiCall({ tag: 'ploc-degustations', system: DEG_SYS, schema: DEG_SCHEMA, maxTokens: 12000, effort: 'medium',
      content: chunk.map((w, i) => `#${i} nom « ${w.nom} » | millésime ${w.mill || 'non indiqué'} | couleur Ploc ${w.couleur ? COLORS[w.couleur].label + ' (fiable)' : w.hex ? w.hex + ' (incertaine)' : 'absente'}${w.hint ? ' | commentaire « ' + w.hint + ' »' : ''}`).join('\n') });
    for (const f of r.json?.items || []) {
      const w = chunk[int(f.i)]; if (!w) continue;
      const src = norm(w.nom + ' ' + w.hint);
      for (const key of ['domaine', 'appellation', 'cuvee', 'region', 'pays']) {
        const v = String(f[key] || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!v) continue;
        w[key] = v;
        if (!src.includes(norm(v)) && key !== 'pays') w.fill.push(key);   // pris hors du nom : à vérifier
      }
      if (f.couleur === 'effervescent' || (!w.couleur && COLORS[f.couleur])) { if (w.couleur !== f.couleur && w.couleur) w.fill.push('couleur'); w.couleur = f.couleur; }
    }
    progress(Math.min(ws.length, k + 40));
  }
}
// Sans le sommelier : le nom reste entier, en cuvée, à compléter
function degRaw(w) { if (!w.domaine && !w.appellation && !w.cuvee) w.cuvee = w.nom; }
const degKey = w => [norm(w.domaine), norm(w.cuvee || w.appellation), w.mill || w.millesime || null].join('|');
function degMatch(w) {
  const k = degKey(w), nn = norm(w.nom);
  const m = S.wines.find(x => x.kind === 'vin' && [norm(x.domaine), norm(x.cuvee || x.appellation), x.millesime || null].join('|') === k)
    || S.wines.find(x => x.kind === 'vin' && (x.millesime || null) === (w.mill || null) && norm(wineName(x) + ' ' + (x.domaine || '')).includes(nn));
  w.match = m?.id || null;
}
const degWine = k => degImport.wines.find(w => w.k === k);
const DEG_LABELS = { domaine: 'domaine', appellation: 'appellation', cuvee: 'cuvée', region: 'région', couleur: 'couleur' };
const degDone = it => { const w = degWine(it.wk); return !!(w.match && S.tastings.some(t => t.wineId === w.match && t.at === it.at && (t.note ?? null) === (it.note ?? null))); };
async function onTastingCsv(file) {
  if (!file) return;
  if (file.size > 5e6) return toast('Fichier trop volumineux (5 Mo maximum)');
  try {
    const rows = parseCsv(decodeText(await file.arrayBuffer()));
    if (rows.length < 2) throw new Error('Le fichier ne contient aucune dégustation.');
    const r = csvTastings(rows);
    if (!r.items.length) throw new Error('Aucune ligne lisible : vérifie qu’il s’agit bien de l’export des dégustations de Ploc.');
    degImport = { ...r, wines: degWines(r.items) };
    const n = degImport.wines.length, ai = aiReady() && aiClaude(), cost = Math.max(0.05, Math.ceil(n / 40) * 0.05) * (S.settings.rate || 0.92);
    showSheet(() => `${head('Dégustations Ploc')}
      <p>${plural(r.items.length, 'dégustation lue', 'dégustations lues')}, ${plural(n, 'vin différent', 'vins différents')}.</p>
      ${r.bad.length ? `<p class="small" style="color:var(--bx)">${plural(r.bad.length, 'ligne ignorée', 'lignes ignorées')} : ${r.bad.slice(0, 5).map(b => `ligne ${b.line} (${esc(b.why)})`).join(', ')}${r.bad.length > 5 ? '…' : ''}</p>` : ''}
      ${ai ? `<p class="small">Le sommelier va démêler le nom de chaque vin (domaine, appellation, cuvée) et compléter ce qu’il reconnaît. Coût indicatif : environ ${fmtE2.format(cost)}. Tu vérifies tout ensuite.</p>
        <button class="btn primary wide" data-act="degAi">${ICON.spark} Lancer le sommelier</button>
        <button class="btn ghost wide" data-act="degNoAi">Continuer sans le sommelier</button>`
      : `<p class="small">Sans clé IA, les noms sont gardés tels quels, à compléter sur l’écran suivant.</p><button class="btn primary wide" data-act="degNoAi">Continuer</button>`}`);
  } catch (e) { degImport = null; showSheet(() => `${head('Import impossible')}<p>${esc(e.message || String(e))}</p><button class="btn wide" data-act="close">Fermer</button>`); }
}
function degPrepare() {
  for (const w of degImport.wines) { degRaw(w); if (!w.couleur) w.couleur = ''; degMatch(w); }
  showSheet(degReview, { replace: true, full: true });
}
// Écran de vérification, regroupé par séance (au moins deux dégustations le même jour)
function degGroups() {
  const by = new Map(); for (const it of degImport.items) { if (!by.has(it.at)) by.set(it.at, []); by.get(it.at).push(it); }
  return [...by].sort((a, b) => b[0].localeCompare(a[0]));
}
function degReview() {
  const D = degImport; if (!D) return null;
  const todo = D.items.filter(it => it.on && !degDone(it)).length;
  const wRow = it => {
    const w = degWine(it.wk), done = degDone(it), title = [w.domaine, w.appellation, w.cuvee && `« ${w.cuvee} »`].filter(Boolean).join(' · ') || w.nom;
    return `<div class="li" style="${!it.on || done ? 'opacity:.45;' : ''}align-items:flex-start"><span class="dot" style="background:${COLORS[w.couleur]?.c || '#B9AFA6'};margin-top:4px"></span>
      <button class="lb" style="align-items:flex-start" data-act="degEdit" data-k="${esc(w.k)}"><div class="it"><b>${esc(title)} ${esc(w.mill || '')}</b>
        <small>${esc(['Ploc : ' + w.nom, it.lieu, it.convives].filter(Boolean).join(' · '))}</small>
        <small>${done ? '<span class="tag">déjà importée</span>' : w.match ? '<span class="tag g">vin de ta cave</span>' : '<span class="tag">nouveau vin</span>'}${w.fill.length ? ` <span class="tag o">à vérifier : ${esc(w.fill.map(f => DEG_LABELS[f] || f).join(', '))}</span>` : ''}${!w.domaine && !w.appellation ? ' <span class="tag o">à compléter</span>' : ''}</small></div></button>
      ${noteBadge(it.note)}<button class="chev" data-act="degToggle" data-n="${it.n}" aria-label="${it.on ? 'Ne pas importer' : 'Importer'}" style="background:none;border:0;padding:4px">${it.on && !done ? ICON.check : ''}</button></div>`;
  };
  return `${head('Vérifier les dégustations')}
    <p class="small" style="margin-top:-6px">Touche un vin pour corriger son domaine, son appellation ou sa cuvée, ou le rapprocher d’un vin de ta cave. Touche ✓ pour ignorer une dégustation.</p>
    ${degGroups().map(([at, l]) => `<div class="sect">${l.length > 1 ? `Séance du ${esc(fmtDate(at))}${(() => { const lieu = degPlace(l); return lieu ? ' · ' + esc(lieu) : ''; })()} · ${l.length}` : esc(fmtDate(at))}</div><div class="list">${l.map(wRow).join('')}</div>`).join('')}
    <button class="btn primary wide" style="margin-top:14px;position:sticky;bottom:0" data-act="degGo">${todo ? 'Importer ' + plural(todo, 'dégustation', 'dégustations') : 'Rien de nouveau à importer'}</button>`;
}
// Lieu d'une séance : le plus fréquent
function degPlace(l) { const c = new Map(); for (const it of l) if (it.lieu) c.set(it.lieu, (c.get(it.lieu) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || ''; }
function degEditSheet(k) {
  const w = degWine(k); if (!w) return null;
  const cands = S.wines.filter(x => x.kind === 'vin' && (x.millesime || null) === (w.mill || null) && (norm(x.domaine) && norm(w.domaine) && norm(x.domaine) === norm(w.domaine) || norm(x.appellation) && norm(x.appellation) === norm(w.appellation) || x.id === w.match)).slice(0, 12);
  return `${head('Vin importé')}<p class="small" style="margin-top:-6px">Dans Ploc : « ${esc(w.nom)} » ${esc(w.mill || '')}</p>
    <form class="form" data-form="degEdit" data-k="${esc(k)}">
      <label>Couleur<select name="couleur"><option value="">?</option>${opts(COLORS, w.couleur)}</select></label>
      <label>Domaine${w.fill.includes('domaine') ? ' <span class="tag o">à vérifier</span>' : ''}<input name="domaine" value="${esc(w.domaine)}" autocomplete="off"></label>
      <label>Appellation${w.fill.includes('appellation') ? ' <span class="tag o">à vérifier</span>' : ''}<input name="appellation" value="${esc(w.appellation)}" autocomplete="off"></label>
      <label>Cuvée${w.fill.includes('cuvee') ? ' <span class="tag o">à vérifier</span>' : ''}<input name="cuvee" value="${esc(w.cuvee)}" autocomplete="off"></label>
      <div class="grid2"><label>Région<input name="region" value="${esc(w.region)}" autocomplete="off"></label><label>Millésime<input name="mill" inputmode="numeric" value="${esc(w.mill || '')}"></label></div>
      <label>Vin de ta cave<select name="match"><option value="">Nouveau vin (sans bouteille)</option>${cands.map(x => `<option value="${x.id}" ${x.id === w.match ? 'selected' : ''}>${esc(wineTitle(x))} · ${esc(x.domaine || '')}</option>`).join('')}</select></label>
      <p class="tiny" style="margin:0">S’applique à toutes les dégustations de ce vin dans le fichier.</p>
      <button class="btn primary wide" type="submit">Enregistrer</button></form>`;
}
FORMS.degEdit = (f, d) => {
  const w = degWine(f.dataset.k); if (!w) return sheetBack();
  const m = readYear(d.mill, thisYear() + 1); if (m.err || m.bad) return formErrors(f, [['mill', 'Une année, ou vide']]);
  const t = v => String(v || '').trim().slice(0, 120);
  for (const k of ['domaine', 'appellation', 'cuvee', 'region']) if (t(d[k]) !== w[k]) { w[k] = t(d[k]); w.fill = w.fill.filter(x => x !== k); }
  if (d.couleur !== w.couleur) { w.couleur = COLORS[d.couleur] ? d.couleur : ''; w.fill = w.fill.filter(x => x !== 'couleur'); }
  w.mill = m.v || null;
  w.match = d.match && wine(d.match) ? d.match : null;
  sheetBack(); refreshSheet();
};
Object.assign(ACT, {
  plocCsvPick: () => { const i = $('#f-csv'); i.value = ''; i.click(); },
  degNoAi: () => degPrepare(),
  degAi: async () => {
    const n = degImport.wines.length;
    const step = k => showSheet(() => `${head('Dégustations Ploc')}<p>Le sommelier démêle les noms : ${k} / ${n}…</p><div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`, { replace: true });
    step(0);
    try { await degFill(degImport.wines, step); }
    catch (e) { toast('Sommelier indisponible : ' + (e.message || '').split('\n')[0] + ' · noms gardés tels quels'); }
    degPrepare();
  },
  degEdit: t => showSheet(() => degEditSheet(t.dataset.k)),
  degToggle: t => { const it = degImport?.items.find(x => x.n === +t.dataset.n); if (it) { it.on = !it.on; refreshSheet(); } },
  degGo: async () => {
    const D = degImport; if (!D) return;
    const made = new Map(); let nt = 0, nw = 0, ns = 0;
    const target = w => {
      if (w.match && wine(w.match)) return wine(w.match);
      const k = degKey(w); if (made.has(k)) return made.get(k);
      const x = { id: uid(), kind: 'vin', domaine: w.domaine, cuvee: w.cuvee, appellation: w.appellation, region: w.region, pays: w.pays || 'France', couleur: w.couleur || 'rouge', millesime: w.mill, format: '75', createdAt: Date.now(), notes: 'Créé à l’import des dégustations Ploc' };
      S.wines.push(x); made.set(k, x); nw++; return x;
    };
    for (const [at, l] of degGroups()) {
      const keep = l.filter(it => it.on && !degDone(it)); if (!keep.length) continue;
      let sid = null;
      if (l.length > 1) {
        let s = S.sessions.find(x => x.date === at);
        if (!s) { const lieu = degPlace(l); s = { id: uid(), titre: lieu || `Dégustation du ${fmtDate(at)}`, type: null, lieu, date: at, convives: '' }; S.sessions.push(s); ns++; }
        sid = s.id;
      }
      for (const it of keep) {
        const w = target(degWine(it.wk));
        if (S.tastings.some(t => t.wineId === w.id && t.at === at && (t.note ?? null) === (it.note ?? null))) continue;
        S.tastings.push({ id: uid(), wineId: w.id, bottleId: null, at, note: it.note, comment: it.comment, plat: it.plat, lieu: it.lieu, convives: it.convives, type: null, sessionId: sid, horsCave: true, ploc: true });
        nt++;
      }
    }
    degImport = null; await save(); closeSheet(); view = 'deg'; render();
    toast(`${plural(nt, 'dégustation importée', 'dégustations importées')}${ns ? ` · ${plural(ns, 'séance', 'séances')}` : ''}${nw ? ` · ${plural(nw, 'nouveau vin', 'nouveaux vins')}` : ''}`);
  },
});
