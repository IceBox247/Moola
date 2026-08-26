'use client';

/**
 * Sound engine using real audio clips (public/sounds).
 * - moo:      the cow single-moo — plays on a mining claim
 * - coin:     gold-coin prize — check-ins, mints, big rewards
 * - cowbell:  soft cowbell — small rewards / confirmations
 * - barn:     low farm ambience loop while mining
 * All royalty-free (Mixkit, free for commercial use).
 */

type Key = 'moo' | 'coin' | 'cowbell' | 'barn';

const FILES: Record<Key, string> = {
  moo: '/sounds/moo.mp3',
  coin: '/sounds/coin.mp3',
  cowbell: '/sounds/cowbell.mp3',
  barn: '/sounds/barn.mp3',
};

const VOL: Record<Key, number> = { moo: 0.8, coin: 0.6, cowbell: 0.4, barn: 0.22 };

const cache: Partial<Record<Key, HTMLAudioElement>> = {};
let unlocked = false;
let ambienceOn = false;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function el(key: Key): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!cache[key]) {
    try {
      const a = new Audio(FILES[key]);
      a.preload = 'auto';
      a.volume = VOL[key];
      if (key === 'barn') a.loop = true;
      cache[key] = a;
    } catch {
      return null;
    }
  }
  return cache[key] ?? null;
}

/** Call from a user gesture to satisfy autoplay policies. */
export function enableAudio() {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  (Object.keys(FILES) as Key[]).forEach((k) => el(k)?.load());
}

function play(key: Key) {
  const a = el(key);
  if (!a) return;
  try {
    const node = a.cloneNode(true) as HTMLAudioElement;
    node.volume = VOL[key];
    void node.play();
  } catch {
    /* ignore */
  }
}

/** The star — a real cow moo. */
export function moo() {
  play('moo');
}
/** Gold-coin reward chime. */
export function coinChime() {
  play('coin');
}
/** Soft cowbell for small confirmations. */
export function blip() {
  play('cowbell');
}

export function startAmbience() {
  const a = el('barn');
  if (!a || ambienceOn) return;
  ambienceOn = true;
  if (fadeTimer) clearInterval(fadeTimer);
  a.volume = 0;
  a.currentTime = 0;
  void a.play().catch(() => {});
  const target = VOL.barn;
  fadeTimer = setInterval(() => {
    a.volume = Math.min(target, a.volume + 0.02);
    if (a.volume >= target && fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 60);
}

export function stopAmbience() {
  const a = cache.barn;
  ambienceOn = false;
  if (!a) return;
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = setInterval(() => {
    a.volume = Math.max(0, a.volume - 0.03);
    if (a.volume <= 0.01) {
      a.pause();
      if (fadeTimer) {
        clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }
  }, 50);
}

export function isAmbiencePlaying() {
  return ambienceOn;
}
