import { sql, addTx, nowMs } from './db';
import { sendMoola, payoutConfigured } from './payout';

const MAX_ATTEMPTS = 5;

export type PayoutRun = { processed: number; paid: number; failed: number; skipped?: string };

/**
 * Process queued withdrawals: claim one 'pending' row at a time (atomically, so
 * it can never be paid twice), send the MOOLA, and settle the row. On a
 * permanent failure the debited balance is refunded to the user.
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
    } else if (!res.refundable) {
      // Payout may have broadcast — never auto-retry or refund (double-pay risk).
      // Park it for manual review; balance stays debited until reconciled.
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

  return { processed, paid, failed };
}
