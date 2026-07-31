/* ============================================================
 * TYPE RACER - SPEED RUSH
 * audio.js — synthesized sound effects via Web Audio API
 * (no external audio files needed)
 * ============================================================ */
window.TR = window.TR || {};

TR.AudioEngine = class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.7;
    this.engine = null;        // running engine sound nodes
    this.engineSource = null;
    this.idleSource = null;
  }

  /* Must be called from a user gesture (browser autoplay policy) */
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* audio unsupported — silently disable */ }
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? this.volume : 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.enabled ? v : 0;
  }

  /* ---------- one-shot sounds ---------- */

  click() {
    this._blip(1400 + Math.random() * 400, 0.05, "triangle", 0.045);
  }

  wrong() {
    this._blip(110, 0.14, "square", 0.09);
    this._noise(0.12, 0.05, 400);
  }

  countBeep(final) {
    this._blip(final ? 880 : 620, final ? 0.32 : 0.14, "triangle", 0.12);
  }

  milestone(tier) {
    const base = 520 + tier * 140;
    [0, 1, 2].forEach((i) => setTimeout(() => this._blip(base * (i + 1), 0.09, "square", 0.05), i * 60));
  }

  nitro() {
    /* rising whoosh */
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + 0.5);
    this._noise(0.4, 0.09, 2400, true);
  }

  nitroEnd() {
    if (!this.ctx || !this.master) return;
    this._blip(300, 0.2, "sawtooth", 0.05);
  }

  finish(victory) {
    /* chord + arpeggio */
    const notes = victory ? [523.25, 659.25, 783.99, 1046.5] : [392, 466.16, 523.25];
    notes.forEach((f, i) => setTimeout(() => this._blip(f, victory ? 0.5 : 0.3, "triangle", 0.12), i * 130));
    if (victory) setTimeout(() => this._noise(0.9, 0.05, 6000, true), 500);
  }

  _blip(freq, dur, type, vol) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, cutoff, highpass) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = highpass ? "highpass" : "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t);
  }

  /* ---------- continuous engine sound ---------- */

  engineStart() {
    if (!this.ctx || this.engine) return;
    const t = this.ctx.currentTime;
    const main = this.ctx.createOscillator();          // saw layer
    const sub = this.ctx.createOscillator();           // low rumble
    const osc2 = this.ctx.createOscillator();          // detuned for texture
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    main.type = "sawtooth"; main.frequency.value = 55;
    sub.type = "sine"; sub.frequency.value = 27.5;
    osc2.type = "square"; osc2.frequency.value = 111;
    filter.type = "lowpass"; filter.frequency.value = 320; filter.Q.value = 6;
    gain.gain.value = 0.0;
    main.connect(filter); sub.connect(filter); osc2.connect(filter);
    filter.connect(gain); gain.connect(this.master);
    main.start(t); sub.start(t); osc2.start(t);
    this.engine = { main, sub, osc2, filter, gain };
    this.engineSource = filter;
  }

  /* speed01: 0..1 of speed range; nitro: boolean */
  engineUpdate(speed01, nitro) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const pitch = 40 + speed01 * 150 + (nitro ? 90 : 0);
    const f2 = pitch * 1.018;
    this.engine.main.frequency.setTargetAtTime(pitch, t, 0.06);
    this.engine.sub.frequency.setTargetAtTime(pitch * 0.5, t, 0.06);
    this.engine.osc2.frequency.setTargetAtTime(f2 * 2, t, 0.06);
    this.engine.filter.frequency.setTargetAtTime(240 + speed01 * 900 + (nitro ? 1400 : 0), t, 0.08);
    this.engine.gain.gain.setTargetAtTime(0.018 + speed01 * 0.05 + (nitro ? 0.02 : 0), t, 0.1);
  }

  engineStop() {
    if (!this.engine) return;
    const e = this.engine;
    const t = this.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.08);
    [e.main, e.sub, e.osc2].forEach((o) => o.stop(t + 0.5));
    this.engine = null;
    this.engineSource = null;
  }

  /* ---------- low idle hum on the home screen ---------- */

  idleStart() {
    if (!this.ctx || this.idleSource) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth"; osc.frequency.value = 38;
    gain.gain.setTargetAtTime(0.012, t, 0.4);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t);
    this.idleSource = { osc, gain };
  }

  idleStop() {
    if (!this.idleSource) return;
    const s = this.idleSource;
    const t = this.ctx.currentTime;
    s.gain.gain.setTargetAtTime(0, t, 0.15);
    s.osc.stop(t + 0.4);
    this.idleSource = null;
  }
};
