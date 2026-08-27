import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, json } from '@/lib/api';
import { fetchTonBalance } from '@/lib/ton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live native-coin (TON / GRAM) balance of the caller's connected wallet. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { address } = await req.json().catch(() => ({}));
  const addr = typeof address === 'string' && address ? address : ctx.user.wallet;
  if (!addr) return badRequest('no wallet connected');

  const ton = await fetchTonBalance(addr);
  return json({ ton });
}
