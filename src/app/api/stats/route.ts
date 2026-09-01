import { json } from '@/lib/api';
import { moolaMarketStats } from '@/lib/stonfi';
import { countUsers } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public MOOLA market stats (price + market cap) plus total user count. */
export async function POST() {
  const [stats, totalUsers] = await Promise.all([
    moolaMarketStats().catch(() => ({ moolaPriceUsd: 0, marketCapUsd: 0, tonUsd: 0 })),
    countUsers().catch(() => 0),
  ]);
  return json({ ...stats, totalUsers });
}
