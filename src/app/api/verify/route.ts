import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql } from '@/lib/db';
import { sendVerification } from '@/lib/telegramBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // Telegram bot upload limit is ~50MB; keep well under

/** Submit identity verification (8s video + photo) for review. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('expected multipart form data');
  }

  const video = form.get('video');
  const photo = form.get('photo');
  const vBlob = video instanceof Blob ? video : null;
  const pBlob = photo instanceof Blob ? photo : null;
  if (!vBlob && !pBlob) return badRequest('attach a video and a photo');
  if ((vBlob && vBlob.size > MAX_BYTES) || (pBlob && pBlob.size > MAX_BYTES)) {
    return badRequest('file too large — keep the video short (≈8s)');
  }

  await sql`UPDATE users SET verify_status = 'pending' WHERE id = ${ctx.user.id};`;

  const caption =
    `🔎 <b>Moola Verification</b>\n` +
    `Name: ${ctx.user.first_name}\n` +
    `Telegram ID: <code>${ctx.user.id}</code>\n` +
    (ctx.user.username ? `Username: @${ctx.user.username}\n` : '') +
    `Review the video/photo, then tap Approve or Reject.`;

  const forwarded = await sendVerification(vBlob, pBlob, caption, ctx.user.id);

  return userResponse(ctx.user.id, { submitted: true, forwarded });
}
