/** Client-facing types mirroring the server's serialize() output. */

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Genesis';

export type NftView = {
  id: string;
  name: string;
  image: string;
  rarity: Rarity;
  boostPct: number;
  blurb: string;
  unlock: 'starter' | 'level' | 'mint';
  requiredLevel: number | null;
  costMoola: number | null;
  owned: boolean;
  active: boolean;
  unlockable: boolean;
  lockLabel: string;
};

export type PublicUser = {
  id: string;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  onboarded: boolean;
  soundFx: boolean;
  wallet: string | null;

  balance: number;
  lifetime: number;
  held: number;

  level: number;
  maxLevel: number;
  toNextLevel: number;
  levelFloor: number;
  levelCeil: number;

  moolaPriceUsd: number;
  marketCapUsd?: number;
  livePriceUsd?: number;
  heldUsd: number;
  levelUsd: number;
  nextLevelUsd: number;
  toNextLevelUsd: number;

  dailyYield: number;
  hashrate: number;
  boostPct: number;

  atfUsd: number;
  atfMult: number;
  atfBonus: number;
  atfBonusClaimed: boolean;
  moolaOnchain: number;

  verified: boolean;
  verifyStatus: string; // 'none' | 'pending' | 'approved' | 'rejected'
  verifyThreshold: number;
  withdrawnTotal: number;
  withdrawFree: boolean; // free (no-fee) withdrawal available now
  withdrawNextFreeAt: number | null; // when the next free withdrawal unlocks
  withdrawFeeUsd: number; // fee for an extra withdrawal inside the window

  lpUsd: number; // USD value of the user's MOOLA/TON liquidity position
  lpDailyUsd: number; // estimated daily LP reward in USD
  lpRate: number; // daily LP reward rate (e.g. 0.02)
  lpRewardsActive?: boolean; // LP program configured and budget remaining
  lpBudgetLeftPct?: number; // % of the LP reward budget still available

  activeNft: string;
  activeNftImage: string;
  ownedNfts: string[];
  socialDone: string[];

  videoTask: {
    status: 'none' | 'pending' | 'approved' | 'rejected';
    url: string | null;
    slotsLeft: number;
    slotsTotal: number;
    reward: number;
  } | null;

  mining: {
    active: boolean;
    startedAt: number | null;
    endsAt: number | null;
    sessionMs: number;
    pending: number;
    complete: boolean;
  };

  checkin: {
    day: number;
    canClaim: boolean;
    nextDay: number;
    rewards: number[];
  };

  ads: {
    day: string;
    watched: number;
    watchTotal: number;
    watchReward: number;
    verified: number;
    verifyTotal: number;
    verifyReward: number;
    verifyWaitSeconds: number;
    watched2: number;
    watch2Total: number;
    watch2Reward: number;
    allDone: boolean;
  };

  collection: NftView[];
};

export type FriendData = {
  invited: number;
  earning: number;
  earned: number;
  inviteLink: string;
  firstTaskReward: number;
  allAdsBonus: number;
  miningCommissionPct: number;
  friends: Array<{ id: string; name: string; earning: boolean; earned: number; joinedAt: number }>;
};

export type HistoryItem = {
  kind: string;
  amount: number;
  label: string;
  createdAt: number;
};
