import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse, json } from '@/lib/api';
import { sql, nowMs } from '@/lib/db';
import { maybeRescan } from '@/lib/state';
import { channelGateEnabled, channelMembership } from '@/lib/telegramBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  // Channel gate: you must be in the official Telegram channel to mine. Only a
  // Telegram-confirmed "not a member" blocks — an API error/outage lets mining
  // proceed so a hiccup never freezes everyone. (Requires the bot to be a
  // channel admin.)
  if (channelGateEnabled()) {
    const m = await channelMembership(ctx.user.id);
    if (m === 'not_member') {
      return json({ needsChannel: true, channelUrl: process.env.NEXT_PUBLIC_CHANNEL_URL || '' });
    }
  }

  // Verify current ATF/MOOLA holdings at session start.
  await maybeRescan(ctx.user, true);

  // Start a fresh, checkpointed session if idle.
  const now = nowMs();
  await sql`
    UPDATE users
    SET mining_started_at = ${now}, mining_settled_at = ${now}, mining_accrued = 0
    WHERE id = ${ctx.user.id} AND mining_started_at IS NULL;
  `;
  return userResponse(ctx.user.id);
}
