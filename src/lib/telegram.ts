'use client';

/** Thin wrapper around the Telegram Web App SDK with safe dev fallbacks. */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotifyType = 'error' | 'success' | 'warning';

interface TgWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: unknown };
  colorScheme?: string;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (s: HapticStyle) => void;
    notificationOccurred: (t: NotifyType) => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function tg(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const w = tg();
  return !!w && !!w.initData;
}

/** The initData string to send to the backend, or a dev payload when outside Telegram. */
export function getInitData(): string {
  const w = tg();
  if (w && w.initData) return w.initData;
  // Dev fallback — a stable mock user + optional ?ref= referral.
  let ref: string | null = null;
  if (typeof window !== 'undefined') {
    ref = new URLSearchParams(window.location.search).get('ref');
  }
  return `devmode:${JSON.stringify({
    id: '1000001',
    first_name: 'Dev Miner',
    username: 'dev_miner',
    start_param: ref,
  })}`;
}

export function initTelegram() {
  const w = tg();
  if (!w) return;
  try {
    w.ready();
    w.expand();
    w.disableVerticalSwipes?.();
    w.setHeaderColor?.('#04070c');
    w.setBackgroundColor?.('#04070c');
  } catch {
    /* noop */
  }
}

export function haptic(style: HapticStyle = 'light') {
  tg()?.HapticFeedback?.impactOccurred(style);
}
export function notify(type: NotifyType = 'success') {
  tg()?.HapticFeedback?.notificationOccurred(type);
}
export function selection() {
  tg()?.HapticFeedback?.selectionChanged();
}

export function openLink(url: string) {
  const w = tg();
  if (!url) return;
  if (w?.openTelegramLink && url.includes('t.me')) w.openTelegramLink(url);
  else if (w?.openLink) w.openLink(url);
  else window.open(url, '_blank');
}
