import { NextResponse } from 'next/server';
import { moolaMarketStats } from '@/lib/stonfi';
import { countUsers } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Public MOOLA market stats (price + market cap) plus total user count. Nothing
 * here is per-user, so the response is cached at Vercel's edge — repeated polls
 * are served from the CDN and never hit the function or Neon. GET is the cached
 * path; POST stays for older clients (uncached).
 */
async function payload() {
  const [stats, totalUsers] = await Promise.all([
    moolaMarketStats().catch(() => ({ moolaPriceUsd: 0, marketCapUsd: 0, tonUsd: 0 })),
    countUsers().catch(() => 0),
  ]);
  return { ...stats, totalUsers };
}

export async function GET() {
  const data = await payload();
  return NextResponse.json(data, {
    headers: {
      // Serve from the CDN for 5 min; keep serving the stale value for another
      // 10 min while it refreshes in the background. Market cap barely moves, so
      // the vast majority of polls are served from the edge cache and never
      // reach the function or the database.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export async function POST() {
  return NextResponse.json(await payload());
}
