import { neon } from '@neondatabase/serverless';
import { Address } from '@ton/core';
import { game } from './config';

/** Canonical raw form of a TON address for uniqueness checks (null if invalid). */
export function normAddr(a: string): string | null {
  try {
    return Address.parse(a).toRawString().toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Vercel Postgres (Neon) data layer. Tables are created lazily on first use so
 * there is no separate migration step — deploy and go.
 *
 * The Neon integration on Vercel injects DATABASE_URL / POSTGRES_URL. With
 * { fullResults: true } each query resolves to { rows, rowCount, ... } — the
 * same shape the rest of this file relies on.
 */
type SqlFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

// Lazily construct the Neon client on first query so that importing this
// module during `next build` (no DB env present) never throws.
let _sql: SqlFn | null = null;
function getSql(): SqlFn {
  if (_sql) return _sql;
  const cs =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
  if (!cs) {
    throw new Error(
      'No database connection string. Set DATABASE_URL or POSTGRES_URL (Neon integration on Vercel).'
    );
  }
  _sql = neon(cs, { fullResults: true }) as unknown as SqlFn;
  return _sql;
}

export const sql: SqlFn = (strings, ...values) => getSql()(strings, ...values);

export type UserRow = {
  id: string;
  first_name: string;
  username: string | null;
  photo_url: string | null;
  balance: number;
  lifetime: number;
  wallet: string | null;
  onboarded: boolean;
  sound_fx: boolean;
  active_nft: string;
  owned_nfts: string; // csv
  mining_started_at: number | null;
  checkin_day: number;
  checkin_at: number | null;
  ads_day: string | null;
  ads_watched: number;
  ads_verified: number;
  ads_watched2: number;
  ads_all_bonus_day: string | null;
  referred_by: string | null;
  ref_first_done: boolean;
  atf_usd: number;
  atf_mult: number;
  atf_bonus_claimed: boolean;
  moola_onchain: number;
  last_scan_at: number | null;
  mining_accrued: number;
  mining_settled_at: number | null;
  verified: boolean;
  verify_status: string;
  support_until: number | null;
  last_free_withdraw_at: number | null;
  lp_usd: number;
  lp_settled_at: number | null;
  created_at: number;
};

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) schemaPromise = initSchema();
  return schemaPromise;
}

async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      first_name        TEXT NOT NULL DEFAULT 'Miner',
      username          TEXT,
      photo_url         TEXT,
      balance           DOUBLE PRECISION NOT NULL DEFAULT 0,
      lifetime          DOUBLE PRECISION NOT NULL DEFAULT 0,
      wallet            TEXT,
      onboarded         BOOLEAN NOT NULL DEFAULT FALSE,
      sound_fx          BOOLEAN NOT NULL DEFAULT TRUE,
      active_nft        TEXT NOT NULL DEFAULT 'genesis',
      owned_nfts        TEXT NOT NULL DEFAULT 'genesis',
      mining_started_at BIGINT,
      checkin_day       INTEGER NOT NULL DEFAULT 0,
      checkin_at        BIGINT,
      ads_day           TEXT,
      ads_watched       INTEGER NOT NULL DEFAULT 0,
      ads_verified      INTEGER NOT NULL DEFAULT 0,
      ads_all_bonus_day TEXT,
      referred_by       TEXT,
      ref_first_done    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        BIGINT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS social_tasks (
      user_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      done_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, task_id)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      kind       TEXT NOT NULL,
      amount     DOUBLE PRECISION NOT NULL,
      label      TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);`;
  // On-chain wallet scan results (added post-launch — safe on existing tables).
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS atf_usd DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS atf_mult DOUBLE PRECISION NOT NULL DEFAULT 1;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS atf_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moola_onchain DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_scan_at BIGINT;`;
  // Mining is checkpointed so boost only applies while ATF is actually held.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_accrued DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_settled_at BIGINT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reminded_at BIGINT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_status TEXT NOT NULL DEFAULT 'none';`;
  // Support mode: when set (future ms), the user's next bot message is forwarded
  // to the admin chat as a support ticket, then the flag is cleared.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS support_until BIGINT;`;
  await sql`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      amount     DOUBLE PRECISION NOT NULL,
      address    TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL
    );
  `;
  // Automated payout state machine columns.
  await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS tx_hash TEXT;`;
  await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS last_error TEXT;`;
  await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at BIGINT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status, created_at);`;

  // Video bounty submissions — one row per user (they can resubmit after a
  // rejection). Reward is credited only when the owner approves.
  await sql`
    CREATE TABLE IF NOT EXISTS video_tasks (
      user_id     TEXT PRIMARY KEY,
      url         TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  BIGINT NOT NULL,
      reviewed_at BIGINT
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_video_status ON video_tasks(status);`;

  // Withdrawal fee: track when a user last took their free withdrawal, and log
  // consumed on-chain fee payments so one payment can't unlock two withdrawals.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_free_withdraw_at BIGINT;`;
  await sql`
    CREATE TABLE IF NOT EXISTS consumed_fees (
      event_id TEXT PRIMARY KEY,
      user_id  TEXT NOT NULL,
      amount   DOUBLE PRECISION NOT NULL,
      at       BIGINT NOT NULL
    );
  `;

  // Liquidity rewards: per-user LP snapshot + a single-row budget ledger.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_usd DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_settled_at BIGINT;`;
  await sql`
    CREATE TABLE IF NOT EXISTS lp_program (
      id INTEGER PRIMARY KEY,
      distributed DOUBLE PRECISION NOT NULL DEFAULT 0
    );
  `;
  await sql`INSERT INTO lp_program (id, distributed) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;`;

  // Dedicated Adsgram ad counter (resets daily with the other ad counts).
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ads_watched2 INTEGER NOT NULL DEFAULT 0;`;

  // Anti-fraud: canonical wallet key (one wallet → one account), signup IP,
  // and a global ledger of withdrawal addresses already claimed by an account.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_key TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_wallet_key ON users(wallet_key);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_signup_ip ON users(signup_ip);`;
  await sql`
    CREATE TABLE IF NOT EXISTS used_withdraw_addresses (
      addr_key TEXT PRIMARY KEY,
      user_id  TEXT NOT NULL,
      at       BIGINT NOT NULL
    );
  `;
  // One-time backfill of wallet_key for wallets already connected.
  const { rows: bf } = await sql`SELECT 1 FROM migrations WHERE key = 'backfill_wallet_key_v1';`;
  if (!bf.length) {
    const { rows } = await sql`SELECT id, wallet FROM users WHERE wallet IS NOT NULL AND wallet_key IS NULL;`;
    for (const r of rows) {
      const k = normAddr(String(r.wallet));
      if (k) await sql`UPDATE users SET wallet_key = ${k} WHERE id = ${String(r.id)};`;
    }
    await sql`INSERT INTO migrations (key, done_at) VALUES ('backfill_wallet_key_v1', ${nowMs()}) ON CONFLICT DO NOTHING;`;
  }

  // One-time migrations, keyed so each runs exactly once across all instances.
  await sql`CREATE TABLE IF NOT EXISTS migrations (key TEXT PRIMARY KEY, done_at BIGINT NOT NULL);`;
  // Reopen the X tasks for everyone — the links were broken, so prior "Done"
  // marks don't mean the user actually followed/retweeted.
  const { rows: m } = await sql`SELECT 1 FROM migrations WHERE key = 'reopen_x_tasks_v1';`;
  if (!m.length) {
    await sql`DELETE FROM social_tasks WHERE task_id IN ('follow_x', 'retweet');`;
    await sql`INSERT INTO migrations (key, done_at) VALUES ('reopen_x_tasks_v1', ${nowMs()}) ON CONFLICT DO NOTHING;`;
  }
}

export function nowMs(): number {
  return Date.now();
}

export function dayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function rowToUser(r: Record<string, unknown>): UserRow {
  return {
    id: String(r.id),
    first_name: String(r.first_name),
    username: (r.username as string) ?? null,
    photo_url: (r.photo_url as string) ?? null,
    balance: Number(r.balance),
    lifetime: Number(r.lifetime),
    wallet: (r.wallet as string) ?? null,
    onboarded: Boolean(r.onboarded),
    sound_fx: Boolean(r.sound_fx),
    active_nft: String(r.active_nft),
    owned_nfts: String(r.owned_nfts),
    mining_started_at: r.mining_started_at != null ? Number(r.mining_started_at) : null,
    checkin_day: Number(r.checkin_day),
    checkin_at: r.checkin_at != null ? Number(r.checkin_at) : null,
    ads_day: (r.ads_day as string) ?? null,
    ads_watched: Number(r.ads_watched),
    ads_verified: Number(r.ads_verified),
    ads_watched2: r.ads_watched2 != null ? Number(r.ads_watched2) : 0,
    ads_all_bonus_day: (r.ads_all_bonus_day as string) ?? null,
    referred_by: (r.referred_by as string) ?? null,
    ref_first_done: Boolean(r.ref_first_done),
    atf_usd: r.atf_usd != null ? Number(r.atf_usd) : 0,
    atf_mult: r.atf_mult != null ? Number(r.atf_mult) : 1,
    atf_bonus_claimed: Boolean(r.atf_bonus_claimed),
    moola_onchain: r.moola_onchain != null ? Number(r.moola_onchain) : 0,
    last_scan_at: r.last_scan_at != null ? Number(r.last_scan_at) : null,
    mining_accrued: r.mining_accrued != null ? Number(r.mining_accrued) : 0,
    mining_settled_at: r.mining_settled_at != null ? Number(r.mining_settled_at) : null,
    verified: Boolean(r.verified),
    verify_status: (r.verify_status as string) ?? 'none',
    support_until: r.support_until != null ? Number(r.support_until) : null,
    last_free_withdraw_at: r.last_free_withdraw_at != null ? Number(r.last_free_withdraw_at) : null,
    lp_usd: r.lp_usd != null ? Number(r.lp_usd) : 0,
    lp_settled_at: r.lp_settled_at != null ? Number(r.lp_settled_at) : null,
    created_at: Number(r.created_at),
  };
}

export async function getUser(id: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToUser(rows[0]) : null;
}

// ── Anti-fraud helpers ───────────────────────────────────────────────────────

/** Account id that already owns this wallet (by canonical key), or null. */
export async function walletOwnerId(address: string): Promise<string | null> {
  const key = normAddr(address);
  if (!key) return null;
  const { rows } = await sql`SELECT id FROM users WHERE wallet_key = ${key} LIMIT 1;`;
  return rows[0] ? String(rows[0].id) : null;
}

/**
 * Account id associated with an address across accounts — either it's someone's
 * connected wallet, or it was already claimed as a withdrawal address. null if
 * free. Used to block withdrawing to an address tied to a different account.
 */
export async function addressOwnerId(address: string): Promise<string | null> {
  const key = normAddr(address);
  if (!key) return null;
  const { rows } = await sql`
    SELECT id FROM users WHERE wallet_key = ${key}
    UNION
    SELECT user_id AS id FROM used_withdraw_addresses WHERE addr_key = ${key}
    LIMIT 1;
  `;
  return rows[0] ? String(rows[0].id) : null;
}

/** Persist a wallet on an account with its canonical key (uniqueness source). */
export async function setUserWallet(userId: string, address: string): Promise<void> {
  await sql`UPDATE users SET wallet = ${address}, wallet_key = ${normAddr(address)} WHERE id = ${userId};`;
}

/**
 * Claim a withdrawal address for a user — first claim wins. Returns false if a
 * DIFFERENT account already owns it (so the withdrawal must be rejected).
 */
export async function claimWithdrawAddress(address: string, userId: string): Promise<boolean> {
  const key = normAddr(address);
  if (!key) return true;
  await sql`
    INSERT INTO used_withdraw_addresses (addr_key, user_id, at)
    VALUES (${key}, ${userId}, ${nowMs()})
    ON CONFLICT (addr_key) DO NOTHING;
  `;
  const { rows } = await sql`SELECT user_id FROM used_withdraw_addresses WHERE addr_key = ${key};`;
  return String(rows[0]?.user_id ?? userId) === userId;
}

/** How many accounts were created from this IP. */
export async function accountsFromIp(ip: string): Promise<number> {
  if (!ip) return 0;
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM users WHERE signup_ip = ${ip};`;
  return Number(rows[0]?.n ?? 0);
}

/** Thrown when a new signup is blocked by the per-IP account cap. */
export class IpLimitError extends Error {
  constructor() {
    super('ip_limit');
    this.name = 'IpLimitError';
  }
}

export async function upsertUser(input: {
  id: string;
  first_name?: string;
  username?: string | null;
  photo_url?: string | null;
  referredBy?: string | null;
  signupIp?: string | null;
}): Promise<UserRow> {
  await ensureSchema();
  const existing = await getUser(input.id);

  if (existing) {
    // Only WRITE when the profile actually changed. authed() calls this on
    // EVERY request, so skipping the no-op UPDATE removes a DB write from the
    // hottest path (the biggest source of Neon load).
    const nextName = input.first_name ?? existing.first_name;
    const nextUser = input.username ?? existing.username;
    const nextPhoto = input.photo_url ?? existing.photo_url;
    if (nextName === existing.first_name && nextUser === existing.username && nextPhoto === existing.photo_url) {
      return existing;
    }
    const { rows } = await sql`
      UPDATE users
      SET first_name = ${nextName}, username = ${nextUser}, photo_url = ${nextPhoto}
      WHERE id = ${input.id}
      RETURNING *;
    `;
    return rowToUser(rows[0]);
  }

  // Per-IP account cap (opt-in via MAX_ACCOUNTS_PER_IP). Off by default because
  // mobile carriers share one IP across many real users (NAT) — enable only if
  // you accept that risk. Applies to brand-new accounts only.
  const ip = (input.signupIp ?? '').trim();
  const maxPerIp = Number(process.env.MAX_ACCOUNTS_PER_IP ?? 0);
  if (maxPerIp > 0 && ip && (await accountsFromIp(ip)) >= maxPerIp) {
    throw new IpLimitError();
  }

  // Only accept a real, different referrer.
  let referredBy = input.referredBy ?? null;
  if (referredBy === input.id) referredBy = null;
  if (referredBy && !(await getUser(referredBy))) referredBy = null;

  const { rows } = await sql`
    INSERT INTO users (id, first_name, username, photo_url, referred_by, created_at, signup_ip)
    VALUES (${input.id}, ${input.first_name ?? 'Miner'}, ${input.username ?? null},
            ${input.photo_url ?? null}, ${referredBy}, ${nowMs()}, ${ip || null})
    RETURNING *;
  `;
  return rowToUser(rows[0]);
}

export async function addTx(userId: string, kind: string, amount: number, label: string): Promise<void> {
  await sql`
    INSERT INTO transactions (user_id, kind, amount, label, created_at)
    VALUES (${userId}, ${kind}, ${amount}, ${label}, ${nowMs()});
  `;
}

/**
 * Credit balance + lifetime and log a transaction.
 * amount may be negative (debit); lifetime only grows on positive amounts.
 */
export async function credit(userId: string, amount: number, kind: string, label: string): Promise<void> {
  await sql`
    UPDATE users
    SET balance  = balance + ${amount},
        lifetime = lifetime + ${amount > 0 ? amount : 0}
    WHERE id = ${userId};
  `;
  await addTx(userId, kind, amount, label);
}

// ── Liquidity rewards ────────────────────────────────────────────────────────

/** MOOLA distributed so far by the LP rewards program. */
export async function lpDistributed(): Promise<number> {
  const { rows } = await sql`SELECT distributed FROM lp_program WHERE id = 1;`;
  return Number(rows[0]?.distributed ?? 0);
}

/**
 * Claim `want` MOOLA from the fixed LP budget, returning how much was actually
 * granted (clamped to the remaining budget; 0 once the program is exhausted).
 * The conditional UPDATE + RETURNING makes the clamp atomic against races.
 */
export async function grantLpReward(want: number): Promise<number> {
  if (!(want > 0)) return 0;
  const cap = game.lpRewards.capMoola;
  // One atomic statement: read the old total, write the clamped new total, and
  // return both so the granted amount is exact even under concurrent claims.
  const { rows } = await sql`
    WITH prev AS (SELECT distributed AS d FROM lp_program WHERE id = 1)
    UPDATE lp_program p
    SET distributed = LEAST(p.distributed + ${want}, ${cap})
    FROM prev
    WHERE p.id = 1
    RETURNING p.distributed AS new_dist, prev.d AS old_dist;
  `;
  const granted = Number(rows[0]?.new_dist ?? 0) - Number(rows[0]?.old_dist ?? 0);
  return Math.max(0, granted);
}

/** Total MOOLA a user has withdrawn or has queued (excludes rejected/failed). */
export async function withdrawnTotal(userId: string): Promise<number> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals
    WHERE user_id = ${userId} AND status IN ('pending','processing','paid');
  `;
  return Math.round(Number(rows[0]?.s ?? 0) * 100) / 100;
}

export async function listWithdrawals(userId: string, limit = 10) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, amount, address, status, last_error, tx_hash, created_at
    FROM withdrawals
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    amount: Number(r.amount),
    address: String(r.address),
    status: String(r.status),
    error: (r.last_error as string) ?? null,
    txHash: (r.tx_hash as string) ?? null,
    createdAt: Number(r.created_at),
  }));
}

let userCountCache: { at: number; n: number } | null = null;
/** Total registered users (cached 60s so it's cheap to show everywhere). */
export async function countUsers(): Promise<number> {
  await ensureSchema();
  if (userCountCache && Date.now() - userCountCache.at < 60_000) return userCountCache.n;
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM users;`;
  const n = Number(rows[0]?.n ?? 0);
  userCountCache = { at: Date.now(), n };
  return n;
}

export async function getSocialDone(userId: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT task_id FROM social_tasks WHERE user_id = ${userId};`;
  return rows.map((r) => String(r.task_id));
}

// ── Video bounty ────────────────────────────────────────────────────────────

export type VideoTaskState = {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  url: string | null;
  slotsLeft: number;
  slotsTotal: number;
  reward: number;
};

let approvedVideoCache: { at: number; n: number } | null = null;
async function approvedVideoCount(fresh = false): Promise<number> {
  if (!fresh && approvedVideoCache && Date.now() - approvedVideoCache.at < 60_000) return approvedVideoCache.n;
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM video_tasks WHERE status = 'approved';`;
  const n = Number(rows[0]?.n ?? 0);
  approvedVideoCache = { at: Date.now(), n };
  return n;
}

/** This user's video-bounty state + how many winner slots remain. */
export async function getVideoTaskState(userId: string): Promise<VideoTaskState> {
  await ensureSchema();
  const [{ rows }, approved] = await Promise.all([
    sql`SELECT url, status FROM video_tasks WHERE user_id = ${userId} LIMIT 1;`,
    approvedVideoCount(),
  ]);
  const row = rows[0];
  return {
    status: row ? (String(row.status) as VideoTaskState['status']) : 'none',
    url: row ? String(row.url) : null,
    slotsLeft: Math.max(0, game.videoTask.slots - approved),
    slotsTotal: game.videoTask.slots,
    reward: game.videoTask.reward,
  };
}

export type VideoSubmitResult = { ok: boolean; status: VideoTaskState['status']; reason?: string };

/**
 * Record (or re-record after a rejection) a user's video submission. Never pays
 * out — the owner approves later. Refuses once all winner slots are filled or
 * while a submission is already pending/approved.
 */
export async function submitVideoTask(userId: string, url: string): Promise<VideoSubmitResult> {
  await ensureSchema();
  const approved = await approvedVideoCount();
  if (approved >= game.videoTask.slots) return { ok: false, status: 'none', reason: 'All slots are filled' };

  const { rows } = await sql`SELECT status FROM video_tasks WHERE user_id = ${userId} LIMIT 1;`;
  const current = rows[0]?.status as string | undefined;
  if (current === 'pending') return { ok: false, status: 'pending', reason: 'Your video is already awaiting review' };
  if (current === 'approved') return { ok: false, status: 'approved', reason: 'You already earned this reward' };

  const now = nowMs();
  await sql`
    INSERT INTO video_tasks (user_id, url, status, created_at)
    VALUES (${userId}, ${url}, 'pending', ${now})
    ON CONFLICT (user_id) DO UPDATE
      SET url = ${url}, status = 'pending', created_at = ${now}, reviewed_at = NULL;
  `;
  return { ok: true, status: 'pending' };
}

/**
 * Approve a submission and credit the reward — idempotent (a second approve
 * pays nothing) and slot-capped. Returns whether the reward was credited.
 */
export async function approveVideoTask(userId: string): Promise<{ credited: boolean; reason?: string }> {
  await ensureSchema();
  if ((await approvedVideoCount(true)) >= game.videoTask.slots) return { credited: false, reason: 'slots full' };
  const { rows } = await sql`
    UPDATE video_tasks SET status = 'approved', reviewed_at = ${nowMs()}
    WHERE user_id = ${userId} AND status <> 'approved'
    RETURNING user_id;
  `;
  if (!rows.length) return { credited: false, reason: 'already approved or missing' };
  approvedVideoCache = null; // a slot was just filled — don't serve a stale count
  await credit(userId, game.videoTask.reward, 'video_task', 'Moola video reward 🎬');
  return { credited: true };
}

/** All video submissions (pending first, then approved, then rejected). */
export async function listVideoSubmissions(limit = 300) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT v.user_id, v.url, v.status, v.created_at, u.first_name, u.username
    FROM video_tasks v
    LEFT JOIN users u ON u.id = v.user_id
    ORDER BY CASE v.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, v.created_at DESC
    LIMIT ${limit};
  `;
  return rows.map((r) => ({
    userId: String(r.user_id),
    url: String(r.url),
    status: String(r.status),
    createdAt: Number(r.created_at),
    name: (r.first_name as string) ?? null,
    username: (r.username as string) ?? null,
  }));
}

export async function rejectVideoTask(userId: string): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE video_tasks SET status = 'rejected', reviewed_at = ${nowMs()}
    WHERE user_id = ${userId} AND status <> 'approved';
  `;
}

// ── Withdrawal fee ───────────────────────────────────────────────────────────

/** True if the user's free (no-fee) withdrawal is available right now. */
export function freeWithdrawAvailable(u: UserRow, at = nowMs()): boolean {
  const windowMs = game.withdraw.freeCooldownHours * 60 * 60 * 1000;
  return !u.last_free_withdraw_at || at - u.last_free_withdraw_at >= windowMs;
}

/** Stamp that the user just used their free withdrawal. */
export async function markFreeWithdrawal(userId: string): Promise<void> {
  await sql`UPDATE users SET last_free_withdraw_at = ${nowMs()} WHERE id = ${userId};`;
}

/**
 * Atomically consume an on-chain fee payment so it can unlock exactly one
 * withdrawal. Returns true only if THIS call claimed it (INSERT succeeded).
 */
export async function consumeFee(eventId: string, userId: string, amount: number): Promise<boolean> {
  const { rowCount } = await sql`
    INSERT INTO consumed_fees (event_id, user_id, amount, at)
    VALUES (${eventId}, ${userId}, ${amount}, ${nowMs()})
    ON CONFLICT (event_id) DO NOTHING;
  `;
  return rowCount > 0;
}

export async function listHistory(userId: string, limit = 40) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT kind, amount, label, created_at
    FROM transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return rows.map((r) => ({
    kind: String(r.kind),
    amount: Number(r.amount),
    label: String(r.label),
    createdAt: Number(r.created_at),
  }));
}
