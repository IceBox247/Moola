/**
 * Central Moola game & economy configuration.
 * Tune the whole economy from this one file.
 */

export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN ?? '',
  BOT_USERNAME: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'MoolaMiningBot',
  ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH === '1' || !process.env.BOT_TOKEN,
};

export const game = {
  currency: 'MOOLA',

  mining: {
    sessionHours: 8,
    baseDailyYield: 10, // MOOLA/day at level 1
    yieldPerLevel: 6,
    baseHashrate: 0.2, // TH/s (cosmetic)
    hashratePerLevel: 0.15,
  },

  leveling: {
    baseThreshold: 100, // lifetime MOOLA for level 1 -> 2
    growth: 1.6,
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
    { id: 'retweet', title: 'X (Twitter) Retweet', reward: 3, kind: 'x' },
  ],

  referral: {
    // Inviter earns this % of EVERYTHING their referred friends mine/earn,
    // credited automatically each time the friend earns. Lifetime, no cap.
    commissionPct: 5,
  },

  withdraw: {
    min: 60,
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

/** Lifetime-earnings threshold required to be at a given level. */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  const { baseThreshold, growth } = game.leveling;
  let total = 0;
  let step: number = baseThreshold;
  for (let l = 1; l < level; l++) {
    total += step;
    step = Math.round(step * growth);
  }
  return total;
}

export function levelForEarnings(lifetime: number): number {
  let level = 1;
  while (lifetime >= levelThreshold(level + 1)) level++;
  return level;
}

export function toNextLevel(lifetime: number): number {
  const level = levelForEarnings(lifetime);
  return Math.max(0, levelThreshold(level + 1) - lifetime);
}

export function dailyYield(level: number, boostPct = 0): number {
  const base = game.mining.baseDailyYield + (level - 1) * game.mining.yieldPerLevel;
  return +(base * (1 + boostPct / 100)).toFixed(4);
}

export function hashrate(level: number, boostPct = 0): number {
  const base = game.mining.baseHashrate + (level - 1) * game.mining.hashratePerLevel;
  return +(base * (1 + boostPct / 100)).toFixed(2);
}
