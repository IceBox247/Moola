'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/format';
import { haptic, openLink } from '@/lib/telegram';
import { stonfiBuyAtf } from '@/lib/links';
import { game } from '@/lib/config';

function usd(n: number): string {
  return n >= 1 ? `$${n % 1 === 0 ? n : n.toFixed(2)}` : `$${n.toFixed(2)}`;
}
function rangeLabel(min: number, max: number): string {
  if (!isFinite(max)) return `${usd(min)}+`;
  return `${usd(min)} – ${usd(max)}`;
}

export function AtfBoostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();
  const u = user!;
  const tiers = game.atfBoost.tiers;
  const connected = !!u.wallet;

  function buy() {
    haptic('heavy');
    openLink(stonfiBuyAtf());
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[28px] border border-gold-400/20 bg-ink-850"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 p-5 pb-3 text-center">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="relative mx-auto mb-2 h-16 w-16">
                <div
                  className="pointer-events-none absolute -inset-2 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.35), transparent 65%)' }}
                />
                <Image src="/brand/atf.png" alt="ATF" fill sizes="64px" className="relative object-contain drop-shadow-[0_0_12px_rgba(245,197,24,0.5)]" />
              </div>
              <h3 className="text-xl font-black">
                <span className="gold-text">ATF</span> Mining Boost
              </h3>
              <p className="text-sm text-white/50">Hold ATF in your wallet to multiply your mining power</p>

              {/* one-time holder bonus */}
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-500/[0.08] p-3 text-left">
                <div className="text-2xl">🎁</div>
                <div className="flex-1 text-sm">
                  <b className="gold-text">+{fmt(u.atfBonus, 0)} MOOLA</b> one-time holder bonus
                  <div className="text-[11px] text-white/50">Auto-credited the first time we detect ATF.</div>
                </div>
                {u.atfBonusClaimed && <span className="chip bg-moo-500 text-ink-900">✓ Got it</span>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/8 bg-black/25 px-2 py-2">
                  <div className="label">Your ATF</div>
                  <div className="text-sm font-black gold-text">{connected ? usd(u.atfUsd) : '—'}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/25 px-2 py-2">
                  <div className="label">Active boost</div>
                  <div className="text-sm font-black text-moo-300">{u.atfMult > 1 ? `${u.atfMult}×` : '1× (none)'}</div>
                </div>
              </div>

              {!connected && (
                <div className="mt-3 rounded-2xl border border-sky-400/30 bg-sky-500/[0.08] px-4 py-2 text-xs text-sky-200">
                  Connect your TON wallet (top-right) so we can detect your ATF and apply the boost.
                </div>
              )}
            </div>

            {/* tiers */}
            <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-28">
              {tiers.map((t, i) => {
                const active = connected && u.atfUsd >= t.minUsd && u.atfUsd < t.maxUsd;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                      active
                        ? 'border-gold-400/60 bg-gold-500/[0.1] shadow-gold'
                        : 'border-white/8 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/30 text-lg font-black gold-text">
                      {t.mult}×
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">
                        Hold {rangeLabel(t.minUsd, t.maxUsd)} <span className="text-white/50">of ATF</span>
                      </div>
                      <div className="text-[11px] text-white/45">Mine {t.mult}× faster at any level</div>
                    </div>
                    {active && <span className="chip bg-gold-500 text-ink-900">Active</span>}
                  </div>
                );
              })}

              <p className="px-1 pt-1 text-center text-[11px] text-white/35">
                Boost tracks your live ATF balance — sell it and your rate reverts. Values are USD worth of ATF.
              </p>
            </div>

            {/* sticky buy */}
            <div className="shrink-0 border-t border-white/8 bg-ink-850 p-4">
              <button onClick={buy} className="btn-gold w-full py-3.5">
                ⚡ Buy ATF on STON.fi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
