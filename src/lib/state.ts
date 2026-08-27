import { sql, dayKey, nowMs, getUser, addTx, type UserRow } from './db';
import {
  game,
  MAX_LEVEL,
  dailyYield,
  hashrate,
  levelForHoldings,
  toNextLevel,
  requiredMoola,
  requiredUsd,
  atfMultiplier,
  nftById,
  nfts,
  type NftDef,
} from './config';
import { scanWallet } from './ton';

const SESSION_MS = game.mining.sessionHours * 60 * 60 * 1000;

export function activeBoost(u: UserRow): number {
  return nftById(u.active_nft)?.boostPct ?? 0;
}

export function ownedSet(u: UserRow): Set<string> {
  return new Set(u.owned_nfts.split(',').map((s) => s.trim()).filter(Boolean));
}

/** MOOLA that counts toward your level: in-app balance or on-chain holdings. */
export function heldMoola(u: UserRow): number {
  return Math.max(u.balance, u.moola_onchain);
}

/** Current per-ms mining rate at the user's live level + NFT + ATF multiplier. */
function ratePerMs(u: UserRow): number {
  const level = levelForHoldings(heldMoola(u));
  const mult = u.atf_mult && u.atf_mult > 0 ? u.atf_mult : 1;
  return dailyYield(level, activeBoost(u), mult) / (24 * 60 * 60 * 1000);
}

/** MOOLA mined in the current *unsettled* segment (since the last checkpoint). */
export function pendingSegment(u: UserRow, at = nowMs()): number {
  if (!u.mining_started_at) return 0;
  const from = u.mining_settled_at ?? u.mining_started_at;
  const to = Math.min(at, u.mining_started_at + SESSION_MS);
  return Math.max(0, to - from) * ratePerMs(u);
}

/** Total MOOLA in the current session = already-settled + current segment. */
export function pendingMining(u: UserRow, at = nowMs()): number {
  if (!u.mining_started_at) return 0;
  return (u.mining_accrued || 0) + pendingSegment(u, at);
}

export function isSessionComplete(u: UserRow, at = nowMs()): boolean {
  return !!u.mining_started_at && at - u.mining_started_at >= SESSION_MS;
}

/**
 * Checkpoint: lock in everything mined so far at the CURRENT verified rate,
 * moving the settle marker to now. Called before any change that affects the
 * rate (a wallet re-scan) and before a claim — so boosted MOOLA is only ever
 * banked for the exact time the user actually held ATF.
 */
export async function settleMining(u: UserRow): Promise<UserRow> {
  if (!u.mining_started_at) return u;
  const now = nowMs();
  const accrued = (u.mining_accrued || 0) + pendingSegment(u, now);
  await sql`
    UPDATE users SET mining_accrued = ${accrued}, mining_settled_at = ${now}
    WHERE id = ${u.id} AND mining_started_at IS NOT NULL;
  `;
  return { ...u, mining_accrued: accrued, mining_settled_at: now };
}

/** Re-scan the wallet, settling the prior segment at the old rate first. */
export async function applyWalletScan(u: UserRow, address: string): Promise<UserRow> {
  const settled = await settleMining(u); // bank prior segment at the pre-scan rate
  const { atfUsd, moolaOnchain } = await scanWallet(address);
  const mult = atfMultiplier(atfUsd);
  await sql`
    UPDATE users
    SET wallet = ${address}, atf_usd = ${atfUsd}, atf_mult = ${mult},
        moola_onchain = ${moolaOnchain}, last_scan_at = ${nowMs()}
    WHERE id = ${settled.id};
  `;

  // One-time ATF holder bonus: the first scan that detects qualifying ATF
  // (mult > 1) credits a flat MOOLA reward. The conditional UPDATE guarantees
  // it's granted exactly once, even under concurrent scans.
  if (mult > 1) {
    const bonus = game.atfBoost.holderBonus;
    const { rows } = await sql`
      UPDATE users
      SET balance = balance + ${bonus}, lifetime = lifetime + ${bonus}, atf_bonus_claimed = TRUE
      WHERE id = ${settled.id} AND atf_bonus_claimed = FALSE
      RETURNING id;
    `;
    if (rows.length > 0) await addTx(settled.id, 'atf_bonus', bonus, 'ATF holder bonus 🤝');
  }

  return (await getUser(settled.id))!;
}

const RESCAN_INTERVAL_MS = 3 * 60 * 1000;

/** Re-verify holdings if the last scan is stale (keeps the boost honest). */
export async function maybeRescan(u: UserRow, force = false): Promise<UserRow> {
  if (!u.wallet) return u;
  const stale = force || !u.last_scan_at || nowMs() - u.last_scan_at > RESCAN_INTERVAL_MS;
  if (!stale) return u;
  return applyWalletScan(u, u.wallet);
}

export async function ensureAdDay(u: UserRow): Promise<UserRow> {
  const today = dayKey();
  if (u.ads_day !== today) {
    await sql`UPDATE users SET ads_day = ${today}, ads_watched = 0, ads_verified = 0 WHERE id = ${u.id};`;
    return { ...u, ads_day: today, ads_watched: 0, ads_verified: 0 };
  }
  return u;
}

export function nftView(u: UserRow, def: NftDef, owned: Set<string>, level: number) {
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
  const held = heldMoola(u);
  const level = levelForHoldings(held);
  const nftBoost = activeBoost(u);
  const atfMult = u.atf_mult && u.atf_mult > 0 ? u.atf_mult : 1;
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
    held: round4(held),

    level,
    maxLevel: MAX_LEVEL,
    toNextLevel: round2(toNextLevel(held)),
    levelFloor: requiredMoola(level),
    levelCeil: requiredMoola(level + 1),

    // Levels valued in USD (fixed launch-price snapshot, locked).
    moolaPriceUsd: game.leveling.fixedMoolaPriceUsd,
    heldUsd: round4(heldMoola(u) * game.leveling.fixedMoolaPriceUsd),
    levelUsd: round4(requiredUsd(level)),
    nextLevelUsd: round4(requiredUsd(level + 1)),
    toNextLevelUsd: round4(toNextLevel(held) * game.leveling.fixedMoolaPriceUsd),

    dailyYield: dailyYield(level, nftBoost, atfMult),
    hashrate: hashrate(level, atfMult),
    boostPct: nftBoost,

    // ATF partnership
    atfUsd: round2(u.atf_usd),
    atfMult,
    atfBonus: game.atfBoost.holderBonus,
    atfBonusClaimed: u.atf_bonus_claimed,
    moolaOnchain: round2(u.moola_onchain),

    verified: u.verified,
    verifyStatus: u.verify_status,
    verifyThreshold: game.withdraw.verifyThreshold,

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

    collection: nfts.map((def) => nftView(u, def, owned, level)),
  };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function round2(n: number): number {
  return Math.round(n * 1e2) / 1e2;
}
