import { env } from './config';

/**
 * Read a wallet's jetton balances from TON API (tonapi.io).
 * Returns the USD value of the user's ATF and their MOOLA token count.
 * Requires ATF_JETTON_ADDRESS / MOOLA_JETTON_ADDRESS to be configured; when
 * a jetton isn't configured or the wallet holds none, its value is 0.
 */

const BASE = 'https://tonapi.io/v2';

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (env.TONAPI_KEY) h.authorization = `Bearer ${env.TONAPI_KEY}`;
  return h;
}

type JettonBalance = {
  balance?: string;
  price?: { prices?: { USD?: number } };
  jetton?: { decimals?: number };
};

async function fetchJetton(account: string, jetton: string): Promise<JettonBalance | null> {
  try {
    const url = `${BASE}/accounts/${encodeURIComponent(account)}/jettons/${encodeURIComponent(jetton)}?currencies=usd`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as JettonBalance;
  } catch {
    return null;
  }
}

function tokenAmount(b: JettonBalance | null): number {
  if (!b?.balance) return 0;
  const dec = b.jetton?.decimals ?? 9;
  return Number(b.balance) / Math.pow(10, dec);
}

/** Native coin (TON / GRAM) balance of an account, in whole coins. */
export async function fetchTonBalance(address: string): Promise<number> {
  try {
    const url = `${BASE}/accounts/${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return 0;
    const data = (await res.json()) as { balance?: string | number };
    return Number(data.balance ?? 0) / 1e9;
  } catch {
    return 0;
  }
}

export async function scanWallet(address: string): Promise<{ atfUsd: number; moolaOnchain: number }> {
  let atfUsd = 0;
  let moolaOnchain = 0;

  if (env.ATF_JETTON) {
    const atf = await fetchJetton(address, env.ATF_JETTON);
    const amount = tokenAmount(atf);
    const priceUsd = atf?.price?.prices?.USD ?? 0;
    atfUsd = amount * priceUsd;
  }

  if (env.MOOLA_JETTON) {
    const moola = await fetchJetton(address, env.MOOLA_JETTON);
    moolaOnchain = tokenAmount(moola);
  }

  return { atfUsd: Math.round(atfUsd * 100) / 100, moolaOnchain: Math.round(moolaOnchain * 100) / 100 };
}
