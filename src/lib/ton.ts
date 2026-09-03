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

// ── toncenter.com fallback ──────────────────────────────────────────────────
// tonapi.io throttles the (shared) Vercel server IP, which makes on-chain reads
// intermittently return nothing. toncenter is an independent provider with its
// own rate budget, so we fall back to it whenever tonapi comes back empty. Every
// helper returns `null` on failure (never a fake 0) so callers can tell "read
// failed" apart from "genuinely zero" and avoid clobbering good data.

const TC_BASE = 'https://toncenter.com/api/v3';

function tcHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (env.TONCENTER_KEY) h['X-API-Key'] = env.TONCENTER_KEY;
  return h;
}

/** Jetton balance via toncenter v3 (whole tokens). `null` if it can't be read. */
async function tcJettonBalance(owner: string, master: string, decimals = 9): Promise<number | null> {
  try {
    const url = `${TC_BASE}/jetton/wallets?owner_address=${encodeURIComponent(owner)}&jetton_address=${encodeURIComponent(
      master
    )}&limit=1`;
    const res = await fetch(url, { headers: tcHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const d = (await res.json()) as { jetton_wallets?: Array<{ balance?: string }> };
    const w = d.jetton_wallets?.[0];
    if (!w) return 0; // toncenter answered: this owner has no such jetton wallet
    return Number(w.balance ?? 0) / Math.pow(10, decimals);
  } catch {
    return null;
  }
}

/**
 * MOOLA jetton balance held by `address` (whole tokens), or `null` if neither
 * provider could read it (so callers can keep the last known value).
 */
export async function moolaBalanceRead(address: string): Promise<number | null> {
  if (!env.MOOLA_JETTON) return 0;
  const b = await fetchJetton(address, env.MOOLA_JETTON);
  if (b) return tokenAmount(b);
  return tcJettonBalance(address, env.MOOLA_JETTON, 9);
}

/** MOOLA jetton balance held by `address` (whole tokens). 0 on any error. */
export async function moolaBalanceOf(address: string): Promise<number> {
  return (await moolaBalanceRead(address)) ?? 0;
}

/**
 * Any jetton balance held by `address` (whole tokens), or `null` if neither
 * provider could read it (so callers can keep the last known value).
 */
export async function jettonBalanceRead(address: string, jetton: string, decimals = 9): Promise<number | null> {
  if (!jetton) return 0;
  const b = await fetchJetton(address, jetton);
  if (b) return tokenAmount(b);
  return tcJettonBalance(address, jetton, decimals);
}

/** Any jetton balance held by `address` (whole tokens). 0 on any error. */
export async function jettonBalanceOf(address: string, jetton: string): Promise<number> {
  return (await jettonBalanceRead(address, jetton)) ?? 0;
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

/** Native coin (TON) balance via tonapi, or `null` if it can't be read. */
async function tonBalanceTonapi(address: string): Promise<number | null> {
  try {
    const url = `${BASE}/accounts/${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { balance?: string | number };
    return Number(data.balance ?? 0) / 1e9;
  } catch {
    return null;
  }
}

/** Native coin (TON) balance via toncenter v3 (fallback), or `null`. */
async function tonBalanceTC(address: string): Promise<number | null> {
  try {
    const url = `${TC_BASE}/walletInformation?address=${encodeURIComponent(address)}&use_v2=false`;
    const res = await fetch(url, { headers: tcHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { balance?: string | number };
    if (data.balance == null) return null;
    return Number(data.balance) / 1e9;
  } catch {
    return null;
  }
}

/**
 * Native coin (TON) balance of an account, in whole coins. Reads tonapi first,
 * falls back to toncenter when tonapi is throttled. 0 only if a provider
 * confirms the account is empty; 0 as well if neither could be read.
 */
export async function fetchTonBalance(address: string): Promise<number> {
  const primary = await tonBalanceTonapi(address);
  if (primary !== null) return primary;
  return (await tonBalanceTC(address)) ?? 0;
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
  const viaTonapi = await tonTransfersToTonapi(account, limit);
  if (viaTonapi !== null) return viaTonapi;
  // tonapi throttled/failed — fall back to toncenter so fee verification (and
  // any other incoming-transfer check) still works.
  return tonTransfersToTC(account, limit);
}

async function tonTransfersToTonapi(account: string, limit: number): Promise<TonTransfer[] | null> {
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

/** Incoming native-TON transfers to `account` via toncenter v3 (fallback). */
async function tonTransfersToTC(account: string, limit: number): Promise<TonTransfer[] | null> {
  try {
    const url = `${TC_BASE}/transactions?account=${encodeURIComponent(account)}&limit=${limit}&sort=desc`;
    const res = await fetch(url, { headers: tcHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      transactions?: Array<{
        hash?: string;
        now?: number;
        description?: { aborted?: boolean };
        in_msg?: { source?: string; destination?: string; value?: string | number };
      }>;
    };
    const out: TonTransfer[] = [];
    for (const tx of data.transactions ?? []) {
      const m = tx.in_msg;
      // A fee payment is an incoming message carrying value from an external
      // wallet (source set). Ignore contract-internal / no-value messages.
      if (!m?.source || !m.destination) continue;
      const value = Number(m.value ?? 0);
      if (!(value > 0)) continue;
      out.push({
        id: tx.hash ?? `${m.source}:${tx.now ?? 0}`,
        from: m.source,
        amount: value / 1e9,
        time: Number(tx.now ?? 0) * 1000,
        ok: tx.description?.aborted !== true,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Read a wallet's holdings. Each field is `null` when it could not be read from
 * any provider (throttle/outage), which callers MUST treat as "unknown, keep the
 * previous value" — never as a real zero. A field is `0` only when a provider
 * actually confirmed the wallet holds none.
 */
export async function scanWallet(address: string): Promise<{ atfUsd: number | null; moolaOnchain: number | null }> {
  let atfUsd: number | null = env.ATF_JETTON ? null : 0;
  let moolaOnchain: number | null = env.MOOLA_JETTON ? null : 0;

  if (env.ATF_JETTON) {
    const atf = await fetchJetton(address, env.ATF_JETTON);
    if (atf) {
      const priceUsd = atf?.price?.prices?.USD ?? 0;
      atfUsd = Math.round(tokenAmount(atf) * priceUsd * 100) / 100;
    }
    // (ATF price needs tonapi; no toncenter fallback for its USD value.)
  }

  if (env.MOOLA_JETTON) {
    const bal = await moolaBalanceRead(address); // tonapi → toncenter fallback
    if (bal !== null) moolaOnchain = Math.round(bal * 100) / 100;
  }

  return { atfUsd, moolaOnchain };
}
