import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, getUser, addTx, nowMs } from '@/lib/db';
import { game } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record a withdrawal request. This debits the user's spendable balance and
 * queues a 'pending' withdrawal for an operator/payout worker to process.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const address = String(body.address ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) return badRequest('invalid amount');
  if (amount < game.withdraw.min) return badRequest(`minimum withdrawal is ${game.withdraw.min} MOOLA`);
  if (!address) return badRequest('enter your TON address');

  // Debit atomically only if the balance covers it.
  const { rowCount } = await sql`
    UPDATE users SET balance = balance - ${amount}
    WHERE id = ${ctx.user.id} AND balance >= ${amount};
  `;
  if (!rowCount) return badRequest('insufficient balance');

  await sql`
    INSERT INTO withdrawals (user_id, amount, address, status, created_at)
    VALUES (${ctx.user.id}, ${amount}, ${address}, 'pending', ${nowMs()});
  `;
  await addTx(ctx.user.id, 'withdraw', -amount, `Withdrawal to ${address.slice(0, 6)}…${address.slice(-4)}`);
  // Persist the address for convenience.
  await sql`UPDATE users SET wallet = ${address} WHERE id = ${ctx.user.id};`;

  const u = await getUser(ctx.user.id);
  return userResponse(ctx.user.id, { requested: amount, balance: u?.balance ?? 0 });
}
