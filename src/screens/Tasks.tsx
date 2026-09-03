'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { ProgressBar } from '@/components/ui';
import { fmt } from '@/lib/format';
import { haptic, notify, openLink, selection } from '@/lib/telegram';
import { unlockAudio, playSfx } from '@/lib/audio';
import { adsEnabled, adsgramEnabled, loadAdSdk, showRewardedAd } from '@/lib/ads';
import { socialLink, links } from '@/lib/links';
import { api } from '@/lib/client';
import type { PublicUser } from '@/lib/types';

const SOCIAL = [
  { id: 'channel_join', title: 'Join Official Moola Channel', reward: 10, icon: '📣', kind: 'channel' },
  { id: 'follow_x', title: 'Follow X (Twitter)', reward: 5, icon: '🐦', kind: 'x' },
  { id: 'subscribe_youtube', title: 'Subscribe on YouTube', reward: 10, icon: '▶️', kind: 'youtube' },
  { id: 'retweet', title: 'X (Twitter) Retweet', reward: 3, icon: '🔁', kind: 'x_post' },
  { id: 'react_post', title: 'React to this Post', reward: 3, icon: '❤️', kind: 'react_post' },
  { id: 'x_like', title: 'Like this Post', reward: 5, icon: '❤️', kind: 'x_engage' },
  { id: 'x_retweet2', title: 'Retweet this Post', reward: 5, icon: '🔁', kind: 'x_engage' },
  { id: 'x_comment', title: 'Comment on this Post', reward: 5, icon: '💬', kind: 'x_engage' },
  { id: 'x_vote', title: 'Go Vote on X', reward: 5, icon: '🗳️', kind: 'x_vote' },
  { id: 'boost_channel', title: 'Boost Moola Channel', reward: 5, icon: '🚀', kind: 'boost' },
];

// New Moola YouTube video — featured at the top of the main Tasks page.
const VIDEO_TASKS = [
  { id: 'yt_comment', title: 'Comment on the video', reward: 5, icon: '💬', kind: 'yt_video' },
  { id: 'yt_like', title: 'Like the video', reward: 5, icon: '❤️', kind: 'yt_video' },
  { id: 'yt_share', title: 'Share the video', reward: 5, icon: '🔗', kind: 'yt_video' },
  { id: 'yt2_comment', title: 'Comment on our 2nd video', reward: 5, icon: '💬', kind: 'yt_video2' },
];

// Moola on TikTok — featured on the main Tasks page.
const TIKTOK_TASKS = [
  { id: 'tt_comment1', title: 'Comment on our TikTok', reward: 7, icon: '💬', kind: 'tt_v1' },
  { id: 'tt_like2', title: 'Comment & Like our TikTok', reward: 7, icon: '❤️', kind: 'tt_v2' },
  { id: 'tt_follow', title: 'Follow Moola on TikTok', reward: 10, icon: '➕', kind: 'tt_follow' },
  { id: 'tt_share', title: 'Share / Repost our TikTok', reward: 7, icon: '🔁', kind: 'tt_v2' },
];

// Combined X engagement — featured on the main Tasks page.
const X_TASKS = [
  { id: 'x_engage_all', title: 'Like, Comment & Share our X post', reward: 15, icon: '𝕏', kind: 'x_post' },
];

/** If the server blocked an earn action for not being in the channel, open the
 *  channel and return true so the caller can bail. */
function channelGated(res: { needsChannel?: boolean; channelUrl?: string } | undefined): boolean {
  if (res?.needsChannel) {
    haptic('medium');
    openLink(res.channelUrl || links.channel);
    return true;
  }
  return false;
}

// Moola on Facebook — featured on the main Tasks page.
const FB_TASKS = [
  { id: 'fb_follow', title: 'Follow us on Facebook', reward: 10, icon: '👍', kind: 'fb_follow' },
  { id: 'fb_engage', title: 'Like, Comment & Share our posts', reward: 15, icon: '💙', kind: 'fb_engage' },
];

export function TasksScreen() {
  const { user } = useStore();
  const [tab, setTab] = useState<'earn' | 'social'>('earn');
  const u = user!;

  const dailyMax =
    u.ads.watchTotal * u.ads.watchReward + u.ads.verifyTotal * u.ads.verifyReward;

  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div className="card-neon relative overflow-hidden p-5">
        <Image
          src="/brand/coin.png"
          alt=""
          width={150}
          height={150}
          className="pointer-events-none absolute -right-5 -top-6 rotate-[14deg] opacity-[0.14]"
        />
        <motion.div
          className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.28), transparent 70%)' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <div className="relative">
          <div className="label text-moo-300/70">Daily Rewards</div>
          <h1 className="text-[32px] font-black leading-none tracking-tight">
            <span className="h-grad">Big</span> <span className="neon-text">Earn</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/55">Rewards go straight to your balance</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-500/[0.08] px-3 py-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-semibold text-white/70">
              Earn up to <span className="gold-text font-black">{fmt(dailyMax, 0)} MOOLA</span> / day
            </span>
          </div>
        </div>
      </div>

      {/* Animated segmented tabs */}
      <div className="relative flex rounded-2xl border border-white/8 bg-black/30 p-1">
        {(['earn', 'social'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => {
                selection();
                setTab(t);
              }}
              className="relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-bold"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-b from-moo-400 to-moo-600 shadow-neon"
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                />
              )}
              <span className={active ? 'text-ink-900' : 'text-white/55'}>
                {t === 'earn' ? '⚡ Big Earn' : '🎯 Social Tasks'}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'earn' ? (
        <>
          <BumperTask done={u.socialDone.includes('join_dollarbumper')} />
          <VideoTasks />
          <XTasks />
          <TikTokTasks />
          <FacebookTasks />
          <CheckIn />
          <AdTasks />
        </>
      ) : (
        <div className="space-y-3">
          <BumperTask done={u.socialDone.includes('join_dollarbumper')} />
          <VideoBounty />
          {SOCIAL.map((s) => (
            <SocialTask key={s.id} task={s} done={u.socialDone.includes(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoBounty() {
  const { user, setUser, toast } = useStore();
  const vt = user!.videoTask;
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  if (!vt) return null;

  const status = vt.status;
  const full = vt.slotsLeft <= 0;
  const canSubmit = (status === 'none' || status === 'rejected') && !full;

  async function submit() {
    const link = url.trim();
    if (busy || !link) return;
    haptic('medium');
    setBusy(true);
    try {
      const res = await api<{ user?: PublicUser; needsChannel?: boolean; channelUrl?: string }>('tasks/video', {
        url: link,
      });
      if (channelGated(res)) {
        toast('📣 Join our Telegram channel to earn', 'bad');
        return;
      }
      if (res.user) setUser(res.user);
      notify('success');
      setUrl('');
      toast('🎬 Video submitted — under review!', 'good');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-neon relative overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-2xl">🎬</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-black">Make a Moola Video</div>
            <span className="chip shrink-0 border border-gold-400/40 bg-gold-500/[0.1] text-gold-300">
              +{fmt(vt.reward, 0)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Record a video about <b className="text-white/80">what Moola is</b> and{' '}
            <b className="text-white/80">how to buy MOOLA</b>. Upload it to <b className="text-white/80">YouTube</b>,
            then paste the link below. Each video is reviewed — approved videos earn{' '}
            <b className="gold-text">{fmt(vt.reward, 0)} MOOLA</b>.
          </p>
          <div className="mt-2 text-[11px] font-semibold text-white/45">
            {full ? (
              <span className="text-white/40">All {vt.slotsTotal} slots filled 🎉</span>
            ) : (
              <>
                <span className="neon-text">{vt.slotsLeft}</span> of {vt.slotsTotal} slots left
              </>
            )}
          </div>
        </div>
      </div>

      {status === 'approved' && (
        <div className="mt-3 rounded-2xl border border-moo-500/40 bg-moo-500/10 px-3 py-2 text-sm font-bold text-moo-300">
          ✅ Approved · +{fmt(vt.reward, 0)} MOOLA added to your balance
        </div>
      )}

      {status === 'pending' && (
        <div className="mt-3 rounded-2xl border border-gold-400/40 bg-gold-500/[0.08] px-3 py-2 text-sm font-semibold text-gold-200">
          ⏳ Submitted — under review. You’ll be notified once it’s approved.
        </div>
      )}

      {canSubmit && (
        <div className="mt-3 space-y-2">
          {status === 'rejected' && (
            <div className="text-xs font-semibold text-rose-300/90">
              ❌ Not approved last time — submit a new video link.
            </div>
          )}
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="Paste your YouTube video link…"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-moo-500/50 focus:outline-none"
          />
          <button onClick={submit} disabled={busy || !url.trim()} className="btn-gold w-full py-3 disabled:opacity-60">
            {busy ? '…' : 'Submit Video'}
          </button>
        </div>
      )}
    </div>
  );
}

function VideoTasks() {
  const { user } = useStore();
  const done = user!.socialDone;
  const allDone = VIDEO_TASKS.every((t) => done.includes(t.id));

  return (
    <div className="card-neon relative overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎥</span>
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">New Moola Video is out!</div>
          <div className="text-xs text-white/55">Support it on YouTube — earn MOOLA for each action.</div>
        </div>
        {allDone && <span className="chip shrink-0 bg-moo-500/15 text-moo-300">✓ All done</span>}
      </div>
      <div className="mt-3 space-y-2">
        {VIDEO_TASKS.map((t) => (
          <SocialTask key={t.id} task={t} done={done.includes(t.id)} />
        ))}
      </div>
    </div>
  );
}

function XTasks() {
  const { user } = useStore();
  const done = user!.socialDone;
  const allDone = X_TASKS.every((t) => done.includes(t.id));

  return (
    <div className="card-neon relative overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl font-black">𝕏</span>
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">Support our X post!</div>
          <div className="text-xs text-white/55">Like, comment & repost to earn MOOLA.</div>
        </div>
        {allDone && <span className="chip shrink-0 bg-moo-500/15 text-moo-300">✓ Done</span>}
      </div>
      <div className="mt-3 space-y-2">
        {X_TASKS.map((t) => (
          <SocialTask key={t.id} task={t} done={done.includes(t.id)} />
        ))}
      </div>
    </div>
  );
}

function FacebookTasks() {
  const { user } = useStore();
  const done = user!.socialDone;
  const allDone = FB_TASKS.every((t) => done.includes(t.id));
  const posts = [links.fbPost1, links.fbPost2, links.fbPost3];

  return (
    <div className="card-neon relative overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">📘</span>
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">Moola is on Facebook!</div>
          <div className="text-xs text-white/55">Follow & engage with our posts to earn MOOLA.</div>
        </div>
        {allDone && <span className="chip shrink-0 bg-moo-500/15 text-moo-300">✓ All done</span>}
      </div>
      <div className="mt-3 space-y-2">
        {FB_TASKS.map((t) => (
          <SocialTask key={t.id} task={t} done={done.includes(t.id)} />
        ))}
      </div>
      {/* All 3 posts to like, comment & share for the combined reward. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-white/45">Open posts:</span>
        {posts.map((url, i) => (
          <button
            key={url}
            onClick={() => {
              haptic('light');
              openLink(url);
            }}
            className="chip border border-white/[0.12] bg-white/[0.05] text-white/70"
          >
            Post {i + 1} ↗
          </button>
        ))}
      </div>
    </div>
  );
}

function TikTokTasks() {
  const { user } = useStore();
  const done = user!.socialDone;
  const allDone = TIKTOK_TASKS.every((t) => done.includes(t.id));

  return (
    <div className="card-neon relative overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎵</span>
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">Moola is on TikTok!</div>
          <div className="text-xs text-white/55">Follow, comment & like — earn MOOLA for each.</div>
        </div>
        {allDone && <span className="chip shrink-0 bg-moo-500/15 text-moo-300">✓ All done</span>}
      </div>
      <div className="mt-3 space-y-2">
        {TIKTOK_TASKS.map((t) => (
          <SocialTask key={t.id} task={t} done={done.includes(t.id)} />
        ))}
      </div>
    </div>
  );
}

function CheckIn() {
  const { user, act, toast } = useStore();
  const c = user!.checkin;
  const [busy, setBusy] = useState(false);

  async function claim() {
    if (!c.canClaim || busy) return;
    setBusy(true);
    haptic('medium');
    try {
      const res = await act<{ user?: PublicUser; reward?: number; needsChannel?: boolean; channelUrl?: string }>(
        'tasks/checkin'
      );
      if (channelGated(res)) {
        toast('📣 Join our Telegram channel to earn', 'bad');
        return;
      }
      notify('success');
      playSfx((res.reward ?? 0) >= 100 ? 'reward_big' : 'claim');
      toast(`✅ Day ${res.user?.checkin.day} · +${res.reward} MOOLA`, 'good');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 text-sm">
        📅 <b>Daily Check-in</b> · <span className="text-white/50">Day 7 = up to</span>{' '}
        <b className="gold-text">{c.rewards[6]} MOOLA</b>
      </div>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
        {c.rewards.map((r, i) => {
          const day = i + 1;
          const claimed = day <= c.day;
          const isNext = c.canClaim && day === c.nextDay;
          const jackpot = day === 7;
          return (
            <div
              key={day}
              className={`flex min-w-[60px] flex-col items-center rounded-2xl border px-2 py-2.5 ${
                claimed
                  ? 'border-moo-500/40 bg-moo-500/10'
                  : isNext
                    ? 'border-gold-400/60 bg-gold-500/10 shadow-gold'
                    : 'border-white/8 bg-white/[0.02]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase text-white/40">Day {day}</span>
              <span className={`text-sm font-black ${jackpot ? 'gold-text' : claimed ? 'neon-text' : 'text-white/70'}`}>
                {jackpot ? '🎁' : ''}
                {r}
              </span>
              {claimed && <span className="text-[10px] text-moo-400">✓</span>}
            </div>
          );
        })}
      </div>
      <button
        onClick={claim}
        disabled={!c.canClaim || busy}
        className={`w-full py-3 ${c.canClaim ? 'btn-primary' : 'btn bg-white/5 text-white/40'}`}
      >
        {c.canClaim ? `Check in — Day ${c.nextDay}` : '✓ Checked in today'}
      </button>
    </div>
  );
}

function AdTasks() {
  const { user, act, toast } = useStore();
  const ads = user!.ads;
  const [watching, setWatching] = useState<null | 'watch' | 'verify' | 'watch2'>(null);
  const showBonus = adsgramEnabled();

  // Preload the Monetag SDK so the first ad opens instantly.
  useEffect(() => {
    loadAdSdk();
  }, []);
  const bonusDone = showBonus ? ads.watched2 : 0;
  const bonusTotal = showBonus ? ads.watch2Total : 0;
  const totalDone = ads.watched + ads.verified + bonusDone;
  const totalTasks = ads.watchTotal + ads.verifyTotal + bonusTotal;
  const earnedToday =
    ads.watched * ads.watchReward + ads.verified * ads.verifyReward + bonusDone * ads.watch2Reward;
  const maxToday =
    ads.watchTotal * ads.watchReward + ads.verifyTotal * ads.verifyReward + bonusTotal * ads.watch2Reward;

  async function credit(type: 'watch' | 'verify' | 'watch2') {
    const res = await act<{ user?: PublicUser; reward?: number; needsChannel?: boolean; channelUrl?: string }>(
      'tasks/ad',
      { type }
    );
    if (channelGated(res)) {
      toast('📣 Join our Telegram channel to earn', 'bad');
      return;
    }
    notify('success');
    playSfx('success');
    toast(`+${fmt(res.reward ?? 0, 2)} MOOLA`, 'good');
  }

  async function run(type: 'watch' | 'verify' | 'watch2') {
    if (watching) return;
    haptic('light');
    unlockAudio();
    setWatching(type);

    // watch2 is the dedicated Adsgram button; watch/verify use whatever's set
    // (Monetag first, Adsgram fallback). Only credit if the ad completes.
    const useReal = type === 'watch2' ? adsgramEnabled() : adsEnabled();
    if (useReal) {
      try {
        const ok = await showRewardedAd({
          provider: type === 'watch2' ? 'adsgram' : 'auto',
          format: type === 'verify' ? 'pop' : 'interstitial',
        });
        if (!ok) {
          toast('No ad available right now — try again shortly', 'bad');
          return;
        }
        await credit(type);
      } finally {
        setWatching(null);
      }
      return;
    }

    // Fallback (no ad network configured): simulated wait, then credit.
    const wait = type === 'verify' ? user!.ads.verifyWaitSeconds * 1000 : 1600;
    setTimeout(async () => {
      try {
        await credit(type);
      } finally {
        setWatching(null);
      }
    }, wait);
  }

  return (
    <div className="space-y-3">
      <div className="card-neon p-4 text-center">
        <p className="text-sm text-white/60">Finish all {totalTasks} ad tasks today to earn</p>
        <p className="my-1 text-3xl font-black gold-text">{maxToday} MOOLA</p>
        <ProgressBar pct={(totalDone / totalTasks) * 100} gold />
        <p className="mt-2 text-xs text-white/50">
          <span className="neon-text font-bold">{totalDone}</span> / {totalTasks} done · earned{' '}
          <span className="neon-text font-bold">{fmt(earnedToday, 2)}</span> MOOLA today
        </p>
      </div>

      {/* Watch ads */}
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">🎬</div>
        <div className="flex-1">
          <div className="font-bold">Watch Ads</div>
          <div className="text-xs gold-text font-semibold">+{fmt(ads.watchReward, 2)} MOOLA per ad</div>
          <div className="text-xs text-white/40">
            {ads.watched}/{ads.watchTotal} watched today
          </div>
        </div>
        <button
          onClick={() => run('watch')}
          disabled={ads.watched >= ads.watchTotal || !!watching}
          className={`px-5 py-2.5 ${ads.watched >= ads.watchTotal ? 'btn bg-white/5 text-white/40' : 'btn-gold'}`}
        >
          {ads.watched >= ads.watchTotal ? 'Done' : watching === 'watch' ? '…' : 'Watch'}
        </button>
      </div>

      {/* Verify ads */}
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">🔗</div>
        <div className="flex-1">
          <div className="font-bold">Verify Ads</div>
          <div className="text-xs gold-text font-semibold">
            +{fmt(ads.verifyReward, 2)} MOOLA · wait {ads.verifyWaitSeconds}s on site
          </div>
          <div className="text-xs text-white/40">
            {ads.verified}/{ads.verifyTotal} verified today
          </div>
        </div>
        <button
          onClick={() => run('verify')}
          disabled={ads.verified >= ads.verifyTotal || !!watching}
          className={`px-5 py-2.5 ${ads.verified >= ads.verifyTotal ? 'btn bg-white/5 text-white/40' : 'btn-primary'}`}
        >
          {ads.verified >= ads.verifyTotal ? 'Done' : watching === 'verify' ? '…' : 'Verify'}
        </button>
      </div>

      {/* Bonus (Adsgram) ads — only shown when Adsgram is configured */}
      {showBonus && (
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">🎁</div>
          <div className="flex-1">
            <div className="font-bold">Bonus Ads</div>
            <div className="text-xs gold-text font-semibold">+{fmt(ads.watch2Reward, 2)} MOOLA per ad</div>
            <div className="text-xs text-white/40">
              {ads.watched2}/{ads.watch2Total} watched today
            </div>
          </div>
          <button
            onClick={() => run('watch2')}
            disabled={ads.watched2 >= ads.watch2Total || !!watching}
            className={`px-5 py-2.5 ${ads.watched2 >= ads.watch2Total ? 'btn bg-white/5 text-white/40' : 'btn-gold'}`}
          >
            {ads.watched2 >= ads.watch2Total ? 'Done' : watching === 'watch2' ? '…' : 'Watch'}
          </button>
        </div>
      )}

      <AdOverlay type={watching} seconds={user!.ads.verifyWaitSeconds} />
    </div>
  );
}

function AdOverlay({ type, seconds }: { type: null | 'watch' | 'verify' | 'watch2'; seconds: number }) {
  return (
    <AnimatePresence>
      {type && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="mb-5 h-16 w-16 rounded-full border-4 border-white/10 border-t-moo-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-lg font-bold">{type === 'verify' ? 'Verifying ad…' : 'Loading ad…'}</p>
          <p className="mt-1 text-sm text-white/50">
            {type === 'verify' ? `Please wait ${seconds}s` : 'Reward incoming'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Featured partner task — DollarBumper. Styled to stand out from the list. */
function BumperTask({ done }: { done: boolean }) {
  const { setUser, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  async function credit() {
    setBusy(true);
    try {
      const res = await api<{ user?: PublicUser; credited?: boolean; needsChannel?: boolean; channelUrl?: string }>(
        'tasks/social',
        { taskId: 'join_dollarbumper' }
      );
      if (channelGated(res)) {
        toast('📣 Join our Telegram channel to earn', 'bad');
        return;
      }
      if (res.user) setUser(res.user);
      notify('success');
      if (res.credited) toast('+15 MOOLA', 'good');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function go() {
    if (done || busy) return;
    haptic('medium');
    if (!armed) {
      openLink(socialLink('dollar_bumper'));
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setArmed(true);
        toast('⏳ Not completed yet — start the bot, then tap Claim', 'bad');
      }, 3000);
      return;
    }
    await credit();
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold-400/40 bg-gradient-to-br from-gold-500/[0.14] via-black/30 to-moo-600/[0.12] p-4 shadow-neon">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-400/20 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-3xl">💵</div>
        <div className="flex-1">
          <div className="mb-0.5 inline-flex items-center rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gold-200">
            ✨ New Partner
          </div>
          <div className="font-black leading-tight">Join DollarBumper Bot</div>
          <div className="text-xs text-white/50">Open the bot, tap Start &amp; earn instantly</div>
        </div>
      </div>
      <div className="relative mt-3 flex items-center justify-between">
        <div className="text-lg font-black gold-text">+15 MOOLA</div>
        {done ? (
          <span className="chip bg-moo-500/15 text-moo-300">✓ Done</span>
        ) : (
          <button
            onClick={go}
            disabled={busy}
            className={`px-7 py-2.5 font-black ${armed ? 'btn-primary' : 'btn-gold'}`}
          >
            {busy ? '…' : armed ? 'Claim +15' : 'Join & Earn'}
          </button>
        )}
      </div>
    </div>
  );
}

function SocialTask({
  task,
  done,
}: {
  task: { id: string; title: string; reward: number; icon: string; kind: string };
  done: boolean;
}) {
  const { setUser, toast } = useStore();
  const [busy, setBusy] = useState(false);
  // Two-click flow for tasks we can't verify by API: the FIRST tap opens the
  // link and "checks" (nudging the user to actually do it); the SECOND tap
  // credits. Channel tasks are server-verified, so they credit on one tap.
  const [armed, setArmed] = useState(false);
  const twoClick = task.kind !== 'channel';

  async function credit() {
    setBusy(true);
    try {
      const res = await api<{ user?: PublicUser; credited?: boolean; needsChannel?: boolean; channelUrl?: string }>(
        'tasks/social',
        { taskId: task.id }
      );
      if (channelGated(res)) {
        toast('📣 Join our Telegram channel to earn', 'bad');
        return;
      }
      if (res.user) setUser(res.user);
      notify('success');
      if (res.credited) toast(`+${task.reward} MOOLA`, 'good');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function go() {
    if (done || busy) return;
    haptic('medium');

    // First tap on an unverifiable task: open it, "check", then ask them to tap
    // again once it's actually done.
    if (twoClick && !armed) {
      openLink(socialLink(task.kind));
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setArmed(true);
        toast('⏳ Task not completed yet — finish it, then tap Claim', 'bad');
      }, 3000);
      return;
    }

    // Channel task (single tap) opens the link first; second tap on others just
    // credits (they already opened it).
    if (!twoClick) openLink(socialLink(task.kind));
    setTimeout(credit, twoClick ? 0 : 1500);
  }

  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">{task.icon}</div>
      <div className="flex-1">
        <div className="font-bold">{task.title}</div>
        <div className="text-xs gold-text font-semibold">+{task.reward} MOOLA</div>
      </div>
      {done ? (
        <span className="chip bg-moo-500/15 text-moo-300">✓ Done</span>
      ) : (
        <button
          onClick={go}
          disabled={busy}
          className={`px-5 py-2.5 ${armed ? 'btn-primary' : 'btn-gold'}`}
        >
          {busy ? '…' : armed ? 'Claim' : 'Go'}
        </button>
      )}
    </div>
  );
}
