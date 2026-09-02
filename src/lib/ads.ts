'use client';

/**
 * Rewarded-ad integration for the Telegram mini app, with two networks:
 *   • Monetag  — set NEXT_PUBLIC_MONETAG_ZONE to your "Telegram Mini App" zone id
 *   • Adsgram  — set NEXT_PUBLIC_ADSGRAM_BLOCK to your block id
 *
 * showRewardedAd() tries Monetag first, then falls back to Adsgram, so you get
 * fill from whichever has an ad ready (and can compare earnings per network in
 * each dashboard). With neither configured, adsEnabled() is false and the app
 * keeps its simulated ad flow, so nothing breaks before you plug in accounts.
 */

const MONETAG_ZONE = process.env.NEXT_PUBLIC_MONETAG_ZONE || '';
const ADSGRAM_BLOCK = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK || '';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function adsEnabled(): boolean {
  return !!MONETAG_ZONE || !!ADSGRAM_BLOCK;
}

// ── Monetag ──────────────────────────────────────────────────────────────────

let monetagInjected = false;
function monetagFn() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = (window as any)[`show_${MONETAG_ZONE}`];
  return typeof f === 'function' ? (f as (arg?: unknown) => Promise<unknown>) : null;
}
function loadMonetag(): void {
  if (!MONETAG_ZONE || monetagInjected || typeof document === 'undefined') return;
  monetagInjected = true;
  if (document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`)) return;
  const s = document.createElement('script');
  s.src = 'https://libtl.com/sdk.js';
  s.async = true;
  s.dataset.zone = MONETAG_ZONE;
  s.dataset.sdk = `show_${MONETAG_ZONE}`;
  document.head.appendChild(s);
}
async function showMonetag(format: 'interstitial' | 'pop'): Promise<boolean> {
  if (!MONETAG_ZONE) return false;
  loadMonetag();
  let fn = monetagFn();
  for (let i = 0; i < 16 && !fn; i++) {
    await sleep(250);
    fn = monetagFn();
  }
  if (!fn) return false;
  try {
    await (format === 'pop' ? fn('pop') : fn());
    return true;
  } catch {
    return false;
  }
}

// ── Adsgram ──────────────────────────────────────────────────────────────────

let adsgramInjected = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adsgramController: any = null;
function loadAdsgram(): void {
  if (!ADSGRAM_BLOCK || adsgramInjected || typeof document === 'undefined') return;
  adsgramInjected = true;
  if (document.querySelector('script[data-adsgram]')) return;
  const s = document.createElement('script');
  s.src = 'https://sad.adsgram.ai/js/sad.min.js';
  s.async = true;
  s.dataset.adsgram = '1';
  document.head.appendChild(s);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adsgramCtrl(): any {
  if (!ADSGRAM_BLOCK) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const A = (window as any).Adsgram;
  if (!A) return null;
  if (!adsgramController) {
    try {
      adsgramController = A.init({ blockId: ADSGRAM_BLOCK });
    } catch {
      return null;
    }
  }
  return adsgramController;
}
async function showAdsgram(): Promise<boolean> {
  if (!ADSGRAM_BLOCK) return false;
  loadAdsgram();
  let c = adsgramCtrl();
  for (let i = 0; i < 16 && !c; i++) {
    await sleep(250);
    c = adsgramCtrl();
  }
  if (!c) return false;
  try {
    // Resolves when the user finishes the ad; rejects on error/skip.
    await c.show();
    return true;
  } catch {
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Inject both SDKs up front so the first ad opens instantly. */
export function loadAdSdk(): void {
  loadMonetag();
  loadAdsgram();
}

/**
 * Show a rewarded ad, resolving true only if it completed. Tries Monetag first,
 * then Adsgram. `format` picks the Monetag placement ('interstitial' full video
 * or 'pop' popup); Adsgram uses its configured block either way.
 */
export async function showRewardedAd(format: 'interstitial' | 'pop' = 'interstitial'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (MONETAG_ZONE && (await showMonetag(format))) return true;
  if (ADSGRAM_BLOCK && (await showAdsgram())) return true;
  return false;
}
