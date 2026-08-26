import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, credit, getUser, dayKey, nowMs } from '@/lib/db';
import { game } from '@/lib/config';
import { referralEarn } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const u = await getUser(ctx.user.id);
  if (!u) return unauthorized();

  const now = nowMs();
  const today = dayKey(now);
  if (u.checkin_at && dayKey(u.checkin_at) === today) {
    return badRequest('already checked in today');
  }

  const rewards = game.checkin.rewards;
  const resetMs = game.checkin.resetHours * 60 * 60 * 1000;

  let day: number;
  if (!u.checkin_at || now - u.checkin_at > resetMs || u.checkin_day >= rewards.length) {
    day = 1; // streak broken or completed a full cycle -> restart
  } else {
    day = u.checkin_day + 1;
  }
  const reward = rewards[day - 1];

  // Guard: at most one check-in per UTC day.
  const todayStart = Date.parse(`${today}T00:00:00.000Z`);
  const { rowCount } = await sql`
    UPDATE users SET checkin_day = ${day}, checkin_at = ${now}
    WHERE id = ${u.id} AND (checkin_at IS NULL OR checkin_at < ${todayStart});
  `;
  if (!rowCount) return badRequest('already checked in today');

  await credit(u.id, reward, 'checkin', `Daily Check-In · Day ${day}`);
  await referralEarn(u.id, reward);

  return userResponse(u.id, { day, reward });
}
