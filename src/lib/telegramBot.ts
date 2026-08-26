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
