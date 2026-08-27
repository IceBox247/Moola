'use client';

/**
 * MOOLA Audio Engine — a single reusable sound service for the whole app.
 *
 * - Low-latency SFX via WebAudio (decoded buffers, no per-tap Audio objects).
 * - A seamless mining ambient loop with smooth fade in/out.
 * - Volume + on/off for music and SFX, persisted to localStorage.
 * - Unlocked on the first user gesture (Telegram/iOS autoplay policy).
 * - Same-sound stacking is throttled so rapid taps don't pile up.
 *
 * Swap the placeholder files in /public/audio/moola/ to reskin — keys unchanged.
 */

export type SfxKey =
  | 'mining_start'
  | 'claim'
  | 'reward_big'
  | 'boost'
  | 'level_up'
  | 'nft_activate'
  | 'success'
  | 'error'
  | 'signature';

const FILES: Record<SfxKey, string> = {
  mining_start: '/audio/moola/mining-start.wav',
  claim: '/audio/moola/claim.wav',
  reward_big: '/audio/moola/big-reward.wav',
  boost: '/audio/moola/boost.wav',
  level_up: '/audio/moola/level-up.wav',
  nft_activate: '/audio/moola/nft-activate.wav',
  success: '/audio/moola/success.wav',
  error: '/audio/moola/error.wav',
  signature: '/audio/moola/moola-signature.wav',
};
const LOOP_FILE = '/audio/moola/mining-loop.wav';

export type AudioPrefs = {
  sfxOn: boolean;
  musicOn: boolean;
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
};

const DEFAULT_PREFS: AudioPrefs = { sfxOn: true, musicOn: false, musicVol: 0.3, sfxVol: 0.65 };
const PREFS_KEY = 'moola_audio_prefs';

function loadPrefs(): AudioPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS };
}

class MoolaAudio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private loopBuffer: AudioBuffer | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private loopWanted = false;
  private unlocked = false;
  private loading = false;
  private lastPlay: Partial<Record<SfxKey, number>> = {};
  prefs: AudioPrefs = loadPrefs();

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.prefs.sfxOn ? this.prefs.sfxVol : 0;
        this.musicGain.gain.value = 0; // loop fades in when started
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** Call from a user gesture. Resumes the context and preloads buffers. */
  unlock() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.unlocked = true;
    void this.preload();
  }

  private async decode(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  private async preload() {
    if (this.loading) return;
    this.loading = true;
    await Promise.all(
      (Object.keys(FILES) as SfxKey[]).map(async (k) => {
        if (!this.buffers[k]) {
          const b = await this.decode(FILES[k]);
          if (b) this.buffers[k] = b;
        }
      })
    );
    if (!this.loopBuffer) this.loopBuffer = await this.decode(LOOP_FILE);
    // If a loop was requested before it finished loading, start it now.
    if (this.loopWanted && !this.loopSource) this.startMiningLoop();
  }

  /** Play a one-shot SFX (throttled so rapid taps don't stack). */
  play(key: SfxKey) {
    if (!this.prefs.sfxOn) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.sfxGain) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = performance.now();
    if (this.lastPlay[key] && now - (this.lastPlay[key] as number) < 70) return;
    this.lastPlay[key] = now;

    const buf = this.buffers[key];
    if (!buf) {
      // lazy-load then play once ready
      this.decode(FILES[key]).then((b) => {
        if (b) {
          this.buffers[key] = b;
          this.spawn(b);
        }
      });
      return;
    }
    this.spawn(buf);
  }

  private spawn(buf: AudioBuffer) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.sfxGain!);
    try {
      src.start();
    } catch {
      /* ignore */
    }
  }

  startMiningLoop() {
    this.loopWanted = true;
    if (!this.prefs.musicOn) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.musicGain) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (this.loopSource) return; // already playing
    if (!this.loopBuffer) {
      void this.preload(); // will auto-start once loaded (loopWanted)
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.loopBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.loopSource = src;
    // fade in
    const t = ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(this.prefs.musicVol, t + 0.8);
  }

  stopMiningLoop() {
    this.loopWanted = false;
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.loopSource) return;
    const t = ctx.currentTime;
    const src = this.loopSource;
    this.loopSource = null;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(0, t + 0.6);
    try {
      src.stop(t + 0.65);
    } catch {
      /* ignore */
    }
  }

  // ── settings ──
  private persist() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
  }
  getPrefs(): AudioPrefs {
    return { ...this.prefs };
  }
  setSfxOn(on: boolean) {
    this.prefs.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? this.prefs.sfxVol : 0;
    this.persist();
  }
  setMusicOn(on: boolean) {
    this.prefs.musicOn = on;
    this.persist();
    if (on) {
      if (this.loopWanted) this.startMiningLoop();
    } else {
      this.stopMiningLoop();
    }
  }
  setSfxVol(v: number) {
    this.prefs.sfxVol = clamp01(v);
    if (this.sfxGain && this.prefs.sfxOn) this.sfxGain.gain.value = this.prefs.sfxVol;
    this.persist();
  }
  setMusicVol(v: number) {
    this.prefs.musicVol = clamp01(v);
    if (this.musicGain && this.loopSource && this.prefs.musicOn) {
      this.musicGain.gain.value = this.prefs.musicVol;
    }
    this.persist();
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export const audio: MoolaAudio =
  typeof window !== 'undefined'
    ? ((window as unknown as { __moolaAudio?: MoolaAudio }).__moolaAudio ??= new MoolaAudio())
    : (new MoolaAudio() as MoolaAudio);

// Convenience helpers (used across the app)
export const playSfx = (k: SfxKey) => audio.play(k);
export const unlockAudio = () => audio.unlock();
export const startMiningLoop = () => audio.startMiningLoop();
export const stopMiningLoop = () => audio.stopMiningLoop();
