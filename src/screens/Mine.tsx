'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { AnimatedNumber, ProgressBar } from '@/components/ui';
import { fmt, countdown } from '@/lib/format';
import { WalletChip } from '@/components/WalletChip';
import { LevelsModal } from '@/components/LevelsModal';
import { AtfBoostModal } from '@/components/AtfBoostModal';
import { haptic, notify } from '@/lib/telegram';
import { unlockAudio, playSfx } from '@/lib/audio';
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
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [atfOpen, setAtfOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mining = user!.mining;
  const now = useNow(mining.active);

  // Anchor the live counter to the server's checkpointed pending value, then
  // grow it locally at the current rate (rate changes when a re-scan lands).
  const fetchedAt = useRef(Date.now());
  useEffect(() => {
    fetchedAt.current = Date.now();
  }, [user]);

  const live = useMemo(() => {
    if (!mining.active) return 0;
    const perMs = user!.dailyYield / (24 * 60 * 60 * 1000);
    const cap = mining.endsAt ? Math.max(0, mining.endsAt - fetchedAt.current) : 0;
    const grown = Math.min(Math.max(0, now - fetchedAt.current), cap) * perMs;
    return (mining.pending || 0) + grown;
  }, [mining, now, user]);

  const remaining = mining.endsAt ? mining.endsAt - now : 0;
  const sessionPct = mining.active ? (1 - Math.max(0, remaining) / mining.sessionMs) * 100 : 0;
  const levelPct =
    user!.levelCeil > user!.levelFloor
      ? ((user!.held - user!.levelFloor) / (user!.levelCeil - user!.levelFloor)) * 100
      : 100;

  async function onMainButton() {
    if (busy) return;
    setBusy(true);
    haptic('heavy');
    unlockAudio();
    try {
      if (!mining.active) {
        await act('mine/start');
        playSfx('mining_start');
        toast('⛏️ Mining started!', 'good');
      } else {
        const res = await act<{ user: PublicUser; claimed: number }>('mine/claim');
        notify('success');
        const amt = res.claimed ?? 0;
        playSfx(amt >= 50 ? 'reward_big' : 'claim'); // sound only after confirmed claim
        toast(`+${fmt(amt, 4)} MOOLA claimed`, 'good');
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
            <button onClick={() => setLevelsOpen(true)} className="chip bg-white/8 text-white/80">
              Lvl {u.level} ›
            </button>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/50">
              <span
                className={`h-2 w-2 rounded-full ${mining.active ? 'bg-moo-400 shadow-neon' : 'bg-white/30'}`}
              />
              {mining.active ? 'MINING' : 'IDLE'}
            </span>
          </div>
        </div>
        <WalletChip />
      </div>

      {/* Balance hero */}
      <div className="rounded-[26px] bg-gradient-to-b from-moo-400/50 via-moo-500/15 to-transparent p-[1.5px] shadow-neon">
        <div className="relative overflow-hidden rounded-[25px] bg-ink-850/95 px-5 pb-4 pt-5">
          <Image
            src="/brand/coin.png"
            alt=""
            width={150}
            height={150}
            className="pointer-events-none absolute -right-7 -top-7 opacity-[0.08]"
          />
          <div className="relative text-center">
            <div className="label">Balance</div>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <AnimatedNumber
                value={u.balance + live}
                dp={4}
                className="neon-text text-[42px] font-black leading-none tracking-tight"
              />
              <span className="gold-text text-xl font-black">MOOLA</span>
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-moo-500/30 bg-moo-500/[0.08] px-4 py-1.5">
              <motion.span
                className="h-2 w-2 rounded-full bg-moo-400"
                animate={mining.active ? { opacity: [1, 0.3, 1] } : { opacity: 0.4 }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              <span className="text-sm font-black text-moo-300">
                +<AnimatedNumber value={live} dp={4} />
              </span>
              <span className="text-[11px] text-white/45">{mining.active ? 'mining live' : 'idle'}</span>
            </div>

            {/* ATF partnership boost — tap to see tiers */}
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => {
                  haptic('light');
                  setAtfOpen(true);
                }}
                className={`chip border ${
                  u.atfMult > 1
                    ? 'border-gold-400/40 bg-gold-500/[0.1] text-gold-300'
                    : 'border-white/[0.12] bg-white/[0.05] text-white/60'
                }`}
              >
                {u.atfMult > 1 ? `⚡ ${u.atfMult}× ATF boost active ›` : '🤝 Hold ATF for up to 64× boost ›'}
              </button>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <Stat label="Per day" value={fmt(u.dailyYield, 2)} />
            <Stat label="Hashrate" value={`${u.hashrate}`} sub="TH/s" />
            <Stat label="NFT boost" value={`+${u.boostPct}%`} gold />
          </div>

          <button onClick={() => setLevelsOpen(true)} className="relative mt-4 block w-full text-left">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="chip bg-white/8 text-white/70">Lvl {u.level} ›</span>
              <span className="text-white/45">
                <span className="neon-text font-bold">{fmt(u.toNextLevel, 2)}</span> to Lvl {u.level + 1}
              </span>
            </div>
            <ProgressBar pct={levelPct} />
          </button>
        </div>
      </div>

      {/* Hero: the MOOLA coin */}
      <div className="relative mx-auto flex flex-col items-center py-3">
        <div
          className="pointer-events-none absolute top-2 mx-auto h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.32), transparent 62%)' }}
        />

        {/* rotating energy ring while mining */}
        {mining.active && (
          <motion.div
            className="pointer-events-none absolute top-1 h-[266px] w-[266px] rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent, rgba(15,217,75,0.55), transparent 40%)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
        )}

        <motion.button
          onClick={onMainButton}
          disabled={busy}
          className="relative h-60 w-60"
          whileTap={{ scale: 0.94 }}
          animate={mining.active ? { y: [0, -6, 0] } : { y: [0, -4, 0] }}
          transition={{ duration: mining.active ? 3 : 4.5, repeat: Infinity }}
          aria-label={mining.active ? 'Tap to claim' : 'Tap to start mining'}
        >
          <motion.div
            className="relative h-full w-full"
            animate={mining.active ? { scale: [1, 1.035, 1] } : { scale: 1 }}
            transition={mining.active ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            <Image
              src="/brand/coin.png"
              alt="MOOLA coin"
              fill
              sizes="240px"
              priority
              className="object-contain drop-shadow-[0_0_28px_rgba(15,217,75,0.55)]"
            />
          </motion.div>
        </motion.button>

        {/* equipped NFT boost badge */}
        <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3">
          <div className="relative h-7 w-7 overflow-hidden rounded-full border border-moo-500/40">
            <Image src={u.activeNftImage} alt="Miner" fill sizes="28px" className="object-cover" />
          </div>
          <span className="text-[11px] font-semibold text-white/60">
            Miner boost <span className="gold-text font-bold">+{u.boostPct}%</span>
          </span>
        </div>

        <button
          onClick={() => setHelpOpen(true)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60"
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

      <LevelsModal open={levelsOpen} onClose={() => setLevelsOpen(false)} />
      <AtfBoostModal open={atfOpen} onClose={() => setAtfOpen(false)} />
    </div>
  );
}

function Stat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-2 py-2.5 text-center">
      <div className="label">{label}</div>
      <div className={`mt-0.5 text-base font-black ${gold ? 'gold-text' : 'text-white'}`}>
        {value}
        {sub && <span className="ml-0.5 text-[10px] font-semibold text-white/45">{sub}</span>}
      </div>
    </div>
  );
}
