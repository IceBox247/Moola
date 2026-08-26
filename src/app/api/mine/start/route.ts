import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { sql, nowMs } from '@/lib/db';
import { maybeRescan } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  // Verify current ATF/MOOLA holdings at session start.
  await maybeRescan(ctx.user, true);

  // Start a fresh, checkpointed session if idle.
  const now = nowMs();
  await sql`
    UPDATE users
    SET mining_started_at = ${now}, mining_settled_at = ${now}, mining_accrued = 0
    WHERE id = ${ctx.user.id} AND mining_started_at IS NULL;
  `;
  return userResponse(ctx.user.id);
}
