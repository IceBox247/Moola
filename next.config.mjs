/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
