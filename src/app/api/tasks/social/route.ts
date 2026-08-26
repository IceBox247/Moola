import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, credit, nowMs } from '@/lib/db';
import { game } from '@/lib/config';
import { onUserEarned } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { taskId } = await req.json().catch(() => ({}));
  const task = game.social.find((s) => s.id === taskId);
  if (!task) return badRequest('unknown task');

  // Insert once; ON CONFLICT prevents double reward.
  const { rowCount } = await sql`
    INSERT INTO social_tasks (user_id, task_id, done_at)
    VALUES (${ctx.user.id}, ${task.id}, ${nowMs()})
    ON CONFLICT (user_id, task_id) DO NOTHING;
  `;

  if (rowCount && task.reward > 0) {
    await credit(ctx.user.id, task.reward, 'social', task.title);
    await onUserEarned(ctx.user.id);
  }

  return userResponse(ctx.user.id, { credited: !!rowCount && task.reward > 0, reward: task.reward });
}
