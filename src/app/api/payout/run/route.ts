import { NextRequest } from 'next/server';
import { json } from '@/lib/api';
import { runPayouts } from '@/lib/payoutWorker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Payout sweep — processes queued withdrawals. Triggered by Vercel Cron (which
 * sends `Authorization: Bearer <CRON_SECRET>`), or manually with the same
 * header. Acts as a retry/safety net alongside the inline payout done at
 * request time.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401);
  }
  const result = await runPayouts(20);
  return json(result);
}

export const GET = handle;
export const POST = handle;
