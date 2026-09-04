'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { AnimatedNumber, Skeleton } from '@/components/ui';
import { fmt, timeAgo } from '@/lib/format';
import { haptic, notify, openLink } from '@/lib/telegram';
import { audio, playSfx, unlockAudio, type AudioPrefs } from '@/lib/audio';
import { VerifyModal } from '@/components/VerifyModal';
import { HelpSheet } from '@/components/HelpSheet';
import { fmtCompact } from '@/lib/format';
import type { HistoryItem, PublicUser } from '@/lib/types';

type WithdrawalItem = {
  id: number;
  amount: number;
  address: string;
  status: string;
  error: string | null;
  txHash: string | null;
  createdAt: number;
};

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ Pending', cls: 'bg-white/10 text-white/60' },
  processing: { label: '⚙️ Sending', cls: 'bg-sky-500/15 text-sky-300' },
  paid: { label: '✅ Paid', cls: 'bg-moo-500/15 text-moo-300' },
  failed: { label: '⚠️ Failed', cls: 'bg-red-500/15 text-red-300' },
  review: { label: '🔎 Under review', cls: 'bg-gold-500/15 text-gold-300' },
};

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
function toSub(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT[+d])
    .join('');
}

/**
 * USD label with DexScreener-style subscript notation for tiny values, so a
 * very small holding still reads meaningfully (e.g. $0.0₅229) instead of $0.00.
 */
function usd(n: number): string {
  if (!(n > 0)) return '$0';
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
  // Very small: 0.0<zeros as subscript><first 3 significant digits>.
  const exp = Math.floor(Math.log10(n));
  const zeros = -exp - 1;
  const mant = Math.round((n / Math.pow(10, exp)) * 100); // 3 significant digits
  return `$0.0${toSub(zeros)}${mant}`;
}

/** Compact "3h 12m" / "8m" until a future timestamp. */
function untilLabel(ts: number): string {
  const ms = Math.max(0, ts - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const KIND_ICON: Record<string, string> = {
  mining: '⛏️',
  checkin: '📅',
  watch_ad: '🎬',
  verify_ad: '🔗',
  social: '⭐',
  referral: '🎁',
  atf_bonus: '🤝',
  mint: '🐮',
  withdraw: '💸',
};

// Cached across tab remounts so switching tabs doesn't refetch every time.
const PROFILE_TTL_MS = 60_000;
const profileCache: { at: number; history: HistoryItem[] | null; withdrawals: WithdrawalItem[] | null } = {
  at: 0,
  history: null,
  withdrawals: null,
};

export function ProfileScreen({ goMine }: { goMine: () => void }) {
  const { user, setUser, toast } = useStore();
  const [tonUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const u = user!;
  const [amount, setAmount] = useState<string>('');
  const [address, setAddress] = useState<string>(u.wallet ?? '');
  const [busy, setBusy] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[] | null>(profileCache.history);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[] | null>(profileCache.withdrawals);
  // Price already arrives with the user payload — no extra /api/stats call.
  const priceUsd = u.livePriceUsd || u.moolaPriceUsd;

  useEffect(() => {
    // Tabs unmount on switch, so without this cache every visit to Profile
    // refired these requests. Serve the cached lists instantly and only hit the
    // API when they're actually stale.
    if (Date.now() - profileCache.at < PROFILE_TTL_MS && profileCache.history) return;
    profileCache.at = Date.now();
    api<{ items: HistoryItem[] }>('history')
      .then((d) => {
        profileCache.history = d.items;
        setHistory(d.items);
      })
      .catch(() => setHistory((h) => h ?? []));
    api<{ items: WithdrawalItem[] }>('withdrawals')
      .then((d) => {
        profileCache.withdrawals = d.items;
        setWithdrawals(d.items);
      })
      .catch(() => setWithdrawals((w) => w ?? []));
  }, []);

  // Live USD value of holdings (falls back to the fixed launch-price snapshot).
  const poolUsd = u.balance * priceUsd; // in-app / withdrawable
  const walletUsd = u.moolaOnchain * priceUsd; // on-chain wallet holding
  const totalMoola = u.balance + u.moolaOnchain;
  const totalUsd = totalMoola * priceUsd;

  // First withdrawal has a higher minimum; later ones use the default.
  const isFirstWithdraw = !u.hasWithdrawn;
  const MIN = isFirstWithdraw ? u.firstWithdrawMin ?? 60 : 60;
  const firstUnlockAt = u.firstWithdrawUnlockAt ?? 0;
  const firstLockedNow = isFirstWithdraw && Date.now() < firstUnlockAt;

  async function withdraw() {
    const amt = Number(amount);
    if (!amt || amt < MIN) return toast(`Minimum withdrawal is ${MIN} MOOLA`, 'bad');
    if (amt > u.balance) return toast('Amount exceeds balance', 'bad');
    if (!address.trim()) return toast('Enter your TON address', 'bad');
    setBusy(true);
    haptic('heavy');
    type WResp = {
      user?: PublicUser;
      needsVerification?: boolean;
      needsFee?: boolean;
      feeUsd?: number;
      feeNanoTon?: string;
      treasury?: string;
      feePending?: boolean;
      firstLocked?: boolean;
      unlockAt?: number;
    };
    const submit = () =>
      api<WResp>('withdraw', { amount: amt, address: address.trim(), payer: tonAddress || undefined });
    try {
      let res = await submit();
      if (res.needsVerification) {
        setVerifyOpen(true);
        return;
      }
      if (res.firstLocked) {
        toast(`First withdrawal unlocks ${untilLabel(res.unlockAt ?? 0)} after joining — hold tight!`, 'bad');
        return;
      }
      // Extra withdrawal in the 24h window → collect the on-chain fee first.
      if (res.needsFee) {
        if (!tonAddress) {
          toast('Connect your wallet to pay the small extra-withdrawal fee', 'bad');
          return;
        }
        toast(`Extra withdrawal today — approve the $${res.feeUsd} fee in your wallet`, 'info');
        await tonUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [{ address: res.treasury!, amount: res.feeNanoTon! }],
        });
        toast('Confirming fee on-chain…', 'info');
        // Poll until the payment is seen on-chain (then the withdrawal queues).
        res = await submit();
        for (let i = 0; i < 8 && !res.user && (res.feePending || res.needsFee); i++) {
          await new Promise((r) => setTimeout(r, 5000));
          res = await submit();
        }
        if (!res.user) {
          toast('Fee not confirmed yet — tap Request again in a moment', 'bad');
          return;
        }
      }
      if (res.user) {
        setUser(res.user);
        notify('success');
        playSfx('signature');
        toast('✅ Withdrawal requested!', 'good');
        setAmount('');
        profileCache.at = 0; // force a refresh so the new row shows
      }
    } catch (e) {
      const m = (e as Error).message || 'Withdrawal failed';
      if (!/reject|cancel|declin/i.test(m)) toast(m, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-moo-500/40 shadow-neon">
          {u.photoUrl ? (
            <Image src={u.photoUrl} alt={u.firstName} fill sizes="64px" className="object-cover" />
          ) : (
            <Image src="/brand/logo.png" alt="Moola" fill sizes="64px" className="object-contain p-1" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-black">{u.firstName}</h1>
          <p className="text-xs text-white/40">
            ID: {u.id} · Lvl {u.level}
          </p>
        </div>
      </div>

      {/* Total assets */}
      <div className="card-neon p-5 text-center">
        <div className="label">Total MOOLA Assets</div>
        <div className="mt-1 text-4xl font-black">
          <AnimatedNumber value={totalMoola} dp={2} className="neon-text" />{' '}
          <span className="gold-text text-2xl">MOOLA</span>
        </div>
        <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-moo-500/30 bg-moo-500/[0.08] px-3 py-0.5 text-sm font-bold text-moo-300">
          ≈ {usd(totalUsd)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
            <div className="label">Pool (spendable)</div>
            <div className="text-sm font-black">{fmt(u.balance, 2)} <span className="text-white/40">MOOLA</span></div>
            <div className="text-[11px] text-moo-300">≈ {usd(poolUsd)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
            <div className="label">Wallet holding</div>
            <div className="text-sm font-black">{fmt(u.moolaOnchain, 2)} <span className="text-white/40">MOOLA</span></div>
            <div className="text-[11px] text-sky-300">≈ {usd(walletUsd)}</div>
          </div>
        </div>
      </div>

      {/* Withdraw */}
      <div className="card p-4">
        <div className="mb-3 font-bold">💸 Withdraw MOOLA</div>

        {isFirstWithdraw && (
          <div className="mb-3 rounded-2xl border border-gold-400/30 bg-gold-500/[0.07] px-3 py-2 text-[11px] leading-relaxed text-white/70">
            🔒 <b className="text-white/85">First withdrawal:</b> minimum{' '}
            <b className="gold-text">{fmtCompact(MIN)} MOOLA</b>
            {firstLockedNow ? (
              <>
                {' '}
                · unlocks in <span className="neon-text font-semibold">{untilLabel(firstUnlockAt)}</span>
              </>
            ) : (
              ' · unlocked ✓'
            )}
            . This keeps out throwaway/bonus-farming accounts; after your first, the minimum drops to{' '}
            <b>60 MOOLA</b>.
          </div>
        )}

        <label className="label">Amount (min {fmtCompact(MIN)} MOOLA)</label>
        <div className="mt-1 flex gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-lg font-bold outline-none focus:border-moo-500/50"
          />
          <button
            onClick={() => setAmount(String(Math.floor(u.balance * 100) / 100))}
            className="btn-ghost shrink-0 px-5"
          >
            MAX
          </button>
        </div>

        <label className="label mt-3 block">Wallet Address (MOOLA is sent here)</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="UQ… your TON wallet"
          className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-moo-500/50"
        />

        {/* Free-withdrawal / fee status */}
        <div className="mt-3 rounded-2xl border border-white/8 bg-black/25 px-3 py-2 text-center text-[11px]">
          {u.withdrawFree ? (
            <span className="font-semibold text-moo-300">
              ✅ 1 free withdrawal available · then ${u.withdrawFeeUsd.toFixed(2)} fee per extra (24h)
            </span>
          ) : (
            <span className="text-white/55">
              Free withdrawal used.{' '}
              {u.withdrawNextFreeAt && (
                <>
                  Next free in <span className="neon-text font-semibold">{untilLabel(u.withdrawNextFreeAt)}</span>.{' '}
                </>
              )}
              Withdraw now for a{' '}
              <span className="gold-text font-semibold">${u.withdrawFeeUsd.toFixed(2)}</span> TON fee.
            </span>
          )}
        </div>

        <button onClick={withdraw} disabled={busy} className="btn-primary mt-3 w-full py-3.5">
          {busy ? '…' : u.withdrawFree ? 'Request Withdrawal' : `Withdraw ($${u.withdrawFeeUsd.toFixed(2)} fee)`}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/35">
          Paid out in <span className="gold-text font-semibold">MOOLA</span> to your TON wallet by the payout desk.
        </p>

        {/* verification status */}
        {u.verified ? (
          <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-moo-300">
            ✓ Verified account
          </div>
        ) : u.verifyStatus === 'pending' ? (
          <div className="mt-2 rounded-2xl border border-gold-400/30 bg-gold-500/[0.06] px-3 py-2 text-center text-[11px] text-white/60">
            ⏳ Verification under review
          </div>
        ) : (
          <button
            onClick={() => setVerifyOpen(true)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-[11px] text-white/55"
          >
            🔒 Withdrawals over {fmtCompact(u.verifyThreshold)} MOOLA need verification — tap to verify
          </button>
        )}
      </div>

      {/* Withdrawal status */}
      {withdrawals && withdrawals.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 font-bold">💸 Withdrawal Status</div>
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const s = WD_STATUS[w.status] ?? WD_STATUS.pending;
              return (
                <div key={w.id} className="rounded-2xl border border-white/8 bg-black/25 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black">{fmt(w.amount, 2)} MOOLA</div>
                    <span className={`chip ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/40">
                    to {w.address.slice(0, 6)}…{w.address.slice(-4)} · {timeAgo(w.createdAt)}
                  </div>
                  {w.status === 'paid' && (
                    <button
                      onClick={() => {
                        haptic('light');
                        openLink(`https://tonviewer.com/${w.address}`);
                      }}
                      className="mt-1 text-[11px] font-semibold text-sky-300/90"
                    >
                      🔎 View on Tonviewer ↗
                    </button>
                  )}
                  {(w.status === 'pending' || w.status === 'processing') && (
                    <div className="mt-1 text-[11px] text-white/40">
                      Sending on-chain — this can take a few minutes. Auto-refunded if it fails.
                    </div>
                  )}
                  {w.status === 'review' && (
                    <div className="mt-1 text-[11px] text-gold-300/70">
                      Being checked on-chain — no action needed. It’ll settle as paid or refund automatically.
                    </div>
                  )}
                  {w.status === 'failed' && (
                    <div className="mt-1 break-words text-[11px] text-red-300/80">
                      {w.error || 'Transfer failed — your MOOLA was refunded to your balance. You can withdraw again.'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audio settings */}
      <AudioSettings mining={u.mining.active} />

      {/* History */}
      <div>
        <div className="mb-2 font-bold">📜 History</div>
        {history === null ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/35">No transactions yet. Start mining!</p>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="card flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-lg">
                  {KIND_ICON[h.kind] ?? '•'}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{h.label}</div>
                  <div className="text-[11px] text-white/35">{timeAgo(h.createdAt)}</div>
                </div>
                <div className={`text-sm font-black ${h.amount >= 0 ? 'neon-text' : 'text-red-300'}`}>
                  {h.amount >= 0 ? '+' : ''}
                  {fmt(h.amount, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help & Support */}
      <button
        onClick={() => setHelpOpen(true)}
        className="card flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-moo-500/12 text-xl">🐮</div>
        <div className="flex-1">
          <div className="text-sm font-bold">Help &amp; Support</div>
          <div className="text-[11px] text-white/45">Withdrawals, holdings, mining speed &amp; more</div>
        </div>
        <span className="text-white/30">›</span>
      </button>

      <button onClick={goMine} className="btn-ghost w-full py-3 text-sm">
        ← Back to mining
      </button>

      <VerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function AudioSettings({ mining }: { mining: boolean }) {
  const [p, setP] = useState<AudioPrefs>(() => audio.getPrefs());

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center gap-2 font-bold">🔊 Audio</div>

      {/* Sound effects */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Sound Effects</div>
          <div className="text-[11px] text-white/45">Claims, rewards, boosts &amp; more</div>
        </div>
        <Toggle
          on={p.sfxOn}
          onChange={(on) => {
            unlockAudio();
            audio.setSfxOn(on);
            setP(audio.getPrefs());
            if (on) playSfx('success');
          }}
        />
      </div>
      {p.sfxOn && (
        <Slider
          value={p.sfxVol}
          onChange={(v) => {
            audio.setSfxVol(v);
            setP(audio.getPrefs());
          }}
          onCommit={() => playSfx('claim')}
        />
      )}

      <div className="divider" />

      {/* Mining music */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Mining Music</div>
          <div className="text-[11px] text-white/45">Ambient loop while you mine</div>
        </div>
        <Toggle
          on={p.musicOn}
          onChange={(on) => {
            unlockAudio();
            audio.setMusicOn(on);
            setP(audio.getPrefs());
          }}
        />
      </div>
      {p.musicOn && (
        <Slider
          value={p.musicVol}
          onChange={(v) => {
            audio.setMusicVol(v);
            setP(audio.getPrefs());
          }}
        />
      )}

      {!mining && p.musicOn && (
        <p className="text-[11px] text-white/35">Music plays while a mining session is active.</p>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-moo-500' : 'bg-white/15'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      onPointerUp={onCommit}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-moo-500"
    />
  );
}
