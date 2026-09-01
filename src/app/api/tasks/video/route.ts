import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { submitVideoTask } from '@/lib/db';
import { sendVideoSubmission } from '@/lib/telegramBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Submit a link to a Moola promo video for the limited-slot bounty. Stores the
 * submission as 'pending' and pings the owner over Telegram to review it — the
 * reward is only credited when the owner approves.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '').trim();

  // Basic sanity check — must look like a real link.
  if (!/^https?:\/\/[^\s]{6,}$/i.test(url) || url.length > 500) {
    return badRequest('Enter a valid video link (starting with https://)');
  }

  const res = await submitVideoTask(ctx.user.id, url);
  if (!res.ok) return badRequest(res.reason ?? 'Could not submit');

  // Best effort — never fail the request if the owner ping doesn't send.
  await sendVideoSubmission(ctx.user.id, ctx.user.first_name, ctx.user.username, url).catch(() => {});

  return userResponse(ctx.user.id, { submitted: true });
}
