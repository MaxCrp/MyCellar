// v1.7.4 : nouveau millésime, propriétaire par bouteille, actions sur une caisse entière
const { chromium } = require('playwright');
const D = __dirname + '/shots/'; require('fs').mkdirSync(D, { recursive: true });
let fail = 0;
const ok = (label, cond, det = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${label}${det ? ' · ' + det : ''}`); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...require('./ua.cjs'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); if (await p.$('#intro')) await p.click('#intro [data-act=introDone]');
  await p.click('[data-act=demo]'); await p.waitForTimeout(300);
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  const submit = async () => { await p.click('.sheet form [type=submit]'); await p.waitForTimeout(300); };

  /* A. Propriétaire : conversion des anciennes données */
  const mig = await p.evaluate(() => {
    const d = structuredClone(S), w = d.wines.find(x => x.kind === 'vin'); w.owner = 'Paul'; for (const b of d.bottles) if (b.wineId === w.id) delete b.owner;
    const n = normalize(d), bs = n.bottles.filter(b => b.wineId === w.id);
    return { all: bs.length > 0 && bs.every(b => b.owner === 'Paul'), wine: n.wines.find(x => x.id === w.id).owner, friend: n.settings.friends.includes('Paul') };
  });
  ok('conversion : un vin « à Paul » donne des bouteilles « à Paul »', mig.all && mig.wine === undefined && mig.friend, JSON.stringify(mig));
  ok('cave fictive : vins d’amis convertis par bouteille', await p.evaluate(() => S.wines.every(w => !w.owner) && S.bottles.some(b => b.owner)));

  /* B. 12 bouteilles dont 6 pour un ami */
  const w0 = await p.evaluate(() => { const w = S.wines.find(x => x.kind === 'vin' && heldBottles(x.id).length && !hasFriend(x) && ['apogee', 'prio'].includes(status(x))); return { id: w.id, mine: myBottles(w.id).length }; });
  await p.evaluate(id => showSheet(() => addBottlesSheet(id)), w0.id); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=qty]', '12'); await p.fill('.sheet input[name=friendQty]', '6'); await p.fill('.sheet input[name=owner]', 'Paul');
  await submit(); await p.evaluate(() => { draft = null; closeSheet(); });
  const o1 = await p.evaluate(id => ({ paul: heldBottles(id).filter(b => b.owner === 'Paul').length, mine: myBottles(id).length, sum: ownerSummary(wine(id)), ctx: caveContext(true).split('\n').find(l => l.includes('id=' + id)) || '' }), w0.id);
  ok('12 bouteilles dont 6 pour Paul', o1.paul === 6 && o1.mine === w0.mine + 6 && o1.sum === 'dont 6 à Paul', JSON.stringify({ paul: o1.paul, mine: o1.mine, sum: o1.sum }));
  ok('sommelier : seulement mes bouteilles', o1.ctx.includes(`${w0.mine + 6} bouteille(s) ici`), o1.ctx.slice(0, 200));
  ok('À boire : seulement mes bouteilles', await p.evaluate(id => drinkable().some(w => w.id === id) && myBottles(id).length === heldBottles(id).length - 6, w0.id));
  ok('ami seul (aucune bouteille à moi) : vin absent du sommelier', await p.evaluate(() => { const w = S.wines.find(x => isFriend(x)); return !!w && !caveContext(true).includes('id=' + w.id); }));
  await p.evaluate(id => showSheet(() => wineSheet(id)), w0.id); await p.waitForTimeout(150);
  ok('fiche vin : « dont 6 à Paul »', /dont 6 à Paul/.test(await sheet()));
  // Répartir après coup : 4 à Paul
  await p.click('.sheet [data-act=ownersSheet]'); await p.waitForTimeout(150);
  const rows = await p.evaluate(() => [...document.querySelectorAll('.sheet input[type=hidden]')].map(i => [i.name, i.value]));
  const paulRow = rows.find(r => r[1] === 'Paul')[0].slice(1), meRow = rows.find(r => r[1] === '')[0].slice(1);
  await p.fill(`.sheet input[name=n${paulRow}]`, '4'); await p.fill(`.sheet input[name=n${meRow}]`, String(w0.mine + 8));
  await submit();
  ok('répartition : 4 à Paul, le reste à moi', await p.evaluate(id => heldBottles(id).filter(b => b.owner === 'Paul').length === 4, w0.id));
  // Bouteille : « Appartient à »
  const bid = await p.evaluate(id => myBottles(id)[0].id, w0.id);
  await p.evaluate(bid => { closeSheet(); showSheet(() => bottleSheet(bid)); }, bid); await p.waitForTimeout(150);
  ok('fiche bouteille : « Appartient à : moi »', /Appartient à : moi/.test(await sheet()));
  await p.click('.sheet [data-act=ownerPick]'); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=setOwner][data-o="Paul"]'); await p.waitForTimeout(250);
  ok('bouteille attribuée à Paul', await p.evaluate(b => byId(S.bottles, b).owner === 'Paul' && /Appartient à : Paul/.test(document.querySelector('.sheet').textContent), bid));
  await p.evaluate(() => closeSheet());

  /* C. Nouveau millésime */
  const base = await p.evaluate(id => { const w = wine(id); w.photo = false; w.notes = 'Note privée'; w.service = '16 °C'; w.apogee = { debut: 2020, pic: 2023, fin: 2026, src: 'manuel' }; return { id, mill: w.millesime, dom: w.domaine, app: w.appellation, cuv: w.cuvee, n: S.wines.length }; }, w0.id);
  await p.evaluate(id => showSheet(() => wineSheet(id)), base.id); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=newVintage]'); await p.waitForTimeout(150);
  await p.screenshot({ path: D + '150-millesime.png' });
  ok('saisie courte : prix et source du dernier achat en exemple', await p.evaluate(() => !!document.querySelector('.sheet input[name=prix]').placeholder || !!document.querySelector('.sheet input[name=lieu]').placeholder));
  await p.fill('.sheet input[name=millesime]', String(base.mill + 3)); await p.fill('.sheet input[name=qty]', '3');
  await p.fill('.sheet input[name=lieu]', 'Salon des vignerons'); await p.fill('.sheet input[name=prix]', '31,5');
  await submit();
  const nv = await p.evaluate(b => { const w = S.wines.find(x => x.millesime === b.mill + 3 && x.domaine === b.dom && x.id !== b.id); return w && { n: heldBottles(w.id).length, app: w.appellation, cuv: w.cuvee, service: w.service, apo: w.apogee || null, notes: w.notes, photo: !!w.photo, lieu: w.achat?.lieu, prix: w.achat?.prix, owners: heldBottles(w.id).filter(x => x.owner).length }; }, base);
  ok('nouveau millésime créé : 3 bouteilles, champs repris', nv && nv.n === 3 && nv.app === base.app && nv.cuv === base.cuv && nv.service === '16 °C', JSON.stringify(nv));
  ok('non repris : fenêtre, notes, photo, propriétaire', nv && !nv.apo?.fin && !nv.notes && !nv.photo && nv.owners === 0);
  ok('source et prix du nouvel achat', nv && nv.lieu === 'Salon des vignerons' && nv.prix === 31.5);
  await p.evaluate(() => { draft = null; closeSheet(); });
  await p.evaluate(id => showSheet(() => wineSheet(id)), base.id); await p.waitForTimeout(150);
  ok('fiche vin : « Autres millésimes »', await p.evaluate(m => /Autres millésimes/.test(document.querySelector('.sheet').textContent) && document.querySelector('.sheet').textContent.includes(String(m)), base.mill + 3));
  // Millésime déjà présent : les bouteilles rejoignent ce vin
  await p.click('.sheet [data-act=newVintage]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=millesime]', String(base.mill)); await p.fill('.sheet input[name=qty]', '2');
  const before = await p.evaluate(id => ({ w: S.wines.length, n: heldBottles(id).length }), base.id);
  await submit(); await p.evaluate(() => { draft = null; closeSheet(); });
  ok('millésime déjà en cave : bouteilles ajoutées à ce vin, sans doublon', await p.evaluate(({ id, before }) => S.wines.length === before.w && heldBottles(id).length === before.n + 2, { id: base.id, before }));
  // Depuis « Racheter un vin », avec « Offert par »
  await p.evaluate(() => ACT.rebuyList()); await p.waitForTimeout(150);
  ok('« Racheter un vin » : « Mêmes bouteilles » et « Autre millésime »', /Mêmes bouteilles/.test(await sheet()) && /Autre millésime/.test(await sheet()));
  await p.click(`.sheet [data-act=newVintage][data-id="${base.id}"]`); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=millesime]', String(base.mill + 4)); await p.fill('.sheet input[name=offertPar]', 'Tante Rose');
  await submit(); await p.evaluate(() => { draft = null; closeSheet(); });
  ok('« Offert par » enregistré', await p.evaluate(b => S.wines.find(x => x.millesime === b.mill + 4 && x.domaine === b.dom)?.cadeau?.de === 'Tante Rose', base));
  // Fiche complète préremplie
  await p.evaluate(id => showSheet(() => vintageSheet(id)), base.id); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=millesime]', String(base.mill + 5));
  await p.click('.sheet [data-act=vintageFull]'); await p.waitForTimeout(200);
  ok('« Modifier les autres informations » : fiche complète remplie', await p.evaluate(b => document.querySelector('.sheet input[name=millesime]')?.value === String(b.mill + 5) && document.querySelector('.sheet input[name=domaine]')?.value === b.dom, base));
  await p.evaluate(() => { draft = null; closeSheet(); });

  /* D. Caisses */
  const bx = await p.evaluate(() => { const u = S.units.find(x => x.name === 'Caisse Batailley'); return { u: u.id, n: boxBottles(u.id).length, w: boxBottles(u.id)[0].wineId, space: u.spaceId }; });
  // Rangement : la caisse d'un autre vin est refusée
  const other = await p.evaluate(bx => { const b = S.bottles.find(x => inCave(x) && x.wineId !== bx.w && !x.unitId) || S.bottles.find(x => inCave(x) && x.wineId !== bx.w); startPlace(b.wineId, [b.id], bx.space, false); return { sugg: draft.place.sel.some(s => s.unitId === bx.u) }; }, bx);
  ok('rangement : la caisse d’un autre vin n’est pas suggérée', !other.sugg);
  await p.click(`.sheet [data-act=pickBox][data-u="${bx.u}"]`); await p.waitForTimeout(200);
  ok('rangement : toucher la caisse d’un autre vin est refusé', await p.evaluate(u => !draft.place.sel.some(s => s.unitId === u) && /un seul vin/.test(document.querySelector('#toast')?.textContent || ''), bx.u));
  await p.evaluate(() => { draft = null; closeSheet(); });
  await p.evaluate(u => ACT.box({ dataset: { u } }), bx.u); await p.waitForTimeout(150);
  { const t = await sheet(); ok('fiche de la caisse : actions groupées', ['Sortir des bouteilles', 'Déplacer la caisse', 'Au transfert', 'Attribuer', 'Modifier l’achat', 'Modifier le vin'].every(x => t.includes(x)), t.slice(0, 120)); }
  await p.screenshot({ path: D + '151-caisse.png' });
  // Sortir 2 bouteilles
  await p.click('.sheet [data-act=boxOut]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=n]', '2'); await submit();
  ok('sortir 2 bouteilles d’un coup (à noter)', await p.evaluate(bx => boxBottles(bx.u).length === bx.n - 2 && S.bottles.filter(b => b.wineId === bx.w && b.state === 'out' && b.ficheTodo).length >= 2, bx));
  // Attribuer 3 à Léa
  await p.evaluate(u => { closeSheet(); ACT.box({ dataset: { u } }); }, bx.u); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=boxOwner]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=n]', '3'); await p.fill('.sheet input[name=o]', 'Léa'); await submit();
  ok('attribuer 3 bouteilles de la caisse à Léa', await p.evaluate(u => boxBottles(u).filter(b => b.owner === 'Léa').length === 3, bx.u));
  // Modifier l'achat
  await p.click('.sheet [data-act=boxBuy]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=prix]', '45'); await p.fill('.sheet input[name=lieu]', 'Négociant'); await submit();
  ok('modifier l’achat', await p.evaluate(w => wine(w).achat.prix === 45 && wine(w).achat.lieu === 'Négociant', bx.w));
  // Transfert de la caisse entière
  await p.click('.sheet [data-act=boxTransfer]'); await p.waitForTimeout(200);
  const tr = await p.evaluate(u => ({ unit: !!S.transfer.units[u], ids: boxBottles(u).every(b => S.transfer.ids.includes(b.id)) }), bx.u);
  ok('caisse au transfert (meuble et bouteilles)', tr.unit && tr.ids, JSON.stringify(tr));
  await p.evaluate(() => { closeSheet(); ACT.transferSheet(); }); await p.waitForTimeout(150);
  ok('transfert : « voyage dans sa caisse »', /voyage dans sa caisse/.test(await sheet()));
  const ville = await p.evaluate(() => S.sites.find(s => s.role === 'conso').id);
  await p.click(`.sheet [data-act=transferDone][data-to="${ville}"]`); await p.waitForTimeout(300);
  const arr = await p.evaluate(({ u, ville }) => { const un = unit(u), bs = boxBottles(u); return { site: space(un.spaceId).siteId === ville, inside: bs.length > 0 && bs.every(b => b.unitId === u && b.spaceId === un.spaceId), left: !S.transfer.units[u] }; }, { u: bx.u, ville });
  ok('arrivée : la caisse est posée avec ses bouteilles dedans', arr.site && arr.inside && arr.left, JSON.stringify(arr));
  // Déplacer la caisse
  await p.evaluate(u => { closeSheet(); ACT.box({ dataset: { u } }); }, bx.u); await p.waitForTimeout(150);
  await p.click('.sheet [data-act=boxMove]'); await p.waitForTimeout(150);
  await p.click(`.sheet [data-act=boxMoveTo][data-s="${bx.space}"]`); await p.waitForTimeout(250);
  ok('déplacer la caisse : elle repart avec ses bouteilles', await p.evaluate(bx => unit(bx.u).spaceId === bx.space && boxBottles(bx.u).every(b => b.spaceId === bx.space), bx));
  // Caisse mélangée (données existantes) : signalée « à répartir »
  await p.evaluate(() => { const u = S.units.find(x => x.name === 'Caisse Rougeard'), occ = occupancy(), free = freeSlots(u, occ)[0] || [0, 5], b = S.bottles.find(x => inCave(x) && x.wineId !== boxBottles(u.id)[0]?.wineId && !x.unitId) || S.bottles.find(x => inCave(x) && x.unitId && !UNIT_TYPES[unit(x.unitId).type].box);
    if (!freeSlots(u, occ).length) { const o = boxBottles(u.id)[0]; o.unitId = null; }
    const f2 = freeSlots(u, occupancy())[0]; Object.assign(b, { spaceId: u.spaceId, unitId: u.id, r: f2[0], c: f2[1] }); caveSpace = u.spaceId; S.settings.site = space(u.spaceId).siteId; view = 'cave'; caveMode = 'plan'; render(); });
  ok('caisse avec plusieurs vins : « à répartir »', /à répartir/.test(await p.evaluate(() => document.querySelector('.view').textContent)));
  ok('aucune erreur', !errs.length, errs.join(' | '));
  console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
