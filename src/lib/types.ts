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

  level: number;
  toNextLevel: number;
  levelFloor: number;
  levelCeil: number;

  dailyYield: number;
  hashrate: number;
  boostPct: number;

  activeNft: string;
  activeNftImage: string;
  ownedNfts: string[];
  socialDone: string[];

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
    allDone: boolean;
  };

  collection: NftView[];
};

export type FriendData = {
  invited: number;
  earning: number;
  earned: number;
  inviteLink: string;
  commissionPct: number;
  friends: Array<{ name: string; earning: boolean; earned: number; joinedAt: number }>;
};

export type HistoryItem = {
  kind: string;
  amount: number;
  label: string;
  createdAt: number;
};
