'use client';

/**
 * Self-contained WebAudio sound engine — no audio files required.
 * Generates a subtle "mining rig" ambience plus reward chimes procedurally,
 * so it works offline and adds zero asset weight.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { stop: () => void } | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Must be called from a user gesture to satisfy autoplay policies. */
export function enableAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function noiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // brown-ish noise
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buf;
}

/** Start the looping mining-rig ambience (idempotent). */
export function startAmbience() {
  const c = getCtx();
  if (!c || !master) return;
  enableAudio();
  if (ambience) return;

  // Low hum
  const hum = c.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 58;
  const humGain = c.createGain();
  humGain.gain.value = 0.015;

  // Filtered noise bed
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 2);
  noise.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.05;

  // Slow LFO wobbling the filter for "movement"
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(lp.frequency);

  hum.connect(humGain).connect(master);
  noise.connect(lp).connect(noiseGain).connect(master);

  // fade in
  const now = c.currentTime;
  humGain.gain.setValueAtTime(0, now);
  humGain.gain.linearRampToValueAtTime(0.015, now + 0.6);
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.05, now + 0.6);

  hum.start();
  noise.start();
  lfo.start();

  ambience = {
    stop: () => {
      try {
        const t = c.currentTime;
        humGain.gain.cancelScheduledValues(t);
        noiseGain.gain.cancelScheduledValues(t);
        humGain.gain.linearRampToValueAtTime(0, t + 0.3);
        noiseGain.gain.linearRampToValueAtTime(0, t + 0.3);
        hum.stop(t + 0.35);
        noise.stop(t + 0.35);
        lfo.stop(t + 0.35);
      } catch {
        /* ignore */
      }
    },
  };
}

export function stopAmbience() {
  ambience?.stop();
  ambience = null;
}

function tone(freq: number, start: number, dur: number, gain = 0.12, type: OscillatorType = 'sine') {
  const c = getCtx();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Bright ascending chime for claims / big rewards. */
export function coinChime() {
  enableAudio();
  tone(880, 0, 0.16, 0.14, 'triangle');
  tone(1174, 0.08, 0.18, 0.12, 'triangle');
  tone(1568, 0.16, 0.28, 0.1, 'sine');
}

/** Short soft blip for small rewards / confirmations. */
export function blip() {
  enableAudio();
  tone(660, 0, 0.1, 0.09, 'sine');
  tone(990, 0.06, 0.12, 0.07, 'sine');
}

export function isAmbiencePlaying() {
  return !!ambience;
}
