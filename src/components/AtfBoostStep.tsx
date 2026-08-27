'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { WalletChip } from './WalletChip';
import { openLink, haptic } from '@/lib/telegram';
import { stonfiBuyAtf } from '@/lib/links';
import { game } from '@/lib/config';
import { fmt } from '@/lib/format';

function usd(n: number) {
  return n >= 1 ? `$${n % 1 === 0 ? n : n.toFixed(2)}` : `$${n.toFixed(2)}`;
}

/**
 * Onboarding step: connect a TON wallet to activate the ATF holder boost before
 * reaching the dashboard. Holding ATF auto-applies the multiplier; otherwise the
 * user simply continues to the normal app.
 */
export function AtfBoostStep({ onContinue }: { onContinue: () => void }) {
  const { user } = useStore();
  const u = user!;
  const connected = !!u.wallet;
  const boosted = u.atfMult > 1;

  return (
    <div className="min-h-screen px-5 pb-10 pt-8">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        {/* ATF coin */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-4 h-28 w-28"
        >
          <div
            className="pointer-events-none absolute -inset-4 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.4), transparent 65%)' }}
          />
          <Image src="/brand/atf.png" alt="ATF" fill sizes="112px" className="relative object-contain drop-shadow-[0_0_20px_rgba(245,197,24,0.55)]" />
        </motion.div>

        <div className="chip mb-2 border border-gold-400/40 bg-gold-500/[0.1] text-gold-300">🤝 OFFICIAL PARTNER · ATF</div>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          Boost your mining <span className="gold-text">up to 64×</span>
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Moola proudly supports <b className="text-white">ATF</b> holders. Connect your TON wallet — if you hold ATF,
          your mining rate is boosted <b className="gold-text">instantly</b>, at any level.
        </p>

        {/* one-time holder bonus */}
        <div className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-500/[0.08] p-3">
          <div className="text-2xl">🎁</div>
          <div className="flex-1 text-left text-sm">
            <b className="gold-text">+{fmt(u.atfBonus, 0)} MOOLA</b> one-time bonus
            <div className="text-[11px] text-white/50">Credited automatically the moment we detect ATF.</div>
          </div>
          {u.atfBonusClaimed && <span className="chip bg-moo-500 text-ink-900">✓ Got it</span>}
        </div>

        {/* live status */}
        {boosted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-5 w-full rounded-3xl border border-gold-400/50 bg-gold-500/[0.1] p-5 shadow-gold"
          >
            <div className="text-4xl font-black gold-text">⚡ {u.atfMult}× BOOST</div>
            <div className="mt-1 text-sm text-white/70">
              Active — you hold {usd(u.atfUsd)} of ATF. Your rig now mines {u.atfMult}× faster!
            </div>
          </motion.div>
        ) : connected ? (
          <div className="mt-5 w-full rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-lg font-black">No ATF detected</div>
            <div className="mt-1 text-sm text-white/55">
              Your wallet holds no ATF yet. Grab some to unlock the boost — or continue and add it later.
            </div>
            <button
              onClick={() => {
                haptic('light');
                openLink(stonfiBuyAtf());
              }}
              className="btn-gold mt-3 w-full py-3"
            >
              ⚡ Buy ATF on STON.fi
            </button>
          </div>
        ) : (
          <div className="mt-5 w-full space-y-2">
            {game.atfBoost.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 font-black gold-text">
                  {t.mult}×
                </div>
                <div className="flex-1 text-left text-sm">
                  Hold {usd(t.minUsd)}
                  {isFinite(t.maxUsd) ? ` – ${usd(t.maxUsd)}` : '+'} of ATF
                </div>
              </div>
            ))}
          </div>
        )}

        {/* connect */}
        <div className="mt-5 w-full">
          <WalletChip variant="button" />
        </div>

        {/* continue */}
        <button
          onClick={() => {
            haptic('medium');
            onContinue();
          }}
          className={`mt-3 w-full py-4 text-lg ${boosted ? 'btn-gold' : 'btn-primary'}`}
        >
          {boosted ? `Continue with ${u.atfMult}× boost →` : 'Continue →'}
        </button>
        <button onClick={onContinue} className="mt-3 text-xs font-semibold text-white/40">
          {connected ? 'Continue' : 'Skip for now'}
        </button>

        <p className="mt-4 text-[11px] text-white/30">
          Boost tracks your live ATF balance — hold ATF, keep the boost. You can connect any time from Mine.
        </p>
      </div>
    </div>
  );
}
