import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, credit, getUser, dayKey } from '@/lib/db';
import { game } from '@/lib/config';
import { ensureAdDay } from '@/lib/state';
import { referralEarn } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { type } = await req.json().catch(() => ({}));
  if (type !== 'watch' && type !== 'verify') return badRequest('bad ad type');

  let u = await getUser(ctx.user.id);
  if (!u) return unauthorized();
  u = await ensureAdDay(u);

  const today = dayKey();
  const cfg = type === 'watch' ? game.ads.watch : game.ads.verify;
  const current = type === 'watch' ? u.ads_watched : u.ads_verified;

  if (current >= cfg.count) return badRequest('daily limit reached');

  // Increment atomically, guarded by cap and current day.
  const { rowCount } =
    type === 'watch'
      ? await sql`UPDATE users SET ads_watched = ads_watched + 1
                  WHERE id = ${u.id} AND ads_day = ${today} AND ads_watched < ${cfg.count};`
      : await sql`UPDATE users SET ads_verified = ads_verified + 1
                  WHERE id = ${u.id} AND ads_day = ${today} AND ads_verified < ${cfg.count};`;

  if (!rowCount) return badRequest('daily limit reached');

  await credit(u.id, cfg.reward, type === 'watch' ? 'watch_ad' : 'verify_ad', cfg.label);
  await referralEarn(u.id, cfg.reward);

  return userResponse(u.id, { reward: cfg.reward });
}
