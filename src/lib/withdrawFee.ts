import { Address } from '@ton/core';
import { game } from './config';
import { hotWalletAddress } from './payout';
import { moolaMarketStats } from './stonfi';
import { tonTransfersTo } from './ton';
import { consumeFee } from './db';

/**
 * On-chain verification of the extra-withdrawal fee. The user signs a small
 * TON transfer to the treasury (our hot/payout wallet) via TON Connect; here we
 * confirm it actually landed and claim it exactly once.
 *
 *  - ok:true            → a matching, unconsumed payment was found and claimed.
 *  - needsPay + quote   → no payment yet; the client should send `feeNanoTon`
 *                         to `treasury` and retry.
 *  - retry:true         → couldn't verify right now (price/tonapi hiccup);
 *                         safe to try again shortly, nothing was charged.
 */
export type FeeResult =
  | { ok: true }
  | { ok: false; needsPay: true; treasury: string; feeNanoTon: string; feeTon: number; feeUsd: number }
  | { ok: false; retry: true; error: string };

const MATCH_WINDOW_MS = 20 * 60 * 1000; // a fee payment counts if it landed in the last 20 min
const AMOUNT_TOLERANCE = 0.9; // accept ≥90% of the quote (TON price drifts between quote and pay)

function norm(a: string): string | null {
  try {
    return Address.parse(a).toRawString().toLowerCase();
  } catch {
    return null;
  }
}

export async function verifyWithdrawFee(userId: string, payerWallet: string): Promise<FeeResult> {
  const treasury = await hotWalletAddress();
  if (!treasury) return { ok: false, retry: true, error: 'treasury not configured' };

  const tonUsd = (await moolaMarketStats().catch(() => null))?.tonUsd ?? 0;
  if (!(tonUsd > 0)) return { ok: false, retry: true, error: 'price unavailable, try again' };

  const feeUsd = game.withdraw.extraFeeUsd;
  const feeTon = feeUsd / tonUsd;
  const quote = {
    ok: false as const,
    needsPay: true as const,
    treasury,
    feeNanoTon: String(Math.ceil(feeTon * 1e9)),
    feeTon: Math.round(feeTon * 1e6) / 1e6,
    feeUsd,
  };

  const payer = norm(payerWallet);
  if (!payer) return quote; // no usable payer yet → ask them to pay from a connected wallet

  const transfers = await tonTransfersTo(treasury);
  if (transfers === null) return { ok: false, retry: true, error: 'could not verify payment yet' };

  const now = Date.now();
  const min = feeTon * AMOUNT_TOLERANCE;
  for (const t of transfers) {
    if (!t.ok) continue;
    if (norm(t.from) !== payer) continue;
    if (t.amount < min) continue;
    if (now - t.time > MATCH_WINDOW_MS) continue;
    // Claim it — the INSERT is the lock, so one payment unlocks one withdrawal.
    if (await consumeFee(t.id, userId, t.amount)) return { ok: true };
  }
  return quote;
}
