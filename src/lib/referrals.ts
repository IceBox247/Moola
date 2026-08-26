import { sql, credit, getUser, dayKey } from './db';
import { game } from './config';

/**
 * One-time: the first time a referred friend earns anything, the inviter gets
 * the firstTaskReward.
 */
export async function onUserEarned(userId: string): Promise<void> {
  const u = await getUser(userId);
  if (!u || !u.referred_by || u.ref_first_done) return;

  const { rowCount } = await sql`
    UPDATE users SET ref_first_done = TRUE
    WHERE id = ${userId} AND ref_first_done = FALSE;
  `;
  if (rowCount) {
    await credit(u.referred_by, game.referral.firstTaskReward, 'referral', `Friend's first task`);
  }
}

/** When a friend finishes ALL daily ads, the inviter gets a bonus once/day. */
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

/**
 * Lifetime 5% commission on a friend's MINED MOOLA. Call after crediting a
 * mining claim with the mined amount. Minted on top — the friend keeps 100%.
 */
export async function onFriendMined(userId: string, minedAmount: number): Promise<void> {
  if (!minedAmount || minedAmount <= 0) return;
  const u = await getUser(userId);
  if (!u || !u.referred_by) return;

  const commission = Math.round(minedAmount * game.referral.miningCommissionPct) / 100;
  if (commission <= 0) return;

  await credit(
    u.referred_by,
    commission,
    'referral',
    `${game.referral.miningCommissionPct}% mining from ${u.first_name}`
  );
}

export async function friendSummary(userId: string) {
  const { rows } = await sql`
    SELECT id, first_name, lifetime, created_at
    FROM users WHERE referred_by = ${userId}
    ORDER BY lifetime DESC, created_at DESC;
  `;
  const earnedRow = await sql`
    SELECT COALESCE(SUM(amount),0) AS s FROM transactions
    WHERE user_id = ${userId} AND kind = 'referral';
  `;
  return {
    invited: rows.length,
    earning: rows.filter((r) => Number(r.lifetime) > 0).length,
    earned: Math.round(Number(earnedRow.rows[0].s) * 100) / 100,
    friends: rows.map((r) => ({
      id: String(r.id),
      name: String(r.first_name),
      earning: Number(r.lifetime) > 0,
      earned: Math.round(Number(r.lifetime) * 100) / 100,
      joinedAt: Number(r.created_at),
    })),
  };
}
