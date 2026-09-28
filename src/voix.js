import { PitchDetector } from 'pitchy';

// Suit la note chantée ou jouée en continu (voix : environ 70 à 1100 Hz).
// Envoie à chaque instant la note sous forme de numéro décimal (69 = La 440 Hz,
// +1 = un demi-ton plus haut), ou null quand il n'y a plus de son clair.
export class Voix {
  constructor(onNote) {
    this.onNote = onNote;
    this.actif = false;
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
    this.historique = [];
    this.derniere = 0;
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
    const [freq, clarte] = this.detecteur.findPitch(this.tampon, this.ctx.sampleRate);
    const maintenant = performance.now();
    if (clarte > 0.9 && freq > 70 && freq < 1100) {
      this.historique.push(69 + 12 * Math.log2(freq / 440));
      if (this.historique.length > 5) this.historique.shift();
      const tri = [...this.historique].sort((a, b) => a - b);
      this.derniere = maintenant;
      this.onNote(tri[Math.floor(tri.length / 2)]); // médiane : évite les sauts isolés
    } else if (maintenant - this.derniere > 600) {
      this.historique = [];
      this.onNote(null);
    }
    requestAnimationFrame(() => this.boucle());
  }
}
