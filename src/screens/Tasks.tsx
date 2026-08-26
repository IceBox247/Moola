'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { ProgressBar } from '@/components/ui';
import { fmt } from '@/lib/format';
import { haptic, notify, openLink, selection } from '@/lib/telegram';
import { enableAudio, blip, coinChime } from '@/lib/sound';
import { socialLink } from '@/lib/links';
import { api } from '@/lib/client';
import type { PublicUser } from '@/lib/types';

const SOCIAL = [
  { id: 'follow_x', title: 'Follow X (Twitter)', reward: 5, icon: '🐦', kind: 'x' },
  { id: 'subscribe_youtube', title: 'Subscribe on YouTube', reward: 10, icon: '▶️', kind: 'youtube' },
  { id: 'retweet', title: 'X (Twitter) Retweet', reward: 3, icon: '🔁', kind: 'x' },
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
          <CheckIn />
          <AdTasks />
        </>
      ) : (
        <div className="space-y-3">
          {SOCIAL.map((s) => (
            <SocialTask key={s.id} task={s} done={u.socialDone.includes(s.id)} />
          ))}
        </div>
      )}
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
      const res = await act<{ user: PublicUser; reward: number }>('tasks/checkin');
      notify('success');
      if (user!.soundFx) coinChime();
      toast(`✅ Day ${res.user.checkin.day} · +${res.reward} MOOLA`, 'good');
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
  const [watching, setWatching] = useState<null | 'watch' | 'verify'>(null);
  const totalDone = ads.watched + ads.verified;
  const totalTasks = ads.watchTotal + ads.verifyTotal;
  const earnedToday = ads.watched * ads.watchReward + ads.verified * ads.verifyReward;
  const maxToday = ads.watchTotal * ads.watchReward + ads.verifyTotal * ads.verifyReward;

  async function run(type: 'watch' | 'verify') {
    if (watching) return;
    haptic('light');
    enableAudio();
    setWatching(type);
    const wait = type === 'verify' ? user!.ads.verifyWaitSeconds * 1000 : 1600;
    setTimeout(async () => {
      try {
        const res = await act<{ user: PublicUser; reward: number }>('tasks/ad', { type });
        notify('success');
        if (user!.soundFx) blip();
        toast(`+${fmt(res.reward, 2)} MOOLA`, 'good');
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

      <AdOverlay type={watching} seconds={user!.ads.verifyWaitSeconds} />
    </div>
  );
}

function AdOverlay({ type, seconds }: { type: null | 'watch' | 'verify'; seconds: number }) {
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

function SocialTask({
  task,
  done,
}: {
  task: { id: string; title: string; reward: number; icon: string; kind: string };
  done: boolean;
}) {
  const { setUser, toast } = useStore();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (done || busy) return;
    haptic('medium');
    openLink(socialLink(task.kind));
    setBusy(true);
    setTimeout(async () => {
      try {
        const res = await api<{ user: PublicUser; credited: boolean }>('tasks/social', { taskId: task.id });
        setUser(res.user);
        notify('success');
        if (res.credited) toast(`+${task.reward} MOOLA`, 'good');
      } catch (e) {
        toast((e as Error).message, 'bad');
      } finally {
        setBusy(false);
      }
    }, 1500);
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
        <button onClick={go} disabled={busy} className="btn-gold px-5 py-2.5">
          {busy ? '…' : 'Go'}
        </button>
      )}
    </div>
  );
}
