import { env } from './config';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moola-peach.vercel.app';

/** Send a message from the bot to a Telegram user id, with an Open-app button. */
export async function sendBotMessage(chatId: string, text: string): Promise<boolean> {
  if (!env.BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '⛏️ Open Moola', web_app: { url: APP_URL } }]],
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    return !!data?.ok;
  } catch {
    return false;
  }
}

/**
 * The channel we gate mining on. Prefers TELEGRAM_CHANNEL_ID (e.g. "@moolaTg"
 * or a numeric "-100…" id); otherwise derives the @username from the public
 * channel link. Empty string means "no channel configured" → gate is off.
 */
export function channelChatId(): string {
  const explicit = (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  if (explicit) return /^[@-]/.test(explicit) ? explicit : `@${explicit}`;
  const url = process.env.NEXT_PUBLIC_CHANNEL_URL || '';
  const m = url.match(/t\.me\/(?:s\/)?([A-Za-z0-9_]+)/i);
  return m ? `@${m[1]}` : '';
}

/** Whether the "must be in the channel to mine" gate is active. */
export function channelGateEnabled(): boolean {
  return !!env.BOT_TOKEN && !!channelChatId();
}

/**
 * Check whether a Telegram user is in the official channel. Returns:
 *   'member'      — creator/admin/member/subscribed
 *   'not_member'  — Telegram confirms they left or were removed
 *   'unknown'     — couldn't determine (API error, bot not admin, network)
 * Requires the bot to be an admin of the channel.
 */
// Cache positive membership per user (per warm instance) so frequent task taps
// don't call Telegram every time. Only 'member' is cached; non-members are
// re-checked each attempt so a fresh join is detected immediately.
const memberCache = new Map<string, number>();
const MEMBER_TTL_MS = 10 * 60 * 1000;

export async function channelMembership(userId: string): Promise<'member' | 'not_member' | 'unknown'> {
  const chat = channelChatId();
  if (!env.BOT_TOKEN || !chat) return 'unknown';
  const cached = memberCache.get(userId);
  if (cached && Date.now() - cached < MEMBER_TTL_MS) return 'member';
  try {
    const url =
      `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember` +
      `?chat_id=${encodeURIComponent(chat)}&user_id=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as { ok?: boolean; result?: { status?: string; is_member?: boolean } };
    if (!data?.ok || !data.result) return 'unknown';
    const s = data.result.status;
    const ok = () => {
      memberCache.set(userId, Date.now());
      return 'member' as const;
    };
    if (s === 'creator' || s === 'administrator' || s === 'member') return ok();
    if (s === 'restricted') return data.result.is_member ? ok() : 'not_member';
    if (s === 'left' || s === 'kicked') return 'not_member';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Call a Telegram Bot API method with a JSON body. */
export async function tgApi(method: string, body: unknown): Promise<boolean> {
  if (!env.BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return !!d?.ok;
  } catch {
    return false;
  }
}

/**
 * Notify the owner (ADMIN_CHAT_ID) of a video-bounty submission with the link
 * and Approve/Reject inline buttons (handled by the bot webhook). Returns
 * whether the notification was sent.
 */
export async function sendVideoSubmission(
  userId: string,
  name: string,
  username: string | null,
  url: string
): Promise<boolean> {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!env.BOT_TOKEN || !chatId) return false;
  const who = username ? `@${username}` : name || userId;
  const caption =
    `🎬 <b>New Moola video submission</b>\n\n` +
    `From: <b>${who}</b> (<code>${userId}</code>)\n` +
    `Link: ${url}\n\n` +
    `Approve to pay the user <b>2500 MOOLA</b>.`;
  return tgApi('sendMessage', {
    chat_id: chatId,
    text: caption,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve (+2500)', callback_data: `video:approve:${userId}` },
          { text: '❌ Reject', callback_data: `video:reject:${userId}` },
        ],
      ],
    },
  });
}

/**
 * Forward a user's dashboard-bounty video to the admin chat with Approve/Reject
 * inline buttons (handled by the bot webhook). Returns whether it was sent.
 */
export async function sendDashboardVideo(
  video: Blob,
  userId: string,
  name: string,
  username: string | null,
  reward: number
): Promise<boolean> {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!env.BOT_TOKEN || !chatId) return false;
  const who = username ? `@${username}` : name || userId;
  const caption =
    `🎥 <b>New dashboard video</b>\n\n` +
    `From: <b>${who}</b> (<code>${userId}</code>)\n\n` +
    `Approve to pay the user <b>${reward} MOOLA</b>.`;
  const fd = new FormData();
  fd.set('chat_id', chatId);
  fd.set('caption', caption);
  fd.set('parse_mode', 'HTML');
  fd.set(
    'reply_markup',
    JSON.stringify({
      inline_keyboard: [
        [
          { text: `✅ Approve (+${reward})`, callback_data: `dvid:approve:${userId}` },
          { text: '❌ Reject', callback_data: `dvid:reject:${userId}` },
        ],
      ],
    })
  );
  fd.set('video', video, 'dashboard.mp4');
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendVideo`, { method: 'POST', body: fd });
    const d = await res.json().catch(() => ({}));
    return !!d?.ok;
  } catch {
    return false;
  }
}

/**
 * Forward a user's verification video/photo to the admin chat with
 * Approve/Reject inline buttons (handled by the bot webhook).
 */
export async function sendVerification(
  video: Blob | null,
  photo: Blob | null,
  caption: string,
  userId: string
): Promise<boolean> {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!env.BOT_TOKEN || !chatId) return false;
  const kb = JSON.stringify({
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `verify:approve:${userId}` },
        { text: '❌ Reject', callback_data: `verify:reject:${userId}` },
      ],
    ],
  });
  const base = `https://api.telegram.org/bot${env.BOT_TOKEN}`;
  try {
    let buttonsPlaced = false;
    if (video) {
      const fd = new FormData();
      fd.set('chat_id', chatId);
      fd.set('caption', caption);
      fd.set('parse_mode', 'HTML');
      fd.set('reply_markup', kb);
      fd.set('video', video, 'verify.mp4');
      await fetch(`${base}/sendVideo`, { method: 'POST', body: fd });
      buttonsPlaced = true;
    }
    if (photo) {
      const fd = new FormData();
      fd.set('chat_id', chatId);
      fd.set('photo', photo, 'verify.jpg');
      if (!buttonsPlaced) {
        fd.set('caption', caption);
        fd.set('parse_mode', 'HTML');
        fd.set('reply_markup', kb);
      }
      await fetch(`${base}/sendPhoto`, { method: 'POST', body: fd });
    }
    return true;
  } catch {
    return false;
  }
}
