'use client';

import { getInitData } from './telegram';

/** POST a JSON body to an API route with the Telegram initData header. */
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-init-data': getInitData(),
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
