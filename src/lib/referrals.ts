import { sql, credit, getUser } from './db';
import { game } from './config';

/**
 * Pay the inviter their commission whenever a referred friend earns MOOLA.
 * Call this AFTER crediting the friend, with the positive amount the friend
 * just earned. The inviter receives `commissionPct`% of it (minted on top —
 * the friend keeps their full amount). Lifetime, uncapped, direct referrals.
 */
export async function referralEarn(userId: string, amount: number): Promise<void> {
  if (!amount || amount <= 0) return;
  const u = await getUser(userId);
  if (!u || !u.referred_by) return;

  const commission = Math.round(amount * game.referral.commissionPct) / 100;
  if (commission <= 0) return;

  await credit(
    u.referred_by,
    commission,
    'referral',
    `${game.referral.commissionPct}% from ${u.first_name}`
  );
}

export async function friendSummary(userId: string) {
  const { rows } = await sql`
    SELECT first_name, lifetime, created_at
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
      name: String(r.first_name),
      earning: Number(r.lifetime) > 0,
      earned: Math.round(Number(r.lifetime) * 100) / 100,
      joinedAt: Number(r.created_at),
    })),
  };
}
