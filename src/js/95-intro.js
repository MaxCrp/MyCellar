/* ---------- Présentation de l'app (premier lancement, puis Réglages › Aide) ----------
   Le fait de l'avoir vue est rangé hors du coffre (« introSeen ») : ce n'est pas une donnée sensible. */
const INTRO = [
  ['logo', 'Bienvenue dans MyCellar', `Ta cave à vin sur ${DEV_TON}, avec un sommelier qui la connaît. Tes données restent sur l’appareil, chiffrées par ton mot de passe.`],
  ['cave', 'Décris ta cave', 'Sites, espaces et meubles : armoire, rack, étagère, caisses, cartons. Le plan affiche chaque bouteille à sa place, et la recherche la retrouve d’un coup d’œil.'],
  ['camera', 'Ajoute tes bouteilles', 'Touche + puis « Nouveau vin » : photographie l’étiquette et la fiche se remplit, ou saisis-la à la main. L’app te propose une place libre. Tu viens de Ploc ? L’import se trouve dans les réglages.'],
  ['boire', 'Bois au bon moment', 'Chaque vin a sa fenêtre de dégustation. L’onglet À boire montre les priorités, et te conseille quoi rapprocher ou mettre en garde.'],
  ['somm', 'Ton sommelier', 'Décris ton plat : il choisit dans ta cave, et t’indique la température, le carafage et l’emplacement exact. Il fonctionne avec ta propre clé API (environ 1 € par mois), à ajouter dans les réglages.'],
  ['notes', 'Tes dégustations', 'Note les vins de ta cave ou bus ailleurs, en séance ou à l’aveugle, avec la roue des arômes. Garde tes coups de cœur dans la liste d’envies.'],
  ['up', 'Pense à sauvegarder', `Ta cave n’existe que sur ${DEV}. Exporte régulièrement une sauvegarde chiffrée vers ${BACKUP_DEST} : Réglages › Sauvegarder.`],
  ['info', 'Aide à améliorer l’app', 'Tu testes MyCellar en avant-première ? Active le suivi d’utilisation dans Réglages › Aide : il note tes gestes, jamais tes vins. Tu pourras envoyer le rapport avec ton avis, ou signaler un problème.'],
];
let introAt = null, introInApp = false;
function showIntro(i = 0, inApp = false) { introAt = i; introInApp = inApp; paintIntro(); }
function paintIntro() {
  let el = $('#intro');
  if (introAt == null) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'intro'; el.className = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
  const [ic, t, d] = INTRO[introAt], last = introAt === INTRO.length - 1;
  el.innerHTML = `<div class="intro-top">${introAt ? `<button class="icon-btn" data-act="introPrev" aria-label="Précédent">${ICON.back}</button>` : '<span></span>'}
      ${last ? '<span></span>' : `<button class="link" data-act="introDone">Passer</button>`}</div>
    <div class="intro-body"><div class="intro-art">${ic === 'logo' ? LOGO : ICON[ic]}</div><h2>${esc(t)}</h2><p>${esc(d)}</p></div>
    <div class="intro-foot"><div class="intro-dots">${INTRO.map((_, k) => `<i class="${k === introAt ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn primary wide" data-act="${last ? 'introDone' : 'introNext'}">${last ? (introInApp ? 'Terminer' : 'Créer ma cave') : 'Suivant'}</button></div>`;
}
Object.assign(ACT, {
  introNext: () => { introAt = Math.min(INTRO.length - 1, introAt + 1); paintIntro(); },
  introPrev: () => { introAt = Math.max(0, introAt - 1); paintIntro(); },
  introDone: async () => { introAt = null; paintIntro(); try { await store.set('introSeen', 1); } catch {} if (!introInApp) $('input[name=p1]')?.focus(); },
  introShow: () => showIntro(0, true),
});
// Glisser vers la gauche ou la droite pour changer d'écran
let introX = null;
document.addEventListener('touchstart', e => { if (introAt != null) introX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => {
  if (introAt == null || introX == null) return;
  const dx = e.changedTouches[0].clientX - introX; introX = null;
  if (Math.abs(dx) > 50) ACT[dx < 0 ? 'introNext' : 'introPrev']();
}, { passive: true });
