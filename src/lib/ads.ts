'use client';

/**
 * Monetag rewarded-ad integration for the Telegram mini app.
 *
 * Set NEXT_PUBLIC_MONETAG_ZONE to your Monetag "Telegram Mini App" zone id.
 * The SDK tag defines a global function named `show_<zone>()` that returns a
 * Promise resolving when the user finishes the ad — that's our reward trigger.
 * When the zone isn't configured, adsEnabled() is false and the app falls back
 * to its simulated ad flow, so nothing breaks before you plug in an account.
 */

const ZONE = process.env.NEXT_PUBLIC_MONETAG_ZONE || '';

export function adsEnabled(): boolean {
  return !!ZONE;
}

function fnName(): string {
  return `show_${ZONE}`;
}

let injected = false;

/** Inject the Monetag SDK once (defines the global show_<zone> function). */
export function loadAdSdk(): void {
  if (!ZONE || injected || typeof document === 'undefined') return;
  injected = true;
  if (document.querySelector(`script[data-zone="${ZONE}"]`)) return;
  const s = document.createElement('script');
  s.src = 'https://libtl.com/sdk.js';
  s.async = true;
  s.dataset.zone = ZONE;
  s.dataset.sdk = fnName();
  document.head.appendChild(s);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adFn(): ((arg?: unknown) => Promise<unknown>) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = (window as any)[fnName()];
  return typeof f === 'function' ? f : null;
}

/**
 * Show a rewarded ad and resolve true only if it completed. `format` picks the
 * Monetag placement: 'interstitial' (full rewarded video) or 'pop' (rewarded
 * popup). Returns false if ads aren't configured or the ad didn't complete.
 */
export async function showRewardedAd(format: 'interstitial' | 'pop' = 'interstitial'): Promise<boolean> {
  if (!ZONE || typeof window === 'undefined') return false;
  loadAdSdk();
  // The SDK may still be loading — wait briefly for the global to appear.
  let fn = adFn();
  for (let i = 0; i < 20 && !fn; i++) {
    await new Promise((r) => setTimeout(r, 250));
    fn = adFn();
  }
  if (!fn) return false;
  try {
    await (format === 'pop' ? fn('pop') : fn());
    return true;
  } catch {
    return false;
  }
}
