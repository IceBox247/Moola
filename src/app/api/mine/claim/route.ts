import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, credit, getUser } from '@/lib/db';
import { pendingMining } from '@/lib/state';
import { onFriendMined, onUserEarned } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Claim the current mining session. You can claim at any time; you receive the
 * MOOLA accrued so far (capped at the 8h session), then mining stops until you
 * start again.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const u = await getUser(ctx.user.id);
  if (!u || !u.mining_started_at) return badRequest('no active mining session');

  const earned = pendingMining(u);

  // Clear the session atomically; only proceed if it was still active.
  const { rowCount } = await sql`
    UPDATE users SET mining_started_at = NULL
    WHERE id = ${u.id} AND mining_started_at IS NOT NULL;
  `;
  if (!rowCount) return badRequest('already claimed');

  if (earned > 0) {
    await credit(u.id, +earned.toFixed(4), 'mining', 'Mining reward');
    await onFriendMined(u.id, +earned.toFixed(4)); // 5% mining commission to inviter
    await onUserEarned(u.id); // first-task bonus if this is their first earn
  }

  return userResponse(u.id, { claimed: +earned.toFixed(4) });
}
