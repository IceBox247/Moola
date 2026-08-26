import { NextRequest } from 'next/server';
import { authed, unauthorized, json } from '@/lib/api';
import { listHistory } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();
  const items = await listHistory(ctx.user.id, 50);
  return json({ items });
}
