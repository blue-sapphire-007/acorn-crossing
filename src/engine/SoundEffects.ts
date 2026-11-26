/**
 * Procedural Woodland Soundscape & SFX Synthesizer
 * Wind/rain ambience for prologue, sparrow chirps, wing flaps, footsteps, foraging & crafting
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;
  private windNode: AudioNode | null = null;
  private windGain: GainNode | null = null;
  public muted: boolean = false;

  constructor() {
    const unlock = () => {
      this.ensureContext();
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public startStormWind(intensity: number = 0.08): void {
    const ctx = this.ensureContext();
    if (!ctx || this.windNode) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = intensity;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    this.windNode = noise;
    this.windGain = gain;
  }

  public stopStormWind(): void {
    if (this.windGain && this.ctx) {
      this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
    }
    setTimeout(() => {
      if (this.windNode) {
        try {
          (this.windNode as AudioBufferSourceNode).stop();
        } catch {
          // ignore
        }
        this.windNode = null;
        this.windGain = null;
      }
    }, 550);
  }

  public playSparrowChirp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Two-syllable realistic chipping sparrow trill
    [0, 0.11].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const base = idx === 0 ? 2200 : 2650;
      osc.frequency.setValueAtTime(base, now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + offset + 0.045);
      osc.frequency.exponentialRampToValueAtTime(base * 0.92, now + offset + 0.09);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.09, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.095);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  public playWingFlap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.17);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playLeafStep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95 + Math.random() * 40, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playGather(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.11);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playCraftSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const c = this.ensureContext();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      }, i * 85);
    });
  }
}
