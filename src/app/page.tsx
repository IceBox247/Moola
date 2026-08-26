'use client';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { StoreProvider } from '@/lib/store';
import { App } from '@/components/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moola-peach.vercel.app';

export default function Page() {
  return (
    <ErrorBoundary>
      <TonConnectUIProvider manifestUrl={`${APP_URL}/tonconnect-manifest.json`}>
        <StoreProvider>
          <App />
        </StoreProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
