import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Moola — Mine · Earn · Withdraw',
  description: 'Mine MOOLA, collect neon cow NFTs, complete tasks and withdraw to TON.',
  icons: { icon: '/brand/logo.webp' },
};

export const viewport: Viewport = {
  themeColor: '#04070c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Telegram Web App SDK */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="mx-auto max-w-md min-h-screen">{children}</body>
    </html>
  );
}
