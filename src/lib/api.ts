import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from './auth';
import { upsertUser, getUser, getSocialDone, withdrawnTotal, getVideoTaskState, lpDistributed, type UserRow } from './db';
import { serialize } from './state';
import { moolaMarketStats } from './stonfi';
import { lpRewardsEnabled } from './lp';
import { game } from './config';

export type Ctx = { user: UserRow; startParam: string | null };

/**
 * Authenticate a request via the `x-init-data` header (Telegram initData),
 * upserting the user (and applying a referral on first sight).
 */
export async function authed(req: NextRequest): Promise<Ctx | null> {
  const initData = req.headers.get('x-init-data') ?? '';
  const result = verifyInitData(initData);
  if (!result) return null;

  // Client IP (Vercel sets x-forwarded-for; first entry is the real client).
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();

  try {
    const user = await upsertUser({
      id: result.user.id,
      first_name: result.user.first_name,
      username: result.user.username,
      photo_url: result.user.photo_url,
      referredBy: result.startParam,
      signupIp: ip,
    });
    return { user, startParam: result.startParam };
  } catch {
    // IP cap (or a transient error) — treat as unauthenticated.
    return null;
  }
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

/**
 * Channel gate for earning actions. Returns a `needsChannel` response when the
 * user is a Telegram-confirmed non-member of the official channel, else null
 * (member, unknown/outage, or gate not configured → allowed). Import lazily to
 * avoid a cycle (telegramBot → config → …).
 */
export async function channelBlock(userId: string) {
  const { channelGateEnabled, channelMembership } = await import('./telegramBot');
  if (!channelGateEnabled()) return null;
  if ((await channelMembership(userId)) === 'not_member') {
    return json({ needsChannel: true, channelUrl: process.env.NEXT_PUBLIC_CHANNEL_URL || '' });
  }
  return null;
}

/** Re-fetch a user and return their serialized public state. */
export async function userResponse(id: string, extra?: Record<string, unknown>) {
  const u = await getUser(id);
  if (!u) return unauthorized();
  const [socialDone, wTotal, stats, videoTask, lpDist] = await Promise.all([
    getSocialDone(id),
    withdrawnTotal(id),
    // Live market cap embedded so the dashboard never depends on a separate
    // fetch (cached 60s server-side; 0 on any error → client falls back).
    moolaMarketStats().catch(() => null),
    getVideoTaskState(id).catch(() => null),
    lpRewardsEnabled() ? lpDistributed().catch(() => 0) : Promise.resolve(0),
  ]);
  const lpCap = game.lpRewards.capMoola;
  return NextResponse.json({
    user: {
      ...serialize(u, socialDone),
      withdrawnTotal: wTotal,
      marketCapUsd: stats?.marketCapUsd ?? 0,
      livePriceUsd: stats?.moolaPriceUsd ?? 0,
      videoTask,
      lpRewardsActive: lpRewardsEnabled() && lpDist < lpCap,
      lpBudgetLeftPct: Math.max(0, Math.min(100, Math.round((1 - lpDist / lpCap) * 100))),
      // First-withdrawal gate (anti multi-account).
      hasWithdrawn: wTotal > 0,
      firstWithdrawMin: game.withdraw.firstMin,
      firstWithdrawUnlockAt: u.created_at + game.withdraw.firstAgeHours * 3_600_000,
    },
    ...(extra ?? {}),
  });
}
