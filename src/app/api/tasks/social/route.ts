import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse, channelBlock, json } from '@/lib/api';
import { sql, credit, nowMs, getCustomTaskById } from '@/lib/db';
import { game } from '@/lib/config';
import { onUserEarned } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  const gate = await channelBlock(ctx.user.id);
  if (gate) return gate;

  const { taskId } = await req.json().catch(() => ({}));
  // Built-in tasks live in game.social; admin-added ones live in custom_tasks.
  // Both credit into the same social_tasks completion table, keyed by id.
  const builtin = game.social.find((s) => s.id === taskId);
  const custom = builtin ? null : await getCustomTaskById(String(taskId ?? ''));
  const task = builtin ?? (custom && custom.active
    ? { id: custom.id, title: custom.title, reward: custom.reward, kind: 'custom' as const }
    : null);
  if (!task) return badRequest('unknown task');

  // A channel-join task pays only after Telegram CONFIRMS membership. Stricter
  // than the general gate: an 'unknown' (bot not admin / API hiccup) does not
  // credit, so nobody is paid without a verified join.
  if (task.kind === 'channel') {
    const { channelGateEnabled, channelMembership } = await import('@/lib/telegramBot');
    if (channelGateEnabled() && (await channelMembership(ctx.user.id)) !== 'member') {
      return json({ needsChannel: true, channelUrl: process.env.NEXT_PUBLIC_CHANNEL_URL || '' });
    }
  }

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
