import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql } from '@/lib/db';
import { scanWallet } from '@/lib/ton';
import { atfMultiplier } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Basic TON address sanity check (UQ/EQ base64url, 48 chars). */
function looksLikeTon(addr: string): boolean {
  return /^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(addr) || /^-?\d+:[0-9a-fA-F]{64}$/.test(addr);
}

/** Connect a wallet (or re-scan the current one) and refresh ATF/MOOLA holdings. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { address } = await req.json().catch(() => ({}));
  const addr = String(address ?? ctx.user.wallet ?? '').trim();
  if (!looksLikeTon(addr)) return badRequest('invalid TON address');

  const { atfUsd, moolaOnchain } = await scanWallet(addr);
  const mult = atfMultiplier(atfUsd);

  await sql`
    UPDATE users
    SET wallet = ${addr}, atf_usd = ${atfUsd}, atf_mult = ${mult}, moola_onchain = ${moolaOnchain}
    WHERE id = ${ctx.user.id};
  `;
  return userResponse(ctx.user.id);
}
