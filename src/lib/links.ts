/** Public links surfaced in the UI (set via NEXT_PUBLIC_* env vars). */
export const links = {
  partner: process.env.NEXT_PUBLIC_PARTNER_URL || 'https://t.me/',
  channel: process.env.NEXT_PUBLIC_CHANNEL_URL || 'https://t.me/',
  x: process.env.NEXT_PUBLIC_X_URL || 'https://x.com/',
  youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL || 'https://youtube.com/',
};

export const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'MoolaMiningBot';

/** Public jetton addresses for buy links (client-side). */
export const MOOLA_JETTON = process.env.NEXT_PUBLIC_MOOLA_JETTON || '';
export const ATF_JETTON = process.env.NEXT_PUBLIC_ATF_JETTON || '';

/** STON.fi swap deep link to buy MOOLA with TON, optionally prefilling the amount. */
export function stonfiBuyMoola(amountMoola?: number): string {
  const p = new URLSearchParams();
  p.set('ft', 'TON');
  if (MOOLA_JETTON) p.set('tt', MOOLA_JETTON);
  if (amountMoola && amountMoola > 0) p.set('ta', String(Math.ceil(amountMoola)));
  return `https://app.ston.fi/swap?${p.toString()}`;
}

/** STON.fi swap deep link to buy ATF with TON. */
export function stonfiBuyAtf(): string {
  const p = new URLSearchParams();
  p.set('ft', 'TON');
  if (ATF_JETTON) p.set('tt', ATF_JETTON);
  return `https://app.ston.fi/swap?${p.toString()}`;
}

export function socialLink(kind: string): string {
  switch (kind) {
    case 'partner':
      return links.partner;
    case 'channel':
      return links.channel;
    case 'x':
      return links.x;
    case 'youtube':
      return links.youtube;
    default:
      return 'https://t.me/';
  }
}
