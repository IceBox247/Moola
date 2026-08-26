'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import { unlockAudio, playSfx } from '@/lib/audio';
import type { NftView, PublicUser, Rarity } from '@/lib/types';

const RARITY: Record<Rarity, { ring: string; glow: string; text: string; chip: string }> = {
  Common: { ring: 'from-white/25 to-white/5', glow: 'rgba(255,255,255,0.18)', text: 'text-white/70', chip: 'bg-white/10 text-white/70' },
  Rare: { ring: 'from-sky-400/60 to-sky-500/10', glow: 'rgba(56,189,248,0.35)', text: 'text-sky-300', chip: 'bg-sky-500/15 text-sky-300' },
  Epic: { ring: 'from-fuchsia-400/60 to-fuchsia-500/10', glow: 'rgba(232,121,249,0.38)', text: 'text-fuchsia-300', chip: 'bg-fuchsia-500/15 text-fuchsia-300' },
  Legendary: { ring: 'from-gold-400/70 to-gold-500/10', glow: 'rgba(245,197,24,0.42)', text: 'text-gold-400', chip: 'bg-gold-500/15 text-gold-400' },
  Genesis: { ring: 'from-moo-400/70 to-moo-500/10', glow: 'rgba(15,217,75,0.45)', text: 'text-moo-300', chip: 'bg-moo-500/15 text-moo-300' },
};

export function NftScreen() {
  const { user } = useStore();
  const [open, setOpen] = useState<NftView | null>(null);
  const u = user!;
  const owned = u.collection.filter((n) => n.owned).length;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-[26px] font-black tracking-tight">
          <span className="h-grad">Moola</span> <span className="neon-text">NFTs</span>
        </h1>
        <p className="text-sm text-white/50">
          Collect cows · equip one to <span className="gold-text font-semibold">boost mining</span>
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="chip bg-white/8 text-white/70">Owned {owned}/{u.collection.length}</span>
        {u.boostPct > 0 && <span className="chip bg-moo-500/15 text-moo-300">Active boost +{u.boostPct}%</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {u.collection.map((n, i) => (
          <NftTile key={n.id} n={n} index={i} onOpen={() => { haptic('light'); setOpen(n); }} />
        ))}
      </div>

      <NftModal nft={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function NftTile({ n, index, onOpen }: { n: NftView; index: number; onOpen: () => void }) {
  const r = RARITY[n.rarity];
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className={`relative rounded-[22px] bg-gradient-to-b ${r.ring} p-[1.5px] text-left ${
        n.active ? 'shadow-neon' : ''
      }`}
    >
      <div className="overflow-hidden rounded-[21px] bg-ink-850">
        <div
          className="relative aspect-[4/5] w-full"
          style={{ background: `radial-gradient(circle at 50% 40%, ${r.glow}, transparent 70%)` }}
        >
          <Image src={n.image} alt={n.name} fill sizes="180px" className="object-contain p-1" />
          {/* gloss */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
          {!n.owned && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg">🔒</span>
            </div>
          )}
          {n.active && <span className="absolute left-2 top-2 chip bg-moo-500 text-ink-900">★ Equipped</span>}
          <span className={`absolute right-2 top-2 chip ${r.chip}`}>{n.rarity}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{n.name}</div>
            <div className="gold-text text-[11px] font-bold">+{n.boostPct}% yield</div>
          </div>
          <span className={`shrink-0 text-[11px] font-semibold ${n.owned ? r.text : 'text-white/45'}`}>
            {n.owned ? (n.active ? '' : 'Owned') : n.lockLabel.startsWith('Reach') ? '🔒' : n.lockLabel}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function NftModal({ nft, onClose }: { nft: NftView | null; onClose: () => void }) {
  const { act, toast } = useStore();
  const [busy, setBusy] = useState(false);

  async function equip() {
    if (!nft) return;
    setBusy(true);
    haptic('medium');
    try {
      await act('nft/select', { id: nft.id });
      notify('success');
      playSfx('nft_activate');
      toast(`Equipped ${nft.name}`, 'good');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!nft) return;
    setBusy(true);
    haptic('heavy');
    unlockAudio();
    try {
      await act<{ user: PublicUser }>('nft/unlock', { id: nft.id });
      notify('success');
      playSfx('nft_activate');
      toast(`🎉 Unlocked ${nft.name}!`, 'good');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const r = nft ? RARITY[nft.rarity] : null;

  return (
    <AnimatePresence>
      {nft && r && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`flex max-h-[86vh] w-full max-w-sm flex-col rounded-[26px] bg-gradient-to-b ${r.ring} p-[1.5px]`}
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[25px] bg-ink-850">
              {/* image */}
              <div
                className="relative h-[38vh] max-h-72 w-full shrink-0"
                style={{ background: `radial-gradient(circle at 50% 42%, ${r.glow}, transparent 70%)` }}
              >
                <Image src={nft.image} alt={nft.name} fill sizes="380px" className="object-contain p-2" priority />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
                <span className={`absolute right-3 top-3 chip ${r.chip}`}>{nft.rarity}</span>
                <button
                  onClick={onClose}
                  className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* details */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <h3 className="text-xl font-black">{nft.name}</h3>
                <p className="mt-1 text-sm text-white/55">{nft.blurb}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2 text-center">
                    <div className="label">Yield boost</div>
                    <div className="gold-text text-lg font-black">+{nft.boostPct}%</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2 text-center">
                    <div className="label">Status</div>
                    <div className={`text-lg font-black ${nft.owned ? r.text : 'text-white/70'}`}>
                      {nft.owned ? (nft.active ? 'Equipped' : 'Owned') : 'Locked'}
                    </div>
                  </div>
                </div>
              </div>

              {/* sticky action — always visible */}
              <div className="shrink-0 border-t border-white/8 bg-ink-850 p-4">
                {nft.owned ? (
                  nft.active ? (
                    <button disabled className="btn w-full bg-white/5 py-3.5 text-white/50">★ Currently equipped</button>
                  ) : (
                    <button onClick={equip} disabled={busy} className="btn-primary w-full py-3.5">
                      {busy ? '…' : 'Equip this cow'}
                    </button>
                  )
                ) : nft.unlock === 'level' ? (
                  <button
                    onClick={unlock}
                    disabled={!nft.unlockable || busy}
                    className={`w-full py-3.5 ${nft.unlockable ? 'btn-primary' : 'btn bg-white/5 text-white/40'}`}
                  >
                    {nft.unlockable ? '🎁 Claim for free' : `🔒 Reach Level ${nft.requiredLevel} to unlock`}
                  </button>
                ) : (
                  <button
                    onClick={unlock}
                    disabled={!nft.unlockable || busy}
                    className={`w-full py-3.5 ${nft.unlockable ? 'btn-gold' : 'btn bg-white/5 text-white/40'}`}
                  >
                    {busy ? '…' : nft.unlockable ? `Mint for ${fmt(nft.costMoola ?? 0, 0)} MOOLA` : `Need ${fmt(nft.costMoola ?? 0, 0)} MOOLA to mint`}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
