/* ---------- Cave fictive (démonstration) ---------- */
function demoData() {
  const d = emptyData(), prev = S; S = d;
  const v = { id: uid(), name: 'Ville', role: 'conso' }, c = { id: uid(), name: 'Campagne', role: 'stock' };
  d.sites = [v, c]; d.settings.multi = true;
  d.spaces = [
    { id: uid(), siteId: v.id, name: 'Cave cuisine', use: 'conso', q: { temp: 'stable', humid: 'ok', light: 'sombre', vib: 'oui' } },
    { id: uid(), siteId: c.id, name: 'Cave de vieillissement', use: 'garde', q: { temp: 'stable', humid: 'ok', light: 'sombre', vib: 'non' } },
  ];
  d.settings.spirits = true;
  const [ville, camp] = d.sites, [cuis, vieil] = d.spaces;
  const U = (spaceId, type, name, rows, cols, extra = {}) => { const u = { id: uid(), spaceId, type, name, rows, cols, order: d.units.length, ...extra }; d.units.push(u); return u; };
  const armoire = U(cuis.id, 'armoire', 'Armoire à vin', 4, 5);
  const bar = U(cuis.id, 'etagere', 'Étagère du bar', 1, 6);
  const rack = U(vieil.id, 'rack', 'Rack mural', 4, 10);
  const c1 = U(vieil.id, 'caisse', 'Caisse Batailley', 1, 12, { cap: 12, pile: 'A', level: 1 });
  const c2 = U(vieil.id, 'caisse', 'Caisse Rougeard', 1, 6, { cap: 6, pile: 'A', level: 2 });
  U(vieil.id, 'carton', 'Carton', 1, 6, { cap: 6, pile: 'B', level: 1 });
  const W = (o, a) => { const w = { id: uid(), kind: 'vin', pays: 'France', format: '75', createdAt: Date.now(), ...o }; if (a) w.apogee = { debut: a[0], pic: a[1], fin: a[2], src: 'ia', why: a[3] || '', at: Date.now() }; d.wines.push(w); return w; };
  const put = (w, u, n) => {
    const occ = occupancy(), free = freeSlots(u, occ);
    for (let i = 0; i < n; i++) { const [r, c] = free[i] || []; const b = { id: uid(), wineId: w.id, state: 'cave', spaceId: u.spaceId, unitId: free[i] ? u.id : null, r: free[i] ? r : null, c: free[i] ? c : null, addedAt: '2025-10-12' }; d.bottles.push(b); }
  };
  const morgon = W({ domaine: 'Jean Foillard', cuvee: 'Côte du Py', appellation: 'Morgon', region: 'Beaujolais', couleur: 'rouge', millesime: 2022, cepages: 'Gamay', achat: { prix: 28, lieu: 'Caviste du quartier' } }, [2024, 2027, 2032, 'Un Morgon de granite, charnu, qui gagne en complexité sur cinq à huit ans.']);
  const crozes = W({ domaine: 'Alain Graillot', appellation: 'Crozes-Hermitage', region: 'Rhône', couleur: 'rouge', millesime: 2019, cepages: 'Syrah', achat: { prix: 25 } }, [2022, 2025, 2027, 'Millésime solaire : fruit mûr, tanins fondus, à boire sans trop attendre.']);
  const bourgueil = W({ domaine: 'Catherine et Pierre Breton', cuvee: 'Les Galichets', appellation: 'Bourgueil', region: 'Loire', couleur: 'rouge', millesime: 2021, cepages: 'Cabernet franc', achat: { prix: 18 } }, [2023, 2025, 2027]);
  const chablis = W({ domaine: 'William Fèvre', cuvee: 'Montée de Tonnerre', appellation: 'Chablis 1er Cru', region: 'Bourgogne', couleur: 'blanc', millesime: 2020, cepages: 'Chardonnay', achat: { prix: 42 } }, [2023, 2026, 2030]);
  const sancerre = W({ domaine: 'Vacheron', appellation: 'Sancerre', region: 'Loire', couleur: 'blanc', millesime: 2023, cepages: 'Sauvignon', achat: { prix: 24 } }, [2024, 2025, 2027]);
  const bandol = W({ domaine: 'Domaine Tempier', appellation: 'Bandol', region: 'Provence', couleur: 'rose', millesime: 2023, cepages: 'Mourvèdre, Grenache, Cinsault', achat: { prix: 32 } }, [2024, 2025, 2026]);
  const champ = W({ domaine: 'Billecart-Salmon', cuvee: 'Brut Réserve', appellation: 'Champagne', region: 'Champagne', couleur: 'effervescent', millesime: null, cepages: 'Pinot noir, Chardonnay, Meunier', achat: { prix: 45 } }, [2025, 2026, 2028]);
  const saut = W({ domaine: 'Château Suduiraut', appellation: 'Sauternes', region: 'Bordeaux', couleur: 'liquoreux', millesime: 2015, cepages: 'Sémillon, Sauvignon', achat: { prix: 55 } }, [2022, 2035, 2050]);
  const leoville = W({ domaine: 'Château Léoville Barton', appellation: 'Saint-Julien', region: 'Bordeaux', couleur: 'rouge', millesime: 2010, cepages: 'Cabernet sauvignon, Merlot', owner: 'Pierre' }, [2020, 2030, 2045]);
  const jamet = W({ domaine: 'Jamet', appellation: 'Côte-Rôtie', region: 'Rhône', couleur: 'rouge', millesime: 2017, cepages: 'Syrah', achat: { prix: 85 } }, [2025, 2030, 2037]);
  const gonon = W({ domaine: 'Pierre Gonon', appellation: 'Saint-Joseph', region: 'Rhône', couleur: 'rouge', millesime: 2020, cepages: 'Syrah', achat: { prix: 38 } }, [2025, 2028, 2035]);
  const huet = W({ domaine: 'Huet', cuvee: 'Le Haut-Lieu sec', appellation: 'Vouvray', region: 'Loire', couleur: 'blanc', millesime: 2019, cepages: 'Chenin', achat: { prix: 30 } }, [2022, 2027, 2035]);
  const vt = W({ domaine: 'Vieux Télégraphe', cuvee: 'La Crau', appellation: 'Châteauneuf-du-Pape', region: 'Rhône', couleur: 'rouge', millesime: 2016, cepages: 'Grenache, Syrah, Mourvèdre', achat: { prix: 60 } }, [2022, 2027, 2033]);
  const roulot = W({ domaine: 'Domaine Roulot', appellation: 'Meursault', region: 'Bourgogne', couleur: 'blanc', millesime: 2014, cepages: 'Chardonnay', achat: { prix: 95 } }, [2019, 2023, 2026, 'Grand Meursault à son sommet : à boire dans l’année.']);
  const clape = W({ domaine: 'Auguste Clape', appellation: 'Cornas', region: 'Rhône', couleur: 'rouge', millesime: 2012, cepages: 'Syrah', achat: { prix: 70 } }, [2018, 2022, 2026]);
  const lafarge = W({ domaine: 'Michel Lafarge', cuvee: 'Clos des Chênes', appellation: 'Volnay 1er Cru', region: 'Bourgogne', couleur: 'rouge', millesime: 2017, cepages: 'Pinot noir', achat: { prix: 65 } }, [2022, 2027, 2032]);
  const zind = W({ domaine: 'Zind-Humbrecht', appellation: 'Alsace Riesling', region: 'Alsace', couleur: 'blanc', millesime: 2018, cepages: 'Riesling', achat: { prix: 35 } }, [2021, 2026, 2032]);
  const batailley = W({ domaine: 'Château Batailley', appellation: 'Pauillac', region: 'Bordeaux', couleur: 'rouge', millesime: 2016, cepages: 'Cabernet sauvignon, Merlot', achat: { prix: 48 } }, [2024, 2030, 2040]);
  const rougeard = W({ domaine: 'Clos Rougeard', cuvee: 'Le Clos', appellation: 'Saumur-Champigny', region: 'Loire', couleur: 'rouge', millesime: 2018, cepages: 'Cabernet franc', achat: { prix: 120 } }, [2026, 2032, 2040]);
  const pontet = W({ domaine: 'Château Pontet-Canet', appellation: 'Pauillac', region: 'Bordeaux', couleur: 'rouge', millesime: 2023, cepages: 'Cabernet sauvignon, Merlot', achat: { prix: 110, lieu: 'Primeurs' } }, [2032, 2040, 2055]);
  const S_ = (o) => { const w = { id: uid(), kind: 'spirit', format: '70', createdAt: Date.now(), ...o }; d.wines.push(w); return w; };
  const laga = S_({ domaine: 'Lagavulin', cuvee: '16 ans', cat: 'whisky', pays: 'Écosse', region: 'Islay', age: 16, degre: 43, fut: 'Ex-bourbon', achat: { prix: 85 } });
  const clem = S_({ domaine: 'Clément', cuvee: 'XO', cat: 'rhum', pays: 'Martinique', degre: 42, fut: 'Chêne français', achat: { prix: 95 } });
  const glen = S_({ domaine: 'Glenfarclas', cuvee: '15 ans', cat: 'whisky', pays: 'Écosse', region: 'Speyside', age: 15, degre: 46, format: '5', fut: 'Sherry' });
  put(morgon, armoire, 3); put(crozes, armoire, 2); put(bourgueil, armoire, 2); put(sancerre, armoire, 3);
  put(chablis, armoire, 2); put(bandol, armoire, 2); put(champ, armoire, 2); put(saut, armoire, 1); put(leoville, armoire, 2); put(jamet, armoire, 1);
  put(laga, bar, 1); put(clem, bar, 1); put(glen, bar, 3);
  put(morgon, rack, 2); put(gonon, rack, 3); put(huet, rack, 2); put(vt, rack, 4); put(roulot, rack, 1); put(clape, rack, 2); put(lafarge, rack, 3); put(zind, rack, 2); put(jamet, rack, 2); put(champ, rack, 1); put(saut, rack, 1);
  put(batailley, c1, 9); put(rougeard, c2, 6);
  for (let i = 0; i < 6; i++) d.bottles.push({ id: uid(), wineId: pontet.id, state: 'primeur', spaceId: null, unitId: null, addedAt: '2024-05-20', delivery: { date: '2026-06-30', spaceId: vieil.id } });
  const lb = d.bottles.find(b => b.wineId === laga.id); lb.state = 'open'; lb.openedAt = '2025-01-10'; lb.level = 25;
  d.tastings.push(
    { id: uid(), wineId: crozes.id, at: '2026-09-14', note: 16.5, comment: 'Fruit noir, poivre, tanins fondus. Superbe sur un magret.', plat: 'Magret aux cerises', full: { aromes: ['Cerise noire', 'Mûre', 'Poivre noir'], evolution: 'apoint' } },
    { id: uid(), wineId: morgon.id, at: '2026-07-02', note: 15, comment: 'Croquant, encore un peu serré.', full: { evolution: 'jeune' } },
    { id: uid(), wineId: roulot.id, at: '2026-04-18', note: 17.5, comment: 'Noisette, beurre frais, grande tension.', full: { aromes: ['Noisette', 'Beurre', 'Silex'], evolution: 'apoint' } },
  );
  const out = (w, at, motif, plat) => { const b = { id: uid(), wineId: w.id, state: 'out', spaceId: cuis.id, addedAt: '2025-10-12', outAt: at }; d.bottles.push(b); d.moves.push({ id: uid(), at, ts: new Date(at).getTime(), wineId: w.id, bottleId: b.id, type: 'out', motif, plat }); };
  out(crozes, '2026-09-14', 'bue', 'Magret aux cerises'); out(morgon, '2026-07-02', 'bue', 'Planche de charcuterie'); out(roulot, '2026-04-18', 'bue', 'Turbot au beurre blanc');
  d.settings.site = ville.id;
  S = prev;
  return d;
}
