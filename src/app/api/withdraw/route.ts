import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse, json } from '@/lib/api';
import { sql, getUser, addTx, nowMs, withdrawnTotal, freeWithdrawAvailable, markFreeWithdrawal } from '@/lib/db';
import { game } from '@/lib/config';
import { runPayouts } from '@/lib/payoutWorker';
import { verifyWithdrawFee } from '@/lib/withdrawFee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const payer = String(body.payer ?? '').trim(); // connected wallet that pays the fee

  if (!Number.isFinite(amount) || amount <= 0) return badRequest('invalid amount');
  if (amount < game.withdraw.min) return badRequest(`minimum withdrawal is ${game.withdraw.min} MOOLA`);
  if (!address) return badRequest('enter your TON address');

  // Verification gate: once a user's total withdrawn (queued + paid) crosses the
  // threshold, they must be verified. Blocks the request without debiting.
  if (!ctx.user.verified) {
    const already = await withdrawnTotal(ctx.user.id);
    if (amount > game.withdraw.verifyThreshold || already + amount > game.withdraw.verifyThreshold) {
      return json({ needsVerification: true, verifyStatus: ctx.user.verify_status });
    }
  }

  // Free-withdrawal limit: the first withdrawal each 24h is free; any extra one
  // inside the window requires a small on-chain fee to the treasury. We verify
  // the fee actually landed on-chain (claimed once) BEFORE debiting anything.
  const free = freeWithdrawAvailable(ctx.user);
  if (!free) {
    const fee = await verifyWithdrawFee(ctx.user.id, payer);
    if (!fee.ok) {
      if ('needsPay' in fee) {
        return json({
          needsFee: true,
          feeUsd: fee.feeUsd,
          feeTon: fee.feeTon,
          feeNanoTon: fee.feeNanoTon,
          treasury: fee.treasury,
        });
      }
      return json({ feePending: true, error: fee.error });
    }
  }

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
  // Only a FREE withdrawal starts the 24h clock; a fee-paid one leaves it be.
  if (free) await markFreeWithdrawal(ctx.user.id);

  // Attempt the on-chain payout right away (best effort). If the wallet isn't
  // configured or the send fails, the row stays queued and the cron sweep +
  // retry/refund logic handles it — the response never fails on payout error.
  await runPayouts(1).catch(() => {});

  const u = await getUser(ctx.user.id);
  return userResponse(ctx.user.id, { requested: amount, balance: u?.balance ?? 0 });
}
