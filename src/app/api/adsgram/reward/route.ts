import { NextRequest, NextResponse } from 'next/server';
import { creditBotAd } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Adsgram "Reward URL" postback for Telegram-BOT ads. Adsgram's servers call
 * this (server-to-server) when a user finishes a bot ad, substituting the
 * {userid} macro with the user's Telegram id. We credit the user (capped per
 * day) and return 200.
 *
 * Configure the block's Reward URL in the Adsgram dashboard as:
 *   https://<host>/api/adsgram/reward?userid={userid}&token=<ADSGRAM_REWARD_SECRET>
 *
 * The token is a shared secret (env ADSGRAM_REWARD_SECRET) so only Adsgram can
 * trigger rewards. Adsgram also sends its own params (e.g. hash) which we ignore.
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const secret = process.env.ADSGRAM_REWARD_SECRET || '';
  const token = url.searchParams.get('token') || '';
  // Require the shared secret when one is configured.
  if (secret && token !== secret) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // Adsgram substitutes {userid}; accept a few common param names to be safe.
  const userId = (
    url.searchParams.get('userid') ||
    url.searchParams.get('user_id') ||
    url.searchParams.get('tg_id') ||
    ''
  ).trim();
  if (!/^\d+$/.test(userId)) {
    return NextResponse.json({ ok: false, error: 'invalid userid' }, { status: 400 });
  }

  const res = await creditBotAd(userId).catch(() => ({ credited: false, reason: 'error' }));
  // Always 200 so Adsgram doesn't keep retrying; report the outcome in the body.
  return NextResponse.json({ ok: true, credited: res.credited, reason: res.reason });
}

export const GET = handle;
export const POST = handle;
