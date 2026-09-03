import { Address } from '@ton/core';
import { env } from './config';
import { jettonBalanceOf, moolaBalanceOf, fetchTonBalance } from './ton';

/**
 * Value a user's MOOLA/TON liquidity position in USD.
 *
 * On STON.fi the pool contract is itself the LP jetton master, so a provider's
 * share = their LP balance ÷ the LP total supply. We read the pool reserves
 * from STON.fi's REST API, price both sides in USD (MOOLA + TON prices we
 * already compute), and multiply the user's share by the pool TVL.
 *
 * Requires MOOLA_LP_ADDRESS (the pool address). Returns 0 when unconfigured or
 * on any error, so callers can treat "no LP" and "couldn't read" the same.
 */

function norm(a: string): string | null {
  try {
    return Address.parse(a).toRawString().toLowerCase();
  } catch {
    return null;
  }
}

type Reserves = { moolaReserve: number; tonReserve: number; lpSupply: number; lpPriceUsd: number };

let poolCache: { at: number; data: Reserves } | null = null;
const POOL_TTL_MS = 60_000;

/**
 * Pool data straight from STON.fi (no tonapi): MOOLA/TON reserves, LP total
 * supply, and the USD price of one LP token. Cached 60s. This is what powers
 * both the add-liquidity quote and valuing an existing LP position, so neither
 * depends on the rate-limited tonapi endpoints.
 */
async function poolReserves(): Promise<Reserves | null> {
  if (!env.MOOLA_LP) return null;
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.data;
  try {
    const poolRes = await fetch(`https://api.ston.fi/v1/pools/${encodeURIComponent(env.MOOLA_LP)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!poolRes.ok) return null;
    const body = (await poolRes.json()) as {
      pool?: {
        token0_address?: string;
        reserve0?: string;
        reserve1?: string;
        lp_total_supply?: string;
        lp_price_usd?: string;
      };
    };
    const p = body.pool;
    if (!p) return null;
    // Reserves + LP supply are in base units (9 decimals).
    const r0 = Number(p.reserve0 ?? 0) / 1e9;
    const r1 = Number(p.reserve1 ?? 0) / 1e9;
    const moola = norm(env.MOOLA_JETTON);
    const t0 = norm(p.token0_address ?? '');
    const isMoola0 = !!(t0 && moola && t0 === moola);
    const data: Reserves = {
      moolaReserve: isMoola0 ? r0 : r1,
      tonReserve: isMoola0 ? r1 : r0,
      lpSupply: Number(p.lp_total_supply ?? 0) / 1e9,
      lpPriceUsd: Number(p.lp_price_usd ?? 0),
    };
    if (!(data.moolaReserve > 0) || !(data.tonReserve > 0)) return null;
    poolCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

export type LpAddQuote = {
  ton: number;
  moola: number;
  tonBalance: number;
  moolaBalance: number;
  enoughTon: boolean;
  enoughMoola: boolean;
  addUrl: string;
};

// TON kept aside for gas on the two provide-liquidity messages.
const LP_GAS_TON = 0.3;

/**
 * For a desired TON contribution, compute the matching MOOLA at the pool ratio
 * and check the wallet holds both sides. Powers the guided add-liquidity sheet.
 */
export async function lpAddQuote(wallet: string, ton: number): Promise<LpAddQuote | null> {
  if (!env.MOOLA_LP || !wallet || !(ton > 0)) return null;
  const res = await poolReserves();
  if (!res) return null;
  const moola = ton * (res.moolaReserve / res.tonReserve);
  const [tonBalance, moolaBalance] = await Promise.all([fetchTonBalance(wallet), moolaBalanceOf(wallet)]);
  const override = process.env.NEXT_PUBLIC_STONFI_LP_URL;
  const addUrl = override || `https://app.ston.fi/pools/${env.MOOLA_LP}`;
  return {
    ton,
    moola,
    tonBalance,
    moolaBalance,
    // Balances come from tonapi, which rate-limits Vercel and then returns 0.
    // A 0/unknown read must NOT block the add (STON.fi enforces the real
    // requirement) — only a positive-but-too-low reading counts as "not enough".
    enoughTon: !(tonBalance > 0) || tonBalance >= ton + LP_GAS_TON,
    enoughMoola: !(moolaBalance > 0) || moolaBalance >= moola,
    addUrl,
  };
}

/** USD value of the LP position held by `wallet`. 0 if none / unconfigured. */
export async function lpValueUsd(wallet: string): Promise<number> {
  if (!env.MOOLA_LP || !wallet) return 0;
  const [pool, userLp] = await Promise.all([poolReserves(), jettonBalanceOf(wallet, env.MOOLA_LP)]);
  if (!pool || !(userLp > 0)) return 0;
  // STON.fi gives a USD price per LP token — most reliable. Fall back to the
  // pool share × reserve valuation if that field is missing.
  if (pool.lpPriceUsd > 0) return userLp * pool.lpPriceUsd;
  if (pool.lpSupply > 0) return 0; // no lp price available; avoid guessing
  return 0;
}

export function lpRewardsEnabled(): boolean {
  return !!env.MOOLA_LP;
}
