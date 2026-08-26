'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { AnimatedNumber, ProgressBar } from '@/components/ui';
import { fmt, countdown, shortAddr } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import type { PublicUser } from '@/lib/types';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function MineScreen() {
  const { user, act, toast } = useStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mining = user!.mining;
  const now = useNow(mining.active);

  // Live-interpolated pending balance while mining.
  const live = useMemo(() => {
    if (!mining.active || !mining.startedAt) return 0;
    const perMs = user!.dailyYield / (24 * 60 * 60 * 1000);
    const elapsed = Math.min(now - mining.startedAt, mining.sessionMs);
    return Math.max(0, elapsed * perMs);
  }, [mining, now, user]);

  const remaining = mining.endsAt ? mining.endsAt - now : 0;
  const sessionPct = mining.active ? (1 - Math.max(0, remaining) / mining.sessionMs) * 100 : 0;
  const levelPct =
    user!.levelCeil > user!.levelFloor
      ? ((user!.lifetime - user!.levelFloor) / (user!.levelCeil - user!.levelFloor)) * 100
      : 100;

  async function onMainButton() {
    if (busy) return;
    setBusy(true);
    haptic('heavy');
    try {
      if (!mining.active) {
        await act('mine/start');
        toast('⛏️ Mining started!', 'good');
      } else {
        const res = await act<{ user: PublicUser; claimed: number }>('mine/claim');
        notify('success');
        toast(`+${fmt(res.claimed ?? 0, 4)} MOOLA claimed`, 'good');
      }
    } finally {
      setBusy(false);
    }
  }

  const u = user!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black leading-tight">{u.firstName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="chip bg-white/8 text-white/80">Lvl {u.level}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/50">
              <span
                className={`h-2 w-2 rounded-full ${mining.active ? 'bg-moo-400 shadow-neon' : 'bg-white/30'}`}
              />
              {mining.active ? 'MINING' : 'IDLE'}
            </span>
          </div>
        </div>
        <div className="rounded-full border border-moo-500/40 bg-moo-500/10 px-3 py-2 text-xs font-bold text-moo-200 shadow-neon">
          {u.wallet ? `💎 ${shortAddr(u.wallet)}` : '💎 No wallet'}
        </div>
      </div>

      {/* Level progress */}
      <div className="card px-4 py-3">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-white/50">
            <span className="neon-text font-bold">{fmt(u.toNextLevel, 2)}</span> MOOLA to Lvl {u.level + 1}
          </span>
          <span className="text-white/40">{fmt(u.lifetime, 0)} lifetime</span>
        </div>
        <ProgressBar pct={levelPct} />
      </div>

      {/* Balance + rate */}
      <div className="card-neon relative overflow-hidden px-5 py-5 text-center">
        <div className="label">Balance</div>
        <div className="mt-1 text-4xl font-black">
          <AnimatedNumber value={u.balance + live} dp={4} className="neon-text" />{' '}
          <span className="gold-text text-2xl">MOOLA</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-black/30 px-4 py-2">
          <span className="text-lg font-black text-moo-300">
            +<AnimatedNumber value={live} dp={4} />
          </span>
          <span className="text-xs text-white/50">
            {u.dailyYield} MOOLA/day · {u.hashrate} TH/s
            {u.boostPct > 0 && <span className="ml-1 gold-text font-bold">+{u.boostPct}%</span>}
          </span>
        </div>
      </div>

      {/* Hero: active NFT */}
      <div className="relative mx-auto flex flex-col items-center py-2">
        <div
          className="pointer-events-none absolute inset-0 mx-auto h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.28), transparent 65%)' }}
        />
        <motion.div
          className="relative"
          animate={mining.active ? { y: [0, -8, 0] } : {}}
          transition={{ duration: 3.2, repeat: Infinity }}
        >
          {mining.active && (
            <motion.div
              className="absolute -inset-3 rounded-[36px] border-2 border-moo-500/40"
              animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.98, 1.02, 0.98] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <div className="relative h-60 w-60 overflow-hidden rounded-[32px] border border-moo-500/25 bg-black/20 shadow-neon-lg">
            <Image src={u.activeNftImage} alt="Miner" fill sizes="240px" className="object-contain" priority />
          </div>
        </motion.div>
        <button
          onClick={() => setHelpOpen(true)}
          className="absolute bottom-2 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60"
          aria-label="How mining works"
        >
          ?
        </button>
      </div>

      {/* Session countdown when mining */}
      {mining.active && (
        <div className="card px-4 py-3">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-white/50">Session</span>
            <span className="font-mono font-bold text-moo-300">{countdown(remaining)}</span>
          </div>
          <ProgressBar pct={sessionPct} />
        </div>
      )}

      {/* Main action */}
      <button
        onClick={onMainButton}
        disabled={busy}
        className={`w-full py-4 text-lg ${
          mining.active ? 'btn-gold animate-pulseGlow' : 'btn-primary'
        } disabled:opacity-70`}
      >
        {busy ? '…' : mining.active ? '⛏️ MINING… TAP TO CLAIM' : '🚀 START MINING'}
      </button>

      {/* Help modal */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              className="card max-w-sm p-5"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black">How Moola mining works</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>• Tap <b className="text-white">START</b> to run an 8-hour mining session.</li>
                <li>• You earn <b className="neon-text">{u.dailyYield} MOOLA/day</b> at your level.</li>
                <li>• Tap <b className="text-white">CLAIM</b> anytime to bank what you&apos;ve mined.</li>
                <li>• Equip a rarer <b className="text-white">NFT cow</b> to boost your yield.</li>
                <li>• Do tasks & invite friends for bonus MOOLA, then withdraw from Profile.</li>
              </ul>
              <button onClick={() => setHelpOpen(false)} className="btn-primary mt-4 w-full py-3">
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
