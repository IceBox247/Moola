'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic, selection } from '@/lib/telegram';

type Slide = {
  key: string;
  image: string;
  round?: boolean;
  eyebrow?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  accent?: 'green' | 'gold';
};

const SLIDES: Slide[] = [
  {
    key: 'brand',
    image: '/brand/coin.png',
    round: true,
    eyebrow: 'A NEW HERD RISES',
    title: <><span className="h-grad">MOOLA</span></>,
    body: 'The future is mooing. 🐮',
  },
  {
    key: 'world',
    image: '/brand/onboarding.webp',
    eyebrow: 'THE STORY',
    title: <>A world full of <span className="text-white/60">dead coins</span></>,
    body: 'Rugs, ghost chains, empty promises. The pasture went quiet… until one herd refused to graze in silence.',
  },
  {
    key: 'mine',
    image: '/nft/genesis.webp',
    eyebrow: 'YOUR MISSION',
    title: <>Mine. Rise. <span className="neon-text">Own the herd.</span></>,
    body: 'Fire up your rig, stack MOOLA every day, collect legendary cow NFTs and climb the levels.',
  },
  {
    key: 'atf',
    image: '/brand/logo.png',
    round: true,
    accent: 'gold',
    eyebrow: '🤝 STANDING ON GIANTS',
    title: <>Proudly inspired by <span className="gold-text">ATF Miner</span></>,
    body: 'Built on the shoulders of legends — carrying the miner spirit forward, the Moola way.',
  },
  {
    key: 'boost',
    image: '/brand/atf.png',
    round: true,
    accent: 'gold',
    eyebrow: '⚡ PARTNER BOOST',
    title: <>Hold <span className="gold-text">ATF</span>, mine up to <span className="gold-text">16×</span> faster</>,
    body: 'Connect your TON wallet — the more ATF you hold, the bigger your mining multiplier. And hold MOOLA to level up your rig, all the way to Level 800.',
  },
  {
    key: 'cta',
    image: '/brand/coin.png',
    round: true,
    eyebrow: 'DESTINY AWAITS',
    title: <>Your journey <span className="neon-text">starts now</span></>,
    body: 'Two quick steps and the herd is yours.',
  },
];

const DURATION = 4200;

export function IntroStory({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const isLast = i === SLIDES.length - 1;

  const next = useCallback(() => {
    selection();
    setI((v) => (v < SLIDES.length - 1 ? v + 1 : v));
  }, []);
  const prev = useCallback(() => {
    selection();
    setI((v) => Math.max(0, v - 1));
  }, []);

  // auto-advance (except last slide)
  useEffect(() => {
    if (isLast || paused) return;
    startRef.current = Date.now();
    const t = setTimeout(() => setI((v) => Math.min(SLIDES.length - 1, v + 1)), DURATION);
    return () => clearTimeout(t);
  }, [i, isLast, paused]);

  const s = SLIDES[i];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900">
      {/* progress bars */}
      <div className="flex gap-1.5 px-4 pt-3">
        {SLIDES.map((sl, idx) => (
          <div key={sl.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-moo-400"
              initial={{ width: idx < i ? '100%' : '0%' }}
              animate={{ width: idx < i ? '100%' : idx === i ? (isLast ? '100%' : '100%') : '0%' }}
              transition={
                idx === i && !isLast
                  ? { duration: DURATION / 1000, ease: 'linear' }
                  : { duration: 0.2 }
              }
            />
          </div>
        ))}
      </div>

      {/* skip */}
      <button
        onClick={() => {
          haptic('light');
          onDone();
        }}
        className="absolute right-4 top-6 z-10 text-xs font-semibold text-white/50"
      >
        Skip ›
      </button>

      {/* tap zones */}
      <button className="absolute inset-y-0 left-0 z-0 w-1/3" onClick={prev} aria-label="Previous" />
      <button className="absolute inset-y-0 right-0 z-0 w-1/3" onClick={next} aria-label="Next" />

      {/* slide */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={s.key}
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.04, y: -12 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-7">
              <motion.div
                className="pointer-events-none absolute -inset-8 rounded-full"
                style={{
                  background:
                    s.accent === 'gold'
                      ? 'radial-gradient(circle, rgba(245,197,24,0.35), transparent 65%)'
                      : 'radial-gradient(circle, rgba(15,217,75,0.4), transparent 65%)',
                }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.6, repeat: Infinity }}
              />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.4, repeat: Infinity }}
                className={`relative h-44 w-44 ${
                  s.round ? '' : 'overflow-hidden rounded-[28px] border border-moo-500/25 shadow-neon-lg'
                }`}
              >
                <Image
                  src={s.image}
                  alt=""
                  fill
                  sizes="176px"
                  priority
                  className={s.round ? 'object-contain drop-shadow-[0_0_30px_rgba(15,217,75,0.5)]' : 'object-cover'}
                />
              </motion.div>
            </div>

            {s.eyebrow && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mb-2 text-[11px] font-black tracking-[0.28em] text-white/45"
              >
                {s.eyebrow}
              </motion.div>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black leading-tight tracking-tight"
            >
              {s.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/60"
            >
              {s.body}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer */}
      <div className="relative z-10 px-6 pb-8">
        {isLast ? (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              haptic('heavy');
              onDone();
            }}
            className="btn-primary w-full py-4 text-lg animate-pulseGlow"
          >
            🐮 Enter Moola
          </motion.button>
        ) : (
          <button
            onClick={next}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            className="btn-ghost mx-auto flex px-6 py-2.5 text-sm"
          >
            Continue ›
          </button>
        )}
        <p className="mt-4 text-center text-[11px] text-white/30">Moola · The future is mooing</p>
      </div>
    </div>
  );
}
