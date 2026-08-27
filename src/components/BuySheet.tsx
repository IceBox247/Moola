'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { fmt, fmtCompact } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import { playSfx } from '@/lib/audio';
import { WalletChip } from './WalletChip';
import type { PublicUser } from '@/lib/types';

const PRESETS = [1, 5, 10, 25];

/**
 * Native in-app MOOLA purchase. Quotes TON → MOOLA on STON.fi and has the
 * user's connected wallet sign the swap right here — no browser hop.
 */
export function BuySheet({
  open,
  onClose,
  targetMoola,
}: {
  open: boolean;
  onClose: () => void;
  targetMoola?: number;
}) {
  const { setUser, toast } = useStore();
  const [tonUI] = useTonConnectUI();
  const address = useTonAddress();

  type SwapMsg = { address: string; amount: string; payload: string };
  const [ton, setTon] = useState('1');
  const [quote, setQuote] = useState<{ askMoola: number; minMoola: number } | null>(null);
  const [msg, setMsg] = useState<SwapMsg | null>(null); // pre-built, ready to sign
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null); // visible build/sign diagnostics
  const seq = useRef(0);

  // Debounced quote for the estimate (lightweight, always works), plus — when a
  // wallet is connected — pre-build the signable message in the background so
  // the Swap tap can call sendTransaction with no awaited network call in
  // between (an async gap there would eat the tap's user-activation and the
  // wallet would never open). The pre-build never blocks or errors the display.
  useEffect(() => {
    if (!open) return;
    const amt = Number(ton);
    setMsg(null);
    if (!amt || amt <= 0) {
      setQuote(null);
      setErr(null);
      return;
    }
    const id = ++seq.current;
    setQuoting(true);
    setErr(null);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ askMoola: number; minMoola: number }>('swap/quote', { ton: amt });
        if (id === seq.current) setQuote(r);
      } catch (e) {
        if (id === seq.current) {
          setQuote(null);
          setErr((e as Error).message || 'No route yet');
        }
      } finally {
        if (id === seq.current) setQuoting(false);
      }
      // Background pre-build — surface its error so we can see what's failing.
      if (address) {
        setDiag(null);
        api<{ message: SwapMsg }>('swap/tx', { ton: amt, address })
          .then((b) => {
            if (id === seq.current) setMsg(b.message);
          })
          .catch((e) => {
            if (id === seq.current) setDiag(`build: ${(e as Error).message}`);
          });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [ton, open, address]);

  async function confirm() {
    const amt = Number(ton);
    if (!address) return toast('Connect your wallet first', 'bad');
    if (!amt || amt <= 0) return toast('Enter an amount', 'bad');
    setBusy(true);
    setDiag(null);
    haptic('heavy');
    try {
      // Prefer the pre-built message so no network call precedes sendTransaction
      // (keeps the tap gesture). Fall back to building on-tap if it's not ready.
      let m = msg;
      if (!m) {
        setDiag('building…');
        const b = await api<{ message: SwapMsg }>('swap/tx', { ton: amt, address });
        m = b.message;
      }
      setDiag('opening wallet…');
      await tonUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: m.address, amount: m.amount, payload: m.payload }],
      });
      setDiag(null);
      notify('success');
      playSfx('reward_big');
      toast('✅ Swap sent! Your MOOLA will arrive shortly.', 'good');
      // Re-scan on-chain holdings so balance + level catch up.
      setTimeout(() => {
        api<{ user: PublicUser }>('wallet', { address })
          .then((r) => setUser(r.user))
          .catch(() => {});
      }, 6000);
      onClose();
    } catch (e) {
      const m = (e as Error).message || 'Swap failed';
      if (/reject|cancel|declin/i.test(m)) {
        setDiag(null);
      } else {
        setDiag(`sign: ${m}`);
        toast(m, 'bad');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            className="w-full max-w-md rounded-t-[28px] border border-gold-400/20 bg-ink-850 p-5"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-center text-xl font-black">
              Buy <span className="gold-text">MOOLA</span>
            </h3>
            <p className="text-center text-sm text-white/50">
              Swap TON for MOOLA — signed right in your wallet.
            </p>
            {targetMoola && targetMoola > 0 && (
              <div className="mt-3 rounded-2xl border border-moo-500/30 bg-moo-500/[0.06] px-4 py-2 text-center text-sm">
                You need <span className="neon-text font-bold">{fmtCompact(targetMoola)} MOOLA</span> more to level up.
              </div>
            )}

            {/* amount */}
            <label className="label mt-4 block">You pay (TON)</label>
            <input
              inputMode="decimal"
              value={ton}
              onChange={(e) => setTon(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-lg font-bold outline-none focus:border-moo-500/50"
            />
            <div className="mt-2 flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setTon(String(p))}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-sm font-bold"
                >
                  {p} TON
                </button>
              ))}
            </div>

            {/* estimate */}
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/25 p-4 text-center">
              <div className="label">You receive (est.)</div>
              {quoting ? (
                <div className="mt-1 text-2xl font-black text-white/40">…</div>
              ) : err ? (
                <div className="mt-1 text-sm text-red-300">{err}</div>
              ) : quote ? (
                <>
                  <div className="mt-1 text-2xl font-black gold-text">≈ {fmt(quote.askMoola, 2)} MOOLA</div>
                  <div className="text-[11px] text-white/40">
                    Minimum received {fmt(quote.minMoola, 2)} (2% slippage)
                  </div>
                </>
              ) : (
                <div className="mt-1 text-2xl font-black text-white/30">—</div>
              )}
            </div>

            {/* action */}
            {address ? (
              <button
                onClick={confirm}
                disabled={busy || quoting || !quote}
                className="btn-gold mt-4 w-full py-3.5 disabled:opacity-50"
              >
                {busy ? 'Confirm in wallet…' : quoting ? 'Preparing…' : 'Swap in wallet'}
              </button>
            ) : (
              <div className="mt-4">
                <WalletChip variant="button" />
                <p className="mt-2 text-center text-[11px] text-white/40">
                  Connect your TON wallet to swap.
                </p>
              </div>
            )}

            {diag && (
              <div className="mt-2 break-words rounded-xl border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-center text-[11px] text-red-200">
                {diag}
              </div>
            )}

            <button onClick={onClose} className="mt-3 w-full py-2 text-xs font-semibold text-white/40">
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
