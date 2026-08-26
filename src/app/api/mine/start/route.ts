import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { sql, nowMs } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  // Only start if idle (no active session).
  await sql`
    UPDATE users SET mining_started_at = ${nowMs()}
    WHERE id = ${ctx.user.id} AND mining_started_at IS NULL;
  `;
  return userResponse(ctx.user.id);
}
