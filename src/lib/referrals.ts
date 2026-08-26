import { sql, credit, dayKey, getUser } from './db';
import { game } from './config';

/**
 * The first time a referred user earns anything, their inviter gets the
 * "first task" reward.
 */
export async function onUserEarned(userId: string): Promise<void> {
  const u = await getUser(userId);
  if (!u || !u.referred_by || u.ref_first_done) return;

  // Guard against double-pay with a conditional update.
  const { rowCount } = await sql`
    UPDATE users SET ref_first_done = TRUE
    WHERE id = ${userId} AND ref_first_done = FALSE;
  `;
  if (rowCount) {
    await credit(u.referred_by, game.referral.firstTaskReward, 'referral', `Friend's first task`);
  }
}

/** When a user finishes ALL daily ads, inviter gets a bonus once per day. */
export async function onFriendFinishedAllAds(userId: string): Promise<void> {
  const u = await getUser(userId);
  if (!u || !u.referred_by) return;
  const today = dayKey();
  if (u.ads_all_bonus_day === today) return;

  const { rowCount } = await sql`
    UPDATE users SET ads_all_bonus_day = ${today}
    WHERE id = ${userId} AND (ads_all_bonus_day IS DISTINCT FROM ${today});
  `;
  if (rowCount) {
    await credit(u.referred_by, game.referral.allAdsBonus, 'referral', `Friend finished all daily ads`);
  }
}

export async function friendSummary(userId: string) {
  const { rows } = await sql`
    SELECT first_name, ref_first_done, created_at
    FROM users WHERE referred_by = ${userId}
    ORDER BY created_at DESC;
  `;
  const earnedRow = await sql`
    SELECT COALESCE(SUM(amount),0) AS s FROM transactions
    WHERE user_id = ${userId} AND kind = 'referral';
  `;
  return {
    invited: rows.length,
    earning: rows.filter((r) => Boolean(r.ref_first_done)).length,
    earned: Math.round(Number(earnedRow.rows[0].s) * 100) / 100,
    friends: rows.map((r) => ({
      name: String(r.first_name),
      earning: Boolean(r.ref_first_done),
      joinedAt: Number(r.created_at),
    })),
  };
}
