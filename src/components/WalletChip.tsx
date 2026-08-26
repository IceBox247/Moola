'use client';

import { useEffect, useRef, useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/client';
import { shortAddr } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import type { PublicUser } from '@/lib/types';

/** TON Connect wallet button — connect Tonkeeper / Telegram Wallet and save the address. */
export function WalletChip({ variant = 'chip' }: { variant?: 'chip' | 'button' }) {
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
  const onClick = () => {
    haptic('medium');
    if (connected) tonUI.disconnect();
    else tonUI.openModal();
  };
  const blue = {
    background: 'linear-gradient(180deg, #37b4ff, #0a84f0)',
    boxShadow: '0 6px 18px rgba(10,132,240,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
  } as const;

  if (variant === 'button') {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-black text-white"
        style={blue}
      >
        <TonIcon className="h-5 w-5 shrink-0" />
        {connected ? `Connected · ${shortAddr(address)}` : 'Connect TON Wallet'}
      </button>
    );
  }

  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white" style={blue}>
      <TonIcon className="h-4 w-4 shrink-0" />
      {connected ? shortAddr(address) : 'Connect Wallet'}
    </button>
  );
}

/** TON diamond logo. */
function TonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3 L20.5 8.4 L12 21 L3.5 8.4 Z" opacity="0.95" />
      <path d="M12 3 L12 21" stroke="rgba(10,80,160,0.55)" strokeWidth="1.4" />
    </svg>
  );
}
