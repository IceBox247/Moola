import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, json } from '@/lib/api';
import { sql, getUser, nowMs } from '@/lib/db';
import { sendBotMessage } from '@/lib/telegramBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THROTTLE_MS = 6 * 60 * 60 * 1000; // one reminder per friend per 6h

/** Send a Telegram nudge from the bot to one of your referred friends. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { friendId } = await req.json().catch(() => ({}));
  const friend = await getUser(String(friendId ?? ''));
  if (!friend || friend.referred_by !== ctx.user.id) return badRequest('not your friend');

  // Throttle so friends don't get spammed.
  const { rows } = await sql`SELECT reminded_at FROM users WHERE id = ${friend.id};`;
  const last = rows[0]?.reminded_at != null ? Number(rows[0].reminded_at) : 0;
  const now = nowMs();
  if (last && now - last < THROTTLE_MS) {
    return badRequest('You already reminded them recently — try again later.');
  }

  const text =
    `🐮 <b>${ctx.user.first_name}</b> is nudging you!\n\n` +
    `Your MOOLA rig is waiting — come mine, do your daily tasks and claim your rewards. 💚`;
  const sent = await sendBotMessage(friend.id, text);

  await sql`UPDATE users SET reminded_at = ${now} WHERE id = ${friend.id};`;
  return json({ sent });
}
