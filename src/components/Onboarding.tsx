'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { openLink, haptic, notify } from '@/lib/telegram';
import { socialLink } from '@/lib/links';
import { ProgressBar } from './ui';
import { IntroStory } from './IntroStory';
import type { PublicUser } from '@/lib/types';

const REQUIRED = [
  {
    id: 'join_partner',
    tag: '⭐ OFFICIAL PARTNER',
    step: 'Step 1',
    title: 'Join Official Partner',
    sub: 'AI Trading Forex — our sponsor',
    logo: '/brand/atf.png',
    kind: 'partner',
  },
  {
    id: 'join_channel',
    tag: null,
    step: 'Step 2',
    title: 'Join Official Channel',
    sub: 'News, updates & airdrop alerts',
    logo: '/brand/logo.png',
    kind: 'channel',
  },
];

export function Onboarding() {
  const { user, setUser, refresh } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [showStory, setShowStory] = useState(true);

  // NOTE: all hooks must run before any early return (Rules of Hooks).
  const done = useMemo(() => new Set(user?.socialDone ?? []), [user]);
  const completed = REQUIRED.filter((r) => done.has(r.id)).length;
  const allDone = completed === REQUIRED.length;

  // Always play the story before the join gate for anyone not yet onboarded.
  // (Onboarded users never reach this screen.) They can tap Skip.
  if (showStory) {
    return <IntroStory onDone={() => setShowStory(false)} />;
  }

  async function join(task: (typeof REQUIRED)[number]) {
    haptic('medium');
    openLink(socialLink(task.kind));
    setBusy(task.id);
    // Give the user a moment to actually join, then mark complete.
    setTimeout(async () => {
      try {
        const res = await api<{ user: PublicUser }>('tasks/social', { taskId: task.id });
        setUser(res.user);
        notify('success');
      } catch {
        /* handled by store elsewhere */
      } finally {
        setBusy(null);
      }
    }, 1200);
  }

  async function start() {
    haptic('heavy');
    try {
      const res = await api<{ user: PublicUser }>('onboard');
      setUser(res.user);
      notify('success');
    } catch {
      await refresh();
    }
  }

  return (
    <div className="min-h-screen px-5 pb-10 pt-8">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-4 w-full max-w-[300px]"
        >
          <div
            className="pointer-events-none absolute -inset-4 rounded-[36px]"
            style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.25), transparent 70%)' }}
          />
          <Image
            src="/brand/onboarding.webp"
            alt="Moola"
            width={600}
            height={600}
            priority
            className="relative w-full rounded-[28px] border border-moo-500/20 shadow-neon-lg"
          />
        </motion.div>

        <h1 className="text-3xl font-black tracking-tight">
          Welcome, <span className="neon-text">Miner!</span>
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Complete these {REQUIRED.length} quick steps to unlock the app and start mining MOOLA.
        </p>

        <div className="mt-5 w-full">
          <ProgressBar pct={(completed / REQUIRED.length) * 100} gold />
          <p className="mt-2 text-sm">
            <span className="neon-text font-bold">{completed}</span>
            <span className="text-white/50"> / {REQUIRED.length} completed</span>
          </p>
        </div>

        <div className="mt-4 w-full space-y-3">
          {REQUIRED.map((task) => {
            const isDone = done.has(task.id);
            return (
              <div key={task.id} className={`overflow-hidden rounded-3xl ${task.tag ? 'card-neon' : 'card'}`}>
                {task.tag && (
                  <div className="bg-gradient-to-r from-gold-400 to-gold-500 py-1.5 text-center text-[11px] font-black tracking-[0.16em] text-ink-900">
                    {task.tag}
                  </div>
                )}
                <div className="flex items-center gap-3 p-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <Image src={task.logo} alt={task.title} fill sizes="48px" className="object-contain p-1" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-gold-400">{task.step}</div>
                    <div className="font-bold leading-tight">{task.title}</div>
                    <div className="text-xs text-white/45">{task.sub}</div>
                  </div>
                  {isDone ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-moo-500 text-lg text-ink-900 shadow-neon">
                      ✓
                    </div>
                  ) : (
                    <button
                      onClick={() => join(task)}
                      disabled={busy === task.id}
                      className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
                    >
                      {busy === task.id ? 'Verifying…' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={start}
          disabled={!allDone}
          className={`mt-5 w-full py-4 text-lg ${
            allDone ? 'btn-primary animate-pulseGlow' : 'btn cursor-not-allowed bg-white/5 text-white/40'
          }`}
        >
          {allDone ? '🚀 Start Mining' : '🔒 Complete all steps to continue'}
        </button>
        <p className="mt-3 text-xs text-white/35">Please stay in the channels — leaving may disqualify your airdrop.</p>
      </div>
    </div>
  );
}
