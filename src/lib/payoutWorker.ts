import { Address } from '@ton/core';
import { sql, addTx, nowMs } from './db';
import { sendMoola, payoutConfigured, hotWalletAddress } from './payout';
import { moolaBalanceOf, moolaTransfersFrom } from './ton';

const MAX_ATTEMPTS = 5;
// Only reconcile review rows at least this old, so a genuinely slow (but
// successful) transfer has had time to confirm before we consider a refund.
const RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;
// Don't reach back further than this — keeps the on-chain history window able
// to cover every candidate, so "no successful transfer found" is trustworthy.
const RECONCILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type ReconcileResult = { checked: number; refunded: number; confirmedPaid: number; skipped?: string };
export type PayoutRun = { processed: number; paid: number; failed: number; skipped?: string; reconciled?: ReconcileResult };

function normAddr(a: string): string | null {
  try {
    return Address.parse(a).toRawString().toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Process queued withdrawals: claim one 'pending' row at a time (atomically, so
 * it can never be paid twice), send the MOOLA, and settle the row. On a
 * permanent failure the debited balance is refunded to the user. Finishes with
 * a reconciliation pass that refunds any withdrawals whose on-chain transfer
 * failed (e.g. the hot wallet ran out of gas and the transfer bounced).
 */
export async function runPayouts(limit = 5): Promise<PayoutRun> {
  if (!payoutConfigured()) return { processed: 0, paid: 0, failed: 0, skipped: 'not configured' };

  let processed = 0;
  let paid = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    // Atomically claim the oldest pending row (SKIP LOCKED lets parallel runs
    // coexist). Moving it to 'processing' guarantees single processing.
    const { rows } = await sql`
      UPDATE withdrawals
      SET status = 'processing', attempts = attempts + 1, processed_at = ${nowMs()}
      WHERE id = (
        SELECT id FROM withdrawals
        WHERE status = 'pending' AND attempts < ${MAX_ATTEMPTS}
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, user_id, amount, address, attempts;
    `;
    if (!rows.length) break;

    const row = rows[0] as { id: number; user_id: string; amount: number; address: string; attempts: number };
    processed++;

    const res = await sendMoola(row.address, Number(row.amount));

    if (res.ok) {
      await sql`
        UPDATE withdrawals SET status = 'paid', tx_hash = ${`seqno:${res.seqno}`}, last_error = NULL
        WHERE id = ${row.id};
      `;
      paid++;
    } else if (res.fundIssue) {
      // Hot wallet needs topping up (no MOOLA / no gas) — nothing was broadcast.
      // Keep the withdrawal queued WITHOUT consuming a retry (roll the attempt
      // back) so it pays automatically once the wallet is funded, instead of
      // eventually being refunded away or bouncing on-chain.
      await sql`
        UPDATE withdrawals SET status = 'pending', attempts = attempts - 1, last_error = ${res.error}
        WHERE id = ${row.id};
      `;
      failed++;
    } else if (!res.refundable) {
      // Payout may have broadcast — never auto-retry or refund here (double-pay
      // risk). Park it for the reconciliation pass, which verifies on-chain.
      await sql`UPDATE withdrawals SET status = 'review', last_error = ${res.error} WHERE id = ${row.id};`;
      failed++;
    } else if (row.attempts >= MAX_ATTEMPTS) {
      // Definitely did not send, out of retries — refund so no funds are lost.
      await sql`UPDATE users SET balance = balance + ${row.amount} WHERE id = ${row.user_id};`;
      await addTx(row.user_id, 'refund', Number(row.amount), 'Withdrawal refunded (payout failed)');
      await sql`UPDATE withdrawals SET status = 'failed', last_error = ${res.error} WHERE id = ${row.id};`;
      failed++;
    } else {
      // Definitely did not send — safe to requeue for the next run.
      await sql`UPDATE withdrawals SET status = 'pending', last_error = ${res.error} WHERE id = ${row.id};`;
      failed++;
    }
  }

  const reconciled = await reconcileReview().catch(() => undefined);
  return { processed, paid, failed, reconciled };
}

/**
 * Reconcile withdrawals stuck in 'review' — ones that were broadcast but whose
 * success we couldn't confirm inline (typically because the hot wallet was out
 * of gas and the transfer bounced). We check the hot wallet's on-chain MOOLA
 * transfer history and its current MOOLA balance to decide safely:
 *
 *   • A matching SUCCESSFUL on-chain transfer  → the user was paid → mark 'paid'
 *     (never refunded — that would double-pay).
 *   • No successful transfer, and the hot wallet still holds enough MOOLA to
 *     cover the outstanding amount (proof the MOOLA never left) → refund the
 *     user's in-app balance and mark 'failed'.
 *   • Anything we can't verify → left in 'review' for manual handling.
 */
export async function reconcileReview(): Promise<ReconcileResult> {
  if (!payoutConfigured()) return { checked: 0, refunded: 0, confirmedPaid: 0, skipped: 'not configured' };

  const now = nowMs();
  const { rows } = await sql`
    SELECT id, user_id, amount, address, created_at
    FROM withdrawals
    WHERE status = 'review' AND created_at >= ${now - RECONCILE_MAX_AGE_MS}
    ORDER BY created_at ASC
    LIMIT 100;
  `;
  if (!rows.length) return { checked: 0, refunded: 0, confirmedPaid: 0 };

  const hot = await hotWalletAddress();
  if (!hot) return { checked: rows.length, refunded: 0, confirmedPaid: 0, skipped: 'no hot wallet' };
  const hotNorm = normAddr(hot);

  // On-chain outgoing transfers (may be null if the history can't be fetched)
  // and the hot wallet's current MOOLA balance — our two independent signals.
  const [moves, hotBalance] = await Promise.all([moolaTransfersFrom(hot), moolaBalanceOf(hot)]);

  type Row = { id: number; user_id: string; amount: number; address: string; created_at: number };
  const cands = rows.map((r) => ({
    id: Number(r.id),
    user_id: String(r.user_id),
    amount: Number(r.amount),
    address: String(r.address),
    created_at: Number(r.created_at),
  })) as Row[];

  let refunded = 0;
  let confirmedPaid = 0;
  const toRefund: Row[] = [];

  for (const r of cands) {
    const dest = normAddr(r.address);
    // A transfer matches this row if it went to the same address for ~the same
    // amount at/after the row was created.
    const matches = (moves ?? []).filter(
      (m) =>
        (!hotNorm || normAddr(m.from) === hotNorm) &&
        dest &&
        normAddr(m.to) === dest &&
        Math.abs(m.amount - r.amount) <= 0.5 &&
        m.time >= r.created_at - 5 * 60 * 1000
    );
    if (matches.some((m) => m.ok)) {
      // Confirmed delivered on-chain — settle as paid, never refund.
      await sql`UPDATE withdrawals SET status = 'paid', last_error = NULL WHERE id = ${r.id};`;
      confirmedPaid++;
      continue;
    }
    if (now - r.created_at < RECONCILE_MIN_AGE_MS) continue; // give slow transfers time
    toRefund.push(r);
  }

  // Refund the candidates only if the MOOLA provably never left: the hot wallet
  // still holds at least their combined amount. This guards against a delivered
  // transfer that (rarely) fell outside the fetched history window.
  const outstanding = toRefund.reduce((s, r) => s + r.amount, 0);
  if (toRefund.length && hotBalance + 0.5 >= outstanding) {
    for (const r of toRefund) {
      await sql`UPDATE users SET balance = balance + ${r.amount} WHERE id = ${r.user_id};`;
      await addTx(r.user_id, 'refund', r.amount, 'Withdrawal refunded (transfer failed on-chain)');
      await sql`
        UPDATE withdrawals SET status = 'failed', last_error = 'refunded: on-chain transfer failed'
        WHERE id = ${r.id};
      `;
      refunded++;
    }
  }

  return { checked: cands.length, refunded, confirmedPaid };
}
