import { sql, dayKey, nowMs, type UserRow } from './db';
import {
  game,
  dailyYield,
  hashrate,
  levelForEarnings,
  toNextLevel,
  levelThreshold,
  nftById,
  nfts,
  type NftDef,
} from './config';

const SESSION_MS = game.mining.sessionHours * 60 * 60 * 1000;

export function activeBoost(u: UserRow): number {
  return nftById(u.active_nft)?.boostPct ?? 0;
}

export function ownedSet(u: UserRow): Set<string> {
  return new Set(u.owned_nfts.split(',').map((s) => s.trim()).filter(Boolean));
}

/** MOOLA accrued so far in the current (unclaimed) mining session. */
export function pendingMining(u: UserRow, at = nowMs()): number {
  if (!u.mining_started_at) return 0;
  const level = levelForEarnings(u.lifetime);
  const perMs = dailyYield(level, activeBoost(u)) / (24 * 60 * 60 * 1000);
  const elapsed = Math.min(at - u.mining_started_at, SESSION_MS);
  return Math.max(0, elapsed * perMs);
}

export function isSessionComplete(u: UserRow, at = nowMs()): boolean {
  return !!u.mining_started_at && at - u.mining_started_at >= SESSION_MS;
}

/** Roll daily ad counters forward if we've crossed into a new day. */
export async function ensureAdDay(u: UserRow): Promise<UserRow> {
  const today = dayKey();
  if (u.ads_day !== today) {
    await sql`UPDATE users SET ads_day = ${today}, ads_watched = 0, ads_verified = 0 WHERE id = ${u.id};`;
    return { ...u, ads_day: today, ads_watched: 0, ads_verified: 0 };
  }
  return u;
}

export function nftView(u: UserRow, def: NftDef, owned: Set<string>) {
  const level = levelForEarnings(u.lifetime);
  const isOwned = owned.has(def.id);
  let unlockable = false;
  let lockLabel = '';
  if (isOwned) {
    lockLabel = 'Owned';
  } else if (def.unlock === 'level') {
    unlockable = level >= (def.requiredLevel ?? 1);
    lockLabel = unlockable ? 'Claim' : `Reach Lvl ${def.requiredLevel}`;
  } else if (def.unlock === 'mint') {
    unlockable = u.balance >= (def.costMoola ?? 0);
    lockLabel = `${def.costMoola} MOOLA`;
  }
  return {
    id: def.id,
    name: def.name,
    image: def.image,
    rarity: def.rarity,
    boostPct: def.boostPct,
    blurb: def.blurb,
    unlock: def.unlock,
    requiredLevel: def.requiredLevel ?? null,
    costMoola: def.costMoola ?? null,
    owned: isOwned,
    active: u.active_nft === def.id,
    unlockable,
    lockLabel,
  };
}

export type PublicUser = ReturnType<typeof serialize>;

export function serialize(u: UserRow, socialDone: string[] = [], at = nowMs()) {
  const level = levelForEarnings(u.lifetime);
  const boost = activeBoost(u);
  const pending = pendingMining(u, at);
  const today = dayKey(at);
  const owned = ownedSet(u);

  const canCheckIn = !u.checkin_at || dayKey(u.checkin_at) !== today;
  const nextCheckinDay = Math.min(u.checkin_day + (canCheckIn ? 1 : 0), game.checkin.rewards.length) || 1;

  const adsWatched = u.ads_day === today ? u.ads_watched : 0;
  const adsVerified = u.ads_day === today ? u.ads_verified : 0;

  return {
    id: u.id,
    firstName: u.first_name,
    username: u.username,
    photoUrl: u.photo_url,
    onboarded: u.onboarded,
    soundFx: u.sound_fx,
    wallet: u.wallet,

    balance: round4(u.balance),
    lifetime: round4(u.lifetime),

    level,
    toNextLevel: round2(toNextLevel(u.lifetime)),
    levelFloor: levelThreshold(level),
    levelCeil: levelThreshold(level + 1),

    dailyYield: dailyYield(level, boost),
    hashrate: hashrate(level, boost),
    boostPct: boost,

    activeNft: u.active_nft,
    activeNftImage: nftById(u.active_nft)?.image ?? '/nft/genesis.webp',
    ownedNfts: [...owned],
    socialDone,

    mining: {
      active: !!u.mining_started_at,
      startedAt: u.mining_started_at,
      endsAt: u.mining_started_at ? u.mining_started_at + SESSION_MS : null,
      sessionMs: SESSION_MS,
      pending: round4(pending),
      complete: isSessionComplete(u, at),
    },

    checkin: {
      day: u.checkin_day,
      canClaim: canCheckIn,
      nextDay: nextCheckinDay,
      rewards: game.checkin.rewards as unknown as number[],
    },

    ads: {
      day: today,
      watched: adsWatched,
      watchTotal: game.ads.watch.count,
      watchReward: game.ads.watch.reward,
      verified: adsVerified,
      verifyTotal: game.ads.verify.count,
      verifyReward: game.ads.verify.reward,
      verifyWaitSeconds: game.ads.verify.waitSeconds,
      allDone: adsWatched >= game.ads.watch.count && adsVerified >= game.ads.verify.count,
    },

    collection: nfts.map((def) => nftView(u, def, owned)),
  };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function round2(n: number): number {
  return Math.round(n * 1e2) / 1e2;
}
