import { neon } from '@neondatabase/serverless';

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
  ads_all_bonus_day: string | null;
  referred_by: string | null;
  ref_first_done: boolean;
  atf_usd: number;
  atf_mult: number;
  moola_onchain: number;
  last_scan_at: number | null;
  mining_accrued: number;
  mining_settled_at: number | null;
  verified: boolean;
  verify_status: string;
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
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moola_onchain DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_scan_at BIGINT;`;
  // Mining is checkpointed so boost only applies while ATF is actually held.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_accrued DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_settled_at BIGINT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reminded_at BIGINT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_status TEXT NOT NULL DEFAULT 'none';`;
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
    ads_all_bonus_day: (r.ads_all_bonus_day as string) ?? null,
    referred_by: (r.referred_by as string) ?? null,
    ref_first_done: Boolean(r.ref_first_done),
    atf_usd: r.atf_usd != null ? Number(r.atf_usd) : 0,
    atf_mult: r.atf_mult != null ? Number(r.atf_mult) : 1,
    moola_onchain: r.moola_onchain != null ? Number(r.moola_onchain) : 0,
    last_scan_at: r.last_scan_at != null ? Number(r.last_scan_at) : null,
    mining_accrued: r.mining_accrued != null ? Number(r.mining_accrued) : 0,
    mining_settled_at: r.mining_settled_at != null ? Number(r.mining_settled_at) : null,
    verified: Boolean(r.verified),
    verify_status: (r.verify_status as string) ?? 'none',
    created_at: Number(r.created_at),
  };
}

export async function getUser(id: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function upsertUser(input: {
  id: string;
  first_name?: string;
  username?: string | null;
  photo_url?: string | null;
  referredBy?: string | null;
}): Promise<UserRow> {
  await ensureSchema();
  const existing = await getUser(input.id);

  if (existing) {
    const { rows } = await sql`
      UPDATE users
      SET first_name = ${input.first_name ?? existing.first_name},
          username   = ${input.username ?? existing.username},
          photo_url  = ${input.photo_url ?? existing.photo_url}
      WHERE id = ${input.id}
      RETURNING *;
    `;
    return rowToUser(rows[0]);
  }

  // Only accept a real, different referrer.
  let referredBy = input.referredBy ?? null;
  if (referredBy === input.id) referredBy = null;
  if (referredBy && !(await getUser(referredBy))) referredBy = null;

  const { rows } = await sql`
    INSERT INTO users (id, first_name, username, photo_url, referred_by, created_at)
    VALUES (${input.id}, ${input.first_name ?? 'Miner'}, ${input.username ?? null},
            ${input.photo_url ?? null}, ${referredBy}, ${nowMs()})
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

/** Total MOOLA a user has withdrawn or has queued (excludes rejected/failed). */
export async function withdrawnTotal(userId: string): Promise<number> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals
    WHERE user_id = ${userId} AND status IN ('pending','processing','paid');
  `;
  return Math.round(Number(rows[0]?.s ?? 0) * 100) / 100;
}

export async function getSocialDone(userId: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT task_id FROM social_tasks WHERE user_id = ${userId};`;
  return rows.map((r) => String(r.task_id));
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
