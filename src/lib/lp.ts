import { Address } from '@ton/core';
import { env } from './config';
import { jettonBalanceOf, jettonTotalSupply, moolaBalanceOf, fetchTonBalance } from './ton';
import { moolaMarketStats } from './stonfi';

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

type Reserves = { moolaReserve: number; tonReserve: number; lpSupply: number };

let poolCache: { at: number; data: Reserves } | null = null;
const POOL_TTL_MS = 60_000;

/** Pool MOOLA/TON reserves + LP total supply (whole units). Cached 60s. */
async function poolReserves(): Promise<Reserves | null> {
  if (!env.MOOLA_LP) return null;
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.data;
  try {
    const [poolRes, lpSupply] = await Promise.all([
      fetch(`https://api.ston.fi/v1/pools/${encodeURIComponent(env.MOOLA_LP)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      }),
      jettonTotalSupply(env.MOOLA_LP),
    ]);
    if (!poolRes.ok || !(lpSupply > 0)) return null;
    const body = (await poolRes.json()) as {
      pool?: { token0_address?: string; reserve0?: string; reserve1?: string };
    };
    const p = body.pool;
    if (!p) return null;
    // Reserves are in base units (both MOOLA and pTON use 9 decimals).
    const r0 = Number(p.reserve0 ?? 0) / 1e9;
    const r1 = Number(p.reserve1 ?? 0) / 1e9;
    const moola = norm(env.MOOLA_JETTON);
    const t0 = norm(p.token0_address ?? '');
    const isMoola0 = !!(t0 && moola && t0 === moola);
    const data: Reserves = {
      moolaReserve: isMoola0 ? r0 : r1,
      tonReserve: isMoola0 ? r1 : r0,
      lpSupply,
    };
    if (!(data.moolaReserve > 0) || !(data.tonReserve > 0)) return null;
    poolCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

type PoolInfo = { tvlUsd: number; lpSupply: number };

/** Pool TVL (USD) and LP total supply. */
async function poolInfo(): Promise<PoolInfo | null> {
  const [res, stats] = await Promise.all([poolReserves(), moolaMarketStats().catch(() => null)]);
  if (!res || !stats || !(stats.moolaPriceUsd > 0)) return null;
  const tvlUsd = res.moolaReserve * stats.moolaPriceUsd + res.tonReserve * (stats.tonUsd || 0);
  if (!(tvlUsd > 0)) return null;
  return { tvlUsd, lpSupply: res.lpSupply };
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
    enoughTon: tonBalance >= ton + LP_GAS_TON,
    enoughMoola: moolaBalance >= moola,
    addUrl,
  };
}

/** USD value of the LP position held by `wallet`. 0 if none / unconfigured. */
export async function lpValueUsd(wallet: string): Promise<number> {
  if (!env.MOOLA_LP || !wallet) return 0;
  const [pool, userLp] = await Promise.all([poolInfo(), jettonBalanceOf(wallet, env.MOOLA_LP)]);
  if (!pool || !(userLp > 0)) return 0;
  const share = userLp / pool.lpSupply;
  return Math.max(0, share * pool.tvlUsd);
}

export function lpRewardsEnabled(): boolean {
  return !!env.MOOLA_LP;
}
