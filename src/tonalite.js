// Détection de tonalité : on écoute ~10 s, on compte quelles notes reviennent
// le plus (sur 12 notes, sans tenir compte de l'octave), puis on compare
// avec le profil typique d'une tonalité majeure et mineure (Krumhansl).
const NOTES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const MAJEUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINEUR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) {
    ab += (a[i] - ma) * (b[i] - mb);
    aa += (a[i] - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

// chroma : 12 nombres (Do, Do♯, Ré…), plus c'est grand plus la note revient
export function estimerTonalite(chroma) {
  const res = [];
  for (let t = 0; t < 12; t++) {
    const decale = Array.from({ length: 12 }, (_, i) => chroma[(i + t) % 12]);
    res.push({ nom: `${NOTES[t]} majeur`, score: correlation(decale, MAJEUR) });
    res.push({ nom: `${NOTES[t]} mineur`, score: correlation(decale, MINEUR) });
  }
  return res.sort((a, b) => b.score - a.score);
}

// Transforme une image du son (octets 0-255) en 12 notes ; null si trop silencieux
export function chromaDepuisSpectre(octets, sampleRate, fftSize) {
  let max = 0;
  for (const v of octets) if (v > max) max = v;
  if (max < 90) return null;
  const chroma = new Float64Array(12);
  const pas = sampleRate / fftSize;
  const debut = Math.max(1, Math.ceil(100 / pas));
  const fin = Math.min(octets.length - 2, Math.floor(2500 / pas));
  let total = 0;
  for (let i = debut; i <= fin; i++) {
    const v = octets[i];
    if (v > octets[i - 1] && v >= octets[i + 1]) { // seulement les « pics »
      const poids = 10 ** (((v - 255) / 255) * 3.5); // 70 dB de dynamique
      const midi = 69 + 12 * Math.log2((i * pas) / 440);
      chroma[((Math.round(midi) % 12) + 12) % 12] += poids;
      total += poids;
    }
  }
  if (!total) return null;
  return chroma.map((x) => x / total);
}

export class Tonalite {
  constructor() { this.actif = false; }

  async demarrer(duree, onProgres, onFin) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('micro indisponible sur cette adresse (il faut une adresse https)');
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)(); // iPhone : pendant l'appui
    const reprise = this.ctx.resume();
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      this.ctx.close();
      this.ctx = null;
      throw e;
    }
    await reprise;
    const analyseur = this.ctx.createAnalyser();
    analyseur.fftSize = 16384; // précis même pour les notes graves
    analyseur.smoothingTimeConstant = 0;
    this.ctx.createMediaStreamSource(this.flux).connect(analyseur);
    const octets = new Uint8Array(analyseur.frequencyBinCount);
    const somme = new Float64Array(12);
    let valides = 0;
    const debut = performance.now();
    this.actif = true;
    this.minuteur = setInterval(() => {
      const ecoule = performance.now() - debut;
      analyseur.getByteFrequencyData(octets);
      const c = chromaDepuisSpectre(octets, this.ctx.sampleRate, analyseur.fftSize);
      if (c) { c.forEach((x, i) => (somme[i] += x)); valides++; }
      onProgres(Math.min(1, ecoule / (duree * 1000)));
      if (ecoule >= duree * 1000) {
        this.arreter();
        onFin(valides < 10 ? null : estimerTonalite(somme)); // null = pas assez de son
      }
    }, 100);
  }

  arreter() {
    clearInterval(this.minuteur);
    this.actif = false;
    this.flux?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.flux = this.ctx = null;
  }
}
