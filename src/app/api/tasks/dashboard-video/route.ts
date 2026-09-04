import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse, channelBlock, json } from '@/lib/api';
import { submitDashboardVideo } from '@/lib/db';
import { sendDashboardVideo } from '@/lib/telegramBot';
import { game } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 45 * 1024 * 1024; // Telegram bot upload limit ~50MB

/**
 * Submit a dashboard-bounty video (a short clip holding the phone showing the
 * Moola dashboard). The video is forwarded to the admin bot for approve/reject;
 * the reward is credited only on approval.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  // Must be a channel member to earn.
  const gate = await channelBlock(ctx.user.id);
  if (gate) return gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('expected multipart form data');
  }
  const video = form.get('video');
  const vBlob = video instanceof Blob ? video : null;
  if (!vBlob) return badRequest('attach your video');
  if (vBlob.size > MAX_BYTES) return badRequest('file too large — keep the video short (≈15s)');

  // Reserve the slot / enforce the daily reject cap before forwarding.
  const res = await submitDashboardVideo(ctx.user.id);
  if (!res.ok) return json({ error: res.reason, status: res.status });

  const forwarded = await sendDashboardVideo(
    vBlob,
    ctx.user.id,
    ctx.user.first_name,
    ctx.user.username,
    game.dashboardVideo.reward
  );

  return userResponse(ctx.user.id, { submitted: true, forwarded });
}
