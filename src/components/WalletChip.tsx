'use client';

import { useEffect, useRef, useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { shortAddr } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import type { PublicUser } from '@/lib/types';

/** TON Connect wallet button — connect Tonkeeper / Telegram Wallet and save the address. */
export function WalletChip() {
  const [tonUI] = useTonConnectUI();
  const address = useTonAddress(); // user-friendly UQ… address (empty when disconnected)
  const { user, setUser } = useStore();
  const saved = useRef<string | null>(null);

  // Sync wallet state to the backend on connect AND disconnect.
  useEffect(() => {
    if (address && address !== saved.current) {
      // Connected (or switched) — save + scan holdings.
      saved.current = address;
      api<{ user: PublicUser }>('wallet', { address })
        .then((r) => setUser(r.user))
        .catch(() => {});
    } else if (!address && saved.current) {
      // Disconnected — clear on-chain holdings so level/boost revert.
      saved.current = null;
      api<{ user: PublicUser }>('wallet/disconnect')
        .then((r) => setUser(r.user))
        .catch(() => {});
    }
  }, [address, setUser]);

  // Wait for TON Connect to finish restoring any prior connection before we
  // decide a wallet is really gone (otherwise we'd wipe a still-connected one).
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let mounted = true;
    tonUI.connectionRestored.then(() => mounted && setRestored(true)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [tonUI]);

  // If the backend still has a wallet (from a prior session) but TON Connect has
  // none after restore, reconcile so a stale wallet can't linger.
  useEffect(() => {
    if (restored && !address && !saved.current && user?.wallet) {
      api<{ user: PublicUser }>('wallet/disconnect')
        .then((r) => setUser(r.user))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, address, user?.wallet]);

  const connected = !!address;

  return (
    <button
      onClick={() => {
        haptic('medium');
        if (connected) tonUI.disconnect();
        else tonUI.openModal();
      }}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold shadow-neon transition-colors ${
        connected
          ? 'border-moo-500/40 bg-moo-500/10 text-moo-200'
          : 'border-sky-400/50 bg-sky-500/15 text-sky-200'
      }`}
    >
      {connected ? (
        <>💎 {shortAddr(address)}</>
      ) : (
        <>
          <span className="text-sm">💎</span> Connect TON
        </>
      )}
    </button>
  );
}
