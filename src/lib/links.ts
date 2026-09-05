/** Public links surfaced in the UI (set via NEXT_PUBLIC_* env vars). */
export const links = {
  // Hardcoded so no stale env override can point these at a dead handle.
  partner: 'https://t.me/ATF_AIRDROP_bot?start=2071398340',
  channel: process.env.NEXT_PUBLIC_CHANNEL_URL || 'https://t.me/',
  x: 'https://x.com/Moolaminer',
  xPost: 'https://x.com/Moolaminer/status/2093144542128095398',
  xEngage: 'https://x.com/Moolaminer/status/2094786665977954714',
  xVote: 'https://x.com/Moolaminer/status/2094806407379902522',
  reactPost: 'https://t.me/moolaTg/6',
  boost: 'https://t.me/boost/moolaTg',
  dollarBumper: 'https://t.me/DollarBumperBot?start=2071398340',
  whatsapp: 'https://whatsapp.com/channel/0029Vb8WlYEATRSsTEg5qQ2O',
  moolaSolana: 'https://www.moolas.site/?ref=WFPL2UK6',
  // $2 MOOLA airdrop campaign (external). Override via NEXT_PUBLIC_AIRDROP_URL.
  airdrop: process.env.NEXT_PUBLIC_AIRDROP_URL || 'https://www.moolas.site/?ref=WFPL2UK6',
  ytVideo: 'https://youtube.com/shorts/f1P5hgx_AHQ',
  ytVideo2: 'https://youtube.com/shorts/Ehh7pPanxEY',
  ttVideo1: 'https://vt.tiktok.com/ZSVom6eue/',
  ttVideo2: 'https://vt.tiktok.com/ZSVoa3ogw/',
  ttProfile: 'https://tiktok.com/@moolaminers',
  fbPage: 'https://www.facebook.com/share/1EkWNExqVJ/',
  fbPost1: 'https://www.facebook.com/share/r/1bVAJeAVoP/',
  fbPost2: 'https://www.facebook.com/share/r/1ESU6sbnCD/',
  fbPost3: 'https://www.facebook.com/share/p/1BdbW1nSro/',
  youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL || 'https://youtube.com/',
  // Dedicated support bot (create via @BotFather). Leave unset to hide the
  // "Contact Support" button and show FAQ only.
  support: process.env.NEXT_PUBLIC_SUPPORT_URL || '',
};

/**
 * Deep link to support. Prefers a dedicated support bot (NEXT_PUBLIC_SUPPORT_URL,
 * with the user's Moola id as the /start payload); otherwise opens the MAIN bot's
 * self-service support menu ("/start support"). Always returns a usable link.
 */
export function supportLink(userId?: string | number): string {
  if (links.support) {
    if (!userId) return links.support;
    const sep = links.support.includes('?') ? '&' : '?';
    return `${links.support}${sep}start=uid${userId}`;
  }
  return `https://t.me/${botUsername}?start=support`;
}

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

/** STON.fi add-liquidity link for the MOOLA/TON pool. */
export function stonfiAddLiquidity(): string {
  const override = process.env.NEXT_PUBLIC_STONFI_LP_URL;
  if (override) return override;
  if (MOOLA_JETTON) return `https://app.ston.fi/liquidity/provide?ft=TON&tt=${MOOLA_JETTON}`;
  return 'https://app.ston.fi/pools';
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
    case 'x_post':
      return links.xPost;
    case 'react_post':
      return links.reactPost;
    case 'boost':
      return links.boost;
    case 'dollar_bumper':
      return links.dollarBumper;
    case 'whatsapp':
      return links.whatsapp;
    case 'moola_solana':
      return links.moolaSolana;
    case 'yt_video':
      return links.ytVideo;
    case 'yt_video2':
      return links.ytVideo2;
    case 'tt_v1':
      return links.ttVideo1;
    case 'tt_v2':
      return links.ttVideo2;
    case 'tt_follow':
      return links.ttProfile;
    case 'fb_follow':
      return links.fbPage;
    case 'fb_engage':
      return links.fbPost1;
    case 'x_engage':
      return links.xEngage;
    case 'x_vote':
      return links.xVote;
    case 'youtube':
      return links.youtube;
    default:
      return 'https://t.me/';
  }
}
