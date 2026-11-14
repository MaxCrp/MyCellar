/* ---------- Onglet Plus ---------- */
const DEMO_OFF = 'Indisponible dans la cave fictive : crée ta cave pour l’utiliser';
// Interrupteur ; « demoOff » : désactivé dans la cave fictive, et un appui explique pourquoi
const sw = (act, on, dis = false, demoOff = false) => `<span class="switch" ${demoOff ? 'data-act="demoOnly"' : ''}><input type="checkbox" data-ch="${act}" ${on ? 'checked' : ''} ${dis || demoOff ? 'disabled' : ''}><span></span></span>`;
const whyOff = on => on ? `<span class="why-off">${DEMO_OFF}</span>` : '';
const setRow = (act, title, sub, val = '', extra = '') => `<button class="set" data-act="${act}" ${extra}><div class="it"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${val ? `<span class="val">${val}</span>` : ''}<span class="chev">${ICON.chev}</span></button>`;
function vPlus() {
  const bs = S.bottles.filter(inCave), mine = bs.filter(b => !b.owner);
  const value = caveValue().total;
  const drunk = S.moves.filter(m => m.type === 'out' && ['bue', 'bouchonnee', 'terminee'].includes(m.motif) && (m.at || '').startsWith(String(thisYear()))).length;
  const prim = S.bottles.filter(b => b.state === 'primeur').length, friendBs = bs.filter(b => b.owner);
  const ai = aiCfg(), spent = monthSpend(), pct = ai.budget ? Math.min(100, spent / ai.budget * 100) : 0;
  const lastExp = S.settings.lastExport, old = !lastExp || Date.now() - lastExp > 7 * 864e5;
  return `<div class="card"><div class="grid2" style="text-align:center">
      <div><div class="score" style="font-size:28px">${mine.length}</div><div class="small">bouteilles à moi</div></div>
      <div><div class="score" style="font-size:28px">${new Set(mine.map(b => b.wineId)).size}</div><div class="small">références</div></div>
      <div><div class="score" style="font-size:22px">${value ? eur(value) : '–'}</div><div class="small">${caveValue().nEst ? 'valeur estimée' : 'valeur d’achat'}</div></div>
      <div><div class="score" style="font-size:22px">${drunk}</div><div class="small">bues en ${thisYear()}</div></div></div></div>
    <div class="sect">Ma cave</div>
    <div class="card" style="padding:0 12px">
      ${setRow('sitesSheet', 'Sites, espaces et meubles', isMulti() ? `${S.sites.length} sites · ${S.spaces.length} espaces · ${S.units.length} meubles` : `Site unique · ${S.spaces.length} espace${S.spaces.length > 1 ? 's' : ''} · ${S.units.length} meubles`)}
      ${isMulti() ? setRow('transferSheet', 'Transfert entre sites', S.transfer.ids.length ? plural(S.transfer.ids.length, 'bouteille en préparation', 'bouteilles en préparation') : 'Préparer les bouteilles à emporter') : ''}
      ${setRow('statsSheet', 'Statistiques', 'Ta cave, ta consommation, tes achats, sa valeur')}
      ${setRow('giftsSheet', 'Cadeaux', 'Vins reçus et offerts, par personne')}
      ${setRow('primeursSheet', 'Primeurs', prim ? plural(prim, 'bouteille attendue', 'bouteilles attendues') : 'Aucun primeur en attente')}
      ${setRow('friendsSheet', 'Vins gardés pour des amis', friendBs.length ? plural(friendBs.length, 'bouteille', 'bouteilles') : 'Aucun')}
      ${setRow('wishSheet', 'Liste d’envies', S.wishes.length ? plural(S.wishes.length, 'vin à acheter', 'vins à acheter') : 'Vins repérés en dégustation')}
      ${setRow('journalSheet', 'Journal des mouvements', 'Entrées, sorties, déplacements')}
      ${setRow('importPloc', 'Importer depuis Ploc', 'À partir du PDF de ta cave')}
    </div>
    <div class="sect">Contenu</div>
    <div class="card" style="padding:0 12px">
      <div class="set"><div class="it"><b>Spiritueux</b><small>Whisky, rhum, cognac, armagnac, mignonnettes…</small></div>${sw('setSpirits', S.settings.spirits)}</div>
      ${S.settings.spirits ? `<div class="set"><div class="it"><b>Cocktails</b><small>Le sommelier peut proposer des cocktails avec tes spiritueux</small></div>${sw('setCocktails', S.settings.cocktails)}</div>` : ''}
    </div>
    <div class="sect">Intelligence artificielle</div>
    <div class="card">
      <button class="set" style="padding-top:0" data-act="aiSettings"><div class="it"><b>${ai.key ? esc(AI[ai.provider || 'anthropic'].label) : 'Non configurée'}</b><small>${ai.key ? esc(aiModel()) : 'Ajoute une clé API pour activer le sommelier'}</small></div><span class="chev">${ICON.chev}</span></button>
      <div class="row between" style="margin-top:10px"><b style="font-size:14px">Dépense ce mois</b><span style="font-size:13px;font-weight:600">${fmtE2.format(spent)} / ${fmtE2.format(ai.budget || 0)}</span></div>
      <div class="meter"><i class="${pct >= 100 ? 'over' : pct >= 75 ? 'warn' : ''}" style="width:${pct}%"></i></div>
    </div>
    <div class="sect">Partager et exporter</div>
    <div class="card" style="padding:0 12px">
      ${setRow('wineCardSheet', 'Carte des vins', 'À partager en image ou en PDF')}
      ${setRow('exportXlsx', 'Exporter en Excel', 'Inventaire, dégustations, mouvements')}
      ${setRow('printInventory', 'Inventaire imprimable', 'Par site et meuble, avec les plans (PDF)')}
    </div>
    ${isStandalone() ? '' : `<div class="sect">Application</div><div class="card" style="padding:0 12px">${setRow('installApp', 'Installer l’application', 'Sur l’écran d’accueil, en plein écran, sans réseau')}</div>`}
    <div class="sect">Sauvegarde</div>
    <div class="card" style="padding:0 12px">
      <button class="set" data-act="export"><div class="it"><b>Sauvegarder</b><small>${lastExp ? 'Dernière : ' + esc(fmtDate(new Date(lastExp).toISOString())) : 'Jamais sauvegardée'}${old && S.wines.length ? ' · <span style="color:var(--bx);font-weight:600">à faire</span>' : ''}</small></div><span class="chev">${ICON.up}</span></button>
      ${setRow('import', 'Restaurer une sauvegarde', 'Remplace la cave de cet appareil')}
      ${mode === 'app' ? `<div class="set"><div class="it"><b>Données protégées</b><small>${persisted === true ? 'Le navigateur ne les effacera pas' : persisted === false ? 'Non garanti par le navigateur : sauvegarde souvent' : 'Vérification…'}</small></div>${persisted === true ? `<span style="color:var(--green)">${ICON.check}</span>` : ''}</div>` : ''}
    </div>
    <div class="sect">Sécurité</div>
    <div class="card" style="padding:0 12px">
      ${pkAvailable() ? `<div class="set"><div class="it"><b>${BIO}</b><small>${S.settings.pkNo && !slots?.pk ? 'Pas encore pris en charge par ' + DEV : 'Déverrouiller sans mot de passe'}</small>${whyOff(mode === 'demo')}</div>${sw('setPk', !!slots?.pk, false, mode === 'demo')}</div>` : ''}
      <div class="set"><div class="it"><b>Rester déverrouillé</b><small>Ouvre la cave sans mot de passe sur ${DEV}</small>${whyOff(mode === 'demo')}</div>${sw('setStay', S.settings.stay, false, mode === 'demo')}</div>
      ${S.settings.stay ? '' : `<label class="set" style="display:flex"><div class="it"><b>Verrouillage automatique</b><small>Après un passage en arrière-plan</small></div>
        <select data-ch="setLock" style="width:auto;min-height:34px;padding:4px 30px 4px 10px;font-size:14px">${[[2, '2 min'], [5, '5 min'], [15, '15 min'], [60, '1 h'], [0, 'Jamais']].map(([v, l]) => `<option value="${v}" ${S.settings.lockMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${mode === 'app' ? setRow('chpw', 'Changer le mot de passe', '') : ''}
      ${setRow('codeinfo', 'Vérification du code', 'Empreinte ' + esc(fpLabel(code.approved)))}
    </div>
    <div class="sect">Aide</div>
    <div class="card" style="padding:0 12px">
      ${setRow('historySheet', 'Historique des versions', 'Version installée : ' + esc(APP_VERSION))}
      ${setRow('usageSheet', 'Suivi d’utilisation', S.settings.usage?.on ? 'Activé · synthèse et rapport à envoyer' : 'Désactivé · aide à améliorer l’app')}
      ${setRow('problem', 'Signaler un problème', 'Prépare un rapport à envoyer')}
      ${setRow('introShow', 'Revoir la présentation', 'Les fonctions de MyCellar en quelques écrans')}
    </div>
    <div class="btns" style="margin-top:16px"><button class="btn wide" data-act="lock">${ICON.lock} ${mode === 'demo' ? 'Quitter la démo' : 'Verrouiller maintenant'}</button></div>
    <p class="tiny" style="text-align:center;margin-top:14px">MyCellar · données chiffrées sur cet appareil</p>`;
}

/* ---------- Sites, espaces ---------- */
function sitesSheet() {
  const multi = S.settings.multi;
  return `${head('Sites et espaces')}
    <div class="seg" style="margin-top:0"><button class="${!multi ? 'on' : ''}" data-act="setMulti" data-v="0">Site unique</button><button class="${multi ? 'on' : ''}" data-act="setMulti" data-v="1">Plusieurs sites</button></div>
    <p class="small">${multi ? 'Chaque site a un rôle : consommation (là où tu vis) ou stockage. Le sommelier propose d’abord les bouteilles du site où tu te trouves et te conseille les transferts.' : 'Tous tes espaces sont au même endroit. Tu peux passer en mode plusieurs sites à tout moment.'}</p>
    ${S.sites.filter(s => multi || s.id === S.sites[0].id).map(s => `<div class="card">
      <div class="ct"><span>${esc(s.name)} ${multi ? `<span class="tag ${s.role === 'stock' ? 'o' : 'g'}">${s.role === 'stock' ? 'Stockage' : 'Consommation'}</span>` : ''}</span><button class="icon-btn" data-act="editSite" data-id="${s.id}" aria-label="Modifier le site">${ICON.edit}</button></div>
      ${siteSpaces(s.id).map(sp => `<button class="set" data-act="editSpace" data-id="${sp.id}"><div class="it"><b>${esc(sp.name)}</b><small>${sp.use === 'conso' ? 'Consommation' : 'Garde'} · ${Object.keys(sp.q || {}).length ? 'qualité ' + qualityLabel(spaceQuality(sp)).toLowerCase() : 'conditions non renseignées'} · ${plural(spaceUnits(sp.id).length, 'meuble', 'meubles')} · ${plural(S.bottles.filter(b => inCave(b) && b.spaceId === sp.id).length, 'bouteille', 'bouteilles')}</small></div><span class="chev">${ICON.chev}</span></button>`).join('')}
      <button class="link" data-act="editSpace" data-site="${s.id}">+ Ajouter un espace</button></div>`).join('')}
    ${multi ? `<button class="btn wide" style="margin-top:12px" data-act="editSite">${ICON.add} Ajouter un site</button>` : ''}`;
}
function siteSheet(id) {
  const s = id ? site(id) : { name: newSiteName(), role: 'stock' };
  return `${head(id ? 'Modifier le site' : 'Nouveau site')}
    <form class="form" data-form="site" data-id="${id || ''}">
      <label>Nom<input name="name" value="${esc(s.name)}" required placeholder="Site 2, Maison de campagne…"></label>
      ${S.settings.multi ? `<label>Rôle<select name="role"><option value="conso" ${s.role === 'conso' ? 'selected' : ''}>Consommation (là où je vis)</option><option value="stock" ${s.role === 'stock' ? 'selected' : ''}>Stockage</option></select></label>` : ''}
      <button class="btn primary wide" type="submit">Enregistrer</button>
      ${id && S.sites.length > 1 ? `<button class="btn danger wide" type="button" data-act="delSite" data-id="${id}">Supprimer ce site</button>` : ''}
    </form>`;
}
function spaceSheet(id, siteId) {
  const sp = id ? space(id) : { name: '', siteId, use: 'garde', q: {} };
  const q = sp.q || {};
  return `${head(id ? 'Modifier l’espace' : 'Nouvel espace')}
    <form class="form" data-form="space" data-id="${id || ''}">
      <label>Nom<input name="name" value="${esc(sp.name)}" required placeholder="Cave cuisine, Cave de vieillissement…"></label>
      ${isMulti() ? `<label>Site<select name="siteId">${S.sites.map(s => `<option value="${s.id}" ${s.id === sp.siteId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : `<input type="hidden" name="siteId" value="${sp.siteId || S.sites[0].id}">`}
      <label>Usage<select name="use"><option value="conso" ${sp.use === 'conso' ? 'selected' : ''}>Consommation (bouteilles prêtes à boire)</option><option value="garde" ${sp.use !== 'conso' ? 'selected' : ''}>Garde, vieillissement</option></select></label>
      <div class="fieldset"><div class="ft">Conditions de stockage</div>
        ${Object.entries(QUALITY).map(([k, d]) => `<label>${d.label}<select name="q_${k}"><option value="">Non renseigné</option>${Object.entries(d.opts).map(([v, l]) => `<option value="${v}" ${q[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${k === 'temp' ? `
          <div class="grid2"><label>Mini sur l’année (°C)<input name="tmin" inputmode="decimal" value="${sp.tmin ?? ''}" placeholder="Facultatif"></label><label>Maxi sur l’année (°C)<input name="tmax" inputmode="decimal" value="${sp.tmax ?? ''}" placeholder="Facultatif"></label></div>` : ''}`).join('')}
        <p class="tiny" style="margin:0">Le sommelier en tient compte pour estimer la garde et conseiller où ranger chaque vin.</p>
        ${id && reanalPlanSize(id) ? `<button type="button" class="btn wide" style="margin-top:4px" data-act="reanalSpace" data-id="${id}">${ICON.spark} Réanalyser les apogées des ${plural(reanalPlanSize(id), 'vin', 'vins')} de cet espace</button>` : ''}</div>
      ${id ? `<label>Places cibles (réassort)<input name="target" inputmode="numeric" value="${esc(sp.target || '')}" placeholder="Facultatif"></label>` : ''}
      <button class="btn primary wide" type="submit">Enregistrer</button>
      ${id ? `<button class="btn danger wide" type="button" data-act="delSpace" data-id="${id}">Supprimer cet espace</button>` : ''}
    </form>`;
}
FORMS.site = async (f, d) => {
  if (formErrors(f, d.name ? [] : [['name', 'Donne un nom à ce site']])) return;
  const id = f.dataset.id;
  if (id) Object.assign(site(id), { name: d.name, role: d.role || site(id).role });
  else { const s = { id: uid(), name: d.name, role: d.role || 'stock' }; S.sites.push(s); S.spaces.push({ id: uid(), siteId: s.id, name: 'Cave', use: s.role === 'stock' ? 'garde' : 'conso', q: {} }); }
  await save(); sheetBack(); refreshSheet(); render(); toast('Site enregistré');
};
FORMS.space = async (f, d) => {
  const tg = d.target ? num(d.target) : null;
  // Températures de l'année (v2.1.7) : facultatives, entre −10 et 40 °C, mini ≤ maxi
  const deg = v => { if (!String(v ?? '').trim()) return null; const n = num(String(v).replace('−', '-')); return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN; };
  const tmin = deg(d.tmin), tmax = deg(d.tmax), bad = v => v != null && !(v >= -10 && v <= 40);
  if (formErrors(f, [...(d.name ? [] : [['name', 'Donne un nom à cet espace']]), ...(d.target && !(Number.isInteger(tg) && tg >= 1 && tg <= 5000) ? [['target', 'Au moins 1 place, ou laisse vide']] : []),
    ...(bad(tmin) ? [['tmin', 'Entre −10 et 40 °C, ou laisse vide']] : []), ...(bad(tmax) ? [['tmax', 'Entre −10 et 40 °C, ou laisse vide']] : []),
    ...(!bad(tmin) && !bad(tmax) && tmin != null && tmax != null && tmin > tmax ? [['tmax', 'Le maxi doit être au moins égal au mini']] : [])])) return;
  const id = f.dataset.id, q = {}, before = id ? condKey(space(id)) : null;
  for (const k of Object.keys(QUALITY)) if (d['q_' + k]) q[k] = d['q_' + k];
  const o = { name: d.name, siteId: d.siteId, use: d.use, q, target: int(d.target), tmin, tmax };
  if (id) Object.assign(space(id), o); else S.spaces.push({ id: uid(), ...o });
  await save(); sheetBack(); refreshSheet(); render(); toast('Espace enregistré');
  // Conditions modifiées et vins rangés ici : proposer de réajuster leurs fenêtres (v2.1.8)
  if (id && aiReady() && before !== condKey(space(id)) && reanalCount(id)) { reanalOpts = { manual: false }; showSheet(() => reanalSheet(id, true)); }
};
Object.assign(ACT, {
  sitesSheet: () => showSheet(sitesSheet),
  editSite: t => showSheet(() => siteSheet(t.dataset.id)),
  editSpace: t => showSheet(() => spaceSheet(t.dataset.id, t.dataset.site)),
  setMulti: async t => {
    const multi = t.dataset.v === '1';
    if (multi === S.settings.multi) return;
    if (multi) {
      S.settings.multi = true;
      if (S.sites.length < 2) { S.sites[0].role = 'conso'; const c = { id: uid(), name: newSiteName(), role: 'stock' }; S.sites.push(c); S.spaces.push({ id: uid(), siteId: c.id, name: 'Cave', use: 'garde', q: {} }); }
    } else {
      if (S.sites.length > 1 && !confirm(`Passer en site unique ? Tous les espaces seront regroupés dans « ${S.sites[0].name} » et les autres sites supprimés. Les bouteilles ne bougent pas de leurs meubles.`)) return;
      const keep = S.sites[0];
      for (const sp of S.spaces) sp.siteId = keep.id;
      S.sites = [keep]; S.settings.multi = false; S.settings.site = keep.id; S.transfer = { ids: [], to: null, dest: {}, units: {} };
    }
    await save(); refreshSheet(); render();
  },
  delSite: async t => {
    const id = t.dataset.id, n = S.bottles.filter(b => inCave(b) && siteOfBottle(b) === id).length;
    if (n) return toast(`Ce site contient encore ${plural(n, 'bouteille', 'bouteilles')}`);
    if (!confirm('Supprimer ce site et ses espaces vides ?')) return;
    const sps = new Set(siteSpaces(id).map(s => s.id));
    S.units = S.units.filter(u => !sps.has(u.spaceId)); S.spaces = S.spaces.filter(s => !sps.has(s.id)); S.sites = S.sites.filter(s => s.id !== id);
    if (S.settings.site === id) S.settings.site = S.sites[0].id;
    if (S.sites.length < 2) S.settings.multi = false;
    await save(); sheetBack(); refreshSheet(); render();
  },
  delSpace: async t => {
    const id = t.dataset.id, n = S.bottles.filter(b => inCave(b) && b.spaceId === id).length;
    if (n) return toast(`Cet espace contient encore ${plural(n, 'bouteille', 'bouteilles')}`);
    if (S.spaces.length < 2) return toast('Il faut garder au moins un espace');
    if (!confirm('Supprimer cet espace et ses meubles ?')) return;
    S.units = S.units.filter(u => u.spaceId !== id); S.spaces = S.spaces.filter(s => s.id !== id);
    if (caveSpace === id) caveSpace = null;
    await save(); sheetBack(); refreshSheet(); render();
  },
});

/* ---------- Primeurs, amis, journal ---------- */
Object.assign(ACT, {
  primeursSheet: () => showSheet(() => {
    const bs = S.bottles.filter(b => b.state === 'primeur'), by = new Map();
    for (const b of bs) by.set(b.wineId, [...(by.get(b.wineId) || []), b]);
    return `${head('Primeurs')}<button class="btn primary wide" style="margin-bottom:10px" data-act="primeurAdd">${ICON.add} Ajouter un primeur</button>${by.size ? `<div class="list">${[...by].map(([wid, l]) => { const w = wine(wid), d = l[0].delivery; return `<div class="li"><span class="dot" style="background:${wineColor(w)}"></span>
      <div class="it"><b class="ell">${esc(wineTitle(w))}</b><small>${d?.date ? 'Livraison prévue ' + esc(fmtDate(d.date)) : 'Date de livraison inconnue'}${space(d?.spaceId) ? ' · vers ' + esc(space(d.spaceId).name) : ''}</small></div>
      <span class="qty">×${l.length}</span><button class="btn small primary" data-act="receive" data-b="${l[0].id}">Reçu</button></div>`; }).join('')}</div>` : '<p class="muted">Aucun primeur en attente. À l’ajout d’un vin, choisis l’état « Primeur ».</p>'}`;
  }),
  friendsSheet: () => showSheet(() => {
    const by = new Map();
    for (const b of S.bottles.filter(x => inCave(x) && x.owner)) { const m = by.get(b.owner) || new Map(); m.set(b.wineId, (m.get(b.wineId) || 0) + 1); by.set(b.owner, m); }
    return `${head('Vins des amis')}<p class="small" style="margin-top:-4px">Rangés et suivis comme les autres, mais jamais proposés par le sommelier ni comptés dans ta valeur de cave.</p>
      ${by.size ? [...by].map(([o, m]) => `<h3>${esc(o)} · ${plural([...m.values()].reduce((t, n) => t + n, 0), 'bouteille', 'bouteilles')}</h3><div class="list">${[...m].map(([wid, n]) => { const w = wine(wid); return `<button class="li" data-act="wine" data-id="${wid}"><span class="dot" style="background:${wineColor(w)}"></span><div class="it"><b class="ell">${esc(wineTitle(w))}</b><small class="ell">${esc(wineSub(w))}${myBottles(wid).length ? ' · ' + plural(myBottles(wid).length, 'autre à moi', 'autres à moi') : ''}</small></div><span class="qty">×${n}</span></button>`; }).join('')}</div>`).join('') : '<p class="muted">Aucun. À l’ajout d’un vin, indique combien de bouteilles sont pour un ami dans « Propriétaire ».</p>'}`;
  }),
  journalSheet: () => showSheet(() => {
    const L = { in: 'Entrée', out: 'Sortie', move: 'Déplacement', transfert: 'Transfert', primeur: 'Primeur commandé', open: 'Ouverture' };
    // Les mouvements identiques du même jour (6 bouteilles reçues, par exemple) sont regroupés
    const ms = [], key = m => [m.type, m.motif, m.wineId, m.at, m.to?.siteId].join('|');
    for (const m of [...S.moves].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
      const last = ms[ms.length - 1];
      if (last && key(last) === key(m)) last.n++; else ms.push({ ...m, n: 1 });
      if (ms.length > 80) break;
    }
    return `${head('Journal')}${ms.length ? `<div class="list">${ms.map(m => { const w = wine(m.wineId); return `<div class="li"><div class="it"><b class="ell" style="font-size:14px">${esc(L[m.type] || m.type)}${m.motif ? ' · ' + esc(MOTIFS[m.motif] || '') : ''} · ${esc(w ? wineTitle(w) : 'vin supprimé')}</b>
      <small class="ell">${esc(fmtDate(m.at))}${m.who ? ' · ' + esc(m.who) : ''}${m.plat ? ' · ' + esc(m.plat) : ''}${m.type === 'transfert' && m.to ? ' · vers ' + esc(site(m.to.siteId)?.name || '') : ''}</small></div>${m.n > 1 ? `<span class="qty">×${m.n}</span>` : ''}</div>`; }).join('')}</div>` : '<p class="muted">Aucun mouvement pour l’instant.</p>'}`;
  }),
});

/* ---------- Réglages : contenu ---------- */
CHANGES.setSpirits = async el => { S.settings.spirits = el.checked; if (!el.checked) caveF.col.delete('spirit'); await save(); render(); toast(el.checked ? 'Spiritueux activés' : 'Spiritueux masqués (rien n’est supprimé)'); };
CHANGES.setCocktails = async el => { S.settings.cocktails = el.checked; await save(); };
CHANGES.setLock = async el => { S.settings.lockMin = +el.value; await save(); };
CHANGES.setStay = async el => {
  if (mode !== 'app') return;
  if (el.checked && !confirm('Rester déverrouillé ? Toute personne qui a ${DEV_TON} en main pourra ouvrir ta cave. Tes sauvegardes restent protégées par ton mot de passe.')) { el.checked = false; return; }
  S.settings.stay = el.checked;
  if (el.checked) await devEnable(); else await devDisable();
  await save(); render();
};
CHANGES.setPk = async el => {
  if (mode !== 'app') return;
  if (!el.checked) { if (!confirm(`Désactiver le déverrouillage ${BIO_AVEC} ?`)) { el.checked = true; return; } const { pk, ...rest } = slots; slots = rest; await save(); return toast(`${BIO} désactivé`); }
  try {
    const { slot, secret } = await pkCreate();
    await pkStore(slot, secret || await prfGet(slot)); delete S.settings.pkNo; await save(); toast(`${BIO} activé`);
  } catch (e) { el.checked = false; if (e?.message === 'noprf') { S.settings.pkNo = true; await save(); } sheetMsg(BIO, pkError(e)); }
};

/* ---------- Réglages : IA ---------- */
function aiSheet() {
  const c = aiCfg(), P = AI[c.provider || 'anthropic'];
  const months = Object.entries(S.usage).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
  return `${head('Intelligence artificielle')}
    <form class="form" data-form="ai">
      <label>Fournisseur<select name="provider" data-ch="aiProv">${Object.entries(AI).map(([k, v]) => `<option value="${k}" ${k === (c.provider || 'anthropic') ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Clé API<input type="password" name="key" value="${esc(c.key || '')}" autocomplete="off" placeholder="sk-…"></label>
      <label>Modèle<input name="model" id="ai-model" value="${esc(c.model || '')}" placeholder="${esc(P.model)}" autocomplete="off"></label>
      <label>Plafond mensuel (€)<input name="budget" inputmode="decimal" value="${esc(numFr(c.budget, 2))}"></label>
      <label class="check"><input type="checkbox" name="auto" ${c.auto ? 'checked' : ''}> Estimer l’apogée à chaque ajout de vin</label>
      <label class="check"><input type="checkbox" name="web" ${c.web ? 'checked' : ''}> Autoriser la recherche web pour les apogées (Claude, ~1 centime)</label>
      <button class="btn primary wide" type="submit">Enregistrer</button>
      <button class="btn wide" type="button" data-act="aiTest">Tester la clé</button>
    </form>
    <h3>Dépense</h3>
    ${months.length ? `<dl class="kv">${months.map(([k, m]) => `<dt>${esc(new Date(k + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</dt><dd>${fmtE2.format(m.usd * (S.settings.rate || 0.92))} · ${m.n} appel${m.n > 1 ? 's' : ''}</dd>`).join('')}</dl>` : '<p class="small">Aucun appel pour l’instant.</p>'}
    <p class="small">Crée la clé sur ${esc(P.keyUrl)} et fixe-lui aussi un plafond de dépense chez le fournisseur. Ordre de grandeur avec Claude Sonnet 5.5 : 1 à 2 centimes par conseil, 1 centime par étiquette, 3 à 5 centimes par apogée avec recherche web. Les montants affichés ici sont estimés à partir de l’usage renvoyé par l’API.</p>
    <p class="small">Ce qui est envoyé : la liste de tes vins disponibles (sans les vins de tes amis), tes notes de dégustation et ta question. La clé reste chiffrée sur ${DEV}.</p>`;
}
CHANGES.aiProv = el => { $('#ai-model').placeholder = AI[el.value].model; $('#ai-model').value = ''; };
FORMS.ai = async (f, d) => {
  Object.assign(S.settings.ai, { provider: d.provider, key: d.key.replace(/\s+/g, ''), model: d.model, budget: num(d.budget) ?? 2, auto: !!d.auto, web: !!d.web });
  aiNoFallback = false;
  await save(); render(); sheetBack(); toast('Réglages IA enregistrés');
};
Object.assign(ACT, {
  aiSettings: () => showSheet(aiSheet),
  aiTest: async t => {
    const f = t.form, d = formData(f);
    const prev = { ...S.settings.ai };
    Object.assign(S.settings.ai, { provider: d.provider, key: d.key.replace(/\s+/g, ''), model: d.model });
    t.disabled = true; t.textContent = 'Test en cours…';
    try { const r = await aiCall({ tag: 'test', system: 'Réponds par OK.', content: 'ping', maxTokens: 50, effort: 'low' }); sheetMsg('Test de la clé', `La clé fonctionne (${AI[d.provider].label}, ${aiModel()}). Réponse : ${r.text.slice(0, 40)}`); }
    catch (e) { sheetMsg('Test de la clé', e.message || String(e)); }
    finally { Object.assign(S.settings.ai, prev); }
  },
});

/* ---------- Sauvegarde ---------- */
async function exportBackup() {
  if (mode !== 'app') return toast('Crée ta cave pour pouvoir sauvegarder');
  const v = await seal();
  v.slots = { pw: slots.pw };   // ni Face ID ni clé d'appareil dans le fichier
  v.photos = {};
  for (const k of await store.keys()) if (String(k).startsWith('ph:')) v.photos[k.slice(3)] = await store.get(k);
  const name = `mycellar-sauvegarde-${today()}.json`;
  const blob = new Blob([JSON.stringify(v)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  let ok = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); ok = true; } catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!ok) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  S.settings.lastExport = Date.now(); await save(); render(); toast('Sauvegarde exportée');
}
async function onBackupFile(file) {
  if (!file) return;
  try { pendingImport = JSON.parse(await file.text()); if (pendingImport.app !== 'mycellar') throw 0; }
  catch { pendingImport = null; return toast('Ce fichier n’est pas une sauvegarde MyCellar'); }
  showSheet(() => `${head('Restaurer une sauvegarde')}
    <p class="small">Sauvegarde du ${esc(new Date(pendingImport.savedAt || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}. Elle remplacera la cave de cet appareil.</p>
    <form class="form" data-form="import">${USERFIELD}<label>Mot de passe de cette sauvegarde<input type="password" name="p" autocomplete="current-password" required></label>
      <p class="err" id="ierr" hidden></p><button class="btn primary wide" type="submit">Restaurer</button></form>`);
}
FORMS.import = async (f, d) => {
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Déchiffrement…';
  try {
    const o = await openVault(pendingImport, { pass: d.p });
    if (mode === 'app' && S.wines.length && !confirm('Remplacer la cave actuelle de cet appareil par cette sauvegarde ?')) { btn.disabled = false; btn.textContent = 'Restaurer'; return; }
    for (const k of await store.keys()) if (String(k).startsWith('ph:')) await store.del(k);
    for (const [id, e] of Object.entries(pendingImport.photos || {})) await store.set('ph:' + id, e);
    await devDisable();
    await adopt({ raw: o.raw, data: o.data, slots: { pw: pendingImport.slots.pw } });
    S.settings.stay = false; S.settings.lastExport = pendingImport.savedAt || Date.now();
    await save(); navigator.storage?.persist?.(); pendingImport = null;
    closeSheet(); enterApp('restauration'); toast('Cave restaurée');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Restaurer'; const er = $('#ierr'); er.hidden = false;
    // Une structure invalide se repère ; un déchiffrement refusé peut venir du mot de passe ou d'un fichier altéré
    er.textContent = e?.message === 'format' ? 'Sauvegarde incomplète ou endommagée : elle ne peut pas être restaurée.' : 'Mot de passe incorrect, ou fichier endommagé.';
  }
};
Object.assign(ACT, {
  export: () => exportBackup(),
  import: () => { const i = $('#f-backup'); i.value = ''; i.click(); },
  lock: () => lockNow(),
  chpw: () => showSheet(() => `${head('Changer le mot de passe')}
    <form class="form" data-form="chpw">${USERFIELD}
      <label>Mot de passe actuel<input type="password" name="c0" autocomplete="current-password" required></label>
      <label>Nouveau mot de passe<input type="password" name="c1" autocomplete="new-password" required></label>
      <label>Confirmation<input type="password" name="c2" autocomplete="new-password" required></label>
      <p class="err" id="cerr" hidden></p><button class="btn primary wide" type="submit">Changer le mot de passe</button></form>
    <p class="tiny">Les anciennes sauvegardes restent lisibles avec l’ancien mot de passe : exporte une nouvelle sauvegarde ensuite.</p>`),
});
FORMS.chpw = async (f, d) => {
  const er = $('#cerr'), fail = m => { er.hidden = false; er.textContent = m; };
  if (d.c1.length < 10) return fail('Au moins 10 caractères.');
  if (d.c1 !== d.c2) return fail('Les deux mots de passe ne correspondent pas.');
  try { const raw = await openPwSlot(slots.pw, d.c0); if (!sameBytes(raw, dekRaw)) throw 0; }
  catch { await noteFail(); return fail('Mot de passe actuel incorrect.'); }
  await clearFails();
  slots = { ...slots, pw: await makePwSlot(dekRaw, d.c1) };
  await save(); closeSheet(); toast('Mot de passe modifié. Pense à exporter une nouvelle sauvegarde.');
};
