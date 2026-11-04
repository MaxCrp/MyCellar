/* ---------- Référentiels ---------- */
const COLORS = {
  rouge: { label: 'Rouge', c: '#8E2435' },
  blanc: { label: 'Blanc', c: '#E3CB6B', light: true },
  rose: { label: 'Rosé', c: '#E59CA2', light: true },
  effervescent: { label: 'Effervescent', c: '#CDBB8C', light: true },
  liquoreux: { label: 'Liquoreux', c: '#C4852A' },
  orange: { label: 'Orange', c: '#D98B3A' },
};
const SPIRIT_CATS = {
  whisky: 'Whisky', rhum: 'Rhum', cognac: 'Cognac', armagnac: 'Armagnac', calvados: 'Calvados', gin: 'Gin', autre: 'Autre spiritueux',
};
const SPIRIT_COLOR = '#8A5A2B';
const FORMATS = {
  vin: [['37.5', 'Demi-bouteille 37,5 cl'], ['50', '50 cl'], ['75', 'Bouteille 75 cl'], ['150', 'Magnum 1,5 l'], ['300', 'Double magnum 3 l'], ['600', 'Mathusalem 6 l']],
  spirit: [['5', 'Mignonnette 5 cl'], ['20', '20 cl'], ['35', '35 cl'], ['50', '50 cl'], ['70', '70 cl'], ['100', '1 l'], ['150', '1,5 l']],
};
const UNIT_TYPES = {
  armoire: { label: 'Armoire à vin', rows: 'Clayettes', cols: 'Places par clayette', row1: 'Clayette', grid: true, def: [4, 6] },
  rack: { label: 'Rack', rows: 'Lignes', cols: 'Colonnes', row1: 'Ligne', grid: true, def: [3, 8] },
  etagere: { label: 'Étagère', rows: 'Planches', cols: 'Places par planche', row1: 'Planche', grid: true, def: [3, 6] },
  caisse: { label: 'Caisse bois', box: true, def: [1, 12] },
  carton: { label: 'Carton', box: true, def: [1, 6] },
};
const MOTIFS = {
  bue: 'Bue', offerte: 'Offerte', cassee: 'Cassée', bouchonnee: 'Bouchonnée', vendue: 'Vendue', rendue: 'Rendue à son propriétaire', terminee: 'Terminée',
};
const STATUS = {
  prio: { label: 'À boire en priorité', short: 'Priorité', c: 'var(--st-prio)', hex: '#6E1E2F', tag: 'b' },
  apogee: { label: 'Prêt à boire', short: 'Apogée', c: 'var(--st-apogee)', hex: '#2F5240', tag: 'g' },
  tot: { label: 'Trop tôt', short: 'Trop tôt', c: 'var(--st-tot)', hex: '#A8844E', tag: 'o' },
  declin: { label: 'En déclin', short: 'Déclin', c: 'var(--st-declin)', hex: '#9A5B4D', tag: 'r' },
  inconnu: { label: 'Fenêtre inconnue', short: 'Inconnue', c: 'var(--st-inconnu)', hex: '#B9AFA6', tag: '' },
};
const QUALITY = {
  temp: { label: 'Température', opts: { stable: 'Stable (10–14 °C)', variable: 'Variable' } },
  humid: { label: 'Hygrométrie', opts: { ok: 'Bonne (60–80 %)', sec: 'Trop sèche', humide: 'Trop humide' } },
  light: { label: 'Lumière', opts: { sombre: 'Obscurité', lumineux: 'Exposée à la lumière' } },
  vib: { label: 'Vibrations', opts: { non: 'Aucune', oui: 'Présentes (électroménager, passage)' } },
};
const TEINTES = {
  rouge: [['Pourpre', '#5E0F2C'], ['Rubis', '#8B1A2B'], ['Grenat', '#74222F'], ['Tuilé', '#9A4A35'], ['Brique', '#A35A3C']],
  blanc: [['Vert pâle', '#EEF0C0'], ['Jaune paille', '#EBDD8E'], ['Or', '#D9B44A'], ['Vieil or', '#C99A35'], ['Ambré', '#B87A28']],
  rose: [['Gris', '#F3D8CF'], ['Pétale', '#F2B9B5'], ['Saumon', '#EE9F86'], ['Framboise', '#E26C7A'], ['Cerise', '#D24A5E']],
  effervescent: [['Argenté', '#F1EED6'], ['Jaune paille', '#EBDD8E'], ['Or', '#D9B44A'], ['Rosé', '#EFB3AE']],
  liquoreux: [['Or', '#D9B44A'], ['Vieil or', '#C99A35'], ['Ambré', '#B87A28'], ['Acajou', '#7E4220']],
  orange: [['Orangé', '#E0A45A'], ['Ambré', '#B87A28'], ['Cuivré', '#A8612E']],
  spirit: [['Paille', '#E7D28A'], ['Or', '#D4A640'], ['Ambre', '#B8792B'], ['Cuivre', '#9C5A28'], ['Acajou', '#6E3518']],
};
// Roue des arômes du vin : familles (anneau intérieur) et arômes (anneau extérieur)
const AROMAS_VIN = [
  ['fr', 'Fruits rouges', '#B8424F', ['Fraise', 'Framboise', 'Cerise', 'Groseille', 'Canneberge', 'Fraise des bois', 'Grenade']],
  ['fn', 'Fruits noirs', '#5B2340', ['Cassis', 'Mûre', 'Myrtille', 'Cerise noire', 'Prune', 'Figue', 'Sureau']],
  ['fb', 'Fruits blancs', '#CDB46A', ['Pomme verte', 'Pomme mûre', 'Poire', 'Pêche', 'Abricot', 'Coing', 'Melon']],
  ['ag', 'Agrumes', '#DDA93A', ['Citron', 'Citron vert', 'Pamplemousse', 'Orange', 'Mandarine', 'Zeste', 'Bergamote']],
  ['ex', 'Exotiques', '#DE8C45', ['Ananas', 'Mangue', 'Fruit de la passion', 'Litchi', 'Banane', 'Goyave']],
  ['fs', 'Fruits secs', '#A87B55', ['Amande', 'Noisette', 'Noix', 'Pruneau', 'Raisin sec', 'Figue sèche', 'Fruits confits']],
  ['fl', 'Floral', '#A9719A', ['Violette', 'Rose', 'Acacia', 'Tilleul', 'Pivoine', 'Fleur d’oranger', 'Aubépine', 'Chèvrefeuille']],
  ['ve', 'Végétal', '#6E8B5A', ['Poivron', 'Herbe coupée', 'Menthe', 'Eucalyptus', 'Garrigue', 'Thym', 'Laurier', 'Buis', 'Fougère']],
  ['ep', 'Épicé', '#A0522D', ['Poivre noir', 'Poivre blanc', 'Réglisse', 'Cannelle', 'Clou de girofle', 'Muscade', 'Anis', 'Gingembre']],
  ['bo', 'Boisé', '#8B6A4A', ['Chêne', 'Vanille', 'Cèdre', 'Santal', 'Pin', 'Coco']],
  ['gr', 'Grillé', '#5A4636', ['Pain grillé', 'Café', 'Cacao', 'Fumée', 'Caramel', 'Moka', 'Goudron']],
  ['pa', 'Pâtissier', '#C99A5E', ['Brioche', 'Beurre', 'Miel', 'Pâte d’amande', 'Crème', 'Levure']],
  ['mi', 'Minéral', '#8A97A0', ['Silex', 'Pierre à fusil', 'Craie', 'Graphite', 'Iodé', 'Pétrole', 'Salin']],
  ['sb', 'Sous-bois', '#6B5B4B', ['Champignon', 'Truffe', 'Humus', 'Cuir', 'Gibier', 'Tabac', 'Feuilles mortes', 'Musc']],
  ['df', 'Défauts', '#5E5E5E', ['Bouchon', 'Réduction', 'Oxydation', 'Volatile', 'Brett', 'Moisi']],
];
const AROMAS_SPIRIT = [
  ['tf', 'Tourbé, fumé', '#4B4A46', ['Tourbe', 'Fumée', 'Feu de bois', 'Goudron', 'Cendre', 'Médicinal']],
  ['ce', 'Céréales', '#C9A75C', ['Malt', 'Orge', 'Céréales', 'Biscuit', 'Pain', 'Porridge']],
  ['ff', 'Fruits frais', '#D07C4A', ['Pomme', 'Poire', 'Agrumes', 'Pêche', 'Banane', 'Fruits rouges']],
  ['fx', 'Fruits secs', '#A87B55', ['Raisin sec', 'Figue', 'Datte', 'Pruneau', 'Amande', 'Noix', 'Orange confite']],
  ['fl', 'Floral', '#A9719A', ['Bruyère', 'Rose', 'Fleurs blanches', 'Miel de fleurs', 'Lavande']],
  ['bv', 'Boisé, vanille', '#8B6A4A', ['Chêne', 'Vanille', 'Noix de coco', 'Cèdre', 'Bois de santal']],
  ['es', 'Épices', '#A0522D', ['Poivre', 'Cannelle', 'Clou de girofle', 'Muscade', 'Gingembre', 'Réglisse']],
  ['vi', 'Vineux', '#6E1E2F', ['Sherry', 'Porto', 'Madère', 'Vin rouge', 'Fruits noirs']],
  ['ma', 'Maritime', '#5E8293', ['Iodé', 'Embruns', 'Algues', 'Sel', 'Huître']],
  ['su', 'Caramel, sucré', '#C08A3E', ['Caramel', 'Toffee', 'Miel', 'Chocolat', 'Café', 'Sucre brun']],
  ['ca', 'Canne, mélasse', '#7D6B2F', ['Canne fraîche', 'Mélasse', 'Vesou', 'Herbe', 'Olive']],
  ['et', 'Esters, funky', '#C25E6B', ['Banane mûre', 'Ananas', 'Vernis', 'Colle', 'Fruits blets']],
];
const aromaFamilies = kind => {
  const base = kind === 'spirit' ? AROMAS_SPIRIT : AROMAS_VIN;
  const custom = S?.settings.aromas?.[kind] || {};
  return base.map(([id, name, c, list]) => [id, name, c, [...list, ...(custom[id] || [])]]);
};

/* ---------- Données ---------- */
const emptyData = () => ({
  v: 1,
  settings: {
    multi: false, site: null, spirits: false, cocktails: true, friends: [],
    ai: { provider: 'anthropic', key: '', model: '', budget: 2, auto: true, web: true },
    lockMin: 5, stay: false, lastExport: null, aromas: {}, rate: 0.92,
  },
  sites: [], spaces: [], units: [], wines: [], bottles: [], moves: [], tastings: [],
  transfer: { ids: [], to: null }, chat: [], usage: {}, dismissed: {},
});
function normalize(d) {
  const e = emptyData();
  d.settings = { ...e.settings, ...(d.settings || {}) };
  d.settings.ai = { ...e.settings.ai, ...(d.settings.ai || {}) };
  for (const k of ['sites', 'spaces', 'units', 'wines', 'bottles', 'moves', 'tastings', 'chat']) d[k] = Array.isArray(d[k]) ? d[k] : [];
  d.transfer = { ...e.transfer, ...(d.transfer || {}) };
  d.usage = d.usage || {}; d.dismissed = d.dismissed || {};
  if (!d.sites.length) d.sites.push({ id: uid(), name: 'Maison', role: 'conso' });
  if (!d.spaces.length) d.spaces.push({ id: uid(), siteId: d.sites[0].id, name: 'Cave', use: 'conso', q: {} });
  if (!d.sites.some(s => s.id === d.settings.site)) d.settings.site = d.sites[0].id;
  return d;
}
// Structure de départ choisie à la création du coffre
function seedStructure(d, multi) {
  d.settings.multi = multi;
  if (multi) {
    const v = { id: uid(), name: 'Ville', role: 'conso' }, c = { id: uid(), name: 'Campagne', role: 'stock' };
    d.sites = [v, c];
    d.spaces = [
      { id: uid(), siteId: v.id, name: 'Cave cuisine', use: 'conso', q: { temp: 'stable', humid: 'ok', light: 'sombre', vib: 'oui' } },
      { id: uid(), siteId: c.id, name: 'Cave de vieillissement', use: 'garde', q: { temp: 'stable', humid: 'ok', light: 'sombre', vib: 'non' } },
    ];
  } else {
    const m = { id: uid(), name: 'Maison', role: 'conso' };
    d.sites = [m];
    d.spaces = [{ id: uid(), siteId: m.id, name: 'Cave', use: 'garde', q: {} }];
  }
  d.settings.site = d.sites[0].id;
  return d;
}

/* ---------- Accès ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const site = id => byId(S.sites, id);
const space = id => byId(S.spaces, id);
const unit = id => byId(S.units, id);
const wine = id => byId(S.wines, id);
const isMulti = () => S.settings.multi && S.sites.length > 1;
const siteSpaces = siteId => S.spaces.filter(s => s.siteId === siteId);
const spaceUnits = spaceId => S.units.filter(u => u.spaceId === spaceId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const inCave = b => b.state === 'cave' || b.state === 'open';
const wineBottles = (wid, f = inCave) => S.bottles.filter(b => b.wineId === wid && f(b));
const isFriend = w => !!w.owner;
const spiritsOn = () => !!S.settings.spirits;
// Vins visibles selon les options : les spiritueux disparaissent si l'option est coupée
const kindOn = w => w.kind !== 'spirit' || spiritsOn();
const siteOfBottle = b => b.spaceId ? space(b.spaceId)?.siteId : null;
function spaceQuality(sp) {
  const q = sp?.q || {}; let n = 0;
  if (q.temp === 'stable') n += 2; if (q.humid === 'ok') n++; if (q.light === 'sombre') n++; if (q.vib === 'non') n++;
  return n;
}
const qualityLabel = n => n >= 5 ? 'Excellente' : n >= 4 ? 'Bonne' : n >= 2 ? 'Moyenne' : 'Faible';

/* ---------- Libellés ---------- */
const vintage = w => w.millesime ? String(w.millesime) : (w.kind === 'spirit' ? '' : 'NM');
const vintage2 = w => w.millesime ? '’' + String(w.millesime).slice(-2) : '';
// Château ou clos sans cuvée : c'est le nom du domaine qui identifie le vin
const nameIsDomaine = w => w.kind !== 'spirit' && !w.cuvee && /^(Château|Chateau|Clos|Ch\.)\s/i.test(w.domaine || '');
function wineName(w) {
  if (nameIsDomaine(w)) return w.domaine;
  if (w.kind === 'spirit') return [w.domaine, w.cuvee].filter(Boolean).join(' ') || SPIRIT_CATS[w.cat] || 'Spiritueux';
  return w.cuvee ? (w.appellation && !norm(w.cuvee).includes(norm(w.appellation)) ? `${w.appellation} « ${w.cuvee} »` : w.cuvee) : (w.appellation || w.domaine || 'Vin');
}
const wineTitle = w => `${wineName(w)}${w.millesime ? ' ' + w.millesime : ''}`;
function wineSub(w) {
  if (w.kind === 'spirit') return [SPIRIT_CATS[w.cat], w.age ? w.age + ' ans' : '', w.degre ? numFr(w.degre) + ' %' : '', w.pays].filter(Boolean).join(' · ');
  return [nameIsDomaine(w) ? w.appellation : w.domaine, w.region, COLORS[w.couleur]?.label].filter(Boolean).join(' · ');
}
const wineColor = w => w.kind === 'spirit' ? SPIRIT_COLOR : (COLORS[w.couleur]?.c || '#B9AFA6');
const wineLight = w => w.kind !== 'spirit' && !!COLORS[w.couleur]?.light;
const STOP = new Set(['ch', 'dom', 'chateau', 'domaine', 'clos', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'aoc', 'aop', 'cru', '1er', 'grand']);
const words = s => norm(s).split(/[\s\-'’.]+/).filter(x => x && !STOP.has(x));
// Nom court affiché dans les cases du plan
function shortName(w) {
  if (w.short) return w.short;
  const base = w.kind === 'spirit' ? (w.domaine || w.cuvee || SPIRIT_CATS[w.cat]) : nameIsDomaine(w) ? w.domaine : (w.appellation || w.cuvee || w.domaine || 'Vin');
  return base.replace(/^Château\s+/i, 'Ch. ').replace(/^Domaine\s+/i, 'Dom. ');
}
function shortSub(w) {
  if (w.kind === 'spirit') return w.cuvee || (w.age ? w.age + ' ans' : SPIRIT_CATS[w.cat] || '');
  if (nameIsDomaine(w)) return [w.appellation, w.millesime ? String(w.millesime).slice(-2) : ''].filter(Boolean).join(' ');
  const dd = (w.domaine || w.cuvee || '').replace(/^(Domaine|Château|Maison)\s+/i, '').split(/\s+/).slice(-1)[0] || '';
  return [dd, w.millesime ? String(w.millesime).slice(-2) : ''].filter(Boolean).join(' ');
}
// Abréviation de 2 ou 3 lettres pour les pastilles du rack
function abbr(w) {
  if (w.abbr) return w.abbr;
  const ws = words(shortName(w));
  if (!ws.length) return '•';
  const s = ws.length >= 2 ? ws.slice(0, 3).map(x => x[0]).join('') : ws[0].slice(0, 3);
  return s.toUpperCase();
}
const ownerInitial = w => w.owner ? w.owner.trim().charAt(0).toUpperCase() : '';

/* ---------- Fenêtre de dégustation ---------- */
function status(w) {
  if (w.kind === 'spirit') return null;
  const a = w.apogee;
  if (!a || !a.fin) return 'inconnu';
  const y = thisYear();
  if (a.debut && y < a.debut) return 'tot';
  if (y > a.fin) return 'declin';
  if (y >= a.fin - 1) return 'prio';
  return 'apogee';
}
const windowLabel = a => a?.fin ? `${a.debut || '?'}–${a.fin}${a.pic ? ' · apogée ' + a.pic : ''}` : 'fenêtre inconnue';
// Barre de fenêtre : position sur une échelle d'années commune
function winBar(a, from, to, big) {
  if (!a?.fin) return `<div class="win${big ? ' big' : ''}"></div>`;
  const span = Math.max(1, to - from), p = y => clamp((y - from) / span * 100, 0, 100);
  const l = p(a.debut || a.fin - 3), r = 100 - p(a.fin + 1), now = p(thisYear() + (new Date().getMonth() / 12));
  return `<div class="win${big ? ' big' : ''}"><div class="w" style="left:${l}%;right:${r}%"></div><div class="now" style="left:${now}%"></div></div>`;
}

/* ---------- Emplacements ---------- */
const capacity = u => UNIT_TYPES[u.type]?.box ? (u.cap || 6) : (u.rows || 1) * (u.cols || 1);
function positions(u) {
  const out = [];
  if (UNIT_TYPES[u.type]?.box) for (let i = 0; i < capacity(u); i++) out.push([0, i]);
  else for (let r = 0; r < (u.rows || 1); r++) for (let c = 0; c < (u.cols || 1); c++) out.push([r, c]);
  return out;
}
function occupancy() {
  const m = new Map();
  for (const b of S.bottles) if (inCave(b) && b.unitId) m.set(`${b.unitId}:${b.r}:${b.c}`, b);
  return m;
}
const freeSlots = (u, occ = occupancy()) => positions(u).filter(([r, c]) => !occ.has(`${u.id}:${r}:${c}`));
function posLabel(b) {
  const u = b.unitId && unit(b.unitId);
  if (!u) return 'non placée';
  const t = UNIT_TYPES[u.type];
  if (t.box) return u.name || t.label;
  return `${u.name || t.label} · ${t.row1} ${b.r + 1}, place ${b.c + 1}`;
}
function locLabel(b, withSite = isMulti()) {
  if (b.state === 'primeur') return 'Primeur, pas encore livrée' + (b.delivery?.date ? ' (prévue ' + fmtDate(b.delivery.date) + ')' : '');
  const sp = space(b.spaceId);
  const parts = [];
  if (withSite && sp) parts.push(site(sp.siteId)?.name);
  if (sp) parts.push(sp.name);
  parts.push(posLabel(b));
  return parts.filter(Boolean).join(' › ');
}
// Espace conseillé pour un vin : prêt à boire → espace de consommation du site de consommation,
// sinon → espace de garde de meilleure qualité
function suggestSpace(w) {
  const st = status(w), ready = st === 'prio' || st === 'apogee' || w.kind === 'spirit';
  const sp = S.spaces.map(s => ({ s, site: site(s.siteId), q: spaceQuality(s) }));
  const score = o => {
    let n = o.q;
    if (ready) { if (o.s.use === 'conso') n += 10; if (o.site?.role === 'conso') n += 5; }
    else { if (o.s.use === 'garde') n += 10; if (o.site?.role === 'stock') n += 3; }
    if (o.s.siteId === S.settings.site) n += 1;
    return n;
  };
  return sp.sort((a, b) => score(b) - score(a))[0]?.s || S.spaces[0];
}
// Cases libres conseillées dans un espace : on remplit les meubles dans l'ordre, une caisse vide d'abord
// si l'on range au moins six bouteilles d'un même vin
function suggestSlots(spaceId, n, exclude = new Set()) {
  const occ = occupancy(), out = [];
  const units = spaceUnits(spaceId);
  const boxes = units.filter(u => UNIT_TYPES[u.type].box && freeSlots(u, occ).length === capacity(u) && capacity(u) <= n);
  const order = n >= 6 ? [...boxes, ...units.filter(u => !boxes.includes(u))] : [...units.filter(u => !UNIT_TYPES[u.type].box), ...units.filter(u => UNIT_TYPES[u.type].box)];
  for (const u of order) for (const [r, c] of freeSlots(u, occ)) {
    const k = `${u.id}:${r}:${c}`; if (exclude.has(k)) continue;
    if (out.length < n) out.push({ unitId: u.id, r, c });
  }
  return out;
}

/* ---------- Coûts IA ---------- */
const PRICES = { // dollars par million de tokens : entrée, sortie, lecture du cache, écriture du cache
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5], 'claude-sonnet-5': [2, 10, 0.2, 2.5], 'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125], 'mistral': [2, 6, 2, 2],
};
const WEB_SEARCH_USD = 0.01;
const priceOf = m => PRICES[m] || (m.startsWith('mistral') ? PRICES.mistral : m.includes('opus') ? PRICES['claude-opus-5-5'] : m.includes('haiku') ? PRICES['claude-haiku-5-5'] : PRICES['claude-sonnet-5-5']);
const monthSpend = () => (S.usage[monthKey()]?.usd || 0) * (S.settings.rate || 0.92);
