/* ---------- Intelligence artificielle ----------
   Appels directs depuis le navigateur, avec la clé de l'utilisateur rangée dans le coffre chiffré.
   La politique de sécurité (CSP) limite les destinations possibles à ces deux API.
   Les vins gardés pour des amis ne sont jamais envoyés au sommelier. */
const AI = {
  anthropic: { label: 'Claude (Anthropic)', model: 'claude-sonnet-5-5', keyUrl: 'console.anthropic.com', url: 'https://api.anthropic.com/v1/messages' },
  mistral: { label: 'Mistral (hébergé en Europe)', model: 'mistral-large-latest', keyUrl: 'console.mistral.ai', url: 'https://api.mistral.ai/v1/chat/completions' },
};
const aiCfg = () => S?.settings.ai || {};
const aiReady = () => !!aiCfg().key;
const aiClaude = () => (aiCfg().provider || 'anthropic') === 'anthropic';
const aiModel = () => aiCfg().model || AI[aiCfg().provider || 'anthropic'].model;
let aiNoFallback = false;
class AIError extends Error {}

async function apiError(r) {
  let detail = '';
  try { const t = (await r.text()).slice(0, 500); try { const j = JSON.parse(t); detail = j.error?.message || j.message || j.detail || ''; } catch { detail = t; } } catch {}
  detail = String(detail).replace(/\s+/g, ' ').trim().slice(0, 160);
  const base = r.status === 401 ? 'Clé refusée (401) : elle est invalide, expirée, ou pas encore active.'
    : r.status === 402 ? 'Paiement requis (402) : le compte n’a pas de moyen de paiement actif.'
    : r.status === 403 ? 'Accès refusé (403) : la clé n’a pas accès à ce modèle.'
    : r.status === 404 ? 'Modèle introuvable (404) : vérifie le nom du modèle dans les réglages.'
    : r.status === 429 ? 'Quota atteint (429) : trop de requêtes, ou crédit épuisé. Réessaie dans un instant.'
    : r.status === 529 || r.status >= 500 ? `Service momentanément indisponible (${r.status}). Réessaie plus tard.`
    : `Erreur ${r.status}.`;
  return { msg: detail ? `${base}\nRéponse du service : ${detail}` : base, detail };
}
function addUsage(model, u, searches = 0) {
  const [pi, po, pr, pw] = priceOf(model);
  const usd = ((u.input || 0) * pi + (u.output || 0) * po + (u.cacheRead || 0) * pr + (u.cacheWrite || 0) * pw) / 1e6 + searches * WEB_SEARCH_USD;
  const k = monthKey(), m = S.usage[k] ||= { usd: 0, n: 0 };
  m.usd += usd; m.n++;
  return usd;
}
function budgetCheck() {
  const b = aiCfg().budget;
  if (b && monthSpend() >= b) throw new AIError(`Plafond mensuel atteint (${fmtE2.format(b)}). Tu peux le relever dans Plus › Intelligence artificielle.`);
}
// Un appel au modèle. system : texte fixe ; context : texte mis en cache (cave) ; content : blocs du dernier message.
// Enveloppe : note chaque appel dans le suivi d'utilisation (type, durée, coût, réussite) et garde les erreurs
async function aiCall(opts) {
  const t0 = Date.now(), tag = opts.tag || 'autre';
  try {
    const r = await aiCall0(opts);
    uLog('ai', tag, `ok,${Date.now() - t0},${(r.usd || 0).toFixed(4)}`);
    return r;
  } catch (e) {
    uLog('ai', tag, `err,${Date.now() - t0},0`); errLog('ia:' + tag, e);
    throw e;
  }
}
async function aiCall0({ system, context = '', history = [], content, schema = null, maxTokens = 4000, effort = 'medium', web = false }) {
  if (!aiReady()) throw new AIError('Aucune clé IA configurée. Va dans Plus › Intelligence artificielle.');
  if (navigator.onLine === false) throw new AIError('Pas de connexion réseau.');
  budgetCheck();
  const cfg = aiCfg(), model = aiModel();
  if (!aiClaude()) return mistralCall({ system, context, history, content, schema, maxTokens, model, cfg });
  const sys = [{ type: 'text', text: system }];
  if (context) sys.push({ type: 'text', text: context, cache_control: { type: 'ephemeral' } });
  const msgs = [...history, { role: 'user', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content }];
  const body = { model, max_tokens: maxTokens, system: sys, messages: msgs, output_config: { effort } };
  if (schema) body.output_config.format = { type: 'json_schema', schema };
  if (web) body.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }];
  const fb = !aiNoFallback && /sonnet-5-5|opus-5/.test(model);
  let out = { text: '', sources: [], usd: 0 };
  for (let turn = 0; turn < 4; turn++) {
    const headers = { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' };
    const b = { ...body };
    if (fb && !aiNoFallback) { b.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
    let r;
    try { r = await fetch(AI.anthropic.url, { method: 'POST', headers, body: JSON.stringify(b) }); }
    catch { throw new AIError('Impossible de joindre le service. Vérifie ta connexion.'); }
    if (!r.ok) {
      const e = await apiError(r);
      // Le paramètre de repli n'est pas accepté par ce compte ou ce modèle : on réessaie sans lui
      if (r.status === 400 && b.fallbacks && /fallback/i.test(e.detail)) { aiNoFallback = true; turn--; continue; }
      throw new AIError(e.msg);
    }
    const j = await r.json();
    const u = j.usage || {};
    out.usd += addUsage(j.model || model, { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens }, u.server_tool_use?.web_search_requests || 0);
    for (const c of j.content || []) {
      if (c.type === 'text') out.text += c.text;
      if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) for (const s of c.content) if (s.url) out.sources.push({ url: s.url, title: s.title });
    }
    if (j.stop_reason === 'refusal') throw new AIError('Le modèle a refusé de répondre à cette demande. Reformule-la.');
    if (j.stop_reason === 'pause_turn') { body.messages = [...msgs, { role: 'assistant', content: j.content }]; continue; }
    if (j.stop_reason === 'max_tokens') throw new AIError('Réponse trop longue, interrompue. Réessaie avec une demande plus courte.');
    break;
  }
  if (mode === 'app') save();
  out.text = out.text.trim();
  if (schema) { try { out.json = JSON.parse(out.text); } catch { throw new AIError('Réponse illisible. Réessaie.'); } }
  return out;
}
async function mistralCall({ system, context, history, content, schema, maxTokens, model, cfg }) {
  if (typeof content !== 'string') {
    if (content.some(c => c.type !== 'text')) throw new AIError('La lecture d’images et de PDF n’est disponible qu’avec Claude. Change de fournisseur dans Plus › Intelligence artificielle.');
    content = content.map(c => c.text).join('\n');
  }
  const flat = m => typeof m.content === 'string' ? m.content : m.content.map(c => c.text || '').join('\n');
  const sys = system + (context ? '\n\n' + context : '') + (schema ? '\n\nRéponds uniquement par un objet JSON conforme à ce schéma :\n' + JSON.stringify(schema) : '');
  const body = { model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, ...history.map(m => ({ role: m.role, content: flat(m) })), { role: 'user', content }] };
  if (schema) body.response_format = { type: 'json_object' };
  let r;
  try { r = await fetch(AI.mistral.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key }, body: JSON.stringify(body) }); }
  catch { throw new AIError('Impossible de joindre le service. Vérifie ta connexion.'); }
  if (!r.ok) throw new AIError((await apiError(r)).msg);
  const j = await r.json();
  const usd = addUsage(model, { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens });
  if (mode === 'app') save();
  const text = (j.choices?.[0]?.message?.content || '').trim();
  const out = { text, sources: [], usd };
  if (schema) { try { out.json = JSON.parse(text.replace(/^```(json)?|```$/g, '')); } catch { throw new AIError('Réponse illisible. Réessaie.'); } }
  return out;
}
// Extrait le dernier objet JSON d'un texte libre (réponse avec recherche web)
function lastJson(t) {
  const fences = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
  for (const c of fences.reverse()) { try { return JSON.parse(c); } catch {} }
  const end = t.lastIndexOf('}');
  for (let i = t.lastIndexOf('{', end); i >= 0; i = i ? t.lastIndexOf('{', i - 1) : -1) { try { return JSON.parse(t.slice(i, end + 1)); } catch {} }
  return null;
}

/* ---------- Contexte de cave envoyé au sommelier ---------- */
function caveContext(allSites) {
  const y = thisYear(), cur = S.settings.site, multi = isMulti();
  const rows = [], ws = S.wines.filter(w => kindOn(w) && myBottles(w.id).length);
  for (const w of ws) {
    const bs = myBottles(w.id).filter(b => allSites || !multi || siteOfBottle(b) === cur);
    const elsewhere = multi && !allSites ? myBottles(w.id).length - bs.length : 0;
    if (!bs.length && !elsewhere) continue;
    const locs = [...new Set(bs.map(b => locLabel(b, multi)))].map(l => `${l} ×${bs.filter(b => locLabel(b, multi) === l).length}`).join(' ; ');
    const ts = S.tastings.filter(t => t.wineId === w.id), tn = ts.filter(t => t.note != null), avg = tn.length ? tn.reduce((n, t) => n + t.note, 0) / tn.length : null;
    const st = status(w), a = w.apogee;
    const parts = [`id=${w.id}`, w.kind === 'spirit' ? `SPIRITUEUX ${SPIRIT_CATS[w.cat]}` : COLORS[w.couleur]?.label, wineTitle(w), w.domaine && `domaine ${w.domaine}`,
      w.kind === 'spirit' ? [w.age && w.age + ' ans', w.fut, w.degre && w.degre + ' %'].filter(Boolean).join(', ') : [w.appellation, w.region].filter(Boolean).join(', '),
      w.cepages && `cépages ${w.cepages}`, `${bs.length} bouteille(s) ici${bs.length ? ' : ' + locs : ''}${elsewhere ? `, ${elsewhere} sur l’autre site` : ''}`,
      w.kind !== 'spirit' && (a?.fin ? `fenêtre ${a.debut || '?'}–${a.fin}${a.pic ? ' apogée ' + a.pic : ''} (${STATUS[st].label.toLowerCase()})` : 'fenêtre inconnue'),
      bs.some(b => b.state === 'open') && `ouverte, niveau ${bs.find(b => b.state === 'open').level ?? 100} %`,
      w.service && `servir à ${w.service}`, w.notes && /Accords Ploc/.test(w.notes) && w.notes.match(/Accords Ploc : [^\n]{0,160}/)?.[0],
      w.achat?.prix != null && `prix ${Math.round(w.achat.prix)} €`, w.format && w.format !== '75' && w.format !== '70' && `format ${w.format} cl`,
      avg != null && `déjà dégusté : ${numFr(avg)}/20${ts.at(-1)?.comment ? ' « ' + ts.at(-1).comment.slice(0, 80) + ' »' : ''}`];
    rows.push({ w, line: '- ' + parts.filter(Boolean).join(' | ') });
  }
  // Grosse cave : on ne détaille que les vins les plus utiles (à boire, prêts, bientôt prêts, dégustés récemment), 300 au plus
  let lines = rows.map(o => o.line), reduced = '';
  if (rows.length > 300) {
    const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10), recent = new Set(S.tastings.filter(t => (t.at || '') >= since).map(t => t.wineId));
    const rank = w => { const st = status(w); return w.kind === 'spirit' ? 2 : st === 'prio' ? 0 : st === 'apogee' ? 1 : st === 'tot' && w.apogee?.debut <= y + 1 ? 2 : recent.has(w.id) ? 3 : 9; };
    const keep = rows.filter(o => rank(o.w) < 9).sort((a, b) => rank(a.w) - rank(b.w) || (a.w.apogee?.fin || 9999) - (b.w.apogee?.fin || 9999)).slice(0, 300);
    const kept = new Set(keep.map(o => o.w.id)), rest = rows.filter(o => !kept.has(o.w.id));
    const count = f => Object.entries(rest.reduce((m, o) => { const k = f(o.w); m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, n]) => `${k} ${n}`).join(', ');
    lines = keep.map(o => o.line);
    reduced = `\nCave volumineuse : ${rest.length} autres références ne sont pas détaillées (par couleur : ${count(w => w.kind === 'spirit' ? 'spiritueux' : COLORS[w.couleur]?.label || '?')} ; par statut : ${count(w => STATUS[status(w) || 'inconnu']?.short || '?')}). Si la demande porte sur elles, dis-le à l’utilisateur.`;
  }
  const sites = S.sites.map(s => `${s.name} (${s.role === 'stock' ? 'stockage' : 'consommation'}${s.id === cur ? ', l’utilisateur y est actuellement' : ''})`).join(' ; ');
  const top = [...S.tastings].filter(t => t.note != null && wine(t.wineId)).sort((a, b) => b.note - a.note);
  const liked = top.slice(0, 6).map(t => `${wineTitle(wine(t.wineId) || {})} ${numFr(t.note)}/20`).filter(x => !x.startsWith('undefined'));
  const disliked = top.filter(t => t.note < 12).slice(-4).map(t => `${wineTitle(wine(t.wineId) || {})} ${numFr(t.note)}/20`);
  const tw = t => wine(t.wineId) || {};
  const outside = S.tastings.filter(t => !t.bottleId && wine(t.wineId) && !isFriend(tw(t))).sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 15)
    .map(t => `${wineTitle(tw(t))} (${[COLORS[tw(t).couleur]?.label, tw(t).region].filter(Boolean).join(', ')}) ${t.note != null ? numFr(t.note) + '/20' : ''}${t.type ? ', ' + TASTE_TYPES[t.type].toLowerCase() : ''}${t.comment ? ' « ' + t.comment.slice(0, 70) + ' »' : ''}`);
  const accords = S.tastings.filter(t => t.accord && t.plat && wine(t.wineId)).slice(-12).map(t => `${t.plat} + ${wineTitle(tw(t))} : ${ACCORDS[t.accord].toLowerCase()}`);
  const wishes = S.wishes.map(x => wine(x.wineId)).filter(Boolean).map(wineTitle);
  return `Date du jour : ${today()} (année ${y}).
${outside.length ? `Vins dégustés hors de la cave (récents) : ${outside.join(' ; ')}.` : ''}
${accords.length ? `Accords déjà essayés par l’utilisateur : ${accords.join(' ; ')}.` : ''}
${wishes.length ? `Liste d’envies (vins qu’il veut acheter) : ${wishes.join(' ; ')}.` : ''}
${multi ? `Sites : ${sites}.${allSites ? ' Bouteilles de tous les sites.' : ' Liste limitée au site actuel.'}` : ''}
${liked.length ? `Vins les mieux notés par l’utilisateur : ${liked.join(' ; ')}.` : ''}${disliked.length ? `\nVins peu appréciés : ${disliked.join(' ; ')}.` : ''}
Cave disponible (${lines.length} références détaillées)${reduced} :
${lines.join('\n') || '(aucune bouteille)'}`;
}

/* ---------- Sommelier (conversation) ---------- */
const SOMM_SYS = () => `Tu es le sommelier personnel d’un amateur français. Tu conseilles des bouteilles de SA cave, listée dans le contexte, pour des accords mets-vins, des occasions, ou ce qu’il faut boire en priorité.
Règles :
- Ne recommande que des bouteilles de la liste, en citant leur id exact. N’invente aucune bouteille. Si rien ne convient, dis-le franchement et propose dans « achats » 1 à 3 vins à acheter (appellation, style, budget indicatif).
- Ordre de priorité : 1) vin dans sa fenêtre de dégustation, 2) qualité de l’accord, 3) bouteilles en fin de fenêtre à boire avant les autres, 4) préserve les grandes bouteilles (prix élevé, grands crus) sauf si l’occasion est « grande occasion », 5) respecte le budget de l’occasion : quotidien = bouteilles modestes, entre amis = milieu de gamme, grande occasion = les meilleures.
- Évite de proposer un vin « trop tôt » ou « en déclin » sauf demande explicite ou faute de mieux (et dis-le).
- Propose en général 3 bouteilles au plus, la meilleure en premier. Un vin par plat uniquement si on te demande un menu complet ; indique alors le plat dans « plat ».
- Pour chaque recommandation : raison de l’accord en une ou deux phrases concrètes, température de service (ex. « 16 °C »), carafage (ex. « Carafe 30 min » ou « Sans carafe »).
- Tiens compte des notes et commentaires passés, y compris des vins dégustés hors de la cave, pour les goûts de l’utilisateur. Appuie-toi sur les accords qu’il a jugés parfaits, évite de reproduire ceux qu’il a jugés ratés. Pour les suggestions d’achat, pense à sa liste d’envies.
- Si la liste est limitée au site actuel et qu’une bouteille idéale est sur l’autre site, tu peux le mentionner dans le message.
${spiritsOn() ? `- La cave contient aussi des spiritueux (marqués SPIRITUEUX) : propose-les pour un digestif, une dégustation ou un accord (chocolat, fromage, dessert, cigare).${S.settings.cocktails ? ' Tu peux suggérer un cocktail réalisable avec un spiritueux de la cave, recette courte dans le message.' : ' Ne propose pas de cocktails.'}` : '- Ne propose pas de spiritueux ni de cocktails.'}
- « message » : réponse courte et chaleureuse, en français, en tutoyant, 80 mots maximum, sans markdown. « relances » : 2 ou 3 suggestions de questions de suivi très courtes (moins de 6 mots).`;
const SOMM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['message', 'recos', 'achats', 'relances'],
  properties: {
    message: { type: 'string' },
    recos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'role', 'raison', 'temperature', 'carafe', 'plat'], properties: {
      id: { type: 'string' }, role: { type: 'string', description: 'Étiquette courte : « Mon choix », « Plus frais », « Pour le fromage »…' }, raison: { type: 'string' }, temperature: { type: 'string' }, carafe: { type: 'string' }, plat: { type: 'string' } } } },
    achats: { type: 'array', items: { type: 'string' } },
    relances: { type: 'array', items: { type: 'string' } },
  },
};
let chatOpts = { occasion: '', all: false };
const OCCASIONS = { quotidien: 'Quotidien', amis: 'Entre amis', grande: 'Grande occasion' };
function vSomm() {
  const msgs = S.chat;
  const starters = ['Ce soir : poulet rôti', 'Un apéritif pour 6', 'Que boire en priorité ?', 'Un vin pour un plateau de fromages', 'Que cuisiner avec mon meilleur rouge ?', ...(spiritsOn() ? ['Un digestif après le repas', ...(S.settings.cocktails ? ['Un cocktail avec ma cave'] : [])] : [])];
  const body = msgs.length ? msgs.map(chatMsg).join('') : `<div class="card"><b>Que veux-tu boire ?</b><p class="small" style="margin:6px 0 0">Décris ton plat ou l’occasion. Je choisis dans ta cave${isMulti() ? `, d’abord à ${esc(site(S.settings.site)?.name)}` : ''}, en privilégiant les bouteilles à leur apogée.</p>
      <div class="chips wrap">${starters.map(s => `<button class="chip" data-act="chatAsk" data-q="${esc(s)}">${esc(s)}</button>`).join('')}<button class="chip" data-act="auditSheet">${ICON.spark} Audit de ma cave</button></div></div>
      ${!aiReady() ? `<div class="banner">Pour activer le sommelier, ajoute une clé API dans Plus › Intelligence artificielle.<br><button class="btn small primary" data-act="aiSettings">Configurer</button></div>` : ''}`;
  return `${body}${chatBusy ? '<div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>' : ''}`;
}
function chatMsg(m, i) {
  if (m.role === 'user') return `<div class="bubble me">${esc(m.text)}</div>`;
  if (m.error) return `<div class="bubble ai err">${esc(m.error)}</div>${i === S.chat.length - 1 ? '<button class="link" style="font-size:13px" data-act="problem">Signaler un problème</button>' : ''}`;
  const d = m.data || {}, last = i === S.chat.length - 1;
  const recos = (d.recos || []).map((r, k) => {
    const w = wine(r.id); if (!w) return '';
    const bs = wineBottles(w.id), st = status(w), b = pickBottle(w);
    return `<div class="reco${k === 0 ? ' first' : ''}"><div class="rk">${k + 1} · ${esc(r.role || (k ? 'Alternative' : 'Mon choix'))}${r.plat ? ' · ' + esc(r.plat) : ''}</div>
      <div class="rn">${esc(wineTitle(w))}</div><div class="rs">${esc(wineSub(w))} · ${plural(bs.length, 'bouteille', 'bouteilles')}</div>
      <div class="why">${esc(r.raison)}</div>
      <div class="tags" style="margin-top:8px">${st && st !== 'inconnu' ? `<span class="tag ${STATUS[st].tag}">${STATUS[st].short}</span>` : ''}${r.temperature ? `<span class="tag">${esc(r.temperature)}</span>` : ''}${r.carafe ? `<span class="tag">${esc(r.carafe)}</span>` : ''}${w.achat?.prix ? `<span class="tag">~${eur(w.achat.prix)}</span>` : ''}</div>
      ${b ? `<div class="loc">${ICON.pin}${esc(locLabel(b))}</div>` : ''}
      ${b ? `<div class="btns2" style="margin-top:10px"><button class="btn primary small" data-act="takeIt" data-w="${w.id}">Je la prends</button><button class="btn small" data-act="wine" data-id="${w.id}">Fiche</button></div>` : '<p class="tiny">Plus de bouteille disponible.</p>'}</div>`;
  }).join('');
  const gone = (d.recos || []).filter(r => !wine(r.id)).length;
  return `<div class="bubble ai">${esc(d.message || '')}</div>${recos}${gone ? `<p class="tiny" style="margin:6px 4px 0">${gone > 1 ? gone + ' recommandations ne correspondent' : 'Une recommandation ne correspond'} plus à ta cave.</p>` : ''}
    ${d.achats?.length ? `<div class="card"><div class="ct">À acheter</div>${d.achats.map(a => `<p class="small" style="margin:4px 0;color:var(--ink)">• ${esc(a)}</p>`).join('')}</div>` : ''}
    ${last && d.relances?.length ? `<div class="chips wrap">${d.relances.map(q => `<button class="chip" data-act="chatAsk" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}`;
}
// Bouteille à sortir pour un vin : sur le site actuel, dans l'espace de consommation, rangée, déjà ouverte d'abord
function pickBottle(w) {
  const bs = myBottles(w.id).length ? myBottles(w.id) : wineBottles(w.id);
  const score = b => (b.state === 'open' ? 8 : 0) + (siteOfBottle(b) === S.settings.site ? 4 : 0) + (space(b.spaceId)?.use === 'conso' ? 2 : 0) + (b.unitId ? 1 : 0);
  return bs.sort((a, b) => score(b) - score(a))[0] || null;
}
function composer() {
  return `<div class="composer">
    <div class="chips" style="margin:0 0 6px">${Object.entries(OCCASIONS).map(([k, l]) => `<button class="chip soft${chatOpts.occasion === k ? ' on' : ''}" data-act="chatOcc" data-k="${k}">${l}</button>`).join('')}
      ${isMulti() ? `<button class="chip soft${chatOpts.all ? ' on' : ''}" data-act="chatAll">Inclure tous les sites</button>` : ''}</div>
    <form class="box" data-form="chat">${S.chat.length ? `<button type="button" class="newc" data-act="chatNew" aria-label="Nouvelle conversation" title="Nouvelle conversation" ${chatBusy ? 'disabled' : ''}>${ICON.newchat}</button>` : ''}<textarea name="q" rows="1" placeholder="Demande au sommelier…" data-in="grow" enterkeyhint="send"></textarea>
      <button class="send" type="submit" aria-label="Envoyer" ${chatBusy ? 'disabled' : ''}>${ICON.send}</button></form></div>`;
}
INPUTS.grow = el => { el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; };
async function chatSend(q) {
  q = (q || '').trim(); if (!q || chatBusy) return;
  if (!aiReady()) return ACT.aiSettings();
  const ctxNote = [chatOpts.occasion && `Occasion : ${OCCASIONS[chatOpts.occasion].toLowerCase()}.`].filter(Boolean).join(' ');
  S.chat.push({ role: 'user', text: q, at: Date.now() });
  chatBusy = true; chatScroll = true; render();
  const hist = S.chat.slice(-13, -1).filter(m => !m.error).map(m => m.role === 'user' ? { role: 'user', content: m.text } : { role: 'assistant', content: JSON.stringify(m.data) });
  // L'historique doit commencer par un message de l'utilisateur et alterner
  while (hist.length && hist[0].role !== 'user') hist.shift();
  const clean = []; for (const m of hist) { if (clean.length && clean.at(-1).role === m.role) clean.pop(); clean.push(m); }
  if (clean.length && clean.at(-1).role === 'user') clean.pop();
  try {
    const r = await aiCall({ tag: 'sommelier', system: SOMM_SYS(), context: caveContext(chatOpts.all), history: clean, content: [{ type: 'text', text: (ctxNote ? ctxNote + '\n' : '') + q, cache_control: { type: 'ephemeral' } }], schema: SOMM_SCHEMA, maxTokens: 3000, effort: 'medium' });
    S.chat.push({ role: 'assistant', data: r.json, at: Date.now(), usd: r.usd });
  } catch (e) {
    S.chat.push({ role: 'assistant', error: e instanceof AIError ? e.message : 'Erreur inattendue : ' + (e.message || e), at: Date.now() });
  }
  chatBusy = false; chatScroll = true;
  if (S.chat.length > 60) S.chat = S.chat.slice(-60);
  await save(); if (view === 'somm') render();
}
FORMS.chat = (f, d) => chatSend(d.q);
Object.assign(ACT, {
  chatAsk: t => chatSend(t.dataset.q),
  chatNew: async () => {
    if (chatBusy || !S.chat.length || !confirm('Commencer une nouvelle conversation ? La conversation actuelle sera effacée.')) return;
    S.chat = []; await save(); render(); window.scrollTo(0, 0);
  },
  chatOcc: t => { chatOpts.occasion = chatOpts.occasion === t.dataset.k ? '' : t.dataset.k; $$('.composer [data-act=chatOcc]').forEach(b => b.classList.toggle('on', b.dataset.k === chatOpts.occasion)); },
  chatAll: t => { chatOpts.all = !chatOpts.all; t.classList.toggle('on', chatOpts.all); },
  takeIt: t => { const b = pickBottle(wine(t.dataset.w)); if (b) showSheet(() => outSheet(b.id)); },
});

/* ---------- Fenêtre de dégustation (apogée) ---------- */
const APO_SYS = `Tu es un sommelier expert du vieillissement des vins. On te donne un vin d’une cave personnelle et ses conditions de stockage.
Estime sa fenêtre de dégustation : année de début (le vin devient agréable), année d’apogée, année de fin (au-delà il décline). Tiens compte du millésime, de l’appellation, du producteur, de la cuvée, du format (un magnum évolue plus lentement) et des conditions de stockage (une cave de qualité moyenne ou faible raccourcit la garde). S’il y a des notes de dégustation récentes, elles priment sur la théorie.
Si un outil de recherche web est disponible, fais une ou deux recherches ciblées (critiques, fiches du producteur, appréciation du millésime) avant de conclure.
Termine ta réponse par un bloc JSON : {"debut": année, "pic": année, "fin": année, "justification": "deux phrases maximum en français", "confiance": "haute|moyenne|faible"}.`;
function wineBrief(w) {
  const bs = wineBottles(w.id), sps = [...new Set(bs.map(b => b.spaceId))].map(space).filter(Boolean);
  const ts = S.tastings.filter(t => t.wineId === w.id).slice(-3);
  return [`Vin : ${wineTitle(w)}`, `Couleur : ${COLORS[w.couleur]?.label || '?'}`, w.domaine && `Producteur : ${w.domaine}`, w.cuvee && `Cuvée : ${w.cuvee}`,
    w.appellation && `Appellation : ${w.appellation}`, (w.region || w.pays) && `Région : ${[w.region, w.pays].filter(Boolean).join(', ')}`, w.cepages && `Cépages : ${w.cepages}`,
    `Millésime : ${w.millesime || 'non millésimé'}`, w.format && w.format !== '75' && `Format : ${w.format} cl`,
    sps.length && `Stockage : ${sps.map(s => `${s.name} (qualité ${qualityLabel(spaceQuality(s)).toLowerCase()} : ${Object.entries(s.q || {}).map(([k, v]) => QUALITY[k]?.opts[v]).filter(Boolean).join(', ') || 'conditions non renseignées'})`).join(' ; ')}`,
    ts.length && `Dégustations : ${ts.map(t => `${t.at} ${t.note != null ? numFr(t.note) + '/20' : ''} ${t.full?.evolution ? '(' + t.full.evolution + ')' : ''} ${t.comment || ''}`.trim()).join(' ; ')}`,
    `Année actuelle : ${thisYear()}`].filter(Boolean).join('\n');
}
const yearOk = (y, w) => Number.isInteger(y) && y >= 1900 && y <= 2200 && (!w.millesime || y >= w.millesime);
async function estimateApogee(wid, { quiet = false } = {}) {
  const w = wine(wid); if (!w || w.kind === 'spirit') return;
  if (!quiet) toast('Le sommelier étudie ce vin…');
  try {
    const r = await aiCall({ tag: 'apogee', system: APO_SYS, content: wineBrief(w), maxTokens: 6000, effort: 'medium', web: aiClaude() && aiCfg().web });
    const j = lastJson(r.text);
    if (!j) throw new AIError('Estimation illisible. Réessaie.');
    const cw = cleanWindow(j.debut, j.pic, j.fin, w.millesime);
    if (!cw) throw new AIError('Estimation incohérente (années dans le désordre ou impossibles) : elle a été ignorée. Réessaie.');
    w.apogee = { ...cw, why: String(j.justification || '').slice(0, 400), conf: j.confiance, src: 'ia', sources: r.sources.slice(0, 5), at: Date.now() };
    await save(); render(); if (sheetStack.length) refreshSheet();
    toast(`Fenêtre estimée : ${windowLabel(w.apogee)}`);
  } catch (e) {
    if (quiet) toast('Apogée non estimée : ' + (e.message || '').split('\n')[0]);
    else errSheet('Estimation impossible', e.message || String(e));
  }
}
// Estimation groupée, sans recherche web (import, vins sans fenêtre)
const BATCH_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['i', 'debut', 'pic', 'fin'], properties: { i: { type: 'integer' }, debut: { type: 'integer' }, pic: { type: 'integer' }, fin: { type: 'integer' } } } } } };
async function estimateBatch(ws, onStep) {
  let done = 0;
  for (let k = 0; k < ws.length; k += 30) {
    const chunk = ws.slice(k, k + 30);
    const r = await aiCall({ tag: 'apogee-lot', system: APO_SYS.replace(/Si un outil[\s\S]*?conclure\.\n/, '').replace(/Termine ta réponse[\s\S]*$/, 'Réponds pour chaque vin avec son numéro i.'), content: chunk.map((w, i) => `#${i}\n${wineBrief(w)}`).join('\n\n'), schema: BATCH_SCHEMA, maxTokens: 6000, effort: 'low' });
    for (const it of r.json.items || []) {
      const w = chunk[it.i], cw = w && cleanWindow(it.debut, it.pic, it.fin, w.millesime); if (!cw) continue;
      w.apogee = { ...cw, src: 'ia', why: 'Estimation groupée, sans recherche web.', at: Date.now() };
      done++;
    }
    onStep?.(Math.min(ws.length, k + 30), ws.length);
  }
  await save();
  return done;
}
Object.assign(ACT, {
  estimate: t => { if (!aiReady()) return ACT.aiSettings(); closeSheet(); estimateApogee(t.dataset.id).then(() => showSheet(() => wineSheet(t.dataset.id))); },
  estimateMissing: async () => {
    if (!aiReady()) return ACT.aiSettings();
    const ws = S.wines.filter(w => w.kind === 'vin' && !w.apogee?.fin && wineBottles(w.id).length);
    if (!ws.length) return toast('Toutes les fenêtres sont connues');
    if (!confirm(`Estimer la fenêtre de ${plural(ws.length, 'vin', 'vins')} ? Coût indicatif : moins de ${fmtE2.format(Math.max(0.02, ws.length * 0.004))}.`)) return;
    toast('Estimation en cours…');
    try { const n = await estimateBatch(ws); render(); toast(`${plural(n, 'fenêtre estimée', 'fenêtres estimées')}`); }
    catch (e) { errSheet('Estimation impossible', e.message || String(e)); }
  },
});

/* ---------- Lecture d'étiquette ---------- */
const LABEL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['kind', 'couleur', 'domaine', 'cuvee', 'appellation', 'region', 'pays', 'millesime', 'cepages', 'degre', 'format', 'cat', 'age', 'fut'],
  properties: {
    kind: { type: 'string', enum: ['vin', 'spirit'] }, couleur: { type: 'string', enum: ['rouge', 'blanc', 'rose', 'effervescent', 'liquoreux', 'orange', ''] },
    domaine: { type: 'string' }, cuvee: { type: 'string' }, appellation: { type: 'string' }, region: { type: 'string' }, pays: { type: 'string' },
    millesime: { type: 'string' }, cepages: { type: 'string' }, degre: { type: 'string' }, format: { type: 'string' },
    cat: { type: 'string', enum: ['whisky', 'rhum', 'cognac', 'armagnac', 'calvados', 'gin', 'autre', ''] }, age: { type: 'string' }, fut: { type: 'string' },
  },
};
const LABEL_SYS = `Tu lis la photo d’une étiquette de vin ou de spiritueux et tu remplis sa fiche. Recopie fidèlement ce qui est écrit ; complète la région, le pays, la couleur et les cépages habituels de l’appellation si l’étiquette ne les donne pas. Laisse vide (chaîne vide) ce que tu ne peux pas déterminer.
« domaine » : producteur, château ou distillerie. « cuvee » : nom de cuvée ou de l’expression, vide si aucun. « millesime » : année seule. « degre » : nombre seul. « format » : contenance en cl (75, 150, 70, 5…). « age » : âge en années pour un spiritueux. Pour un vin, « cat », « age » et « fut » restent vides.`;
Object.assign(ACT, {
  scanLabel: t => { labelFor = null; photoInput(t); },
  editPhoto: t => { labelFor = { editPhoto: true }; photoInput(t); },
});
async function onPhoto(file) {
  if (!file) return;
  let big, small;
  try { big = await shrinkImage(file, 1280, 0.8); small = await shrinkImage(file, 640, 0.72); if (!big || !small) throw 0; }
  catch { labelFor = null; return sheetMsg('Photo illisible', 'Ce format de photo n’a pas pu être lu sur cet appareil. Prends la photo directement avec « Prendre une photo », ou choisis-en une autre.'); }
  const forTaste = labelFor; labelFor = null;
  // Fiche en cours de modification : la photo remplace celle de l'étiquette, sans nouvelle lecture
  if (forTaste?.editPhoto) { if (!draft?.w) return; draft.photo = small; draft.photoUrl = URL.createObjectURL(small); refreshSheet(); return toast('Photo remplacée · enregistre la fiche'); }
  const go = fields => {
    newDraft(fields.kind === 'spirit' && spiritsOn() ? 'spirit' : 'vin', fields);
    draft.photo = small; draft.photoUrl = URL.createObjectURL(small);
    if (forTaste?.reveal) draft.forReveal = forTaste.reveal; else if (forTaste) draft.forTaste = forTaste;
    showSheet(wineFormSheet, { full: true });
  };
  if (!aiReady() || !aiClaude()) { closeSheet(); go({}); return toast(aiReady() ? 'Lecture d’étiquette : Claude uniquement' : 'Sans clé IA : saisie manuelle'); }
  closeSheet();
  showSheet(() => `${head('Lecture de l’étiquette…')}<p class="small">Le sommelier déchiffre l’étiquette. Quelques secondes.</p><div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`);
  try {
    const r = await aiCall({ tag: 'etiquette', system: LABEL_SYS, content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobB64(big) } }, { type: 'text', text: 'Fiche de cette bouteille.' }], schema: LABEL_SCHEMA, maxTokens: 2000, effort: 'low' });
    const j = r.json, f = {};
    for (const k of ['domaine', 'cuvee', 'appellation', 'region', 'pays', 'cepages', 'fut']) if (typeof j[k] === 'string') f[k] = j[k].trim().slice(0, 120);
    f.kind = j.kind === 'spirit' ? 'spirit' : 'vin';
    f.millesime = readYear(j.millesime, thisYear() + 1).v || null;
    const deg = num(j.degre); f.degre = deg > 0 && deg <= (f.kind === 'spirit' ? 80 : 25) ? deg : null;
    const age = int(j.age); f.age = age >= 0 && age <= 100 ? age || null : null;
    f.format = f.kind === 'spirit' ? (FORMATS.spirit.some(x => x[0] === j.format) ? j.format : '70') : (FORMATS.vin.some(x => x[0] === j.format) ? j.format : '75');
    if (f.kind === 'vin' && COLORS[j.couleur]) f.couleur = j.couleur;
    if (f.kind === 'spirit') f.cat = SPIRIT_CATS[j.cat] ? j.cat : 'autre';
    for (const k of Object.keys(f)) if (f[k] === '') delete f[k];
    closeSheet(); go(f);
  } catch (e) { closeSheet(); go({}); errSheet('Lecture impossible', (e.message || String(e)) + '\n\nTu peux remplir la fiche à la main : la photo est conservée.'); }
}

/* ---------- Réévaluation de la fenêtre après une dégustation ---------- */
const REEVAL_SCHEMA = { type: 'object', additionalProperties: false, required: ['changer', 'debut', 'pic', 'fin', 'justification'], properties: {
  changer: { type: 'boolean' }, debut: { type: 'integer' }, pic: { type: 'integer' }, fin: { type: 'integer' }, justification: { type: 'string' } } };
async function reevaluate(w, rec) {
  const a = w.apogee, left = wineBottles(w.id).length;
  const F = rec.full || {};
  const note = [`Dégustation du ${rec.at} : ${rec.note != null ? numFr(rec.note) + '/20' : 'sans note'}`, rec.comment && `commentaire « ${rec.comment} »`,
    F.evolution && `évolution jugée : ${({ jeune: 'jeune', apoint: 'à point', declin: 'sur le déclin' })[F.evolution]}`, F.potentiel && `potentiel restant estimé : ${F.potentiel}`,
    F.aromes?.length && `arômes : ${F.aromes.join(', ')}`].filter(Boolean).join(' ; ');
  try {
    const r = await aiCall({ tag: 'reevaluation', system: APO_SYS.replace(/Si un outil[\s\S]*?conclure\.\n/, '').replace(/Termine ta réponse[\s\S]*$/, '') +
      `\nOn vient de déguster ce vin. Dis s'il faut modifier sa fenêtre actuelle (${a?.fin ? `${a.debut || '?'}–${a.fin}, apogée ${a.pic || '?'}` : 'inconnue'}) pour les ${left} bouteille(s) restantes. Ne la change que si la dégustation l'apporte vraiment (changer = false sinon, et recopie la fenêtre actuelle). Justification en une ou deux phrases, en français, en tutoyant.`,
      content: wineBrief(w) + '\n' + note, schema: REEVAL_SCHEMA, maxTokens: 2000, effort: 'low' });
    const j = r.json;
    const prop = j.changer && cleanWindow(j.debut, j.pic, j.fin, w.millesime);
    if (!prop || (a && prop.fin === a.fin && prop.debut === (a.debut ?? null) && prop.pic === (a.pic ?? null))) return;
    showSheet(() => `${head('Le sommelier')}
      <div class="card" style="background:var(--green-soft);border-color:#C9DCCF"><p style="margin:0 0 6px"><b>${esc(wineTitle(w))}</b> · ${plural(left, 'bouteille restante', 'bouteilles restantes')}</p>
        <p style="margin:0">${esc(j.justification)}</p>
        <p class="small" style="margin:8px 0 0">Fenêtre actuelle : ${esc(windowLabel(a))}<br>Proposée : <b style="color:var(--green)">${esc(windowLabel(prop))}</b></p></div>
      <div class="btns2" style="margin-top:12px"><button class="btn green" data-act="applyReeval" data-w="${w.id}" data-deb="${prop.debut || ''}" data-pic="${prop.pic || ''}" data-fin="${prop.fin}">Mettre à jour</button><button class="btn ghost" data-act="close">Garder</button></div>`);
  } catch (e) { /* silencieux : la dégustation est enregistrée, la réévaluation est un bonus */ }
}
ACT.applyReeval = async t => {
  const w = wine(t.dataset.w);
  w.apogee = { ...(w.apogee || {}), debut: int(t.dataset.deb), pic: int(t.dataset.pic), fin: int(t.dataset.fin), src: 'ia', why: 'Réévaluée après dégustation.', at: Date.now() };
  await save(); closeSheet(); render(); toast('Fenêtre mise à jour');
};
