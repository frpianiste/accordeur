import { PitchDetector } from 'pitchy';
import { NOTES } from './tonalite.js';

// Détection pensée pour un coup de tambour : un son bref, qui décroît vite,
// pas une note tenue comme une corde de guitare. On attend un « coup »
// (le volume qui monte d'un coup), on lit la hauteur juste après, puis on
// se remet en attente une fois le son retombé.
const SEUIL_COUP = 0.09;   // volume à partir duquel on considère que « ça a tapé »
const SEUIL_REPOS = 0.03;  // volume en dessous duquel on considère que c'est retombé

export class Percussion {
  constructor(onCoup) {
    this.onCoup = onCoup; // reçoit { note, freq, clarte } ou null (son pas assez net)
    this.actif = false;
    this.etat = 'attente';
  }

  async demarrer() {
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
    this.analyseur = this.ctx.createAnalyser();
    this.analyseur.fftSize = 4096;
    this.ctx.createMediaStreamSource(this.flux).connect(this.analyseur);
    this.tampon = new Float32Array(this.analyseur.fftSize);
    this.octets = new Uint8Array(this.analyseur.fftSize);
    this.detecteur = PitchDetector.forFloat32Array(this.analyseur.fftSize);
    this.etat = 'attente';
    this.actif = true;
    this.boucle();
  }

  arreter() {
    this.actif = false;
    this.flux?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.flux = this.ctx = null;
  }

  boucle() {
    if (!this.actif) return;
    if (this.analyseur.getFloat32TimeDomainData) {
      this.analyseur.getFloat32TimeDomainData(this.tampon);
    } else {
      this.analyseur.getByteTimeDomainData(this.octets); // anciens Safari
      for (let i = 0; i < this.octets.length; i++) this.tampon[i] = (this.octets[i] - 128) / 128;
    }
    let somme = 0;
    for (let i = 0; i < this.tampon.length; i++) somme += this.tampon[i] * this.tampon[i];
    const volume = Math.sqrt(somme / this.tampon.length);

    if (this.etat === 'attente' && volume > SEUIL_COUP) {
      this.etat = 'coup';
      const [freq, clarte] = this.detecteur.findPitch(this.tampon, this.ctx.sampleRate);
      if (clarte > 0.55 && freq > 60 && freq < 500) {
        this.onCoup({ note: NOTES[((Math.round(69 + 12 * Math.log2(freq / 440)) % 12) + 12) % 12], freq, clarte });
      } else {
        this.onCoup(null); // coup entendu, mais pas de hauteur assez nette
      }
    } else if (this.etat === 'coup' && volume < SEUIL_REPOS) {
      this.etat = 'attente'; // prêt pour le prochain coup
    }
    requestAnimationFrame(() => this.boucle());
  }
}

// Distance la plus courte (en demi-tons, + ou -) pour aller du nom "de" au nom "vers"
export function ecartCourt(de, vers) {
  const a = NOTES.indexOf(de), b = NOTES.indexOf(vers);
  let d = (b - a + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}
