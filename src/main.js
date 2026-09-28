import './style.css';
import { Metronome } from './metronome.js';

const $ = (id) => document.getElementById(id);
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

$('moins').onclick = () => regler(metro.bpm - 1);
$('plus').onclick = () => regler(metro.bpm + 1);
curseur.oninput = () => regler(Number(curseur.value));
mesure.onchange = () => { metro.beats = Number(mesure.value); dessinerTemps(); };

jouer.onclick = () => {
  if (metro.running) {
    metro.stop();
    [...temps.children].forEach((p) => p.classList.remove('actif'));
  } else {
    metro.start();
  }
  jouer.textContent = metro.running ? 'Arrêter' : 'Démarrer';
  jouer.classList.toggle('marche', metro.running);
};

dessinerTemps();
