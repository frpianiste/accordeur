import './style.css';
import { Metronome } from './metronome.js';
import { Accordeur, CORDES } from './accordeur.js';
import { Tonalite } from './tonalite.js';

const $ = (id) => document.getElementById(id);

/* ---------- Onglets ---------- */
function afficher(nom) {
  for (const v of ['metro', 'accord', 'tonal']) {
    $('vue-' + v).hidden = v !== nom;
    $('onglet-' + v).setAttribute('aria-selected', v === nom);
  }
  if (nom !== 'metro') arreterMetronome();
  if (nom !== 'accord') arreterAccordeur();
  if (nom !== 'tonal') arreterTonalite();
}
$('onglet-metro').onclick = () => afficher('metro');
$('onglet-accord').onclick = () => afficher('accord');
$('onglet-tonal').onclick = () => afficher('tonal');

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
