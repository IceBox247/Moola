'use client';

import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { Rarity } from '@/lib/types';
import { useStore } from '@/lib/store';

/** A number that smoothly rolls to its target value. */
export function AnimatedNumber({ value, dp = 4, className }: { value: number; dp?: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 90, damping: 20, mass: 0.6 });
  const text = useTransform(spring, (v) =>
    v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  );
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function ProgressBar({ pct, gold = false }: { pct: number; gold?: boolean }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-white/8">
      <motion.div
        className={`shimmer-fill h-full rounded-full ${
          gold ? 'bg-gradient-to-r from-gold-400 to-gold-600' : 'bg-gradient-to-r from-moo-400 to-moo-500'
        }`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 18 }}
      />
    </div>
  );
}

const rarityStyles: Record<Rarity, string> = {
  Common: 'bg-white/10 text-white/70 border-white/15',
  Rare: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  Epic: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30',
  Legendary: 'bg-gold-500/15 text-gold-400 border-gold-400/40',
  Genesis: 'bg-moo-500/15 text-moo-300 border-moo-400/40',
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`chip border ${rarityStyles[rarity]}`}>{rarity}</span>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className={`pointer-events-auto rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-card backdrop-blur-md ${
              t.kind === 'good'
                ? 'border-moo-400/40 bg-moo-500/15 text-moo-200'
                : t.kind === 'bad'
                  ? 'border-red-400/40 bg-red-500/15 text-red-200'
                  : 'border-white/15 bg-white/10 text-white'
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 ${className}`} />;
}
