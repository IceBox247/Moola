import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql } from '@/lib/db';
import { game } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unlock the app once all required social tasks are done. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const required = game.social.filter((s) => 'required' in s && s.required).map((s) => s.id);
  const { rows } = await sql`SELECT task_id FROM social_tasks WHERE user_id = ${ctx.user.id};`;
  const done = new Set(rows.map((r) => String(r.task_id)));
  const allDone = required.every((id) => done.has(id));
  if (!allDone) return badRequest('complete required steps first');

  await sql`UPDATE users SET onboarded = TRUE WHERE id = ${ctx.user.id};`;
  return userResponse(ctx.user.id);
}
