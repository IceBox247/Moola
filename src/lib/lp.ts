import { Address } from '@ton/core';
import { env } from './config';
import { jettonBalanceOf, jettonTotalSupply } from './ton';
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

type PoolInfo = { tvlUsd: number; lpSupply: number };

let poolCache: { at: number; data: PoolInfo } | null = null;
const POOL_TTL_MS = 60_000;

/** Pool TVL (USD) and LP total supply. Cached 60s. */
async function poolInfo(): Promise<PoolInfo | null> {
  if (!env.MOOLA_LP) return null;
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.data;
  try {
    const [poolRes, stats, lpSupply] = await Promise.all([
      fetch(`https://api.ston.fi/v1/pools/${encodeURIComponent(env.MOOLA_LP)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      }),
      moolaMarketStats().catch(() => null),
      jettonTotalSupply(env.MOOLA_LP),
    ]);
    if (!poolRes.ok || !stats || !(stats.moolaPriceUsd > 0) || !(lpSupply > 0)) return null;
    const body = (await poolRes.json()) as {
      pool?: {
        token0_address?: string;
        token1_address?: string;
        reserve0?: string;
        reserve1?: string;
      };
    };
    const p = body.pool;
    if (!p) return null;

    // Reserves are in base units (both MOOLA and pTON use 9 decimals).
    const r0 = Number(p.reserve0 ?? 0) / 1e9;
    const r1 = Number(p.reserve1 ?? 0) / 1e9;
    const moola = norm(env.MOOLA_JETTON);
    const t0 = norm(p.token0_address ?? '');
    // Whichever side is MOOLA is priced in MOOLA; the other side is TON.
    const moolaReserve = t0 && moola && t0 === moola ? r0 : r1;
    const tonReserve = t0 && moola && t0 === moola ? r1 : r0;
    const tvlUsd = moolaReserve * stats.moolaPriceUsd + tonReserve * (stats.tonUsd || 0);
    if (!(tvlUsd > 0)) return null;

    const data = { tvlUsd, lpSupply };
    poolCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
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
