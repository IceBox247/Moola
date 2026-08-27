import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, json } from '@/lib/api';
import { quoteBuyMoola } from '@/lib/stonfi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Estimate how much MOOLA a given amount of native coin (TON/GRAM) buys. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { ton } = await req.json().catch(() => ({}));
  const amt = Number(ton);
  if (!Number.isFinite(amt) || amt <= 0) return badRequest('invalid amount');

  const offerNano = String(BigInt(Math.round(amt * 1e9)));
  try {
    const quote = await quoteBuyMoola(offerNano);
    return json({ askMoola: quote.askMoola, minMoola: quote.minMoola });
  } catch (e) {
    return badRequest((e as Error).message || 'no route for this pair yet');
  }
}
