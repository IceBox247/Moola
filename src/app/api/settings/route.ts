import { NextRequest } from 'next/server';
import { authed, unauthorized, userResponse } from '@/lib/api';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { soundFx } = await req.json().catch(() => ({}));
  if (typeof soundFx === 'boolean') {
    await sql`UPDATE users SET sound_fx = ${soundFx} WHERE id = ${ctx.user.id};`;
  }
  return userResponse(ctx.user.id);
}
