/**
 * Central Moola game & economy configuration.
 * Tune the whole economy from this one file.
 */

export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN ?? '',
  BOT_USERNAME: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'MoolaMiningBot',
  ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH === '1' || !process.env.BOT_TOKEN,
  // On-chain jetton master addresses (fill these to activate boost detection).
  ATF_JETTON: process.env.ATF_JETTON_ADDRESS ?? '',
  MOOLA_JETTON: process.env.MOOLA_JETTON_ADDRESS ?? '',
  TONAPI_KEY: process.env.TONAPI_KEY ?? '',
};

export const MAX_LEVEL = 800;

/** Fixed MOOLA total supply (50 billion) — used for market-cap display. */
export const MOOLA_TOTAL_SUPPLY = 50_000_000_000;

export const game = {
  currency: 'MOOLA',

  mining: {
    sessionHours: 24,
    baseDailyYield: 10, // MOOLA/day at level 1
    growthPerLevel: 1.0065, // daily yield compounds per level up to MAX_LEVEL
    yieldSteepness: 5, // multiplies the per-level increase (5× the base step)
    baseHashrate: 0.2, // TH/s (cosmetic)
    hashratePerLevel: 0.009,
  },

  // Levels are priced in USD, starting at $0.01 for the first paid step and
  // building up. The USD ladder is snapshotted to MOOLA once at the launch
  // price and LOCKED — so the MOOLA needed per level never floats with price.
  //   fixedMoolaPriceUsd = launch snapshot: $0.01 == 500 MOOLA.
  //   baseHold = 500 MOOLA == $0.01 for the level 1 -> 2 step.
  leveling: {
    baseHold: 500, // MOOLA held for level 1 -> 2 ( == $0.01 at snapshot )
    holdGrowth: 1.0075, // required holding compounds per level
    fixedMoolaPriceUsd: 0.00002, // locked launch price: 1 MOOLA = $0.00002
  },

  // ATF partnership: hold ATF in your connected wallet for a mining multiplier.
  // Boost is pure mining power, applied on top of your level, regardless of it.
  atfBoost: {
    // One-time MOOLA bonus, credited the first time we detect ATF in a
    // connected wallet (on top of the ongoing mining multiplier).
    holderBonus: 1000,
    // Multipliers step by +2 (2×,4×,…,64×). USD thresholds spread wide so big
    // multipliers demand real holdings — e.g. 64× needs $10k of ATF, not $100.
    tiers: [
      { minUsd: 0.5, maxUsd: 0.7, mult: 2 },
      { minUsd: 0.7, maxUsd: 1, mult: 4 },
      { minUsd: 1, maxUsd: 1.3, mult: 6 },
      { minUsd: 1.3, maxUsd: 1.8, mult: 8 },
      { minUsd: 1.8, maxUsd: 2.5, mult: 10 },
      { minUsd: 2.5, maxUsd: 3.5, mult: 12 },
      { minUsd: 3.5, maxUsd: 5, mult: 14 },
      { minUsd: 5, maxUsd: 6.5, mult: 16 },
      { minUsd: 6.5, maxUsd: 9, mult: 18 },
      { minUsd: 9, maxUsd: 12, mult: 20 },
      { minUsd: 12, maxUsd: 17, mult: 22 },
      { minUsd: 17, maxUsd: 23, mult: 24 },
      { minUsd: 23, maxUsd: 32, mult: 26 },
      { minUsd: 32, maxUsd: 44, mult: 28 },
      { minUsd: 44, maxUsd: 60, mult: 30 },
      { minUsd: 60, maxUsd: 85, mult: 32 },
      { minUsd: 85, maxUsd: 115, mult: 34 },
      { minUsd: 115, maxUsd: 155, mult: 36 },
      { minUsd: 155, maxUsd: 215, mult: 38 },
      { minUsd: 215, maxUsd: 300, mult: 40 },
      { minUsd: 300, maxUsd: 410, mult: 42 },
      { minUsd: 410, maxUsd: 560, mult: 44 },
      { minUsd: 560, maxUsd: 775, mult: 46 },
      { minUsd: 775, maxUsd: 1070, mult: 48 },
      { minUsd: 1070, maxUsd: 1470, mult: 50 },
      { minUsd: 1470, maxUsd: 2025, mult: 52 },
      { minUsd: 2025, maxUsd: 2790, mult: 54 },
      { minUsd: 2790, maxUsd: 3840, mult: 56 },
      { minUsd: 3840, maxUsd: 5280, mult: 58 },
      { minUsd: 5280, maxUsd: 7275, mult: 60 },
      { minUsd: 7275, maxUsd: 10000, mult: 62 },
      { minUsd: 10000, maxUsd: Infinity, mult: 64 },
    ],
  },

  checkin: {
    rewards: [5, 5, 5, 5, 5, 5, 700], // Day 1..7
    resetHours: 48,
  },

  ads: {
    watch: { count: 10, reward: 1.25, label: 'Watch Ads' },
    verify: { count: 5, reward: 2.5, label: 'Verify Ads', waitSeconds: 5 },
  },

  social: [
    { id: 'join_partner', title: 'Join Official Partner', reward: 0, required: true, kind: 'partner' },
    { id: 'join_channel', title: 'Join Official Channel', reward: 0, required: true, kind: 'channel' },
    { id: 'follow_x', title: 'Follow X (Twitter)', reward: 5, kind: 'x' },
    { id: 'subscribe_youtube', title: 'Subscribe on YouTube', reward: 10, kind: 'youtube' },
    { id: 'retweet', title: 'X (Twitter) Retweet', reward: 3, kind: 'x_post' },
    { id: 'react_post', title: 'React to this Post', reward: 3, kind: 'react_post' },
    { id: 'x_like', title: 'Like this Post', reward: 5, kind: 'x_engage' },
    { id: 'x_retweet2', title: 'Retweet this Post', reward: 5, kind: 'x_engage' },
    { id: 'x_comment', title: 'Comment on this Post', reward: 5, kind: 'x_engage' },
    { id: 'x_vote', title: 'Go Vote on X', reward: 5, kind: 'x_vote' },
  ],

  referral: {
    firstTaskReward: 5, // one-time, when a friend completes their first task
    allAdsBonus: 50, // when a friend finishes all their daily ads (once/day)
    miningCommissionPct: 5, // % of a friend's MINED MOOLA, every claim, lifetime
  },

  withdraw: {
    min: 60,
    // Withdrawals that push a user's lifetime withdrawn total over this need a
    // one-time identity verification (video + photo). MOOLA isn't tradeable yet,
    // so this is a flat token amount rather than a USD value.
    verifyThreshold: 100000,
  },
} as const;

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Genesis';

export type NftDef = {
  id: string;
  name: string;
  image: string;
  rarity: Rarity;
  /** Extra mining yield this skin grants, as a % boost. */
  boostPct: number;
  /** How you get it: 'starter' (free), 'level' (reach requiredLevel), 'mint' (pay costMoola). */
  unlock: 'starter' | 'level' | 'mint';
  requiredLevel?: number;
  costMoola?: number;
  blurb: string;
};

/**
 * The Moola NFT collection — each cow is a selectable miner skin that grants a
 * mining boost. Images live in /public/nft.
 */
export const nfts: NftDef[] = [
  {
    id: 'genesis',
    name: 'Genesis Moola',
    image: '/nft/genesis.webp',
    rarity: 'Genesis',
    boostPct: 0,
    unlock: 'starter',
    blurb: 'The original. Every miner starts here.',
  },
  {
    id: 'street',
    name: 'Street Moola',
    image: '/nft/street.webp',
    rarity: 'Common',
    boostPct: 5,
    unlock: 'mint',
    costMoola: 40,
    blurb: 'Hoodie up, chain on. Certified degen.',
  },
  {
    id: 'biker',
    name: 'Biker Moola',
    image: '/nft/biker.webp',
    rarity: 'Common',
    boostPct: 5,
    unlock: 'mint',
    costMoola: 40,
    blurb: 'Leather jacket, zero chill.',
  },
  {
    id: 'hippie',
    name: 'Hippie Moola',
    image: '/nft/hippie.webp',
    rarity: 'Common',
    boostPct: 8,
    unlock: 'mint',
    costMoola: 60,
    blurb: 'Peace, love, and passive yield.',
  },
  {
    id: 'sheriff',
    name: 'Sheriff Moola',
    image: '/nft/sheriff.webp',
    rarity: 'Rare',
    boostPct: 12,
    unlock: 'level',
    requiredLevel: 3,
    blurb: 'New sheriff of the pasture in town.',
  },
  {
    id: 'baller',
    name: 'Baller Moola',
    image: '/nft/baller.webp',
    rarity: 'Rare',
    boostPct: 12,
    unlock: 'mint',
    costMoola: 150,
    blurb: 'Number 13. Always drains the three.',
  },
  {
    id: 'scientist',
    name: 'Professor Moola',
    image: '/nft/scientist.webp',
    rarity: 'Rare',
    boostPct: 15,
    unlock: 'mint',
    costMoola: 200,
    blurb: 'Brewing the next 100x in the lab.',
  },
  {
    id: 'cyber',
    name: 'Cyber Moola',
    image: '/nft/cyber.webp',
    rarity: 'Epic',
    boostPct: 20,
    unlock: 'mint',
    costMoola: 350,
    blurb: 'Jacked into the hashrate matrix.',
  },
  {
    id: 'viking',
    name: 'Viking Moola',
    image: '/nft/viking.webp',
    rarity: 'Epic',
    boostPct: 22,
    unlock: 'level',
    requiredLevel: 6,
    blurb: 'Raids liquidity pools for breakfast.',
  },
  {
    id: 'astronaut',
    name: 'Cosmo Moola',
    image: '/nft/astronaut.webp',
    rarity: 'Legendary',
    boostPct: 30,
    unlock: 'mint',
    costMoola: 600,
    blurb: 'To the moon — literally lives there.',
  },
  {
    id: 'samurai',
    name: 'Shogun Moola',
    image: '/nft/samurai.webp',
    rarity: 'Legendary',
    boostPct: 35,
    unlock: 'level',
    requiredLevel: 10,
    blurb: 'Master of the blade and the blockchain.',
  },
  {
    id: 'bubble',
    name: 'Bubble Moola',
    image: '/nft/bubble.webp',
    rarity: 'Common',
    boostPct: 6,
    unlock: 'mint',
    costMoola: 50,
    blurb: 'Cap backwards, bubblegum popping. Pure vibes.',
  },
  {
    id: 'thug',
    name: 'OG Moola',
    image: '/nft/thug.webp',
    rarity: 'Epic',
    boostPct: 20,
    unlock: 'mint',
    costMoola: 320,
    blurb: 'Deal-with-it shades. Never sells the dip.',
  },
  {
    id: 'beanie',
    name: 'Frost Moola',
    image: '/nft/beanie.webp',
    rarity: 'Rare',
    boostPct: 14,
    unlock: 'mint',
    costMoola: 180,
    blurb: 'Puffer jacket on, cold enough to HODL.',
  },
];

export function nftById(id: string): NftDef | undefined {
  return nfts.find((n) => n.id === id);
}

/** MOOLA you must HOLD to be at a given level (1..MAX_LEVEL). Level 1 = 0. */
export function requiredMoola(level: number): number {
  if (level <= 1) return 0;
  const n = Math.min(MAX_LEVEL, level);
  const { baseHold, holdGrowth } = game.leveling;
  return Math.round(baseHold * (n - 1) * Math.pow(holdGrowth, n - 1));
}

/** Highest level whose required holding is covered by `held` MOOLA. */
export function levelForHoldings(held: number): number {
  let level = 1;
  while (level < MAX_LEVEL && held >= requiredMoola(level + 1)) level++;
  return level;
}

/** MOOLA still needed to reach the next level (0 at max). */
export function toNextLevel(held: number): number {
  const level = levelForHoldings(held);
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, requiredMoola(level + 1) - held);
}

/** Convert a MOOLA amount to its locked USD value (fixed launch snapshot). */
export function moolaToUsd(moola: number): number {
  return moola * game.leveling.fixedMoolaPriceUsd;
}

/** Locked USD value required to HOLD to reach a given level. */
export function requiredUsd(level: number): number {
  return moolaToUsd(requiredMoola(level));
}

/**
 * Base daily yield for a level (before NFT/ATF boosts).
 * The gap above level 1 is scaled by `yieldSteepness`, so the per-level step is
 * that many times bigger while the curve keeps its shape. Level 1 stays at base.
 */
export function baseDailyYield(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  const base = game.mining.baseDailyYield;
  const grown = base * Math.pow(game.mining.growthPerLevel, l - 1);
  return +(base + game.mining.yieldSteepness * (grown - base)).toFixed(2);
}

/** ATF holding (USD value) -> mining multiplier. */
export function atfMultiplier(usd: number): number {
  for (const t of game.atfBoost.tiers) if (usd >= t.minUsd && usd < t.maxUsd) return t.mult;
  return 1;
}

/** Effective daily yield: level base × NFT boost × ATF multiplier. */
export function dailyYield(level: number, nftBoostPct = 0, atfMult = 1): number {
  return +(baseDailyYield(level) * (1 + nftBoostPct / 100) * atfMult).toFixed(4);
}

/** Cosmetic hashrate shown as TH/s, scaled by the ATF multiplier. */
export function hashrate(level: number, atfMult = 1): number {
  const base = game.mining.baseHashrate + (level - 1) * game.mining.hashratePerLevel;
  return +(base * atfMult).toFixed(2);
}
