import { NextRequest } from 'next/server';
import { listVideoSubmissions, approveVideoTask, rejectVideoTask } from '@/lib/db';
import { sendBotMessage } from '@/lib/telegramBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Simple owner-only admin page for the video bounty. Open in a browser:
 *   /api/admin/videos?key=<ADMIN_SECRET or CRON_SECRET>
 * Lists every submission and lets you approve (pays 2500) or reject, without
 * needing the Telegram buttons. Guarded by a shared secret in the URL.
 */

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function page(body: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moola · Video submissions</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0b0f0c;color:#e8f5e9;margin:0;padding:16px}
  h1{font-size:18px;margin:0 0 4px} .sub{color:#7a8a7e;font-size:12px;margin-bottom:16px}
  .notice{background:#123018;border:1px solid #1f6b34;padding:8px 12px;border-radius:8px;margin-bottom:14px;font-size:13px}
  .card{background:#111814;border:1px solid #1e2a22;border-radius:12px;padding:12px;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
  .who{font-weight:700} .meta{color:#7a8a7e;font-size:12px}
  a.link{color:#4ade80;word-break:break-all;font-size:13px}
  .pill{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .pending{background:#3a2f00;color:#ffd54f} .approved{background:#123018;color:#4ade80} .rejected{background:#3a1414;color:#ff8a8a}
  .btns{margin-top:8px;display:flex;gap:8px}
  .btn{display:inline-block;padding:7px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none}
  .approve{background:#16a34a;color:#fff} .reject{background:#3a1414;color:#ff8a8a;border:1px solid #5a2020}
</style></head><body>${body}</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET || '';
  if (!secret || key !== secret) return new Response('unauthorized', { status: 401 });

  let notice = '';
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');
  if (action && id) {
    if (action === 'approve') {
      const r = await approveVideoTask(id);
      notice = r.credited ? `✅ Approved ${id} — 2500 MOOLA paid.` : `⚠️ Approve ${id}: ${r.reason}`;
      if (r.credited) {
        await sendBotMessage(
          id,
          '🎬 Your Moola video was <b>approved</b>! <b>2500 MOOLA</b> has been added to your balance. 🐮'
        ).catch(() => {});
      }
    } else if (action === 'reject') {
      await rejectVideoTask(id);
      notice = `❌ Rejected ${id}.`;
      await sendBotMessage(
        id,
        '🎬 Your Moola video wasn’t approved this time. You can submit a new one from the Tasks tab.'
      ).catch(() => {});
    }
  }

  const subs = await listVideoSubmissions();
  const approved = subs.filter((s) => s.status === 'approved').length;
  const pending = subs.filter((s) => s.status === 'pending').length;

  const cards = subs
    .map((s) => {
      const who = s.username ? `@${s.username}` : s.name || s.userId;
      const when = new Date(s.createdAt).toISOString().slice(0, 16).replace('T', ' ');
      const actions =
        s.status === 'pending'
          ? `<div class="btns">
               <a class="btn approve" href="?key=${encodeURIComponent(key)}&action=approve&id=${encodeURIComponent(s.userId)}">Approve (+2500)</a>
               <a class="btn reject" href="?key=${encodeURIComponent(key)}&action=reject&id=${encodeURIComponent(s.userId)}">Reject</a>
             </div>`
          : '';
      return `<div class="card">
        <div class="row">
          <div><span class="who">${esc(who)}</span> <span class="meta">· ${esc(s.userId)} · ${when}</span></div>
          <span class="pill ${s.status}">${s.status.toUpperCase()}</span>
        </div>
        <div style="margin-top:6px"><a class="link" href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.url)}</a></div>
        ${actions}
      </div>`;
    })
    .join('');

  const body = `
    <h1>🎬 Moola video submissions</h1>
    <div class="sub">${subs.length} total · ${pending} pending · ${approved}/50 slots used</div>
    ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
    ${cards || '<div class="sub">No submissions yet.</div>'}`;
  return page(body);
}
