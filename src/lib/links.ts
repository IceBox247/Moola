/** Public links surfaced in the UI (set via NEXT_PUBLIC_* env vars). */
export const links = {
  partner: process.env.NEXT_PUBLIC_PARTNER_URL || 'https://t.me/',
  channel: process.env.NEXT_PUBLIC_CHANNEL_URL || 'https://t.me/',
  x: process.env.NEXT_PUBLIC_X_URL || 'https://x.com/',
  youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL || 'https://youtube.com/',
};

export const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'MoolaMiningBot';

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
