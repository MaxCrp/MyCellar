/* ---------- Audit de cave (v2.0, §7.4) ----------
   Un bilan calculé sur l'appareil, puis, à la demande, une lecture du sommelier (un appel, sans recherche web). */
function auditCalc() {
  const y = thisYear(), mine = S.bottles.filter(b => inCave(b) && !b.owner && wine(b.wineId)?.kind === 'vin'), n = mine.length;
  const share = rows => rows.map(r => ({ ...r, pct: n ? Math.round(r.n / n * 100) : 0 }));
  const colors = share(groupBy(mine, w => COLORS[w.couleur]?.label || 'Couleur inconnue').sort((a, b) => b.n - a.n));
  const regions = share(topN(groupBy(mine, w => w.region || 'Non renseignée'), 5));
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const rhythm = S.moves.filter(m => m.type === 'out' && TASTE_OUT.includes(m.motif) && (m.at || '') >= since && !byId(S.bottles, m.bottleId)?.owner && wine(m.wineId)?.kind === 'vin').length;
  const years = Array.from({ length: 12 }, (_, i) => y + i), win = b => wine(b.wineId).apogee;
  const cal = years.map(yy => ({ y: yy,
    fin: mine.filter(b => win(b)?.fin === yy || (yy === y && win(b)?.fin && win(b).fin < y)).length,
    ready: mine.filter(b => { const a = win(b); return a?.fin && a.fin >= yy && (a.debut || a.fin - 3) <= yy; }).length }));
  const surplus = cal.filter(c => c.fin > Math.max(3, rhythm * 1.5)).map(c => c.y);
  const creux = rhythm ? cal.filter(c => c.y > y && c.ready < rhythm).map(c => c.y) : [];
  const st = k => mine.filter(b => status(wine(b.wineId)) === k).length;
  const spaces = S.spaces.map(sp => { const units = spaceUnits(sp.id), cap = units.reduce((t, u) => t + capacity(u), 0), used = S.bottles.filter(b => inCave(b) && b.spaceId === sp.id).length; return { name: (S.sites.length > 1 ? site(sp.siteId)?.name + ' › ' : '') + sp.name, use: sp.use, cap, used, pct: cap ? Math.round(used / cap * 100) : null }; });
  return { y, n, colors, regions, rhythm, cal, surplus, creux, declin: st('declin'), prio: st('prio'), tot: st('tot'), inconnu: st('inconnu'), spaces };
}
function auditText(c) {
  return [`Bilan de la cave (${c.y}) : ${c.n} bouteilles de vin à moi.`,
    `Couleurs : ${c.colors.map(r => `${r.label} ${r.pct} %`).join(', ')}.`,
    `Régions : ${c.regions.map(r => `${r.label} ${r.pct} %`).join(', ')}.`,
    `Rythme : ${c.rhythm} bouteilles bues sur les 12 derniers mois.`,
    `Statuts : ${c.prio} à boire en priorité, ${c.declin} en déclin, ${c.tot} trop tôt, ${c.inconnu} sans fenêtre.`,
    `Calendrier (année : bouteilles en fin de fenêtre / bouteilles prêtes) : ${c.cal.map(x => `${x.y} : ${x.fin}/${x.ready}`).join(' ; ')}.`,
    c.surplus.length && `Années où trop de vins arrivent en fin de fenêtre : ${c.surplus.join(', ')}.`,
    c.creux.length && `Années creuses (moins de vins prêts que le rythme de consommation) : ${c.creux.join(', ')}.`,
    `Espaces : ${c.spaces.map(s => `${s.name} (${s.use === 'conso' ? 'consommation' : 'garde'}) ${s.used}/${s.cap || '?'}`).join(' ; ')}.`].filter(Boolean).join('\n');
}
const AUDIT_SCHEMA = { type: 'object', additionalProperties: false, required: ['synthese', 'constats', 'achats'], properties: {
  synthese: { type: 'string' }, constats: { type: 'array', items: { type: 'string' } },
  achats: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['quoi', 'millesimes', 'budget', 'pourquoi'], properties: { quoi: { type: 'string' }, millesimes: { type: 'string' }, budget: { type: 'string' }, pourquoi: { type: 'string' } } } } } };
const AUDIT_SYS = `Tu es le sommelier personnel de l’utilisateur. On te donne le bilan chiffré de sa cave et la liste de ses vins.
Fais un audit honnête et concret, en français, en tutoyant :
- « synthese » : trois phrases au plus sur l’état de la cave ;
- « constats » : trois à cinq constats précis (équilibre des couleurs et des régions, années où trop de vins arrivent à maturité en même temps, années creuses, vins en déclin à boire vite, espaces de garde) ;
- « achats » : deux à quatre suggestions d’achat qui corrigent ces déséquilibres (type de vin ou appellation, millésimes à viser, budget indicatif par bouteille, raison).
N’invente aucun vin de la cave : appuie-toi uniquement sur le bilan et la liste.`;
function auditSheet() {
  const c = auditCalc(), a = S.audit, y = c.y;
  if (!c.n) return `${head('Audit de ma cave')}<p class="muted">Ajoute des vins pour lancer un audit.</p>`;
  const maxC = Math.max(1, ...c.cal.map(x => Math.max(x.fin, x.ready)));
  return `${head('Audit de ma cave')}
    <p class="small" style="margin-top:-6px">${plural(c.n, 'bouteille de vin', 'bouteilles de vin')} à toi · ${plural(c.rhythm, 'bouteille bue', 'bouteilles bues')} ces 12 derniers mois.</p>
    <div class="card"><div class="ct">Calendrier de maturité</div>
      <p class="tiny" style="margin:0 0 8px">Barre pleine : bouteilles en fin de fenêtre cette année-là · barre claire : bouteilles prêtes à boire${c.rhythm ? ` · ton rythme : ${c.rhythm} par an` : ''}.</p>
      <div class="cal">${c.cal.map(x => `<div class="calc${c.surplus.includes(x.y) ? ' hot' : ''}${c.creux.includes(x.y) ? ' low' : ''}"><span class="cr" style="height:${x.ready / maxC * 100}%"></span><span class="cf" style="height:${x.fin / maxC * 100}%"></span><small>${String(x.y).slice(2)}</small></div>`).join('')}</div>
      ${c.surplus.length ? `<p class="small" style="margin:8px 0 0"><b style="color:var(--bx)">Embouteillage</b> : beaucoup de vins arrivent en fin de fenêtre en ${c.surplus.join(', ')}.</p>` : ''}
      ${c.creux.length ? `<p class="small" style="margin:6px 0 0"><b style="color:var(--gold)">Années creuses</b> : moins de vins prêts que ton rythme en ${c.creux.slice(0, 6).join(', ')}.</p>` : ''}</div>
    <div class="card"><div class="ct">Équilibre</div>
      <p class="small" style="margin:0">${c.colors.map(r => `${esc(r.label)} ${r.pct} %`).join(' · ')}</p>
      <p class="small" style="margin:6px 0 0">${c.regions.map(r => `${esc(r.label)} ${r.pct} %`).join(' · ')}</p>
      <p class="small" style="margin:6px 0 0">${c.prio ? `${plural(c.prio, 'bouteille', 'bouteilles')} à boire en priorité` : 'Aucune urgence'}${c.declin ? ` · ${c.declin} en déclin` : ''}${c.inconnu ? ` · ${c.inconnu} sans fenêtre` : ''}.</p></div>
    ${c.spaces.some(s => s.cap) ? `<div class="card"><div class="ct">Espaces</div>${c.spaces.filter(s => s.cap).map(s => `<p class="small" style="margin:2px 0">${esc(s.name)} · ${s.used} / ${s.cap} (${s.pct} %)${s.pct >= 90 ? ' · <b style="color:var(--bx)">presque plein</b>' : ''}</p>`).join('')}</div>` : ''}
    <div class="sect">Lecture du sommelier</div>
    ${a?.ai ? `<div class="card"><p style="margin:0">${esc(a.ai.synthese)}</p>
      ${a.ai.constats?.length ? `<ul class="small" style="margin:8px 0 0;padding-left:18px">${a.ai.constats.map(x => `<li style="margin:3px 0">${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      ${a.ai.achats?.length ? `<div class="card"><div class="ct">À acheter</div>${a.ai.achats.map(x => `<p class="small" style="margin:6px 0;color:var(--ink)"><b>${esc(x.quoi)}</b>${x.millesimes ? ' · ' + esc(x.millesimes) : ''}${x.budget ? ' · ' + esc(x.budget) : ''}<br><span style="color:var(--muted)">${esc(x.pourquoi)}</span></p>`).join('')}</div>` : ''}
      <p class="tiny">Audit du ${esc(fmtDate(new Date(a.at).toISOString().slice(0, 10)))}.</p>` : '<p class="small">Le sommelier lit ce bilan et ta liste de vins, puis propose des constats et des achats.</p>'}
    <button class="btn ${a?.ai ? '' : 'primary '}wide" data-act="auditRun">${ICON.spark} ${a?.ai ? 'Refaire la lecture' : 'Demander la lecture du sommelier'} (environ 5 centimes)</button>`;
}
async function auditRun() {
  if (!aiReady()) return sheetMsg('Audit de ma cave', 'Ajoute une clé IA dans Réglages › Intelligence artificielle pour la lecture du sommelier. Le bilan chiffré reste disponible sans clé.');
  const c = auditCalc();
  showSheet(() => `${head('Audit de ma cave')}<p>Le sommelier lit ta cave…</p><div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`, { replace: true });
  try {
    const r = await aiCall({ tag: 'audit', system: AUDIT_SYS, context: caveContext(true), content: auditText(c), schema: AUDIT_SCHEMA, maxTokens: 3000, effort: 'medium' });
    const j = r.json || {}, txt = v => String(v || '').slice(0, 600);
    S.audit = { at: Date.now(), ai: { synthese: txt(j.synthese), constats: (Array.isArray(j.constats) ? j.constats : []).slice(0, 6).map(txt),
      achats: (Array.isArray(j.achats) ? j.achats : []).slice(0, 5).map(x => ({ quoi: txt(x?.quoi), millesimes: txt(x?.millesimes), budget: txt(x?.budget), pourquoi: txt(x?.pourquoi) })) } };
    await save();
    showSheet(auditSheet, { replace: true, full: true });
  } catch (e) { showSheet(() => `${head('Audit impossible')}<p style="white-space:pre-wrap">${esc(e.message || String(e))}</p><button class="btn wide" data-act="close">Fermer</button>`, { replace: true }); }
}
Object.assign(ACT, {
  auditSheet: () => showSheet(auditSheet, { full: true }),
  auditRun: () => auditRun(),
});
