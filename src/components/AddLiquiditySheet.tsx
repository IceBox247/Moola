'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTonAddress } from '@tonconnect/ui-react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { fmt, fmtCompact } from '@/lib/format';
import { haptic, openLink } from '@/lib/telegram';
import { WalletChip } from './WalletChip';

const PRESETS = [1, 5, 10, 25];

type Quote = {
  ton: number;
  moola: number;
  tonBalance: number;
  moolaBalance: number;
  enoughTon: boolean;
  enoughMoola: boolean;
  addUrl: string;
  needsWallet?: boolean;
  disabled?: boolean;
};

/**
 * Guided add-liquidity sheet: the user enters a TON amount, we show the matching
 * MOOLA at the pool ratio and whether their wallet holds both, then hand them to
 * STON.fi to confirm. Their LP is auto-detected afterward and starts earning.
 */
export function AddLiquiditySheet({ open, onClose, rate }: { open: boolean; onClose: () => void; rate: number }) {
  const { user, toast } = useStore();
  const address = useTonAddress();
  const [ton, setTon] = useState('5');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const amt = Number(ton);
    if (!address || !(amt > 0)) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setErr(null);
    // Auto-retry a couple of times: the first pool-price fetch can transiently
    // fail, and we don't want the user to have to nudge the amount to recover.
    const attempt = (n: number) => {
      api<Quote>('lp/quote', { ton: amt, wallet: address })
        .then((q) => {
          if (id !== seq.current) return;
          setQuote(q);
          setErr(null);
          setLoading(false);
        })
        .catch((e) => {
          if (id !== seq.current) return;
          if (n < 3) {
            setTimeout(() => attempt(n + 1), 900);
          } else {
            setErr((e as Error).message);
            setLoading(false);
          }
        });
    };
    const t = setTimeout(() => attempt(1), 450);
    return () => clearTimeout(t);
  }, [ton, address, open]);

  const ready = quote && quote.enoughTon && quote.enoughMoola;

  function go() {
    if (!quote) return;
    haptic('heavy');
    openLink(quote.addUrl);
    toast('Add both sides on STON.fi — your LP is detected automatically 💧', 'good');
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-t-[28px] border border-white/10 bg-ink-850 p-5"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">💧 Add Liquidity</h3>
              <span className="chip border border-sky-400/40 bg-sky-500/[0.12] text-sky-200">
                {(rate * 100).toFixed(0)}% / day
              </span>
            </div>
            <p className="mt-1 text-sm text-white/55">
              Provide MOOLA + TON to the pool and earn{' '}
              <b className="neon-text">{(rate * 100).toFixed(0)}% daily</b> in withdrawable MOOLA.
            </p>

            {!address ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <div className="mb-2 text-sm text-white/60">Connect your wallet to continue</div>
                <div className="flex justify-center">
                  <WalletChip />
                </div>
              </div>
            ) : (
              <>
                <label className="label mt-4 block">Amount of TON to add</label>
                <input
                  inputMode="decimal"
                  value={ton}
                  onChange={(e) => setTon(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-lg font-bold outline-none focus:border-sky-400/50"
                />
                <div className="mt-2 flex gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setTon(String(p))}
                      className="chip flex-1 border border-white/10 bg-white/[0.05] text-white/70"
                    >
                      {p} TON
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-black/25 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/55">You add</span>
                    <span className="font-bold">
                      {fmt(Number(ton) || 0, 2)} TON + {quote ? fmtCompact(quote.moola) : '…'} MOOLA
                    </span>
                  </div>
                  {quote &&
                    (() => {
                      // Fall back to the cached on-chain MOOLA when the live read
                      // came back 0 (tonapi throttled). Show "—" for unknown.
                      const moolaBal = quote.moolaBalance > 0 ? quote.moolaBalance : user?.moolaOnchain ?? 0;
                      return (
                        <div className="mt-2 space-y-1 text-xs">
                          <div
                            className={`flex justify-between ${quote.enoughTon ? 'text-white/45' : 'text-rose-300'}`}
                          >
                            <span>Wallet TON</span>
                            <span>
                              {quote.tonBalance > 0 ? fmt(quote.tonBalance, 2) : '—'} {quote.enoughTon ? '' : '· low'}
                            </span>
                          </div>
                          <div
                            className={`flex justify-between ${quote.enoughMoola ? 'text-white/45' : 'text-rose-300'}`}
                          >
                            <span>Wallet MOOLA</span>
                            <span>
                              {moolaBal > 0 ? fmtCompact(moolaBal) : '—'} {quote.enoughMoola ? '' : '· low'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {err && <div className="mt-2 text-center text-xs text-rose-300">{err}</div>}

                <button
                  onClick={go}
                  disabled={!ready || loading}
                  className="btn-primary mt-4 w-full py-3.5 disabled:opacity-50"
                >
                  {loading ? 'Checking…' : ready ? 'Add Liquidity on STON.fi ›' : 'Enter an amount you can cover'}
                </button>
                <p className="mt-2 text-center text-[11px] text-white/35">
                  You confirm the add on STON.fi. Your LP is detected automatically and starts earning within ~15 min.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
