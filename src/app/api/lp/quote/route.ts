import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, json } from '@/lib/api';
import { lpAddQuote, lpRewardsEnabled } from '@/lib/lp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Guided add-liquidity quote: given a TON amount, return the matching MOOLA at
 * the pool ratio plus whether the user's connected wallet holds enough of both.
 * The client shows this, then sends the user to STON.fi to confirm the add.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  if (!lpRewardsEnabled()) return json({ disabled: true });

  const body = await req.json().catch(() => ({}));
  const ton = Number(body.ton);
  const wallet = String(body.wallet ?? ctx.user.wallet ?? '').trim();
  if (!wallet) return json({ needsWallet: true });
  if (!Number.isFinite(ton) || ton <= 0) return badRequest('enter a TON amount');

  const quote = await lpAddQuote(wallet, ton);
  if (!quote) return badRequest('could not price the pool right now — try again');
  return json(quote);
}
