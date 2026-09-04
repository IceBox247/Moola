import { NextRequest, NextResponse } from 'next/server';
import { upsertUser, sql, approveVideoTask, rejectVideoTask, approveDashboardVideo, rejectDashboardVideo } from '@/lib/db';
import { game } from '@/lib/config';
import { sendBotMessage } from '@/lib/telegramBot';
import { links } from '@/lib/links';
import { translateText } from '@/lib/translate';

// ── Support: self-service FAQ answered inside the bot ────────────────────────
// Deflects the common questions with canned answers; only "Message a human"
// forwards to the admin chat, so support volume stays low.
const SUPPORT_ANSWERS: Record<string, string> = {
  withdraw:
    '💸 <b>Withdrawals</b>\n\nEvery withdrawal is sent on the TON blockchain: <b>Pending → Sending → Paid</b>. This can take a few minutes. Your MOOLA is deducted and queued — never lost. If a payout fails on-chain it is <b>auto-refunded</b> to your balance, so just try again. You must be a member of our official channel to withdraw.',
  holdings:
    '💰 <b>Holdings &amp; Mining speed</b>\n\nYour <b>Wallet Holding</b> is read live from the blockchain — if it briefly shows 0, refresh the app in a minute. It is separate from your in-app <b>Pool (Spendable)</b> balance, which is what you mine and withdraw. Holding ATF boosts your mining; speed also depends on your level and NFT boost.',
  fees:
    '🎫 <b>Fees &amp; limits</b>\n\nYour first withdrawal every 24h is <b>free</b>. Withdrawing again inside the same window needs a small on-chain fee (~$0.10 in TON) to the treasury — this covers gas and blocks spam/multi-accounts. Wait for the free window to reset to withdraw free again.',
  verify:
    '✅ <b>Verification</b>\n\nLarge withdrawals need a quick verification (a short video + photo) to confirm you are one real person. Submit it from the <b>Profile</b> tab; it is reviewed manually and you will get a bot message once approved.',
};

function supportMenuKb() {
  return {
    inline_keyboard: [
      [
        { text: '💸 Withdrawals', callback_data: 'sup:withdraw' },
        { text: '💰 Holdings & Mining', callback_data: 'sup:holdings' },
      ],
      [
        { text: '🎫 Fees & Limits', callback_data: 'sup:fees' },
        { text: '✅ Verification', callback_data: 'sup:verify' },
      ],
      [{ text: '✍️ Message a human', callback_data: 'sup:human' }],
    ],
  };
}

async function sendSupportMenu(chatId: string | number) {
  await tg('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text:
      '🐮 <b>Moola Help &amp; Support</b>\n\nMost answers are one tap away — pick a topic below. Still stuck? Tap <b>Message a human</b>.',
    reply_markup: supportMenuKb(),
  });
}

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

  // ── Admin verification Approve/Reject buttons ──
  const cq = update?.callback_query;
  if (cq) {
    const data: string = cq.data ?? '';
    const fromId = String(cq.from?.id ?? '');
    const adminIds = (process.env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const adminChat = process.env.ADMIN_CHAT_ID ?? '';
    const isAdmin =
      (adminIds.length > 0 && adminIds.includes(fromId)) ||
      (adminChat && String(cq.message?.chat?.id) === String(adminChat));

    if (data.startsWith('verify:')) {
      if (!isAdmin) {
        await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Not authorized' });
        return NextResponse.json({ ok: true });
      }
      const [, action, userId] = data.split(':');
      const approve = action === 'approve';
      await sql`
        UPDATE users SET verified = ${approve}, verify_status = ${approve ? 'approved' : 'rejected'}
        WHERE id = ${userId};
      `;
      await tg('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: approve ? 'Approved ✅' : 'Rejected ❌',
      });
      if (cq.message) {
        await tg('editMessageCaption', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          parse_mode: 'HTML',
          caption: `${cq.message.caption ?? ''}\n\n<b>${approve ? '✅ APPROVED' : '❌ REJECTED'}</b>`,
        });
      }
      await sendBotMessage(
        userId,
        approve
          ? '✅ Your Moola account is <b>verified</b>! You can withdraw now.'
          : '❌ Your verification was not approved. Please redo it with a clear, well-lit video and photo.'
      );
    }

    if (data.startsWith('video:')) {
      if (!isAdmin) {
        await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Not authorized' });
        return NextResponse.json({ ok: true });
      }
      const [, action, userId] = data.split(':');
      const approve = action === 'approve';
      let toast = approve ? 'Approved ✅' : 'Rejected ❌';
      if (approve) {
        const r = await approveVideoTask(userId);
        if (!r.credited) toast = r.reason === 'slots full' ? 'All slots filled' : 'Already handled';
      } else {
        await rejectVideoTask(userId);
      }
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: toast });
      if (cq.message) {
        await tg('editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          text: `${cq.message.text ?? ''}\n\n<b>${approve ? '✅ APPROVED — 2500 MOOLA paid' : '❌ REJECTED'}</b>`,
        });
      }
      await sendBotMessage(
        userId,
        approve
          ? '🎬 Your Moola video was <b>approved</b>! <b>2500 MOOLA</b> has been added to your balance. 🐮'
          : '🎬 Your Moola video wasn’t approved this time. You can submit a new one from the Tasks tab.'
      );
    }

    if (data.startsWith('dvid:')) {
      if (!isAdmin) {
        await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Not authorized' });
        return NextResponse.json({ ok: true });
      }
      const [, action, userId] = data.split(':');
      const approve = action === 'approve';
      const reward = game.dashboardVideo.reward;
      let toast = approve ? 'Approved ✅' : 'Rejected ❌';
      if (approve) {
        const r = await approveDashboardVideo(userId);
        if (!r.credited) toast = r.reason === 'slots full' ? 'All slots filled' : 'Already handled';
      } else {
        await rejectDashboardVideo(userId);
      }
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: toast });
      if (cq.message) {
        await tg('editMessageCaption', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          parse_mode: 'HTML',
          caption: `${cq.message.caption ?? ''}\n\n<b>${approve ? `✅ APPROVED — ${reward} MOOLA paid` : '❌ REJECTED'}</b>`,
        });
      }
      await sendBotMessage(
        userId,
        approve
          ? `🎥 Your Moola dashboard video was <b>approved</b>! <b>${reward} MOOLA</b> has been added to your balance. 🐮`
          : '🎥 Your dashboard video wasn’t approved this time. You can record and submit a new one from the Tasks tab.'
      );
    }

    // ── Support menu (open to everyone) ──
    // For a private-chat button, chat.id == the user id, so fromId is a safe
    // fallback if the callback arrives without its originating message.
    const supChat = cq.message?.chat?.id ?? fromId;
    if (data === 'support') {
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      await sendSupportMenu(supChat);
    } else if (data.startsWith('sup:')) {
      const topic = data.slice(4);
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (topic === 'human') {
        // Arm support mode: the user's next message is forwarded to admin.
        await sql`UPDATE users SET support_until = ${Date.now() + 30 * 60 * 1000} WHERE id = ${fromId};`;
        await tg('sendMessage', {
          chat_id: supChat,
          parse_mode: 'HTML',
          text:
            '✍️ <b>Describe your issue in one message.</b>\n\nInclude what happened (e.g. withdrawal amount, time) — and you can <b>attach a screenshot</b>. Your next message goes straight to our support team and we’ll reply here.',
        });
      } else if (SUPPORT_ANSWERS[topic]) {
        await tg('sendMessage', {
          chat_id: supChat,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          text: SUPPORT_ANSWERS[topic],
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Help', callback_data: 'support' }]] },
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update?.message;
  const text: string = msg?.text ?? '';
  const from = msg?.from;

  if (msg && from && typeof text === 'string' && text.startsWith('/start')) {
    const chatId = msg.chat.id;
    const url = appUrl(req);

    const payload = text.split(/\s+/)[1];

    // Support deep link ("/start support", e.g. from the in-app Contact button).
    if (payload === 'support') {
      await sendSupportMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // Referral: "/start <referrerId>" — record it on first sight of this user.
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
          [
            { text: '🤝 Join Partner', url: links.partner },
            { text: '📣 Join Channel', url: process.env.NEXT_PUBLIC_CHANNEL_URL || 'https://t.me/' },
          ],
          [{ text: '💬 Help & Support', callback_data: 'support' }],
        ],
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ── Non-/start messages: support command + ticket forwarding ──
  if (msg && from && msg.chat?.type === 'private') {
    const userId = String(from.id);
    const adminChat = process.env.ADMIN_CHAT_ID ?? '';
    const adminIds = (process.env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const isAdmin =
      (adminIds.length > 0 && adminIds.includes(userId)) ||
      (!!adminChat && String(msg.chat.id) === String(adminChat));

    // Admin reply relay: "/reply <userId> <message>" → DM that user via the bot.
    if (isAdmin && text.startsWith('/reply')) {
      const m = text.match(/^\/reply\s+(\d+)\s+([\s\S]+)$/);
      if (!m) {
        await tg('sendMessage', { chat_id: msg.chat.id, text: 'Usage: /reply <userId> <message>' });
      } else {
        // Auto-translate your reply into the user's language (from their ticket).
        const { rows } = await sql`SELECT support_lang FROM users WHERE id = ${m[1]} LIMIT 1;`;
        const lang = (rows[0]?.support_lang as string) || '';
        let body = escapeHtml(m[2]);
        if (lang && lang !== 'en') {
          const tr = await translateText(m[2], lang);
          if (tr) body = `${escapeHtml(tr.text)}\n\n<i>(EN: ${escapeHtml(m[2])})</i>`;
        }
        const ok = await sendBotMessage(m[1], `💬 <b>Moola Support</b>\n\n${body}`);
        await tg('sendMessage', {
          chat_id: msg.chat.id,
          text: ok ? `✅ Sent to ${m[1]}${lang && lang !== 'en' ? ` (translated → ${lang})` : ''}` : `⚠️ Could not reach ${m[1]}`,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // "/support" or "/help" opens the self-service menu.
    if (text.startsWith('/support') || text.startsWith('/help')) {
      await sendSupportMenu(msg.chat.id);
      return NextResponse.json({ ok: true });
    }

    // If the user armed "Message a human", forward this one message (text and/or
    // a screenshot) to admin as a ticket.
    const photo = Array.isArray(msg.photo) && msg.photo.length ? msg.photo[msg.photo.length - 1] : null;
    const body = (text.trim() || msg.caption || '').trim();
    if ((body || photo) && !text.startsWith('/')) {
      const { rows } = await sql`SELECT support_until FROM users WHERE id = ${userId} LIMIT 1;`;
      const until = rows[0]?.support_until != null ? Number(rows[0].support_until) : 0;
      if (until > Date.now()) {
        // Translate the ticket to English (best-effort) and remember the user's
        // language so replies can be auto-translated back to it.
        const tr = body ? await translateText(body, 'en') : null;
        const lang = tr?.src && tr.src !== 'en' ? tr.src : null;
        await sql`UPDATE users SET support_until = NULL, support_lang = ${lang} WHERE id = ${userId};`;
        if (adminChat) {
          const who = from.username ? `@${from.username}` : from.first_name || userId;
          const msgPart = !body
            ? '<i>(screenshot only)</i>'
            : tr && lang
              ? `🌐 <b>EN:</b> ${escapeHtml(tr.text)}\n\n<i>Original (${escapeHtml(lang)}):</i> ${escapeHtml(body)}`
              : escapeHtml(body);
          const caption =
            `🆘 <b>Support ticket</b>\n\nFrom: <b>${escapeHtml(who)}</b> (<code>${userId}</code>)\n\n` +
            `${msgPart}\n\n<i>Reply with</i> <code>/reply ${userId} your message</code>`;
          if (photo) {
            await tg('sendPhoto', { chat_id: adminChat, photo: photo.file_id, caption, parse_mode: 'HTML' });
          } else {
            await tg('sendMessage', { chat_id: adminChat, parse_mode: 'HTML', disable_web_page_preview: true, text: caption });
          }
        }
        await tg('sendMessage', {
          chat_id: msg.chat.id,
          parse_mode: 'HTML',
          text: '✅ <b>Sent to support.</b> We’ll get back to you here as soon as we can. 🐮',
        });
        return NextResponse.json({ ok: true });
      }
    }
  }

  // Always 200 so Telegram doesn't retry.
  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'moola-bot-webhook' });
}
