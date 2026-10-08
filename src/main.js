import './style.css';
import { Metronome } from './metronome.js';
import { Accordeur, CORDES } from './accordeur.js';
import { Tonalite, NOTES } from './tonalite.js';
import { Voix } from './voix.js';
import { Percussion, ecartCourt } from './percussion.js';

const $ = (id) => document.getElementById(id);

/* ---------- Onglets ---------- */
function afficher(nom) {
  for (const v of ['metro', 'accord', 'voix', 'percu']) {
    $('vue-' + v).hidden = v !== nom;
    $('onglet-' + v).setAttribute('aria-selected', v === nom);
  }
  if (nom !== 'metro') arreterMetronome();
  if (nom !== 'accord') arreterAccordeur();
  if (nom !== 'voix') { arreterTonalite(); arreterCercle(); }
  if (nom !== 'percu') arreterPercussion();
}
$('onglet-metro').onclick = () => afficher('metro');
$('onglet-accord').onclick = () => afficher('accord');
$('onglet-voix').onclick = () => afficher('voix');
$('onglet-percu').onclick = () => afficher('percu');

/* ---------- Voix : choix entre « Note en direct » (cercle) et « Tonalité du morceau » ---------- */
function afficherModeVoix(mode) {
  const cercleActif = mode === 'cercle';
  $('vue-cercle-int').hidden = !cercleActif;
  $('vue-tonal-int').hidden = cercleActif;
  $('mode-cercle').setAttribute('aria-selected', cercleActif);
  $('mode-tonal').setAttribute('aria-selected', !cercleActif);
  if (cercleActif) arreterTonalite(); else arreterCercle();
}
$('mode-cercle').onclick = () => afficherModeVoix('cercle');
$('mode-tonal').onclick = () => afficherModeVoix('tonal');

/* ---------- Métronome ---------- */
const affichage = $('bpm'), curseur = $('curseur'), mesure = $('mesure');
const temps = $('temps'), jouer = $('jouer');

const metro = new Metronome((b) => {
  [...temps.children].forEach((p, i) => p.classList.toggle('actif', i === b));
});

function dessinerTemps() {
  temps.innerHTML = '';
  for (let i = 0; i < metro.beats; i++) {
    const p = document.createElement('i');
    if (i === 0) p.className = 'premier';
    temps.appendChild(p);
  }
}

function regler(bpm) {
  metro.bpm = Math.min(240, Math.max(30, bpm));
  affichage.textContent = metro.bpm;
  curseur.value = metro.bpm;
}

function arreterMetronome() {
  metro.stop();
  [...temps.children].forEach((p) => p.classList.remove('actif'));
  jouer.textContent = 'Démarrer';
  jouer.classList.remove('marche');
}

$('moins').onclick = () => regler(metro.bpm - 1);
$('plus').onclick = () => regler(metro.bpm + 1);
curseur.oninput = () => regler(Number(curseur.value));
mesure.onchange = () => { metro.beats = Number(mesure.value); dessinerTemps(); };

jouer.onclick = () => {
  if (metro.running) return arreterMetronome();
  metro.start();
  jouer.textContent = 'Arrêter';
  jouer.classList.add('marche');
};

dessinerTemps();

/* ---------- Accordeur ---------- */
const liste = $('cordes');
CORDES.forEach((c) => {
  const li = document.createElement('li');
  li.textContent = c.note.replace(/\d/, '');
  li.title = c.nom;
  liste.appendChild(li);
});

const noteEl = $('note'), etatEl = $('etat'), aiguille = $('aiguille'), micro = $('micro');

function montrer(r) {
  [...liste.children].forEach((li, i) => li.classList.toggle('actif', !!r && CORDES[i] === r.corde));
  if (!r) {
    noteEl.textContent = '–';
    etatEl.textContent = 'Joue une corde de guitare';
    etatEl.classList.remove('juste');
    aiguille.style.left = '50%';
    aiguille.classList.remove('juste');
    return;
  }
  const c = Math.max(-50, Math.min(50, r.cents));
  const juste = Math.abs(r.cents) < 5;
  noteEl.textContent = r.corde.note.replace(/\d/, '');
  etatEl.textContent = juste ? 'Accordée' : r.cents < 0 ? 'Trop bas : serre la corde' : 'Trop haut : desserre la corde';
  etatEl.classList.toggle('juste', juste);
  aiguille.style.left = `${50 + c}%`;
  aiguille.classList.toggle('juste', juste);
}

const accordeur = new Accordeur(montrer);

function arreterAccordeur() {
  accordeur.arreter();
  montrer(null);
  micro.textContent = 'Activer le micro';
  micro.classList.remove('marche');
}

micro.onclick = async () => {
  const erreur = $('erreur');
  erreur.hidden = true;
  if (accordeur.actif) return arreterAccordeur();
  try {
    await accordeur.demarrer();
    micro.textContent = 'Arrêter le micro';
    micro.classList.add('marche');
  } catch (e) {
    accordeur.arreter();
    erreur.textContent = `Micro impossible (${e.name} : ${e.message}). Vérifie l'autorisation du micro pour ce site, puis réessaie.`;
    erreur.hidden = false;
  }
};

/* ---------- Tonalité ---------- */
const tonalite = new Tonalite();
const tonaliteEl = $('tonalite'), etatTonal = $('tonal-etat'), progres = $('progres');
const autres = $('autres'), ecouter = $('ecouter'), erreurTonal = $('erreur-tonal');
const DUREE = 10;

function reinitialiserTonalite() {
  progres.hidden = true;
  progres.value = 0;
  ecouter.textContent = 'Écouter 10 secondes';
  ecouter.classList.remove('marche');
}

function arreterTonalite() {
  tonalite.arreter();
  reinitialiserTonalite();
}

ecouter.onclick = async () => {
  erreurTonal.hidden = true;
  if (tonalite.actif) return arreterTonalite();
  tonaliteEl.textContent = '…';
  autres.hidden = true;
  etatTonal.textContent = 'Écoute en cours : chante, joue ou mets la musique';
  progres.hidden = false;
  ecouter.textContent = 'Arrêter';
  ecouter.classList.add('marche');
  try {
    await tonalite.demarrer(
      DUREE,
      (f) => { progres.value = Math.round(f * 100); },
      (classement) => {
        reinitialiserTonalite();
        if (!classement) {
          tonaliteEl.textContent = '–';
          etatTonal.textContent = "Pas assez de son. Rapproche le téléphone de la source et réessaie.";
          return;
        }
        tonaliteEl.textContent = classement[0].nom;
        etatTonal.textContent = classement[0].score < 0.5
          ? 'Résultat incertain : essaie plus longtemps ou plus près.'
          : 'Tonalité la plus probable';
        autres.textContent = 'Autres possibilités : ' + classement[1].nom + ', ' + classement[2].nom;
        autres.hidden = false;
        ecouter.textContent = 'Écouter à nouveau';
      },
    );
  } catch (e) {
    tonalite.arreter();
    reinitialiserTonalite();
    tonaliteEl.textContent = '–';
    etatTonal.textContent = 'Chante, joue ou mets de la musique près du micro';
    erreurTonal.textContent = `Micro impossible (${e.name} : ${e.message}). Vérifie l'autorisation du micro pour ce site, puis réessaie.`;
    erreurTonal.hidden = false;
  }
};

/* ---------- Cercle : écart en demi-tons par rapport au 00 ---------- */
const SVG = 'http://www.w3.org/2000/svg';
const point = (angle, r) => {
  const a = (angle * Math.PI) / 180;
  return [150 + r * Math.sin(a), 150 - r * Math.cos(a)];
};
// 24 graduations (une tous les 15°) : 00 en haut, +1…+12 à droite, −1…−12 à gauche
for (let k = -11; k <= 12; k++) {
  const angle = k * 15;
  const [x1, y1] = point(angle, 98), [x2, y2] = point(angle, 108);
  const tic = document.createElementNS(SVG, 'line');
  tic.setAttribute('class', k === 0 ? 'tic zero' : 'tic');
  tic.setAttribute('x1', x1); tic.setAttribute('y1', y1);
  tic.setAttribute('x2', x2); tic.setAttribute('y2', y2);
  $('graduations').appendChild(tic);
}
for (let k = -11; k <= 12; k++) {
  const angle = k * 15;
  const [x, y] = point(angle, 128);
  const t = document.createElementNS(SVG, 'text');
  t.setAttribute('class', k === 0 ? 'num zero' : 'num');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
  t.textContent = k === 0 ? '00' : k === 12 ? '12' : k > 0 ? String(k) : '−' + -k;
  $('graduations').appendChild(t);
}
// En bas, un seul « 12 » (+12 et −12 se rejoignent) : un petit − à gauche et + à droite le précisent
{
  const [x, y] = point(180, 140);
  const moins = document.createElementNS(SVG, 'text');
  moins.setAttribute('class', 'signe');
  moins.setAttribute('x', x - 14); moins.setAttribute('y', y);
  moins.setAttribute('text-anchor', 'middle'); moins.setAttribute('dominant-baseline', 'central');
  moins.textContent = '−';
  $('graduations').appendChild(moins);
  const plus = document.createElementNS(SVG, 'text');
  plus.setAttribute('class', 'signe');
  plus.setAttribute('x', x + 14); plus.setAttribute('y', y);
  plus.setAttribute('text-anchor', 'middle'); plus.setAttribute('dominant-baseline', 'central');
  plus.textContent = '+';
  $('graduations').appendChild(plus);
}

const nomNote = (midi) => NOTES[((Math.round(midi) % 12) + 12) % 12];
const cEtat = $('c-etat'), cNote = $('c-note'), cDec = $('c-decalage');
const cEcouter = $('c-ecouter'), cErreur = $('c-erreur');
let zero = null; // numéro de la note de départ (le 00)

function poserAiguille(demiTons) {
  const d = Math.max(-12, Math.min(12, demiTons));
  $('aiguille-c').setAttribute('transform', `rotate(${d * 15} 150 150)`);
}

const cercle = new Voix((midi) => {
  if (midi === null) {
    cNote.textContent = '–';
    cDec.textContent = '';
    return;
  }
  if (zero === null) zero = Math.round(midi);
  const ecart = midi - zero;
  poserAiguille(ecart);
  cNote.textContent = nomNote(midi);
  const n = Math.round(ecart);
  cDec.textContent = n === 0 ? '00' : (n > 0 ? '+' : '−') + Math.abs(n);
  cEtat.textContent = `00 = ${nomNote(zero)}`;
});

function arreterCercle() {
  cercle.arreter();
  cEcouter.textContent = 'Écouter';
  cEcouter.classList.remove('marche');
}

$('c-zero').onclick = () => {
  zero = null;
  poserAiguille(0);
  cNote.textContent = '–';
  cDec.textContent = '';
  cEtat.textContent = 'Chante la note qui sera le 00';
};

cEcouter.onclick = async () => {
  cErreur.hidden = true;
  if (cercle.actif) return arreterCercle();
  try {
    await cercle.demarrer();
    cEcouter.textContent = 'Arrêter';
    cEcouter.classList.add('marche');
  } catch (e) {
    cercle.arreter();
    cErreur.textContent = `Micro impossible (${e.name} : ${e.message}). Vérifie l'autorisation du micro pour ce site, puis réessaie.`;
    cErreur.hidden = false;
  }
};

/* ---------- Percussions : caisse claire, tom aigu, tom medium, tom basse — 2 peaux chacun ---------- */
const FUTS = {
  claire: $('fut-claire'),
  aigu: $('fut-aigu'),
  medium: $('fut-medium'),
  basse: $('fut-basse'),
};
const PEAUX = { frappe: $('peau-frappe'), resonance: $('peau-resonance') };
let futActuel = 'claire', peauActuelle = 'frappe';
const pNote = $('p-note'), pFreq = $('p-freq'), pCible = $('p-cible');
const pEcart = $('p-ecart'), pDeuxPeaux = $('p-deux-peaux');
const pEcouter = $('p-ecouter'), pErreur = $('p-erreur');
const pMeterBarre = $('p-meter-barre'), pMeterSeuil = $('p-meter-seuil'), pMeterEtat = $('p-meter-etat');
// Une note cible par fût ET par peau (frappe et résonance réglées séparément)
const cibles = {
  claire: { frappe: '', resonance: '' },
  aigu: { frappe: '', resonance: '' },
  medium: { frappe: '', resonance: '' },
  basse: { frappe: '', resonance: '' },
};

function rafraichirAffichage() {
  pCible.value = cibles[futActuel][peauActuelle];
  pNote.textContent = '–';
  pFreq.innerHTML = '&nbsp;';
  pEcart.innerHTML = '&nbsp;';
  const { frappe, resonance } = cibles[futActuel];
  if (frappe && resonance) {
    const ecart = ecartCourt(frappe, resonance);
    pDeuxPeaux.textContent = ecart === 0
      ? `Les deux peaux visent la même note (${frappe})`
      : ecart > 0
        ? `Résonance ${ecart} demi-ton${ecart > 1 ? 's' : ''} au-dessus de la frappe`
        : `Résonance ${-ecart} demi-ton${-ecart > 1 ? 's' : ''} en dessous de la frappe`;
    pDeuxPeaux.classList.add('renseigne');
  } else {
    pDeuxPeaux.innerHTML = '&nbsp;';
    pDeuxPeaux.classList.remove('renseigne');
  }
}

function choisirFut(nom) {
  futActuel = nom;
  for (const [k, bouton] of Object.entries(FUTS)) bouton.setAttribute('aria-selected', k === nom);
  rafraichirAffichage();
}
FUTS.claire.onclick = () => choisirFut('claire');
FUTS.aigu.onclick = () => choisirFut('aigu');
FUTS.medium.onclick = () => choisirFut('medium');
FUTS.basse.onclick = () => choisirFut('basse');

function choisirPeau(nom) {
  peauActuelle = nom;
  for (const [k, bouton] of Object.entries(PEAUX)) bouton.setAttribute('aria-selected', k === nom);
  rafraichirAffichage();
}
PEAUX.frappe.onclick = () => choisirPeau('frappe');
PEAUX.resonance.onclick = () => choisirPeau('resonance');

pCible.onchange = () => { cibles[futActuel][peauActuelle] = pCible.value; rafraichirAffichage(); };

const percussion = new Percussion(
  (coup) => {
    if (!coup) {
      pNote.textContent = '?';
      pFreq.textContent = 'Son pas assez net';
      pEcart.innerHTML = '&nbsp;';
      return;
    }
    pNote.textContent = coup.note;
    pFreq.textContent = `${coup.freq.toFixed(1)} Hz`;
    const cible = cibles[futActuel][peauActuelle];
    if (!cible) { pEcart.innerHTML = '&nbsp;'; return; }
    const ecart = ecartCourt(coup.note, cible);
    pEcart.textContent = ecart === 0
      ? `Accordée sur ${cible}`
      : ecart > 0
        ? `${ecart} demi-ton${ecart > 1 ? 's' : ''} trop bas : tends la peau`
        : `${-ecart} demi-ton${-ecart > 1 ? 's' : ''} trop haut : détends la peau`;
    pEcart.classList.toggle('juste', ecart === 0);
  },
  ({ volume, seuilCoup, pret }) => {
    // Indicateur en direct : utile pour voir pourquoi un coup n'est pas détecté
    const pourcent = Math.min(100, (volume / Math.max(seuilCoup * 2, 0.02)) * 100);
    pMeterBarre.style.width = `${pourcent}%`;
    pMeterBarre.classList.toggle('coup', volume > seuilCoup);
    pMeterSeuil.style.left = '50%';
    pMeterEtat.textContent = pret ? '' : 'Calibrage du bruit ambiant… ne tape pas encore';
  },
);

function arreterPercussion() {
  percussion.arreter();
  pEcouter.textContent = 'Écouter';
  pEcouter.classList.remove('marche');
  pMeterBarre.style.width = '0%';
  pMeterBarre.classList.remove('coup');
  pMeterEtat.innerHTML = '&nbsp;';
}

pEcouter.onclick = async () => {
  pErreur.hidden = true;
  if (percussion.actif) return arreterPercussion();
  try {
    await percussion.demarrer();
    pEcouter.textContent = 'Arrêter';
    pEcouter.classList.add('marche');
    pNote.textContent = '–';
    pFreq.textContent = 'Tape sur le fût';
    pMeterEtat.textContent = 'Calibrage du bruit ambiant… ne tape pas encore';
  } catch (e) {
    percussion.arreter();
    pErreur.textContent = `Micro impossible (${e.name} : ${e.message}). Vérifie l'autorisation du micro pour ce site, puis réessaie.`;
    pErreur.hidden = false;
  }
};
