'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { AnimatedNumber, Skeleton } from '@/components/ui';
import { fmt, timeAgo } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import type { HistoryItem, PublicUser } from '@/lib/types';

const KIND_ICON: Record<string, string> = {
  mining: '⛏️',
  checkin: '📅',
  watch_ad: '🎬',
  verify_ad: '🔗',
  social: '⭐',
  referral: '🎁',
  mint: '🐮',
  withdraw: '💸',
};

export function ProfileScreen({ goMine }: { goMine: () => void }) {
  const { user, act, toast } = useStore();
  const u = user!;
  const [amount, setAmount] = useState<string>('');
  const [address, setAddress] = useState<string>(u.wallet ?? '');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    api<{ items: HistoryItem[] }>('history').then((d) => setHistory(d.items)).catch(() => setHistory([]));
  }, [u.balance]);

  const MIN = 60;

  async function toggleSound() {
    haptic('light');
    await act('settings', { soundFx: !u.soundFx });
  }

  async function withdraw() {
    const amt = Number(amount);
    if (!amt || amt < MIN) return toast(`Minimum withdrawal is ${MIN} MOOLA`, 'bad');
    if (amt > u.balance) return toast('Amount exceeds balance', 'bad');
    if (!address.trim()) return toast('Enter your TON address', 'bad');
    setBusy(true);
    haptic('heavy');
    try {
      await act<{ user: PublicUser }>('withdraw', { amount: amt, address: address.trim() });
      notify('success');
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

        <label className="label mt-3 block">TON Address</label>
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
          Requests are queued and paid to your TON wallet by the payout desk.
        </p>
      </div>

      {/* Settings */}
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-xl">🔊</div>
        <div className="flex-1">
          <div className="font-bold">Mining Sound FX</div>
          <div className="text-xs text-white/45">Pro mining-rig ambience</div>
        </div>
        <button
          onClick={toggleSound}
          className={`relative h-7 w-12 rounded-full transition-colors ${u.soundFx ? 'bg-moo-500' : 'bg-white/15'}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              u.soundFx ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

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
    </div>
  );
}
