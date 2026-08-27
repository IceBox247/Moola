/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the heavy TON/STON.fi SDKs out of the serverless function bundle so
  // the swap API routes deploy reliably (they're loaded from node_modules at
  // runtime instead of being bundled, which otherwise bloats/breaks the fn).
  serverExternalPackages: ['@ston-fi/sdk', '@ston-fi/api', '@ton/ton', '@ton/core'],
  // Our art is already compressed webp; skip the image optimizer so remote
  // Telegram avatars work without domain config and Vercel stays zero-fuss.
  images: { unoptimized: true },
  // Telegram WebApp is embedded in an iframe; allow it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
