import { PitchDetector } from 'pitchy';
import { NOTES } from './tonalite.js';

// Détection pensée pour un coup de tambour : un son bref, qui décroît vite,
// pas une note tenue comme une corde de guitare. On attend un « coup »
// (le volume qui monte d'un coup), on lit la hauteur juste après, puis on
// se remet en attente une fois le son retombé.
//
// Les seuils ne sont PAS fixes : un micro de téléphone, selon le modèle et
// la pièce, peut capter un bruit de fond très différent d'un autre. On mesure
// donc le bruit ambiant pendant la première demi-seconde, puis on calcule les
// seuils à partir de cette mesure. Un retour automatique au bout d'un court
// délai évite aussi de rester bloqué si le bruit de fond ne redescend jamais
// complètement.
const DUREE_CALIBRAGE = 0.5;     // secondes d'écoute du silence avant de régler les seuils
const DELAI_RETOUR_MAX = 0.25;   // secondes : on revient en attente même si le son n'est pas retombé

export class Percussion {
  constructor(onCoup, onVolume) {
    this.onCoup = onCoup; // reçoit { note, freq, clarte } ou null (son pas assez net)
    this.onVolume = onVolume; // optionnel : reçoit { volume, seuilCoup } à chaque image, pour un indicateur
    this.actif = false;
    this.etat = 'calibrage';
    this.bruitFond = 0;
    this.echantillons = 0;
    this.seuilCoup = 0.03;
    this.seuilRepos = 0.012;
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
    this.etat = 'calibrage';
    this.bruitFond = 0;
    this.echantillons = 0;
    this.debut = performance.now();
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
    const maintenant = performance.now();

    if (this.etat === 'calibrage') {
      // On mesure le bruit ambiant (pièce, souffle du micro) pour régler les seuils dessus
      this.bruitFond = Math.max(this.bruitFond, volume);
      this.echantillons++;
      if ((maintenant - this.debut) / 1000 >= DUREE_CALIBRAGE) {
        // Le seuil de déclenchement doit être nettement au-dessus du bruit de fond,
        // mais jamais ridiculement bas si la pièce était très silencieuse pendant le calibrage
        this.seuilCoup = Math.max(0.018, this.bruitFond * 3.5);
        this.seuilRepos = Math.max(0.008, this.bruitFond * 1.5);
        this.etat = 'attente';
      }
    } else if (this.etat === 'attente' && volume > this.seuilCoup) {
      this.etat = 'coup';
      this.coupDepuis = maintenant;
      const [freq, clarte] = this.detecteur.findPitch(this.tampon, this.ctx.sampleRate);
      if (clarte > 0.55 && freq > 60 && freq < 500) {
        this.onCoup({ note: NOTES[((Math.round(69 + 12 * Math.log2(freq / 440)) % 12) + 12) % 12], freq, clarte });
      } else {
        this.onCoup(null); // coup entendu, mais pas de hauteur assez nette
      }
    } else if (this.etat === 'coup') {
      // Retour au repos soit quand le son est vraiment retombé, soit après un court délai
      // dans tous les cas — ça évite de rester bloqué si le bruit de fond ne redescend jamais
      if (volume < this.seuilRepos || maintenant - this.coupDepuis > DELAI_RETOUR_MAX * 1000) {
        this.etat = 'attente';
      }
    }
    this.onVolume?.({ volume, seuilCoup: this.seuilCoup, pret: this.etat !== 'calibrage' });
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
