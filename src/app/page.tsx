'use client';

import { StoreProvider } from '@/lib/store';
import { App } from '@/components/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  );
}
