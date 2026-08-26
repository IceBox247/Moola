import { NextRequest } from 'next/server';
import { authed, unauthorized, json } from '@/lib/api';
import { friendSummary } from '@/lib/referrals';
import { env, game } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const summary = await friendSummary(ctx.user.id);
  const inviteLink = `https://t.me/${env.BOT_USERNAME}?start=${ctx.user.id}`;

  return json({
    ...summary,
    inviteLink,
    commissionPct: game.referral.commissionPct,
  });
}
