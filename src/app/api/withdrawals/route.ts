import { NextRequest } from 'next/server';
import { authed, unauthorized, json } from '@/lib/api';
import { listWithdrawals } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's recent withdrawals with live payout status. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  const items = await listWithdrawals(ctx.user.id, 10);
  return json({ items });
}
