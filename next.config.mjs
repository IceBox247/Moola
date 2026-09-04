/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the heavy TON/STON.fi SDKs out of the serverless function bundle so
  // the swap API routes deploy reliably (they're loaded from node_modules at
  // runtime instead of being bundled, which otherwise bloats/breaks the fn).
  serverExternalPackages: ['@ston-fi/sdk', '@ston-fi/api', '@ton/core'],
  // Our art is already compressed webp; skip the image optimizer so remote
  // Telegram avatars work without domain config and Vercel stays zero-fuss.
  images: { unoptimized: true },
  // Telegram WebApp is embedded in an iframe; allow it.
  async headers() {
    const oneYearImmutable = 'public, max-age=31536000, immutable';
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
      // Static media in /public is served from stable paths. Without an explicit
      // immutable cache header, browsers/CDN revalidate on every view — each a
      // billable edge request. Cache hard so repeat views hit the browser cache
      // and never touch the edge. (Art paths are versioned by content changes;
      // if you replace an asset, use a new filename.)
      {
        source: '/:path*.(webp|png|jpg|jpeg|gif|svg|ico|avif|mp3|wav|ogg|woff|woff2|ttf|otf|mp4|webm)',
        headers: [{ key: 'Cache-Control', value: oneYearImmutable }],
      },
      {
        source: '/brand/:path*',
        headers: [{ key: 'Cache-Control', value: oneYearImmutable }],
      },
      {
        source: '/nft/:path*',
        headers: [{ key: 'Cache-Control', value: oneYearImmutable }],
      },
    ];
  },
};

export default nextConfig;
