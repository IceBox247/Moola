'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { AnimatedNumber, Skeleton } from '@/components/ui';
import { fmt, timeAgo } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import { audio, playSfx, unlockAudio, type AudioPrefs } from '@/lib/audio';
import { VerifyModal } from '@/components/VerifyModal';
import { fmtCompact } from '@/lib/format';
import type { HistoryItem, PublicUser } from '@/lib/types';

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

export function ProfileScreen({ goMine }: { goMine: () => void }) {
  const { user, act, toast } = useStore();
  const u = user!;
  const [amount, setAmount] = useState<string>('');
  const [address, setAddress] = useState<string>(u.wallet ?? '');
  const [busy, setBusy] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    api<{ items: HistoryItem[] }>('history').then((d) => setHistory(d.items)).catch(() => setHistory([]));
  }, [u.balance]);

  const MIN = 60;

  async function withdraw() {
    const amt = Number(amount);
    if (!amt || amt < MIN) return toast(`Minimum withdrawal is ${MIN} MOOLA`, 'bad');
    if (amt > u.balance) return toast('Amount exceeds balance', 'bad');
    if (!address.trim()) return toast('Enter your TON address', 'bad');
    setBusy(true);
    haptic('heavy');
    try {
      const res = await act<{ user?: PublicUser; needsVerification?: boolean }>('withdraw', {
        amount: amt,
        address: address.trim(),
      });
      if (res.needsVerification) {
        setVerifyOpen(true);
        return;
      }
      notify('success');
      playSfx('signature');
      toast('✅ Withdrawal requested!', 'good');
      setAmount('');
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

      {/* Spendable balance */}
      <div className="card-neon p-5 text-center">
        <div className="label">Spendable Balance</div>
        <div className="mt-1 text-4xl font-black">
          <AnimatedNumber value={u.balance} dp={2} className="neon-text" />{' '}
          <span className="gold-text text-2xl">MOOLA</span>
        </div>
      </div>

      {/* Withdraw */}
      <div className="card p-4">
        <div className="mb-3 font-bold">💸 Withdraw MOOLA</div>
        <label className="label">Amount (min {MIN} MOOLA)</label>
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

        <button onClick={withdraw} disabled={busy} className="btn-primary mt-4 w-full py-3.5">
          {busy ? '…' : 'Request Withdrawal'}
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

      <button onClick={goMine} className="btn-ghost w-full py-3 text-sm">
        ← Back to mining
      </button>

      <VerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
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
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
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
