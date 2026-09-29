"use client";

import { freqOfMidi } from "./theory";

/**
 * A synthesized music box. No samples: each note is a struck steel
 * tine — a sine fundamental, a slightly sharp octave, and the tine's
 * inharmonic overtone (a cantilevered bar rings at about 6.27× its
 * fundamental) — plus the tiny click of a pin letting go, all sent
 * through a warm lowpass and a small generated room.
 *
 * Sound only ever starts from a gesture (`unlock()` inside a tap).
 * On iOS the audio session is switched to "playback" so the ringer
 * switch doesn't silence it.
 */

type Listener = () => void;

const MUTE_KEY = "von:muted";

interface PluckOptions {
  /** AudioContext time; defaults to "now" */
  when?: number;
  /** 0–1 */
  velocity?: number;
  /** "accompaniment" notes are softer and darker */
  voice?: "melody" | "accompaniment";
}

class MusicBoxEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private recent: number[] = [];
  private _muted = false;
  private _unlocked = false;
  private visibilityBound = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this._muted = window.localStorage.getItem(MUTE_KEY) === "1";
      } catch {
        /* storage unavailable */
      }
    }
  }

  get muted() {
    return this._muted;
  }

  /** true once a gesture has started a running AudioContext */
  get unlocked() {
    return this._unlocked;
  }

  /** true when a note played now would actually be heard */
  get audible() {
    return this._unlocked && !this._muted && this.ctx?.state === "running";
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /** The clock everything is scheduled against (seconds). */
  now(): number {
    if (this.ctx && this.ctx.state === "running") return this.ctx.currentTime;
    return performance.now() / 1000;
  }

  /** Is `now()` currently the audio clock? */
  get clockIsAudio(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  setMuted(m: boolean) {
    this._muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.03);
    }
    this.emit();
  }

  toggleMuted() {
    this.setMuted(!this._muted);
  }

  /** Call from inside a user gesture (pointerdown / click / keydown). */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* older Safari */
    }
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.build();
      this.ctx.onstatechange = () => {
        this._unlocked = this.ctx?.state === "running";
        this.emit();
      };
    }
    const ctx = this.ctx;
    // a silent buffer, started synchronously inside the gesture (old iOS)
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this._unlocked = ctx.state === "running";
    this.bindVisibility();
    this.emit();
  }

  private bindVisibility() {
    if (this.visibilityBound) return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else if (this._unlocked) void this.ctx.resume().catch(() => {});
    });
  }

  private build() {
    const ctx = this.ctx!;
    const master = ctx.createGain();
    master.gain.value = this._muted ? 0 : 0.9;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    const bus = ctx.createGain();
    bus.gain.value = 0.55;

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 7200;
    tone.Q.value = 0.4;

    const dry = ctx.createGain();
    dry.gain.value = 0.82;

    const wet = ctx.createGain();
    wet.gain.value = 0.24;
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(2.4, 3.1);

    bus.connect(tone);
    tone.connect(dry);
    tone.connect(verb);
    verb.connect(wet);
    dry.connect(comp);
    wet.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    this.bus = bus;
    this.master = master;

    const len = Math.floor(ctx.sampleRate * 0.03);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    this.noise = nb;
  }

  /** A small wooden room: stereo noise with an exponential tail. */
  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    const pre = Math.floor(rate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / (len - pre);
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay) * (ch ? 0.92 : 1);
      }
    }
    return buf;
  }

  /** Play one note. Silently does nothing when muted or locked. */
  pluck(midi: number, opts: PluckOptions = {}) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus || this._muted || ctx.state !== "running") return;

    const t = Math.max(opts.when ?? ctx.currentTime, ctx.currentTime) + 0.004;

    // guard against a frantic crank flooding the graph
    const wall = performance.now();
    this.recent = this.recent.filter((x) => wall - x < 120);
    if (this.recent.length > 18) return;
    this.recent.push(wall);

    const accomp = opts.voice === "accompaniment";
    const v = Math.max(0, Math.min(1, opts.velocity ?? 0.8)) * (accomp ? 0.78 : 1);
    const f = freqOfMidi(midi);
    // low tines ring longer than high ones
    const ring = Math.max(0.55, Math.min(2.6, 2.6 - (midi - 45) * 0.045));

    const voice = ctx.createGain();
    voice.gain.value = 1;
    voice.connect(bus);

    const partials: [ratio: number, amp: number, decay: number][] = [
      [1, 0.62, ring],
      [2.0035, accomp ? 0.08 : 0.16, ring * 0.42],
      [6.27, f > 1400 ? 0.02 : 0.055, 0.07],
      [17.55, f > 700 ? 0 : 0.012, 0.025],
    ];

    for (const [ratio, amp, decay] of partials) {
      if (amp <= 0 || f * ratio > ctx.sampleRate / 2.2) continue;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * v, t + 0.0025);
      g.gain.setTargetAtTime(0, t + 0.0025, decay / 3);
      osc.connect(g);
      g.connect(voice);
      osc.start(t);
      osc.stop(t + decay * 2.2 + 0.05);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    }

    // the pin letting go of the tine
    if (this.noise) {
      const click = ctx.createBufferSource();
      click.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(9000, 2600 + f * 1.4);
      bp.Q.value = 1.1;
      const cg = ctx.createGain();
      cg.gain.value = 0.05 * v;
      click.connect(bp);
      bp.connect(cg);
      cg.connect(voice);
      click.start(t);
      click.onended = () => {
        click.disconnect();
        bp.disconnect();
        cg.disconnect();
      };
    }

    window.setTimeout(() => voice.disconnect(), (ring * 2.2 + 0.4) * 1000 + (t - ctx.currentTime) * 1000);
  }

  /** The dry little tick of the crank's ratchet. */
  tick(gain = 0.05) {
    const ctx = this.ctx;
    if (!ctx || !this.bus || !this.noise || this._muted || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.002;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1.6;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.bus);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      g.disconnect();
    };
  }
}

/** The one music box on the page. */
export const musicBox = new MusicBoxEngine();
