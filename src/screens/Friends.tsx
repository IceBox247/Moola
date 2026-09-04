'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { AnimatedNumber } from '@/components/ui';
import { fmt, timeAgo } from '@/lib/format';
import { haptic, openLink, tg } from '@/lib/telegram';
import type { FriendData } from '@/lib/types';

// Module-level cache so re-opening the tab shows last data instantly while it
// refreshes in the background (no big empty box on every visit).
let friendsCache: FriendData | null = null;
let friendsAt = 0;
const FRIENDS_TTL_MS = 60_000;

export function FriendsScreen() {
  const { toast } = useStore();
  const [data, setData] = useState<FriendData | null>(friendsCache);
  const [reminding, setReminding] = useState<string | null>(null);

  useEffect(() => {
    // Tabs remount on every switch — serve the cached list and only refetch
    // when it's actually stale, instead of hitting the API each visit.
    if (friendsCache && Date.now() - friendsAt < FRIENDS_TTL_MS) return;
    friendsAt = Date.now();
    api<FriendData>('friends')
      .then((d) => {
        friendsCache = d;
        setData(d);
      })
      .catch(() => {});
  }, []);

  async function remind(friendId: string) {
    if (reminding) return;
    haptic('light');
    setReminding(friendId);
    try {
      const r = await api<{ sent: boolean }>('friends/remind', { friendId });
      if (r.sent) toast('Reminder sent! 🐮', 'good');
      else toast("Couldn't reach them — they may need to open the bot first.", 'bad');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setReminding(null);
    }
  }

  function copy() {
    if (!data) return;
    haptic('light');
    navigator.clipboard?.writeText(data.inviteLink).then(
      () => toast('Invite link copied!', 'good'),
      () => toast('Copy failed', 'bad')
    );
  }

  function share() {
    if (!data) return;
    haptic('medium');
    const text = `🐮 Join me on Moola — mine MOOLA, collect neon cow NFTs & withdraw your MOOLA!`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.inviteLink)}&text=${encodeURIComponent(text)}`;
    if (tg()?.openTelegramLink) tg()!.openTelegramLink!(url);
    else openLink(url);
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-black">
          <span className="neon-text">Friends</span>
        </h1>
        <p className="text-sm text-white/50">
          Earn bonuses <span className="gold-text font-bold">+ {data?.miningCommissionPct ?? 5}%</span> of everything
          your friends mine — forever.
        </p>
      </div>

      {/* Stat hero */}
      <div className="card-neon relative overflow-hidden p-5">
        {/* faint coin backdrop */}
        <Image
          src="/brand/coin.png"
          alt=""
          width={180}
          height={180}
          className="pointer-events-none absolute -right-6 -top-8 rotate-12 opacity-[0.12]"
        />
        <div className="relative text-center">
          {/* herd */}
          <div className="mb-3 flex justify-center -space-x-3">
            {['genesis', 'cyber', 'samurai', 'astronaut'].map((id, idx) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.08 }}
                className="h-11 w-11 overflow-hidden rounded-full border-2 border-ink-850 bg-ink-800 shadow-neon"
              >
                <Image src={`/nft/${id}.webp`} alt="" width={44} height={44} className="h-full w-full object-cover" />
              </motion.div>
            ))}
          </div>

          <div className="label">Earned from friends</div>
          <div className="text-4xl font-black leading-none">
            <AnimatedNumber value={data?.earned ?? 0} dp={2} className="neon-text" />{' '}
            <span className="gold-text text-xl">MOOLA</span>
          </div>

          {/* stat pills */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/25 py-2.5">
              <div className="text-2xl font-black neon-text">
                <AnimatedNumber value={data?.earning ?? 0} dp={0} />
              </div>
              <div className="text-[11px] text-white/50">earning now</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/25 py-2.5">
              <div className="text-2xl font-black text-white">
                <AnimatedNumber value={data?.invited ?? 0} dp={0} />
              </div>
              <div className="text-[11px] text-white/50">invited</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-gold-400/40 bg-gold-500/[0.06] px-4 py-2">
            <span className="gold-text text-base font-black">{data?.miningCommissionPct ?? 5}%</span>
            <span className="text-[11px] text-white/55">of all their mined MOOLA</span>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-2">
        <Rule icon="✅" text={<>Get <b className="gold-text">+{data?.firstTaskReward ?? 5} MOOLA</b> when a friend completes their <b>first</b> task.</>} />
        <Rule icon="🎁" text={<>Get <b className="gold-text">+{data?.allAdsBonus ?? 50} MOOLA</b> when a friend finishes <b>all</b> of their daily ads.</>} />
        <Rule icon="⛏️" text={<>Plus <b className="gold-text">{data?.miningCommissionPct ?? 5}%</b> of every friend&apos;s <b>mined</b> MOOLA — lifetime, auto-paid.</>} />
        <Rule icon="👋" text={<>Friends who only tap <b>Start</b> earn you nothing yet — they appear below so you can remind them.</>} />
      </div>

      {/* Referral rewards */}
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">🎁</div>
        <div className="flex-1">
          <div className="font-bold">Referral Rewards</div>
          <div className="text-xs text-white/50">
            Earned from friends: <span className="neon-text font-bold">{fmt(data?.earned ?? 0, 2)}</span> MOOLA
          </div>
        </div>
        <span className="chip bg-moo-500/15 text-moo-300">⚡ Auto-paid</span>
      </div>

      {/* Invite link */}
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">🔗</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Your Invite Link</div>
          <div className="truncate text-xs text-white/45">{data?.inviteLink ?? '…'}</div>
        </div>
        <button onClick={copy} className="btn-gold px-4 py-2 text-sm">
          Copy
        </button>
      </div>

      <button onClick={share} className="btn-primary w-full py-4 text-lg">
        📣 Share &amp; Invite Friends
      </button>

      {/* Invited list */}
      <div>
        <p className="mb-2 text-center text-sm text-white/40">Your invited friends</p>
        {data && data.friends.length > 0 ? (
          <div className="space-y-2">
            {data.friends.map((f, i) => (
              <div key={i} className="card flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm">
                    {f.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.name}</div>
                    <div className="text-[11px] text-white/40">{timeAgo(f.joinedAt)}</div>
                  </div>
                </div>
                {f.earning ? (
                  <div className="text-right">
                    <div className="text-sm font-black neon-text">{fmt(f.earned, 0)}</div>
                    <div className="text-[10px] text-white/40">they&apos;ve earned</div>
                  </div>
                ) : (
                  <button
                    onClick={() => remind(f.id)}
                    disabled={reminding === f.id}
                    className="btn-ghost px-4 py-1.5 text-xs disabled:opacity-60"
                  >
                    {reminding === f.id ? '…' : 'Remind'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-white/35">
            No invited friends yet.
            <br />
            Share your link to start earning!
          </p>
        )}
      </div>
    </div>
  );
}

function Rule({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-3 p-3.5 text-sm text-white/70">
      <span className="text-lg">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
