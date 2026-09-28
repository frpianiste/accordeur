// Métronome : le rythme est calé sur l'horloge audio du navigateur (précis),
// un petit minuteur ne fait que préparer les prochains clics à l'avance.
export class Metronome {
  constructor(onBeat) {
    this.onBeat = onBeat;
    this.bpm = 100;
    this.beats = 4;
    this.running = false;
    this.ctx = null;
    this.timer = null;
  }

  start() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume(); // iPhone : doit se faire après un appui
    this.beat = 0;
    this.next = this.ctx.currentTime + 0.05;
    this.running = true;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    clearInterval(this.timer);
    this.running = false;
  }

  schedule() {
    while (this.next < this.ctx.currentTime + 0.1) {
      const b = this.beat % this.beats;
      this.click(this.next, b === 0);
      const wait = Math.max(0, (this.next - this.ctx.currentTime) * 1000);
      setTimeout(() => this.running && this.onBeat(b), wait);
      this.next += 60 / this.bpm;
      this.beat = (b + 1) % this.beats;
    }
  }

  click(time, accent) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.5, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);
  }
}
