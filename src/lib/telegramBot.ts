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
