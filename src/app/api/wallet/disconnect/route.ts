import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { sql, nowMs } from '@/lib/db';
import { settleMining } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Disconnect the wallet. Bank any mining accrued so far at the current rate,
 * then drop all on-chain holdings so the level falls back to the in-app balance
 * and the ATF boost reverts to 1×.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  await settleMining(ctx.user); // lock in what was mined while still verified
  await sql`
    UPDATE users
    SET wallet = NULL, atf_usd = 0, atf_mult = 1, moola_onchain = 0, last_scan_at = ${nowMs()}
    WHERE id = ${ctx.user.id};
  `;
  return userResponse(ctx.user.id);
}
