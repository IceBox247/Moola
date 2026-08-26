'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { RarityBadge } from '@/components/ui';
import { fmt } from '@/lib/format';
import { haptic, notify } from '@/lib/telegram';
import type { NftView, PublicUser } from '@/lib/types';

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
        {u.collection.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              haptic('light');
              setOpen(n);
            }}
            className={`card relative overflow-hidden p-0 text-left transition-transform active:scale-[0.98] ${
              n.active ? 'ring-2 ring-moo-400 shadow-neon' : ''
            }`}
          >
            <div className="relative aspect-square w-full bg-black/30">
              <Image src={n.image} alt={n.name} fill sizes="180px" className="object-contain" />
              {!n.owned && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                  <span className="text-2xl">🔒</span>
                </div>
              )}
              {n.active && (
                <span className="absolute left-2 top-2 chip bg-moo-500 text-ink-900">Equipped</span>
              )}
              <span className="absolute right-2 top-2">
                <RarityBadge rarity={n.rarity} />
              </span>
            </div>
            <div className="p-2.5">
              <div className="truncate text-sm font-bold">{n.name}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="gold-text font-semibold">+{n.boostPct}% yield</span>
                {n.owned ? (
                  <span className="text-moo-300">{n.active ? '★' : 'Owned'}</span>
                ) : (
                  <span className="text-white/45">{n.lockLabel}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <NftModal nft={open} onClose={() => setOpen(null)} />
    </div>
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
    try {
      const res = await act<{ user: PublicUser }>('nft/unlock', { id: nft.id });
      notify('success');
      toast(`🎉 Unlocked ${nft.name}!`, 'good');
      void res;
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {nft && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-4 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="card w-full max-w-md overflow-hidden"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full bg-black/40">
              <Image src={nft.image} alt={nft.name} fill sizes="420px" className="object-contain" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">{nft.name}</h3>
                <RarityBadge rarity={nft.rarity} />
              </div>
              <p className="mt-1 text-sm text-white/55">{nft.blurb}</p>

              <div className="mt-3 flex gap-2">
                <div className="flex-1 rounded-2xl bg-white/5 px-3 py-2 text-center">
                  <div className="label">Yield boost</div>
                  <div className="gold-text text-lg font-black">+{nft.boostPct}%</div>
                </div>
                <div className="flex-1 rounded-2xl bg-white/5 px-3 py-2 text-center">
                  <div className="label">Status</div>
                  <div className="text-lg font-black text-white/80">
                    {nft.owned ? (nft.active ? 'Equipped' : 'Owned') : 'Locked'}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {nft.owned ? (
                  nft.active ? (
                    <button disabled className="btn w-full bg-white/5 py-3 text-white/50">
                      ★ Currently equipped
                    </button>
                  ) : (
                    <button onClick={equip} disabled={busy} className="btn-primary w-full py-3">
                      {busy ? '…' : 'Equip this cow'}
                    </button>
                  )
                ) : nft.unlock === 'level' ? (
                  <button
                    onClick={unlock}
                    disabled={!nft.unlockable || busy}
                    className={`w-full py-3 ${nft.unlockable ? 'btn-primary' : 'btn bg-white/5 text-white/40'}`}
                  >
                    {nft.unlockable ? '🎁 Claim (free)' : `🔒 Reach Level ${nft.requiredLevel}`}
                  </button>
                ) : (
                  <button
                    onClick={unlock}
                    disabled={!nft.unlockable || busy}
                    className={`w-full py-3 ${nft.unlockable ? 'btn-gold' : 'btn bg-white/5 text-white/40'}`}
                  >
                    {busy ? '…' : `Mint for ${fmt(nft.costMoola ?? 0, 0)} MOOLA`}
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
