import { json } from '@/lib/api';
import { moolaMarketStats } from '@/lib/stonfi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public MOOLA market stats (price + market cap). Cached server-side. */
export async function POST() {
  try {
    const stats = await moolaMarketStats();
    return json(stats);
  } catch {
    return json({ moolaPriceUsd: 0, marketCapUsd: 0, tonUsd: 0 });
  }
}
