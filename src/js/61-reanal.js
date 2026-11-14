/* ---------- Réanalyser les apogées d'une cave (v2.1.8) ----------
   Changer de cave ne change pas le potentiel d'un vin, seulement sa vitesse d'évolution : on demande au sommelier
   d'AJUSTER les fenêtres existantes aux conditions actuelles, en groupe et de façon compacte (une ligne par vin,
   conditions envoyées une seule fois par lot, sans recherche web, modèle économique, réponse minimale).
   Les vins déjà estimés avec les conditions actuelles sont sautés ; les fenêtres saisies à la main ne sont pas
   touchées, sauf sur demande ; les vins sans fenêtre reçoivent l'estimation groupée habituelle. */
const REANAL_LOT = 40;
const REANAL_SYS = `Tu es un sommelier expert du vieillissement des vins. On te donne des vins rangés dans une même cave personnelle, avec leur fenêtre de dégustation actuelle (début, apogée, fin), calculée avec d'anciennes conditions de stockage, et les conditions actuelles de la cave.
Le potentiel d'un vin ne dépend pas de la cave : ajuste seulement la vitesse d'évolution. Une meilleure cave (plus fraîche, plus stable) allonge un peu la fenêtre, une moins bonne la raccourcit ; à conditions équivalentes, garde la fenêtre telle quelle. Une variation de température lente, au fil des saisons, abîme peu le vin : c'est surtout le temps passé au-dessus de 20 °C qui accélère son évolution ; un maximum au-delà de 25 °C ou un minimum sous 0 °C est un vrai risque. Une dégustation récente indiquée prime sur la théorie.
Garde des années entières, début ≤ apogée ≤ fin, jamais avant le millésime. Les années déjà passées d'une fenêtre ne changent pas. Réponds pour chaque vin avec son numéro i, et donne un résumé d'une phrase pour l'ensemble.`;
const REANAL_SCHEMA = { type: 'object', additionalProperties: false, required: ['items', 'resume'], properties: {
  resume: { type: 'string' },
  items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['i', 'debut', 'pic', 'fin'], properties: { i: { type: 'integer' }, debut: { type: 'integer' }, pic: { type: 'integer' }, fin: { type: 'integer' } } } } } };

// Vins de cette cave (cave principale), répartis selon ce qu'il faut faire
function reanalPlan(spaceId, withManual = false) {
  const sp = space(spaceId), key = condKey(sp), out = { sp, adjust: [], upToDate: [], missing: [], manual: [] };
  if (!sp) return out;
  for (const w of S.wines) {
    if (w.kind !== 'vin' || mainSpace(w)?.id !== spaceId) continue;
    const a = w.apogee;
    if (!a?.fin) out.missing.push(w);
    else if (a.src === 'manuel' && !withManual) out.manual.push(w);
    else if (a.cond === key && a.src !== 'manuel') out.upToDate.push(w);
    else out.adjust.push(w);
  }
  return out;
}
const reanalPlanSize = id => { const p = reanalPlan(id); return p.adjust.length + p.missing.length + p.upToDate.length + p.manual.length; };
const reanalCount = id => { const p = reanalPlan(id); return p.adjust.length + p.missing.length; };
// Coût indicatif (euros) : ~70 jetons d'entrée et ~25 de sortie par vin, ~600 par lot (consigne et conditions)
function reanalCost(nAdjust, nMissing) {
  const m = AI[aiCfg().provider || 'anthropic'].light, [pi, po] = priceOf(m), lots = Math.ceil(nAdjust / REANAL_LOT);
  const usd = (lots * 600 * pi + nAdjust * (70 * pi + 25 * po)) / 1e6;
  return (usd + nMissing * 0.004 / (S.settings.rate || 0.92)) * (S.settings.rate || 0.92);
}
const costLabel = e => e < 0.01 ? 'moins de 0,01 €' : 'environ ' + fmtE2.format(e);

// Une ligne compacte par vin ; les anciennes conditions sont regroupées (lettres A, B…) pour n'être écrites qu'une fois
function reanalPrompt(sp, ws) {
  const groups = new Map();
  const g = w => { const t = w.apogee?.condTxt || 'inconnues (fenêtre calculée sans trace des conditions)'; if (!groups.has(t)) groups.set(t, String.fromCharCode(65 + groups.size)); return groups.get(t); };
  const rows = ws.map((w, i) => {
    const a = w.apogee, last = S.tastings.filter(t => t.wineId === w.id && t.note != null).sort((p, q) => (q.at || '').localeCompare(p.at || ''))[0];
    return [`#${i}`, w.appellation || '', w.domaine || '', w.cuvee || '', w.millesime || 'NM', COLORS[w.couleur]?.label || '', w.format && w.format !== '75' ? w.format + ' cl' : '',
      `fenêtre ${a.debut || '?'}-${a.pic || '?'}-${a.fin}`, `calculée avec ${g(w)}`, last ? `dégusté ${last.at?.slice(0, 7)} ${numFr(last.note)}/20${last.full?.evolution ? ' ' + last.full.evolution : ''}` : ''].filter(Boolean).join(' | ');
  });
  return `Cave : ${sp.name}. Conditions actuelles : ${condText(sp)}.\nAnciennes conditions :\n${[...groups].map(([t, l]) => `${l} : ${t}`).join('\n')}\nAnnée actuelle : ${thisYear()}\n\n${rows.join('\n')}`;
}

async function reanalRun(spaceId, withManual, onStep) {
  const plan = reanalPlan(spaceId, withManual), sp = plan.sp, changes = [], key = condKey(sp), stamp = { cond: key, condTxt: condText(sp), condSpace: sp.id };
  const day = fmtDate(today());
  let resume = '', done = 0, total = plan.adjust.length + plan.missing.length;
  for (let k = 0; k < plan.adjust.length; k += REANAL_LOT) {
    const lot = plan.adjust.slice(k, k + REANAL_LOT);
    const r = await aiCall({ tag: 'apogee-cave', system: REANAL_SYS, content: reanalPrompt(sp, lot), schema: REANAL_SCHEMA, maxTokens: 300 + lot.length * 40, effort: 'low', light: true });
    resume ||= String(r.json.resume || '').slice(0, 300);
    for (const it of r.json.items || []) {
      const w = lot[it.i], cw = w && cleanWindow(it.debut, it.pic, it.fin, w.millesime); if (!cw) continue;
      const prev = { ...w.apogee };
      w.apogee = { ...prev, ...cw, src: 'ia', why: `Fenêtre ajustée le ${day} aux conditions de « ${sp.name} ».`, at: Date.now(), ...stamp };
      changes.push({ wid: w.id, prev, next: { debut: cw.debut, pic: cw.pic, fin: cw.fin } });
    }
    done += lot.length; onStep?.(done, total);
  }
  // Vins sans fenêtre : estimation groupée habituelle (elle note aussi les conditions)
  let estimated = 0;
  if (plan.missing.length) { estimated = await estimateBatch(plan.missing); done += plan.missing.length; onStep?.(done, total); }
  S.reanal = { at: Date.now(), spaceId, changes: changes.filter(c => c.prev.debut !== c.next.debut || c.prev.pic !== c.next.pic || c.prev.fin !== c.next.fin).map(c => ({ ...c })), all: changes.map(c => ({ wid: c.wid, prev: c.prev })), resume, estimated, same: 0 };
  S.reanal.same = changes.length - S.reanal.changes.length;
  await save();
  return S.reanal;
}

/* ---------- Fenêtres ---------- */
function reanalSheet(spaceId, offer = false) {
  if (!aiReady()) return `${head('Réanalyser les apogées')}<p>Le sommelier ajuste les fenêtres de dégustation aux conditions de la cave. Il faut d’abord lui donner une clé.</p>
    <button class="btn primary wide" data-act="aiSettings">Configurer le sommelier</button>`;
  const withManual = !!reanalOpts.manual, p = reanalPlan(spaceId, withManual), n = p.adjust.length + p.missing.length;
  const cost = reanalCost(p.adjust.length, p.missing.length);
  const row = (k, l) => k ? `<li>${l}</li>` : '';
  return `${head(offer ? 'Conditions modifiées' : 'Réanalyser les apogées')}
    <p class="small" style="margin-top:-6px">${offer ? `Les conditions de « ${esc(p.sp.name)} » ont changé. ` : ''}Le sommelier ajuste les fenêtres de dégustation des vins rangés surtout dans « ${esc(p.sp.name)} » à ses conditions actuelles : ${esc(condText(p.sp))}.</p>
    <ul class="small" style="margin:8px 0;padding-left:18px">
      ${row(p.adjust.length, `<b>${plural(p.adjust.length, 'fenêtre à réajuster', 'fenêtres à réajuster')}</b>`)}
      ${row(p.missing.length, `${plural(p.missing.length, 'vin sans fenêtre', 'vins sans fenêtre')} : estimation complète groupée`)}
      ${row(p.upToDate.length, `${plural(p.upToDate.length, 'vin déjà à jour', 'vins déjà à jour')} : rien à faire`)}
      ${row(p.manual.length, `${plural(p.manual.length, 'fenêtre saisie à la main', 'fenêtres saisies à la main')} : non touchée${p.manual.length > 1 ? 's' : ''}`)}
    </ul>
    ${p.manual.length || withManual ? `<label class="set" style="display:flex"><div class="it"><b>Inclure les fenêtres saisies à la main</b></div>${sw('reanalManual', withManual)}</label>` : ''}
    ${n ? `<p class="small">Ajustement groupé, sans recherche web, avec le modèle économique. Coût indicatif : <b>${costLabel(cost)}</b>.</p>
      <div class="btns"><button class="btn primary wide" data-act="reanalGo" data-id="${spaceId}">${ICON.spark} Réanalyser ${plural(n, 'vin', 'vins')}</button>
      <button class="btn ghost wide" data-act="close">${offer ? 'Plus tard' : 'Annuler'}</button></div>`
      : `<p class="muted">Rien à réanalyser : toutes les fenêtres de cette cave sont à jour.</p><button class="btn wide" data-act="close">OK</button>`}`;
}
let reanalOpts = { manual: false };
CHANGES.reanalManual = el => { reanalOpts.manual = el.checked; refreshSheet(); };
function reanalResultSheet() {
  const R = S.reanal; if (!R) return null;
  const sp = space(R.spaceId), d = c => Math.abs((c.next.debut || 0) - (c.prev.debut || 0)) + Math.abs(c.next.fin - c.prev.fin) + Math.abs((c.next.pic || 0) - (c.prev.pic || 0));
  const list = [...R.changes].sort((a, b) => d(b) - d(a));
  const w3 = a => `${a.debut || '?'}–${a.fin}${a.pic ? ` (${a.pic})` : ''}`;
  return `${head('Fenêtres réajustées')}
    <p class="small" style="margin-top:-6px">${esc(sp?.name || '')} · ${plural(list.length, 'fenêtre modifiée', 'fenêtres modifiées')}${R.same ? ` · ${plural(R.same, 'inchangée', 'inchangées')}` : ''}${R.estimated ? ` · ${plural(R.estimated, 'vin estimé', 'vins estimés')}` : ''}</p>
    ${R.resume ? `<div class="card" style="background:var(--green-soft);border-color:#C9DCCF"><p style="margin:0">${esc(R.resume)}</p></div>` : ''}
    ${list.length ? `<div class="list">${list.map(c => { const w = wine(c.wid); return w ? `<button class="li" data-act="wine" data-id="${w.id}"><span class="dot" style="background:${wineColor(w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small>${esc(w3(c.prev))} → <b style="color:var(--green)">${esc(w3(c.next))}</b></small></div></button>` : ''; }).join('')}</div>` : '<p class="muted">Aucune fenêtre n’a bougé : les nouvelles conditions sont équivalentes pour ces vins.</p>'}
    <div class="btns" style="margin-top:12px">${R.all?.length ? '<button class="btn wide" data-act="reanalUndo">Annuler ces changements</button>' : ''}<button class="btn primary wide" data-act="close">OK</button></div>`;
}
Object.assign(ACT, {
  reanalSpace: t => { if (!aiReady()) return ACT.aiSettings(); reanalOpts = { manual: false }; showSheet(() => reanalSheet(t.dataset.id)); },
  reanalGo: async t => {
    const id = t.dataset.id; t.disabled = true; t.textContent = 'Réanalyse en cours…';
    try {
      await reanalRun(id, reanalOpts.manual, (d, n) => { if (t.isConnected) t.textContent = `Réanalyse en cours… ${d}/${n}`; });
      render(); closeSheet(); showSheet(reanalResultSheet);
    } catch (e) { errSheet('Réanalyse interrompue', (e.message || String(e)) + '\nLes vins déjà traités gardent leur nouvelle fenêtre.'); }
  },
  reanalUndo: async () => {
    const R = S.reanal; if (!R) return;
    for (const c of R.all || []) { const w = wine(c?.wid), p = c?.prev, cw = w && p && typeof p === 'object' && cleanWindow(p.debut, p.pic, p.fin, w.millesime); if (cw) w.apogee = { ...p, ...cw }; }
    S.reanal = null; await save(); render(); closeSheet(); toast('Anciennes fenêtres remises');
  },
});
