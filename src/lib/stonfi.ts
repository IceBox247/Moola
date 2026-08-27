import { StonApiClient } from '@ston-fi/api';
import { dexFactory } from '@ston-fi/sdk';
import { env, MOOLA_TOTAL_SUPPLY } from './config';
import { fetchTonUsd } from './ton';

/**
 * Server-side STON.fi swap builder for buying MOOLA with the native coin (TON /
 * GRAM). We simulate via the STON.fi API — which returns the correct router +
 * pTON addresses AND both jetton-wallet addresses for whichever pool holds
 * MOOLA — then build the exact on-chain message with the SDK's pure cell
 * builders. Because the simulate already gives us the wallet addresses, no
 * on-chain RPC (and therefore no heavy @ton/ton client) is needed — which keeps
 * this route small enough to deploy reliably as a serverless function.
 */

const DEFAULT_SLIPPAGE = '0.02'; // 2%

// STON.fi's simulate endpoint wants the proxy-TON (pTON) master address for the
// native side, not the literal string "ton". This is pTON v2.1, which STON.fi's
// current v2 routers (the MOOLA/GRAM pool is one) use.
const PTON_MASTER = 'EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S';

function moolaJetton(): string {
  const addr = env.MOOLA_JETTON;
  if (!addr) throw new Error('MOOLA_JETTON_ADDRESS is not configured');
  return addr;
}

function apiClient() {
  return new StonApiClient();
}

/**
 * A no-op contract "provider": the SDK's tx-param methods take a provider and
 * call `provider.open(contract).method(...)`. Since we pass every address the
 * methods would otherwise fetch over RPC, the provider is never used for a
 * network call — it only needs to re-bind each opened contract's methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubProvider(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider: any = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    open: (contract: any) =>
      new Proxy(
        {},
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          get: (_t, m: string) => (...args: any[]) => contract[m](provider, ...args),
        }
      ),
  };
  return provider;
}

export type SwapQuote = {
  offerNanoTon: string; // native coin in (nano)
  askMoola: number; // estimated MOOLA out (human units)
  minMoola: number; // guaranteed minimum out after slippage (human units)
};

async function simulate(offerNanoTon: string, slippage: string) {
  return apiClient().simulateSwap({
    offerAddress: PTON_MASTER,
    askAddress: moolaJetton(),
    offerUnits: offerNanoTon,
    slippageTolerance: slippage,
  });
}

/** Simulate buying MOOLA with `offerNanoTon` nanotons. Cheap, no RPC. */
export async function quoteBuyMoola(offerNanoTon: string, slippage = DEFAULT_SLIPPAGE): Promise<SwapQuote> {
  const sim = await simulate(offerNanoTon, slippage);
  return {
    offerNanoTon,
    askMoola: Number(sim.askUnits) / 1e9,
    minMoola: Number(sim.minAskUnits) / 1e9,
  };
}

export type MarketStats = { moolaPriceUsd: number; marketCapUsd: number; tonUsd: number };

// Cache market stats briefly so the dashboard can poll without hammering APIs.
let statsCache: { at: number; data: MarketStats } | null = null;
const STATS_TTL_MS = 60_000;

/**
 * Live MOOLA market stats: derive the MOOLA/TON rate from the pool, price TON
 * in USD, and multiply by the fixed total supply for market cap.
 */
export async function moolaMarketStats(): Promise<MarketStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.data;
  const [sim, tonUsd] = await Promise.all([
    simulate(String(1e9), '0.01'), // 1 TON -> MOOLA
    fetchTonUsd(),
  ]);
  const moolaPerTon = Number(sim.askUnits) / 1e9;
  const moolaPriceUsd = moolaPerTon > 0 ? (1 / moolaPerTon) * tonUsd : 0;
  const data: MarketStats = {
    moolaPriceUsd,
    marketCapUsd: moolaPriceUsd * MOOLA_TOTAL_SUPPLY,
    tonUsd,
  };
  statsCache = { at: Date.now(), data };
  return data;
}

export type SwapMessage = { address: string; amount: string; payload: string };

/**
 * Build the signed-ready swap message for buying MOOLA with the native coin.
 * Returns a single TON Connect message plus the quote for display/confirmation.
 */
export async function buildBuyMoolaTx(
  userWalletAddress: string,
  offerNanoTon: string,
  slippage = DEFAULT_SLIPPAGE
): Promise<{ message: SwapMessage; quote: SwapQuote }> {
  const sim = await simulate(offerNanoTon, slippage);

  const contracts = dexFactory(sim.router);
  const router = contracts.Router.create(sim.router.address);
  const proxyTon = contracts.pTON.create(sim.router.ptonMasterAddress);

  // No RPC: we pass the jetton-wallet addresses straight from the simulation,
  // so the SDK builds the message from pure cell builders alone.
  const txParams = await router.getSwapTonToJettonTxParams(stubProvider(), {
    userWalletAddress,
    proxyTon,
    offerAmount: sim.offerUnits,
    askJettonWalletAddress: sim.askJettonWallet,
    offerJettonWalletAddress: sim.offerJettonWallet,
    minAskAmount: sim.minAskUnits,
    queryId: Date.now(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return {
    message: {
      address: txParams.to.toString(),
      amount: txParams.value.toString(),
      payload: txParams.body!.toBoc().toString('base64'),
    },
    quote: {
      offerNanoTon,
      askMoola: Number(sim.askUnits) / 1e9,
      minMoola: Number(sim.minAskUnits) / 1e9,
    },
  };
}
