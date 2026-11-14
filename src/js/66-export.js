/* ---------- Exports (v2.1) : Excel (.xlsx créé sur l'appareil) et inventaire imprimable (PDF) ---------- */
// Partage par la feuille iOS, sinon téléchargement
async function shareBlob(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return true;
}
/* Zip sans compression (suffisant pour un .xlsx) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const size = central.reduce((t, x) => t + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
/* Classeur Excel : textes en ligne (sans table partagée), première ligne en gras et figée */
const xEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
function sheetXml(rows) {
  const cell = (v, r, c) => { const ref = colName(c) + (r + 1), st = r === 0 ? ' s="1"' : '';
    if (v == null || v === '') return '';
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xEsc(v)}</t></is></c>`; };
  const widths = rows[0].map((_, c) => Math.min(48, Math.max(8, ...rows.slice(0, 200).map(r => String(r[c] ?? '').length + 2))));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, i, c)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
function xlsxBlob(sheets) {
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)]),
  ];
  return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// Les trois onglets
function exportSheets() {
  const fmtL = w => (FORMATS[w.kind] || FORMATS.vin).find(f => f[0] === w.format)?.[1] || '';
  const sites = S.sites;
  const inv = [['Vin', 'Domaine', 'Cuvée', 'Appellation', 'Région', 'Pays', 'Couleur', 'Millésime', 'Format', 'Bouteilles à moi', 'Bouteilles d’amis', ...(sites.length > 1 ? sites.map(s => 'À ' + s.name) : []), 'En primeur', 'Emplacements', 'Fenêtre : début', 'Apogée', 'Fin', 'Statut', 'Prix d’achat (€)', 'Valeur actuelle (€)', 'Lieu d’achat', 'Note moyenne /20']];
  for (const w of [...S.wines].sort((a, b) => norm(wineName(a)).localeCompare(norm(wineName(b))) || (a.millesime || 0) - (b.millesime || 0))) {
    const bs = wineBottles(w.id), pr = S.bottles.filter(b => b.wineId === w.id && b.state === 'primeur').length;
    if (!bs.length && !pr) continue;
    const ts = S.tastings.filter(t => t.wineId === w.id && t.note != null), avg = ts.length ? Math.round(ts.reduce((t, x) => t + x.note, 0) / ts.length * 10) / 10 : null, st = status(w);
    const locs = [...new Set(bs.map(b => locLabel(b, sites.length > 1)))];
    inv.push([wineName(w), w.domaine || '', w.cuvee || '', w.appellation || '', w.region || '', w.pays || '', w.kind === 'spirit' ? SPIRIT_CATS[w.cat] || 'Spiritueux' : COLORS[w.couleur]?.label || '', w.millesime || '', fmtL(w),
      bs.filter(b => !b.owner).length, bs.filter(b => b.owner).length, ...(sites.length > 1 ? sites.map(s => bs.filter(b => siteOfBottle(b) === s.id).length) : []), pr || '',
      locs.join(' ; '), w.apogee?.debut || '', w.apogee?.pic || '', w.apogee?.fin || '', st ? STATUS[st].label : '', w.achat?.prix ?? '', w.valeur?.v ?? '', w.achat?.lieu || '', avg ?? '']);
  }
  const deg = [['Date', 'Vin', 'Domaine', 'Millésime', 'Note /20', 'Type', 'Lieu', 'Convives', 'Plat', 'Accord', 'Commentaire', 'Séance', 'De ma cave']];
  for (const t of [...S.tastings].sort((a, b) => (b.at || '').localeCompare(a.at || ''))) {
    const w = tastingWine(t); if (!w) continue;
    deg.push([t.at || '', t.blind && !t.wineId ? 'Vin mystère' : wineName(w), w.domaine || '', w.millesime || '', t.note ?? '', TASTE_TYPES[t.type] || '', t.lieu || '', t.convives || '', t.plat || '', ACCORDS[t.accord] || '', t.comment || '', byId(S.sessions, t.sessionId)?.titre || '', t.bottleId ? 'oui' : 'non']);
  }
  const T = { in: 'Entrée', out: 'Sortie', move: 'Déplacement', transfert: 'Transfert', primeur: 'Primeur commandé', open: 'Ouverture' };
  const where = l => l ? [site(l.siteId)?.name, space(l.spaceId)?.name].filter(Boolean).join(' › ') : '';
  const mv = [['Date', 'Mouvement', 'Motif', 'Vin', 'Millésime', 'De', 'Vers', 'Avec / à', 'Occasion ou plat']];
  for (const m of [...S.moves].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    const w = wine(m.wineId); if (!w) continue;
    mv.push([m.at || '', T[m.type] || m.type, MOTIFS[m.motif] || '', wineName(w), w.millesime || '', where(m.from), where(m.to), m.who || '', m.plat || m.occasion || '']);
  }
  return [{ name: 'Inventaire', rows: inv }, { name: 'Dégustations', rows: deg }, { name: 'Mouvements', rows: mv }];
}
async function exportXlsx() {
  const blob = xlsxBlob(exportSheets());
  if (await shareBlob(`mycellar-${today()}.xlsx`, blob)) toast('Fichier Excel prêt');
}
/* Inventaire imprimable : par site, espace et meuble, avec le plan de chaque meuble, puis « Enregistrer en PDF » */
function printInventoryHtml() {
  const occ = occupancy(), multi = S.sites.length > 1;
  const plan = u => {
    if (UNIT_TYPES[u.type].box) { const bs = boxContents(u, occ); return `<p>${bs.length} / ${capacity(u)} · ${esc([...new Set(bs.map(b => wineTitle(wine(b.wineId))))].join(', ') || 'vide')}</p>`; }
    let h = '<table class="pplan">';
    for (let r = 0; r < u.rows; r++) { h += `<tr><th>${r + 1}</th>`; for (let c = 0; c < u.cols; c++) { const b = occ.get(`${u.id}:${r}:${c}`), w = b && wine(b.wineId); h += `<td${w ? ` style="border-left:3px solid ${wineColor(w)}"` : ''}>${w ? esc(abbr(w)) : ''}</td>`; } h += '</tr>'; }
    return h + '</table>';
  };
  const list = bs => { const by = new Map(); for (const b of bs) by.set(b.wineId, (by.get(b.wineId) || 0) + 1);
    return `<ul>${[...by].sort((a, b) => norm(wineName(wine(a[0]))).localeCompare(norm(wineName(wine(b[0]))))).map(([wid, n]) => { const w = wine(wid); return `<li><b>${esc(abbr(w))}</b> ${esc(wineTitle(w))} <span>${esc(w.domaine || '')}</span> ×${n}</li>`; }).join('')}</ul>`; };
  let h = `<h1>Inventaire MyCellar</h1><p class="pmeta">${esc(fmtDate(today()))} · ${plural(S.bottles.filter(inCave).length, 'bouteille', 'bouteilles')}</p>`;
  for (const s of S.sites) {
    const sps = siteSpaces(s.id); if (!sps.length) continue;
    if (multi) h += `<h2>${esc(s.name)}</h2>`;
    for (const sp of sps) {
      h += `<h3>${esc(sp.name)}</h3>`;
      for (const u of spaceUnits(sp.id)) { const bs = S.bottles.filter(b => inCave(b) && b.unitId === u.id); h += `<section class="punit"><h4>${esc(u.name || UNIT_TYPES[u.type].label)}</h4>${plan(u)}${bs.length ? list(bs) : ''}</section>`; }
      const loose = S.bottles.filter(b => inCave(b) && b.spaceId === sp.id && !b.unitId);
      if (loose.length) h += `<section class="punit"><h4>Non placées</h4>${list(loose)}</section>`;
    }
  }
  return h;
}
function printInventory() {
  let el = $('#print'); if (!el) { el = document.createElement('div'); el.id = 'print'; document.body.appendChild(el); }
  el.innerHTML = printInventoryHtml();
  closeSheet();
  if (isAndroid) toast('Pour un PDF : choisis « Enregistrer au format PDF » comme imprimante');
  setTimeout(() => { try { window.print(); } catch { toast('Impression indisponible sur cet appareil'); } }, 80);
}
Object.assign(ACT, {
  exportXlsx: () => exportXlsx(),
  printInventory: () => printInventory(),
});
