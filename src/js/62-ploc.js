/* ---------- Import depuis Ploc (PDF) ----------
   Un export Ploc porte sur une cave : un plan (grille de ronds numérotés), une légende (numéro → vin)
   et une fiche par vin. Les champs remplis dans Ploc sont repris tels quels ; le sommelier ne complète
   que les champs vides et donne son avis sur la fenêtre de garde. Le rapprochement avec les sites se fait
   ici, sur l'appareil : la liste des sites n'est jamais envoyée à l'IA. */
const PLOC_SCHEMA = { type: 'object', additionalProperties: false, required: ['caves', 'vins'], properties: {
  caves: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nom', 'lignes', 'colonnes', 'cases'], properties: {
    nom: { type: 'string' }, lignes: { type: 'integer' }, colonnes: { type: 'integer' },
    cases: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ligne', 'colonne', 'numero'], properties: { ligne: { type: 'integer' }, colonne: { type: 'integer' }, numero: { type: 'integer' } } } } } } },
  vins: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['numero', 'titre', 'millesime', 'couleur', 'alcool', 'apogee', 'estimation', 'producteur', 'pays', 'region', 'appellation', 'cepages', 'cuvee', 'contenance', 'stock', 'caves', 'servir', 'accords', 'note'],
    properties: { numero: { type: 'integer' }, titre: { type: 'string' }, millesime: { type: 'string' }, couleur: { type: 'string' }, alcool: { type: 'string' }, apogee: { type: 'string' },
      estimation: { type: 'string' }, producteur: { type: 'string' }, pays: { type: 'string' }, region: { type: 'string' }, appellation: { type: 'string' }, cepages: { type: 'string' },
      cuvee: { type: 'string' }, contenance: { type: 'string' }, stock: { type: 'integer' }, servir: { type: 'string' }, accords: { type: 'string' }, note: { type: 'string' },
      caves: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nom', 'quantite'], properties: { nom: { type: 'string' }, quantite: { type: 'integer' } } } } } } } } };
const PLOC_SYS = `Tu lis un PDF exporté par l’application Ploc et tu en recopies le contenu, sans rien inventer ni corriger.
Structure habituelle : une page de plan (une grille de ronds ; un rond occupé porte le numéro d’un vin), une page de légende (numéro → millésime et nom du vin), puis une fiche par vin (tableau COULEUR, ALCOOL, APOGÉE, ESTIMATION, PRODUCTEUR, PAYS, RÉGION, APPELLATION, CÉPAGES, STOCK, CONTENANCE, CAVE ou CAVES, SERVIR À, ACCORDS, CLASSEMENT, CUVÉE…).
- « caves » : un élément par plan présent dans le PDF. « nom » : le nom de la cave tel qu’écrit au-dessus du plan. « lignes » et « colonnes » : dimensions de la grille, ronds vides compris. « cases » : uniquement les ronds occupés, avec ligne (1 = en haut) et colonne (1 = à gauche) et le numéro inscrit. Aucun plan : liste vide.
- « vins » : une entrée par fiche. « numero » : son numéro dans la légende (0 si absent). « titre » : le grand titre de la fiche, sans le millésime. « millesime » : l’année affichée, ou vide.
- Recopie chaque champ de la fiche tel qu’écrit (« 2021/2028 », « 15€ », « 750ml », « 10-12° »…) ; chaîne vide si le champ est vide sur la fiche.
- « caves » d’un vin : chaque cave citée dans CAVE ou CAVES avec sa quantité (« Cave A : 1, Étagère B : 2 » donne deux éléments). « stock » : le nombre STOCK.
- « note » : le nombre écrit en haut à droite, au-dessus du trait et de « 100 » (ex. « 75 »). S’il n’y a que « 100 » sous le trait, la note est vide.
- Un autre format (simple liste) : remplis ce que tu trouves, caves vide.`;
const PLOC_FILL_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['i', 'producteur', 'appellation', 'region', 'pays', 'cepages', 'couleur', 'debut', 'pic', 'fin', 'justification'],
  properties: { i: { type: 'integer' }, producteur: { type: 'string' }, appellation: { type: 'string' }, region: { type: 'string' }, pays: { type: 'string' }, cepages: { type: 'string' },
    couleur: { type: 'string', enum: ['', 'rouge', 'blanc', 'rose', 'effervescent', 'liquoreux', 'orange'] }, debut: { type: 'integer' }, pic: { type: 'integer' }, fin: { type: 'integer' }, justification: { type: 'string' } } } } } };
const PLOC_FILL_FIELDS = { producteur: 'producteur', appellation: 'appellation', region: 'région', pays: 'pays', cepages: 'cépages', couleur: 'couleur' };
let plocData = null;

/* Lecture des valeurs Ploc */
const plocText = (s, n = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
function plocColor(s) {
  const x = norm(s);
  if (!x) return '';
  if (/efferv|petill|mousseu|champagne|cremant/.test(x)) return 'effervescent';
  if (/liquor|moelleu|doux/.test(x)) return 'liquoreux';
  if (/ros/.test(x)) return 'rose';
  if (/rouge/.test(x)) return 'rouge';
  if (/orange/.test(x)) return 'orange';
  if (/blanc/.test(x)) return 'blanc';
  return '';
}
// « 750ml » → '75', « 1,5 l » → '150', « 37,5 cl » → '37.5' ; inconnu → bouteille
function plocFormat(s) {
  const m = String(s || '').toLowerCase().replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)(ml|cl|l)/);
  if (!m) return '75';
  const v = +m[1].replace(',', '.'), cl = m[2] === 'ml' ? v / 10 : m[2] === 'l' ? v * 100 : v;
  const f = FORMATS.vin.find(([k]) => Math.abs(+k - cl) < 0.6);
  return f ? f[0] : '75';
}
// « 2021/2028 » → fenêtre 2021–2028, apogée au milieu
function plocWindow(s, mill) {
  const ys = (String(s || '').match(/\b(19|20|21)\d{2}\b/g) || []).map(Number);
  if (ys.length < 2) return null;
  const deb = Math.min(ys[0], ys[1]), fin = Math.max(ys[0], ys[1]);
  return cleanWindow(deb, Math.round((deb + fin) / 2), fin, mill);
}
// Note sur 100 → sur 20, au demi-point
function plocNote(s) {
  const n = num(String(s || '').replace(/\/\s*100/, ''));
  return n != null && n > 0 && n <= 100 ? Math.round(n / 5 * 2) / 2 : null;
}
// Retire une suite de mots (producteur, appellation) du titre, sans tenir compte des accents ni de la casse
function plocStrip(title, part) {
  const tk = String(title || '').split(/\s+/).filter(Boolean), pk = String(part || '').split(/\s+/).filter(Boolean).map(norm);
  if (!pk.length) return tk.join(' ');
  for (let i = 0; i + pk.length <= tk.length; i++) if (pk.every((p, j) => norm(tk[i + j]) === p)) { tk.splice(i, pk.length); break; }
  return tk.join(' ');
}
const plocCuvee = (title, prod, app) => plocStrip(plocStrip(title, prod), app).replace(/^[\s\-–—,·:]+|[\s\-–—,·:]+$/g, '').trim();
// Site d'une cave Ploc : « Maison - Cave 1 » → site « Maison » ; sinon un site dont le nom figure dans celui de la cave
const plocHint = name => name.includes(' - ') ? name.split(' - ')[0].trim() : '';
const plocWords = s => ' ' + norm(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
function plocSite(name) {
  const h = plocHint(name);
  return (h && S.sites.find(s => norm(s.name) === norm(h))) || S.sites.find(s => plocWords(s.name).trim().length >= 3 && plocWords(name).includes(plocWords(s.name)));
}
const plocUnitName = name => (plocHint(name) ? name.slice(name.indexOf(' - ') + 3) : name).trim() || name;
const plocKey = (w, it) => [norm(w.domaine), norm(w.cuvee || w.appellation), w.millesime || null].join('|') === [norm(it.domaine), norm(it.cuvee || it.appellation), it.millesime || null].join('|');
function plocDefaultUnit(c) {
  if (!c.plan || !c.spaceId) return c.plan ? 'new' : 'none';
  const same = spaceUnits(c.spaceId).find(u => !UNIT_TYPES[u.type].box && norm(u.name) === norm(c.unitName) && u.rows === c.plan.rows && u.cols === c.plan.cols);
  return same ? same.id : 'new';
}

Object.assign(ACT, {
  importPloc: () => {
    if (!aiReady() || !aiClaude()) return sheetMsg('Import depuis Ploc', 'L’import lit le PDF avec Claude : ajoute une clé Anthropic dans Plus › Intelligence artificielle, puis recommence.');
    showSheet(() => `${head('Importer depuis Ploc')}
      <p>Dans Ploc, exporte une cave en PDF (plan, légende et fiches des vins), puis choisis le fichier ici.</p>
      <p class="small">Le sommelier lit le PDF et reprend les fiches de Ploc telles quelles : couleur, degré, fenêtre de garde, estimation, contenance, température de service, accords, note. Il ne complète que les champs vides et te signale les fenêtres qui lui semblent décalées. Tu vérifies tout avant l’import, plan compris.</p>
      <p class="small">Plusieurs caves ? Importe-les une à une : un vin déjà importé n’est pas recréé. Coût indicatif : 10 à 40 centimes par export.</p>
      <button class="btn primary wide" data-act="plocPick">${ICON.doc} Choisir le PDF</button>`);
  },
  plocPick: () => { const i = $('#f-pdf'); i.value = ''; i.click(); },
  plocToggle: t => { const it = plocData?.wines[+t.dataset.i]; if (it) { it.skip = !it.skip; refreshSheet(); } },
  plocWin: t => { const it = plocData?.wines[+t.dataset.i]; if (it) { it.win = t.dataset.v === 'ia' ? 'ia' : 'ploc'; refreshSheet(); } },
  plocGo: async () => {
    if (!plocData) return;
    const P = plocData, miss = P.caves.find(c => !c.skip && !c.spaceId && plocCount(c) > 0);
    if (miss) return toast(`Choisis où ranger « ${miss.name} »`);
    // Sites renommés au nom de Ploc
    for (const c of P.caves) if (!c.skip && c.rename && c.hint) { const s = site(space(c.spaceId)?.siteId); if (s) s.name = c.hint; }
    // Meubles créés à l'identique du plan
    for (const c of P.caves) {
      c.unit = null;
      if (c.skip || !c.plan || !c.spaceId || c.unitMode === 'none') continue;
      if (c.unitMode === 'new') { const u = { id: uid(), order: S.units.length, type: 'rack', name: c.unitName, spaceId: c.spaceId, rows: c.plan.rows, cols: c.plan.cols }; S.units.push(u); c.unit = u; }
      else c.unit = unit(c.unitMode) || null;
    }
    const occ = occupancy();
    let nw = 0, nb = 0, placed = 0, first = null;
    for (const it of P.wines) {
      if (it.skip) continue;
      const per = it.per.filter(x => !x.done && !P.caves[x.cave].skip && P.caves[x.cave].spaceId);
      if (!per.length) continue;
      let w = S.wines.find(x => x.kind === 'vin' && plocKey(x, it)), fresh = false;
      if (!w) {
        const win = it.win === 'ia' && it.ia ? it.ia : it.ploc || it.ia;
        w = { id: uid(), kind: 'vin', domaine: it.domaine, cuvee: it.cuvee, appellation: it.appellation, region: it.region, pays: it.pays, couleur: it.couleur || 'rouge', cepages: it.cepages,
          millesime: it.millesime, format: it.format, degre: it.degre, service: it.service, createdAt: Date.now(),
          achat: { prix: it.prix, date: null, lieu: '' }, notes: ['Importé depuis Ploc', it.accords && 'Accords Ploc : ' + it.accords].filter(Boolean).join('\n') };
        if (win) w.apogee = win === it.ploc && it.win !== 'ia'
          ? { debut: win.debut, pic: win.pic, fin: win.fin, src: 'ploc', why: 'Fenêtre reprise de Ploc.', at: Date.now() }
          : { debut: win.debut, pic: win.pic, fin: win.fin, src: 'ia', why: it.ia?.why || 'Estimation à l’import, sans recherche web.', at: Date.now() };
        S.wines.push(w); nw++; fresh = true;
      } else if (!w.service && it.service) w.service = it.service;
      for (const x of per) {
        const c = P.caves[x.cave], cells = c.plan ? c.plan.cells.filter(z => z.n === it.n && it.n > 0) : [];
        const ids = createBottles(w, Math.max(x.q, cells.length), { spaceId: c.spaceId });
        first ||= c.spaceId;
        ids.forEach((id, k) => {
          const b = byId(S.bottles, id), z = cells[k];
          b.plocCave = c.name;
          const u = c.unit, key = z && u && `${u.id}:${z.r - 1}:${z.c - 1}`;
          if (z && u && z.r >= 1 && z.c >= 1 && z.r <= u.rows && z.c <= u.cols && !occ.has(key)) { b.unitId = u.id; b.r = z.r - 1; b.c = z.c - 1; occ.set(key, b); placed++; }
          else b.note = 'Emplacement Ploc : ' + c.name + (z ? `, ligne ${z.r}, colonne ${z.c}` : '');
        });
        nb += ids.length;
      }
      if (it.note20 != null && (fresh || !S.tastings.some(t => t.wineId === w.id && t.plocNote)))
        S.tastings.push({ id: uid(), wineId: w.id, bottleId: null, at: today(), note: it.note20, comment: 'Note importée de Ploc', type: null, horsCave: false, plocNote: true });
    }
    plocData = null; await save(); closeSheet();
    if (first) { caveSpace = first; view = 'cave'; caveMode = 'plan'; }
    render();
    toast(nb ? `${plural(nb, 'bouteille importée', 'bouteilles importées')}, ${placed} à ${placed > 1 ? 'leur' : 'sa'} place${nw ? ` · ${plural(nw, 'nouvelle référence', 'nouvelles références')}` : ''}` : 'Rien de nouveau à importer');
  },
});
Object.assign(CHANGES, {
  plocSpace: el => { const c = plocData?.caves[+el.dataset.k]; if (!c) return; c.skip = el.value === 'skip'; c.spaceId = c.skip ? null : el.value || null; c.unitMode = plocDefaultUnit(c); refreshSheet(); },
  plocUnit: el => { const c = plocData?.caves[+el.dataset.k]; if (c) { c.unitMode = el.value; refreshSheet(); } },
  plocRename: el => { const c = plocData?.caves[+el.dataset.k]; if (c) c.rename = el.checked; },
});

async function onPdf(file) {
  if (!file) return;
  if (file.size > 25e6) return toast('PDF trop volumineux (25 Mo maximum)');
  const step = msg => showSheet(() => `${head('Import depuis Ploc')}<p>${esc(msg)}</p><div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`, { replace: true });
  step('Lecture du PDF…');
  try {
    const data = b64(await file.arrayBuffer());
    const r = await aiCall({ tag: 'ploc', system: PLOC_SYS, content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }, { type: 'text', text: 'Recopie le plan, la légende et les fiches de ce PDF.' }], schema: PLOC_SCHEMA, maxTokens: 32000, effort: 'low' });
    plocData = plocParse(r.json || {});
    if (!plocData.wines.length) { plocData = null; throw new AIError('Aucun vin trouvé dans ce PDF.'); }
    step(`${plural(plocData.wines.length, 'vin trouvé', 'vins trouvés')}. Le sommelier complète les fiches et vérifie les fenêtres de garde…`);
    await plocFill(plocData.wines, k => step(`Fiches vérifiées : ${k} / ${plocData.wines.length}…`));
    for (const it of plocData.wines) plocFinish(it);
    showSheet(plocReview, { replace: true, full: true });
  } catch (e) { plocData = null; showSheet(() => `${head('Import impossible')}<p style="white-space:pre-wrap">${esc(e.message || String(e))}</p><button class="btn wide" data-act="close">Fermer</button>`, { replace: true }); }
}
// Réponse de l'IA → caves et vins, valeurs bornées
function plocParse(j) {
  const caves = [], caveIdx = name => {
    const nm = plocText(name, 80) || 'Cave Ploc', i = caves.findIndex(c => norm(c.name) === norm(nm));
    if (i >= 0) return i;
    caves.push({ name: nm, hint: plocHint(nm), unitName: plocUnitName(nm), plan: null }); return caves.length - 1;
  };
  for (const p of Array.isArray(j.caves) ? j.caves : []) {
    const rows = clamp(int(p.lignes) || 0, 0, 40), cols = clamp(int(p.colonnes) || 0, 0, 40);
    if (!rows || !cols) continue;
    const seen = new Set(), cells = [];
    for (const z of Array.isArray(p.cases) ? p.cases : []) {
      const rr = int(z.ligne), cc = int(z.colonne), n = int(z.numero), k = rr + ':' + cc;
      if (rr >= 1 && cc >= 1 && rr <= rows && cc <= cols && n > 0 && !seen.has(k)) { seen.add(k); cells.push({ r: rr, c: cc, n }); }
    }
    caves[caveIdx(p.nom)].plan = { rows, cols, cells };
  }
  const wines = [];
  for (const v of Array.isArray(j.vins) ? j.vins : []) {
    const title = plocText(v.titre, 160);
    if (!title) continue;
    const mill = readYear(plocText(v.millesime, 8).match(/\d{4}|\d{2}/)?.[0] || '', thisYear() + 1).v || null;
    const g = num(v.alcool), prix = num(String(v.estimation || '').replace(/[^\d,.\s]/g, ''));
    const it = { n: int(v.numero) > 0 ? int(v.numero) : 0, title, millesime: mill, couleur: plocColor(v.couleur), degre: g != null && g > 0 && g <= 25 ? g : null,
      prix: prix != null && prix >= 0 && prix <= 100000 ? prix : null, producteur: plocText(v.producteur, 120), pays: plocText(v.pays, 60), region: plocText(v.region, 80),
      appellation: plocText(v.appellation, 120), cepages: plocText(v.cepages, 160), cuveeP: plocText(v.cuvee, 120), format: plocFormat(v.contenance),
      service: plocText(v.servir, 40), accords: plocText(v.accords, 300), note20: plocNote(v.note), ploc: plocWindow(v.apogee, mill), fill: [], per: [] };
    for (const x of Array.isArray(v.caves) ? v.caves : []) {
      if (!plocText(x.nom)) continue;
      const q = int(x.quantite), ci = caveIdx(x.nom), e = it.per.find(p => p.cave === ci);
      const qq = !q || q < 1 ? 1 : Math.min(q, 200), qfix = qq !== q;
      if (e) e.q = Math.min(200, e.q + qq); else it.per.push({ cave: ci, q: qq, qfix });
    }
    wines.push(it);
  }
  // Ronds du plan sans quantité sur la fiche, et fiches sans cave : on se fie au plan, puis au stock
  caves.forEach((c, ci) => { if (c.plan) for (const it of wines) if (it.n && !it.per.some(p => p.cave === ci) && c.plan.cells.some(z => z.n === it.n)) it.per.push({ cave: ci, q: 1 }); });
  for (const it of wines) if (!it.per.length) {
    const v = j.vins.find(x => plocText(x.titre, 160) === it.title), q = int(v?.stock);
    it.per.push({ cave: caveIdx(caves.length === 1 ? caves[0].name : 'Cave Ploc'), q: !q || q < 1 ? 1 : Math.min(q, 200), qfix: !q || q < 1 || q > 200 });
  }
  // Une note de 100 sur toutes les fiches : c'est le « 100 » du gabarit, pas une note
  if (wines.length >= 3 && wines.every(it => it.note20 === 20)) for (const it of wines) it.note20 = null;
  for (const c of caves) { const s = plocSite(c.name), sps = s ? siteSpaces(s.id) : S.spaces.length === 1 ? S.spaces : [];
    c.site = s?.id || null; c.spaceId = (sps.find(x => x.use === 'garde') || sps[0])?.id || null; c.rename = false; c.skip = false; c.unitMode = plocDefaultUnit(c); }
  return { caves, wines };
}
// Le sommelier complète les champs vides et donne sa propre fenêtre (sans recherche web)
async function plocFill(items, progress) {
  for (let k = 0; k < items.length; k += 40) {
    const chunk = items.slice(k, k + 40);
    try {
      const e = await aiCall({ tag: 'ploc-fiches', schema: PLOC_FILL_SCHEMA, maxTokens: 12000, effort: 'low',
        system: `Tu complètes des fiches de vins importées de Ploc. Pour chaque vin : renvoie le producteur, l’appellation, la région, le pays, les cépages et la couleur UNIQUEMENT si le champ est vide (sinon chaîne vide) ; déduis-les du titre et de tes connaissances, chaîne vide si tu n’es pas sûr. Donne aussi ta propre fenêtre de dégustation (début, apogée, fin, en années) pour un stockage correct, et une justification d’une phrase. Année actuelle : ${thisYear()}. Réponds pour chaque vin avec son numéro i.`,
        content: chunk.map((x, i) => `#${i} ${x.title} | millésime ${x.millesime || 'NM'} | producteur=${x.producteur || '?'} | appellation=${x.appellation || '?'} | région=${x.region || '?'} | pays=${x.pays || '?'} | cépages=${x.cepages || '?'} | couleur=${x.couleur ? COLORS[x.couleur].label : '?'} | fenêtre Ploc=${x.ploc ? x.ploc.debut + '–' + x.ploc.fin : 'aucune'}`).join('\n') });
      for (const f of e.json?.items || []) {
        const it = chunk[int(f.i)]; if (!it) continue;
        for (const key of Object.keys(PLOC_FILL_FIELDS)) {
          const val = key === 'couleur' ? (COLORS[f.couleur] ? f.couleur : '') : plocText(f[key], 160);
          if (val && !it[key]) { it[key] = val; it.fill.push(PLOC_FILL_FIELDS[key]); }
        }
        const cw = cleanWindow(int(f.debut), int(f.pic), int(f.fin), it.millesime);
        if (cw?.fin) it.ia = { ...cw, why: plocText(f.justification, 300) };
      }
    } catch (err) { /* l'import reste possible sans le sommelier */ }
    progress(Math.min(items.length, k + 40));
  }
}
function plocFinish(it) {
  it.domaine = it.producteur || it.title;
  it.cuvee = it.cuveeP || plocCuvee(it.title, it.producteur, it.appellation);
  if (norm(it.cuvee) === norm(it.domaine)) it.cuvee = '';
  if (!it.appellation && !it.cuvee) it.cuvee = it.title;
  it.pays ||= 'France';
  // Fenêtre : celle de Ploc par défaut ; proposition du sommelier si elle s'en écarte d'au moins 2 ans
  it.diff = !!(it.ploc && it.ia && (Math.abs((it.ia.debut ?? it.ploc.debut) - it.ploc.debut) >= 2 || Math.abs(it.ia.fin - it.ploc.fin) >= 2));
  it.win = it.ploc ? 'ploc' : 'ia';
  const w0 = S.wines.find(x => x.kind === 'vin' && plocKey(x, it));
  it.existing = !!w0;
  for (const p of it.per) p.done = !!(w0 && S.bottles.some(b => b.wineId === w0.id && b.plocCave === plocData.caves[p.cave].name));
}
// Bouteilles d'une cave Ploc qui seront importées
function plocCount(c) {
  const ci = plocData.caves.indexOf(c);
  return plocData.wines.reduce((n, it) => { const p = it.per.find(x => x.cave === ci); if (it.skip || !p || p.done) return n;
    return n + Math.max(p.q, c.plan ? c.plan.cells.filter(z => z.n === it.n && it.n > 0).length : 0); }, 0);
}
function plocPlan(c) {
  const P = plocData, byN = new Map(P.wines.filter(it => it.n).map(it => [it.n, it]));
  let h = '';
  for (let r = 1; r <= c.plan.rows; r++) for (let k = 1; k <= c.plan.cols; k++) {
    const z = c.plan.cells.find(x => x.r === r && x.c === k), it = z && byN.get(z.n), col = it ? COLORS[it.couleur]?.c || '#B9AFA6' : '';
    h += z ? `<span class="pd${it && COLORS[it.couleur]?.light ? ' lt' : ''}${it?.skip ? ' off' : ''}" style="background:${col || '#B9AFA6'}">${z.n}</span>` : '<span class="pd e"></span>';
  }
  return `<div class="rack-scroll"><div class="pgrid" style="grid-template-columns:repeat(${c.plan.cols},22px)">${h}</div></div>`;
}
function plocReview() {
  const P = plocData; if (!P) return null;
  const total = P.caves.filter(c => !c.skip).reduce((n, c) => n + plocCount(c), 0);
  const spOpts = c => `<option value="" ${!c.spaceId && !c.skip ? 'selected' : ''} disabled>Choisis où ranger…</option>${S.spaces.map(s => `<option value="${s.id}" ${s.id === c.spaceId ? 'selected' : ''}>${esc(S.sites.length > 1 ? site(s.siteId)?.name + ' › ' : '')}${esc(s.name)}</option>`).join('')}<option value="skip" ${c.skip ? 'selected' : ''}>Ne pas importer</option>`;
  const caveCard = (c, k) => {
    const n = plocCount(c), s = c.spaceId && site(space(c.spaceId)?.siteId);
    const units = c.spaceId ? spaceUnits(c.spaceId).filter(u => !UNIT_TYPES[u.type].box) : [];
    return `<div class="card"><div class="ct">${esc(c.name)}</div>
      <p class="small" style="margin:-4px 0 8px">${plural(n, 'bouteille', 'bouteilles')} à importer${c.plan ? ` · plan ${c.plan.rows} × ${c.plan.cols}` : ' · pas de plan dans ce PDF : bouteilles non placées'}</p>
      <label>${c.site || c.spaceId ? 'Ranger dans' : 'Site non reconnu : où ranger cette cave ?'}<select data-ch="plocSpace" data-k="${k}">${spOpts(c)}</select></label>
      ${c.hint && s && norm(s.name) !== norm(c.hint) && !c.skip ? `<label class="check"><input type="checkbox" data-ch="plocRename" data-k="${k}" ${c.rename ? 'checked' : ''}> Renommer le site « ${esc(s.name)} » en « ${esc(c.hint)} »</label>` : ''}
      ${c.plan && c.spaceId && !c.skip ? `<label>Meuble<select data-ch="plocUnit" data-k="${k}"><option value="new" ${c.unitMode === 'new' ? 'selected' : ''}>Créer « ${esc(c.unitName)} » (rack ${c.plan.rows} × ${c.plan.cols})</option>
        ${units.map(u => `<option value="${u.id}" ${c.unitMode === u.id ? 'selected' : ''}>${esc(u.name || UNIT_TYPES[u.type].label)} (${u.rows} × ${u.cols})</option>`).join('')}
        <option value="none" ${c.unitMode === 'none' ? 'selected' : ''}>Ne pas placer (bouteilles non placées)</option></select></label>
        ${plocPlan(c)}` : ''}</div>`;
  };
  const wineRow = (it, i) => {
    const ws = it.win === 'ia' && it.ia ? it.ia : it.ploc || it.ia;
    const where = it.per.map(p => `${esc(P.caves[p.cave].name)} ×${p.q}${p.qfix ? ' <b style="color:var(--bx)">quantité corrigée</b>' : ''}${p.done ? ' <span class="tag">déjà importé</span>' : ''}`).join(' · ');
    const sub = [it.cuvee && it.appellation ? it.appellation : '', it.region, it.degre ? numFr(it.degre) + ' %' : '', it.prix != null ? fmtE2.format(it.prix) : '', it.service, it.note20 != null ? numFr(it.note20) + '/20' : ''].filter(Boolean).map(esc).join(' · ');
    return `<div class="li" style="${it.skip ? 'opacity:.45' : ''};align-items:flex-start"><span class="dot" style="background:${COLORS[it.couleur]?.c || '#B9AFA6'};margin-top:4px"></span>
      <div class="it"><b>${it.n ? `<span class="small">n° ${it.n}</span> ` : ''}${esc(it.domaine)} · ${esc(it.cuvee || it.appellation)} ${esc(it.millesime || '')}</b>
        <small>${sub}</small><small>${where}${it.existing ? ' · vin déjà dans ta cave' : ''}</small>
        ${it.fill.length ? `<small style="color:var(--gold)">Complété par le sommelier : ${esc(it.fill.join(', '))}</small>` : ''}
        <small>${ws ? `Fenêtre ${ws.debut || '?'}–${ws.fin} · ${it.win === 'ia' || !it.ploc ? 'estimée par le sommelier' : 'reprise de Ploc'}` : 'Pas de fenêtre'}</small>
        ${it.diff && !it.skip && !it.existing ? `<div class="card" style="margin:6px 0 0;padding:10px"><p class="small" style="margin:0 0 6px">Le sommelier propose <b>${it.ia.debut || '?'}–${it.ia.fin}</b> au lieu de ${it.ploc.debut}–${it.ploc.fin}${it.ia.why ? ' : ' + esc(it.ia.why) : '.'}</p>
          <div class="seg"><button class="${it.win === 'ploc' ? 'on' : ''}" data-act="plocWin" data-i="${i}" data-v="ploc">Garder Ploc</button><button class="${it.win === 'ia' ? 'on' : ''}" data-act="plocWin" data-i="${i}" data-v="ia">Prendre la proposition</button></div></div>` : ''}</div>
      <button class="chev" data-act="plocToggle" data-i="${i}" aria-label="${it.skip ? 'Importer ce vin' : 'Ne pas importer ce vin'}" style="background:none;border:0;padding:4px">${it.skip ? '<span class="small">Ignoré</span>' : ICON.check}</button></div>`;
  };
  const nDiff = P.wines.filter(it => it.diff && !it.existing).length;
  return `${head('Vérifier l’import')}
    <p class="small" style="margin-top:-6px">Vérifie le plan et les vins lus dans le PDF. Touche ✓ pour ignorer un vin.${nDiff ? ` Le sommelier propose une autre fenêtre pour ${plural(nDiff, 'vin', 'vins')}.` : ''}</p>
    ${P.caves.map(caveCard).join('')}
    <h3>Vins</h3>
    <div class="list">${P.wines.map(wineRow).join('')}</div>
    <button class="btn primary wide" style="margin-top:14px;position:sticky;bottom:0" data-act="plocGo">${total ? 'Importer ' + plural(total, 'bouteille', 'bouteilles') : 'Rien de nouveau à importer'}</button>`;
}
