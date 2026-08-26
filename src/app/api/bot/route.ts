import { NextRequest, NextResponse } from 'next/server';
import { upsertUser } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Telegram bot webhook. Handles /start (with optional referral payload) by
 * replying with a welcome message + a button that launches the Moola mini app.
 *
 * Register it once (replace <TOKEN>, <HOST>, <SECRET>):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<HOST>/api/bot&secret_token=<SECRET>"
 * and set TELEGRAM_WEBHOOK_SECRET=<SECRET> in your env.
 */

function appUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${req.headers.get('host') ?? 'moola-peach.vercel.app'}`
  );
}

async function tg(method: string, body: unknown) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  // Verify Telegram's secret header if configured.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const text: string = msg?.text ?? '';
  const from = msg?.from;

  if (msg && from && typeof text === 'string' && text.startsWith('/start')) {
    const chatId = msg.chat.id;
    const url = appUrl(req);

    // Referral: "/start <referrerId>" — record it on first sight of this user.
    const payload = text.split(/\s+/)[1];
    if (payload && /^\d+$/.test(payload) && payload !== String(from.id)) {
      await upsertUser({
        id: String(from.id),
        first_name: from.first_name ?? 'Miner',
        username: from.username ?? null,
        referredBy: payload,
      }).catch(() => {});
    }

    const caption =
      `🐮 <b>Welcome to Moola!</b>\n\n` +
      `⛏️ Mine <b>MOOLA</b>, collect neon cow <b>NFTs</b>, complete daily tasks & ` +
      `withdraw straight to your <b>TON</b> wallet.\n\n` +
      `Tap below to start mining 👇`;

    await tg('sendPhoto', {
      chat_id: chatId,
      photo: `${url}/brand/onboarding.webp`,
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Start Mining', web_app: { url } }],
          [{ text: '📣 Join Channel', url: process.env.NEXT_PUBLIC_CHANNEL_URL || 'https://t.me/' }],
        ],
      },
    });
  }

  // Always 200 so Telegram doesn't retry.
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'moola-bot-webhook' });
}
