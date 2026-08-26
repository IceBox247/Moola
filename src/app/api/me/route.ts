import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { ensureAdDay } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  await ensureAdDay(ctx.user);
  return userResponse(ctx.user.id);
}
