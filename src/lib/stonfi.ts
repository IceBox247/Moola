import { StonApiClient } from '@ston-fi/api';
import { dexFactory, Client } from '@ston-fi/sdk';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import { env } from './config';

/**
 * Server-side STON.fi swap builder for buying MOOLA with the native coin (TON /
 * GRAM). We use the STON.fi API to simulate the swap — this also returns the
 * correct router + pTON addresses for whichever pool holds MOOLA, so we never
 * hardcode (and mis-target) a router. The SDK then builds the exact on-chain
 * message, which the client signs with the user's connected wallet.
 */

const DEFAULT_SLIPPAGE = '0.02'; // 2%

// Resolve a reliable, Vercel-friendly RPC endpoint via Orbs TON Access
// (public toncenter rate-limits shared serverless IPs). Cached per warm fn.
let endpointPromise: Promise<string> | null = null;
function rpcEndpoint(): Promise<string> {
  if (!endpointPromise) endpointPromise = getHttpEndpoint();
  return endpointPromise;
}

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

async function tonClient() {
  const endpoint = await rpcEndpoint();
  const apiKey = process.env.TONCENTER_API_KEY || undefined;
  return new Client({ endpoint, apiKey });
}

export type SwapQuote = {
  offerNanoTon: string; // native coin in (nano)
  askMoola: number; // estimated MOOLA out (human units)
  minMoola: number; // guaranteed minimum out after slippage (human units)
};

/** Simulate buying MOOLA with `offerNanoTon` nanotons. Cheap, no RPC. */
export async function quoteBuyMoola(offerNanoTon: string, slippage = DEFAULT_SLIPPAGE): Promise<SwapQuote> {
  const sim = await apiClient().simulateSwap({
    offerAddress: PTON_MASTER,
    askAddress: moolaJetton(),
    offerUnits: offerNanoTon,
    slippageTolerance: slippage,
  });
  return {
    offerNanoTon,
    askMoola: Number(sim.askUnits) / 1e9,
    minMoola: Number(sim.minAskUnits) / 1e9,
  };
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
  const sim = await apiClient().simulateSwap({
    offerAddress: PTON_MASTER,
    askAddress: moolaJetton(),
    offerUnits: offerNanoTon,
    slippageTolerance: slippage,
  });

  const { router: routerInfo } = sim;
  const contracts = dexFactory(routerInfo);
  const proxyTon = contracts.pTON.create(routerInfo.ptonMasterAddress);

  // Build the tx params, retrying once on a transient RPC/get-method hiccup
  // (Orbs load-balances across many nodes; a stale one can throw exit_code -13).
  const buildParams = async () => {
    const client = await tonClient();
    const router = client.open(contracts.Router.create(routerInfo.address));
    return router.getSwapTonToJettonTxParams({
      userWalletAddress,
      proxyTon,
      offerAmount: sim.offerUnits,
      askJettonAddress: sim.askAddress,
      minAskAmount: sim.minAskUnits,
      queryId: Date.now(),
    });
  };
  let txParams;
  try {
    txParams = await buildParams();
  } catch {
    endpointPromise = null; // re-resolve to a fresh node
    txParams = await buildParams();
  }

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
