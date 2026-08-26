import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { ensureAdDay, maybeRescan } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  const u = await ensureAdDay(ctx.user);
  // Re-verify ATF/MOOLA holdings periodically so a sold boost reverts.
  await maybeRescan(u);
  return userResponse(ctx.user.id);
}
