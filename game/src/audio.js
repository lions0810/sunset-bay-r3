// audio.js - tiny synthesized sound effects for Sunset Bay.
// Every sound is built from oscillators and noise buffers at play time,
// so the game needs no audio files and stays fully offline.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  // The context can only start after a user gesture; call this from the
  // first key press or click and it quietly stays silent before that.
  unlock() {
    if (this.ctx || typeof window === 'undefined' || !window.AudioContext) return;
    try {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type = 'square', vol = 0.5, slideTo = null, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.4, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.master);
    src.start(t0);
  }

  click() { this.tone(660, 0.06, 'square', 0.25); }
  shoot() { this.noise(0.09, 0.5); this.tone(190, 0.08, 'sawtooth', 0.3, 60); }
  dryFire() { this.tone(1200, 0.03, 'square', 0.15); }
  crash() { this.noise(0.22, 0.6); this.tone(90, 0.2, 'triangle', 0.4, 45); }
  pickup() { this.tone(880, 0.07, 'sine', 0.4); this.tone(1320, 0.1, 'sine', 0.4, null, 0.07); }
  door() { this.tone(240, 0.07, 'triangle', 0.35, 160); }
  sirenStep(high) { this.tone(high ? 950 : 700, 0.16, 'triangle', 0.10); }
  complete() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.14, 'triangle', 0.4, null, i * 0.11));
  }
  busted() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => this.tone(n, 0.18, 'sawtooth', 0.25, null, i * 0.13));
  }
  hurt() { this.tone(140, 0.12, 'sawtooth', 0.35, 70); }
  horn() { this.tone(370, 0.16, 'square', 0.22); this.tone(466, 0.16, 'square', 0.18, null, 0.01); }
}
