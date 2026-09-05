import { TonClient, WalletContractV4, WalletContractV5R1, JettonMaster, internal } from '@ton/ton';
import { Address, beginCell, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import { env } from './config';
import { moolaBalanceOf, fetchTonBalance } from './ton';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Automated MOOLA jetton payout from the project hot wallet.
 *
 * Security model:
 *  - The hot-wallet mnemonic lives only in WITHDRAW_WALLET_MNEMONIC (env) and is
 *    never logged or returned.
 *  - Callers (the payout worker) claim a withdrawal row atomically before
 *    calling this, so a payout is attempted at most once per row.
 *  - Fund the hot wallet with only as much MOOLA (+ a little TON for gas) as you
 *    are comfortable exposing.
 */

const MOOLA_DECIMALS = 9;
const JETTON_TRANSFER_OP = 0x0f8a7ea5;

// TON/GRAM attached to each jetton-transfer message. Excess returns to the hot
// wallet (response_destination), so this is only a ceiling/headroom — it does
// NOT drive the fee. 0.05 comfortably covers gas plus a first-time recipient
// jetton-wallet deploy. The gas pre-check below must agree with this value so we
// never broadcast a transfer that will bounce.
const MSG_VALUE_TON = 0.05;
// forward_ton_amount: the TON forwarded to the recipient to trigger their
// transfer-notification. Unlike MSG_VALUE_TON this is genuinely SPENT every
// payout (it does not return), so it is the single biggest lever on the fee the
// wallet displays. 1 nanoton is the standard minimum — enough to still trigger
// the recipient's notification while costing effectively nothing. (Raising this
// to e.g. 0.02 TON adds ~0.02 GRAM to every payout for no benefit.)
const FWD_VALUE_NANO = 1n; // 0.000000001 TON
// Minimum native (GRAM/TON) balance the hot wallet must hold to safely send one
// transfer: the message value plus fee/storage headroom.
const GAS_NEEDED_TON = MSG_VALUE_TON + 0.05;

export function payoutConfigured(): boolean {
  return !!process.env.WITHDRAW_WALLET_MNEMONIC && !!env.MOOLA_JETTON;
}

/**
 * The hot wallet's address, derived without any RPC call. Prefers the explicit
 * WITHDRAW_WALLET_ADDRESS you funded; otherwise derives it from the mnemonic at
 * the configured (or default v4) wallet version. Returns null if not configured.
 */
export async function hotWalletAddress(): Promise<string | null> {
  if (!process.env.WITHDRAW_WALLET_MNEMONIC) return null;
  const expected = (process.env.WITHDRAW_WALLET_ADDRESS || '').trim();
  if (expected) {
    try {
      return Address.parse(expected).toString();
    } catch {
      /* fall through to derive */
    }
  }
  const words = (process.env.WITHDRAW_WALLET_MNEMONIC || '').trim().split(/\s+/);
  const key = await mnemonicToPrivateKey(words);
  const version = (process.env.WITHDRAW_WALLET_VERSION || 'v4').toLowerCase();
  const wallet =
    version === 'v5' || version === 'v5r1'
      ? WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey })
      : WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  return wallet.address.toString();
}

let endpointPromise: Promise<string> | null = null;
function rpc(): Promise<string> {
  if (!endpointPromise) endpointPromise = getHttpEndpoint();
  return endpointPromise;
}

function toJettonUnits(amountMoola: number): bigint {
  // Round to whole nano-units to avoid float drift.
  return BigInt(Math.round(amountMoola * 10 ** MOOLA_DECIMALS));
}

async function openWallet(client: TonClient) {
  const words = (process.env.WITHDRAW_WALLET_MNEMONIC || '').trim().split(/\s+/);
  const key = await mnemonicToPrivateKey(words);
  const v4 = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const v5 = WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey });

  // Prefer the wallet version whose derived address matches the public address
  // you funded — so you never have to know the version. Fall back to an
  // explicit WITHDRAW_WALLET_VERSION, else default to v4 (Tonkeeper default).
  const expected = (process.env.WITHDRAW_WALLET_ADDRESS || '').trim();
  if (expected) {
    try {
      const want = Address.parse(expected).toString();
      if (v5.address.toString() === want) return { wallet: v5, secretKey: key.secretKey };
      if (v4.address.toString() === want) return { wallet: v4, secretKey: key.secretKey };
      throw new Error('WITHDRAW_WALLET_ADDRESS does not match the mnemonic (v4/v5)');
    } catch (e) {
      throw new Error((e as Error).message || 'bad WITHDRAW_WALLET_ADDRESS');
    }
  }
  const version = (process.env.WITHDRAW_WALLET_VERSION || 'v4').toLowerCase();
  const wallet = version === 'v5' || version === 'v5r1' ? v5 : v4;
  return { wallet, secretKey: key.secretKey };
}

// `refundable: true` means the payout definitely did NOT leave the wallet, so
// it is safe to retry or refund. `false` means it may have broadcast — never
// auto-retry (double-pay risk); route to manual review instead.
// `fundIssue: true` flags a transient "wallet needs topping up" condition (out
// of MOOLA or out of gas) — nothing was broadcast, so the worker keeps the
// withdrawal queued (rather than refunding it away) until the wallet is funded.
export type PayoutResult =
  | { ok: true; seqno: number }
  | { ok: false; error: string; refundable: boolean; fundIssue?: boolean };

/** Send `amountMoola` MOOLA to `toAddress`. Broadcasts one external message. */
export async function sendMoola(toAddress: string, amountMoola: number): Promise<PayoutResult> {
  if (!payoutConfigured()) return { ok: false, error: 'payout wallet not configured', refundable: true };
  let dest: Address;
  try {
    dest = Address.parse(toAddress);
  } catch {
    return { ok: false, error: 'invalid destination address', refundable: true };
  }
  if (!(amountMoola > 0)) return { ok: false, error: 'invalid amount', refundable: true };

  let broadcast = false;
  try {
    const client = new TonClient({ endpoint: await rpc() });
    const { wallet, secretKey } = await openWallet(client);
    const contract = client.open(wallet);
    const hot = wallet.address.toString();

    // Pre-flight balance checks — best effort ONLY. These read from tonapi,
    // which rate-limits Vercel's IP and then returns 0. A 0/unknown reading must
    // NOT block a payout (that would silently freeze every withdrawal on a
    // funded wallet); we only refuse to broadcast on a *confirmed* shortfall —
    // a real positive balance that's genuinely below what this payout needs.
    // Whatever slips through is still caught after sending by the balance-drop
    // verification below, so a bounced transfer is never marked paid.
    const before = await moolaBalanceOf(hot);
    if (before > 0 && before < amountMoola) {
      return {
        ok: false,
        error: `hot wallet MOOLA too low: has ${before.toFixed(2)}, needs ${amountMoola}. Fund the payout wallet with MOOLA.`,
        refundable: true,
        fundIssue: true,
      };
    }

    const gas = await fetchTonBalance(hot);
    if (gas > 0 && gas < GAS_NEEDED_TON) {
      return {
        ok: false,
        error: `hot wallet gas too low: has ${gas.toFixed(3)} GRAM, needs ~${GAS_NEEDED_TON}. Top up the payout wallet with GRAM.`,
        refundable: true,
        fundIssue: true,
      };
    }

    // Hot wallet's own MOOLA jetton wallet (source of the transfer).
    const master = client.open(JettonMaster.create(Address.parse(env.MOOLA_JETTON)));
    const jettonWallet = await master.getWalletAddress(wallet.address);

    const body = beginCell()
      .storeUint(JETTON_TRANSFER_OP, 32)
      .storeUint(BigInt(Date.now()), 64) // query_id
      .storeCoins(toJettonUnits(amountMoola)) // jetton amount
      .storeAddress(dest) // destination (the user)
      .storeAddress(wallet.address) // response destination — excess TON returns to hot wallet
      .storeBit(0) // no custom payload
      .storeCoins(FWD_VALUE_NANO) // forward TON (1 nanoton) — just triggers recipient's notification
      .storeBit(0) // empty forward payload
      .endCell();

    const seqno = await contract.getSeqno();
    const transfer = {
      seqno,
      secretKey,
      messages: [
        internal({
          to: jettonWallet,
          // Ceiling; unused TON returns to the hot wallet (response_destination).
          // Covers gas + a first-time recipient jetton-wallet deploy, so it
          // won't bounce; with a 1-nanoton forward the real cost is now only
          // ~0.005-0.01 TON/payout (gas), down from ~0.03-0.05.
          value: toNano(String(MSG_VALUE_TON)),
          body,
          bounce: true,
        }),
      ],
    };
    // V4 and V5R1 both accept this shape for an externally-signed transfer; the
    // union of their arg types needs a cast to satisfy TS.
    broadcast = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (contract as any).sendTransfer(transfer);

    // Confirm the MOOLA actually LEFT the hot wallet (balance dropped) before
    // reporting success — so a bounced transfer is never marked paid.
    for (let i = 0; i < 14; i++) {
      await sleep(2500);
      const now = await moolaBalanceOf(hot);
      if (now <= before - amountMoola + 0.5) return { ok: true, seqno };
    }
    // Broadcast but unconfirmed — could have bounced OR be slow. Never auto-retry.
    return { ok: false, error: 'transfer unconfirmed — needs manual review', refundable: false };
  } catch (e) {
    // Never leak the mnemonic/keys in error text.
    return { ok: false, error: (e as Error).message || 'payout failed', refundable: !broadcast };
  }
}

/** Wait (best effort) for the wallet seqno to advance past `fromSeqno`. */
export async function waitConfirmed(fromSeqno: number, timeoutMs = 25_000): Promise<boolean> {
  try {
    const client = new TonClient({ endpoint: await rpc() });
    const { wallet } = await openWallet(client);
    const contract = client.open(wallet);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const s = await contract.getSeqno();
      if (s > fromSeqno) return true;
      await new Promise((r) => setTimeout(r, 2500));
    }
  } catch {
    /* fall through */
  }
  return false;
}
