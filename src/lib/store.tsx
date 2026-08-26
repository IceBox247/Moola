'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './client';
import { initTelegram, notify } from './telegram';
import type { PublicUser } from './types';

type Toast = { id: number; text: string; kind: 'good' | 'bad' | 'info' };

type Store = {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  /** Replace user state from any API response that returns { user }. */
  setUser: (u: PublicUser) => void;
  refresh: () => Promise<void>;
  /** Run an API action that returns { user }, updating state and toasting errors. */
  act: <T extends { user?: PublicUser }>(path: string, body?: unknown) => Promise<T>;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    if (kind === 'bad') notify('error');
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const setUser = useCallback((u: PublicUser) => setUserState(u), []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: PublicUser }>('me');
      setUserState(data.user);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const act = useCallback(
    async <T extends { user?: PublicUser }>(path: string, body?: unknown): Promise<T> => {
      try {
        const data = await api<T>(path, body);
        if (data && (data as { user?: PublicUser }).user) {
          setUserState((data as { user: PublicUser }).user);
        }
        return data;
      } catch (e) {
        toast((e as Error).message, 'bad');
        throw e;
      }
    },
    [toast]
  );

  useEffect(() => {
    initTelegram();
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ user, loading, error, setUser, refresh, act, toasts, toast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used within StoreProvider');
  return c;
}
