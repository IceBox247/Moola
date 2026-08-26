'use client';

import { useEffect, useRef } from 'react';
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
  const { setUser } = useStore();
  const saved = useRef<string | null>(null);

  // Persist the connected address to the backend once.
  useEffect(() => {
    if (address && address !== saved.current) {
      saved.current = address;
      api<{ user: PublicUser }>('wallet', { address })
        .then((r) => setUser(r.user))
        .catch(() => {});
    }
    if (!address) saved.current = null;
  }, [address, setUser]);

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
