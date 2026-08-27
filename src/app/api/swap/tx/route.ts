import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, json } from '@/lib/api';
import { buildBuyMoolaTx } from '@/lib/stonfi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Build the on-chain swap message for buying MOOLA with the native coin.
 * The client signs the returned message with the user's connected wallet, so
 * no keys ever touch the server.
 *
 * NB: this route lives at /api/swap/tx (not /build) because a `build/` entry in
 * .gitignore was silently excluding a `build/` route directory from commits.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { ton, address } = await req.json().catch(() => ({}));
  const amt = Number(ton);
  if (!Number.isFinite(amt) || amt <= 0) return badRequest('invalid amount');
  if (!address || typeof address !== 'string') return badRequest('connect your wallet first');

  const offerNano = String(BigInt(Math.round(amt * 1e9)));
  try {
    const { message, quote } = await buildBuyMoolaTx(address, offerNano);
    return json({ message, minMoola: quote.minMoola, askMoola: quote.askMoola });
  } catch (e) {
    return badRequest((e as Error).message || 'could not build swap');
  }
}
