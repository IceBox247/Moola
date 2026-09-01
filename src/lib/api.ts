import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from './auth';
import { upsertUser, getUser, getSocialDone, withdrawnTotal, type UserRow } from './db';
import { serialize } from './state';
import { moolaMarketStats } from './stonfi';

export type Ctx = { user: UserRow; startParam: string | null };

/**
 * Authenticate a request via the `x-init-data` header (Telegram initData),
 * upserting the user (and applying a referral on first sight).
 */
export async function authed(req: NextRequest): Promise<Ctx | null> {
  const initData = req.headers.get('x-init-data') ?? '';
  const result = verifyInitData(initData);
  if (!result) return null;

  const user = await upsertUser({
    id: result.user.id,
    first_name: result.user.first_name,
    username: result.user.username,
    photo_url: result.user.photo_url,
    referredBy: result.startParam,
  });
  return { user, startParam: result.startParam };
}

export function json(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** Re-fetch a user and return their serialized public state. */
export async function userResponse(id: string, extra?: Record<string, unknown>) {
  const u = await getUser(id);
  if (!u) return unauthorized();
  const [socialDone, wTotal, stats] = await Promise.all([
    getSocialDone(id),
    withdrawnTotal(id),
    // Live market cap embedded so the dashboard never depends on a separate
    // fetch (cached 60s server-side; 0 on any error → client falls back).
    moolaMarketStats().catch(() => null),
  ]);
  return NextResponse.json({
    user: {
      ...serialize(u, socialDone),
      withdrawnTotal: wTotal,
      marketCapUsd: stats?.marketCapUsd ?? 0,
      livePriceUsd: stats?.moolaPriceUsd ?? 0,
    },
    ...(extra ?? {}),
  });
}
