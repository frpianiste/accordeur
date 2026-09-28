import { PitchDetector } from 'pitchy';

// Guitare standard, de la corde la plus grave à la plus aiguë
export const CORDES = [
  { nom: 'Mi grave', note: 'E2', freq: 82.41 },
  { nom: 'La', note: 'A2', freq: 110.0 },
  { nom: 'Ré', note: 'D3', freq: 146.83 },
  { nom: 'Sol', note: 'G3', freq: 196.0 },
  { nom: 'Si', note: 'B3', freq: 246.94 },
  { nom: 'Mi aigu', note: 'E4', freq: 329.63 },
];

// Écart en cents (100 cents = un demi-ton)
const cents = (f, cible) => 1200 * Math.log2(f / cible);

export class Accordeur {
  constructor(onResultat) {
    this.onResultat = onResultat; // reçoit { corde, cents, freq } ou null
    this.actif = false;
  }

  async demarrer() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("micro indisponible sur cette adresse (il faut une adresse https)");
    }
    // iPhone : le contexte audio doit être créé tout de suite, pendant l'appui
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const reprise = this.ctx.resume();
    try {
      // Pas de traitement de la voix : on veut le son brut de l'instrument
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      this.ctx.close();
      this.ctx = null;
      throw e;
    }
    await reprise;
    const source = this.ctx.createMediaStreamSource(this.flux);
    this.analyseur = this.ctx.createAnalyser();
    this.analyseur.fftSize = 4096;
    source.connect(this.analyseur);
    this.tampon = new Float32Array(this.analyseur.fftSize);
    this.octets = new Uint8Array(this.analyseur.fftSize);
    this.detecteur = PitchDetector.forFloat32Array(this.analyseur.fftSize);
    this.actif = true;
    this.derniere = 0;
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
      // Anciens Safari : pas de version décimale, on convertit la version en octets
      this.analyseur.getByteTimeDomainData(this.octets);
      for (let i = 0; i < this.octets.length; i++) this.tampon[i] = (this.octets[i] - 128) / 128;
    }
    const [freq, clarte] = this.detecteur.findPitch(this.tampon, this.ctx.sampleRate);
    const maintenant = performance.now();
    if (clarte > 0.92 && freq > 65 && freq < 400) {
      // On cherche la corde la plus proche (en cents)
      const corde = CORDES.reduce((a, b) =>
        Math.abs(cents(freq, a.freq)) < Math.abs(cents(freq, b.freq)) ? a : b);
      this.derniere = maintenant;
      this.onResultat({ corde, cents: cents(freq, corde.freq), freq });
    } else if (maintenant - this.derniere > 600) {
      this.onResultat(null); // plus de son clair depuis un moment
    }
    requestAnimationFrame(() => this.boucle());
  }
}
