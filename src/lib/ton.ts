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

/** MOOLA jetton balance held by `address` (whole tokens). 0 on any error. */
export async function moolaBalanceOf(address: string): Promise<number> {
  if (!env.MOOLA_JETTON) return 0;
  const b = await fetchJetton(address, env.MOOLA_JETTON);
  return tokenAmount(b);
}

/** Any jetton balance held by `address` (whole tokens). 0 on any error. */
export async function jettonBalanceOf(address: string, jetton: string): Promise<number> {
  if (!jetton) return 0;
  return tokenAmount(await fetchJetton(address, jetton));
}

/** Total supply of a jetton (whole tokens). 0 on any error. */
export async function jettonTotalSupply(jetton: string): Promise<number> {
  if (!jetton) return 0;
  try {
    const res = await fetch(`${BASE}/jettons/${encodeURIComponent(jetton)}`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return 0;
    const d = (await res.json()) as { total_supply?: string; mintable?: boolean; metadata?: { decimals?: string | number } };
    const dec = Number(d.metadata?.decimals ?? 9);
    return Number(d.total_supply ?? 0) / Math.pow(10, dec);
  } catch {
    return 0;
  }
}

/** Native coin (TON / GRAM) price in USD, or 0 if unavailable. */
export async function fetchTonUsd(): Promise<number> {
  try {
    const res = await fetch(`${BASE}/rates?tokens=ton&currencies=usd`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return 0;
    const data = (await res.json()) as { rates?: { TON?: { prices?: { USD?: number } } } };
    return data.rates?.TON?.prices?.USD ?? 0;
  } catch {
    return 0;
  }
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

export type JettonMove = { from: string; to: string; amount: number; time: number; ok: boolean };

/**
 * Outgoing MOOLA jetton transfers made *from* `account`, newest first, read from
 * tonapi's jetton history. Returns `null` if the history can't be fetched (so
 * callers can decline to act rather than guess). Each move carries whether the
 * on-chain transfer succeeded (`ok`) — a bounced/failed transfer never delivered.
 */
export async function moolaTransfersFrom(account: string, limit = 200): Promise<JettonMove[] | null> {
  if (!env.MOOLA_JETTON) return [];
  try {
    const url = `${BASE}/accounts/${encodeURIComponent(account)}/jettons/${encodeURIComponent(
      env.MOOLA_JETTON
    )}/history?limit=${limit}`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: Array<{
        timestamp?: number;
        actions?: Array<{
          type?: string;
          status?: string;
          JettonTransfer?: { sender?: { address?: string }; recipient?: { address?: string }; amount?: string };
        }>;
      }>;
    };
    const out: JettonMove[] = [];
    for (const ev of data.events ?? []) {
      const time = Number(ev.timestamp ?? 0) * 1000;
      for (const a of ev.actions ?? []) {
        if (a.type !== 'JettonTransfer' || !a.JettonTransfer) continue;
        const jt = a.JettonTransfer;
        const from = jt.sender?.address;
        const to = jt.recipient?.address;
        if (!from || !to) continue;
        out.push({ from, to, amount: Number(jt.amount ?? 0) / 1e9, time, ok: (a.status ?? 'ok') === 'ok' });
      }
    }
    // Both incoming and outgoing transfers are returned; callers filter by
    // sender/recipient after normalising address forms with @ton/core.
    return out;
  } catch {
    return null;
  }
}

export type TonTransfer = { id: string; from: string; amount: number; time: number; ok: boolean };

/**
 * Recent incoming native-coin (TON/GRAM) transfers to `account`, read from
 * tonapi's account events. Used to verify withdrawal fee payments. Returns null
 * if the events can't be fetched (so callers decline rather than guess).
 */
export async function tonTransfersTo(account: string, limit = 50): Promise<TonTransfer[] | null> {
  try {
    const url = `${BASE}/accounts/${encodeURIComponent(account)}/events?limit=${limit}`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: Array<{
        event_id?: string;
        timestamp?: number;
        actions?: Array<{
          type?: string;
          status?: string;
          TonTransfer?: { sender?: { address?: string }; recipient?: { address?: string }; amount?: number | string };
        }>;
      }>;
    };
    const out: TonTransfer[] = [];
    for (const ev of data.events ?? []) {
      const time = Number(ev.timestamp ?? 0) * 1000;
      for (let i = 0; i < (ev.actions ?? []).length; i++) {
        const a = ev.actions![i];
        if (a.type !== 'TonTransfer' || !a.TonTransfer) continue;
        const from = a.TonTransfer.sender?.address;
        const to = a.TonTransfer.recipient?.address;
        if (!from || !to) continue;
        out.push({
          id: `${ev.event_id ?? ''}:${i}`,
          from,
          amount: Number(a.TonTransfer.amount ?? 0) / 1e9,
          time,
          ok: (a.status ?? 'ok') === 'ok',
        });
      }
    }
    return out;
  } catch {
    return null;
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
