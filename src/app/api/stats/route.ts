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
      // Serve from the CDN for 60s; keep serving the stale value for another
      // 5 min while it refreshes in the background. Most polls never reach the
      // function or the database.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

export async function POST() {
  return NextResponse.json(await payload());
}
