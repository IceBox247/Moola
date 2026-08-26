'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { getInitData } from '@/lib/telegram';
import { haptic } from '@/lib/telegram';
import { playSfx } from '@/lib/audio';
import { fmtCompact } from '@/lib/format';
import type { PublicUser } from '@/lib/types';

export function VerifyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser, toast } = useStore();
  const u = user!;
  const [video, setVideo] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const pending = u.verifyStatus === 'pending';

  async function submit() {
    if (!video || !photo) return toast('Add both the video and the photo', 'bad');
    setBusy(true);
    haptic('heavy');
    try {
      const form = new FormData();
      form.set('video', video);
      form.set('photo', photo);
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'x-init-data': getInitData() },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
      if (data.user) setUser(data.user as PublicUser);
      playSfx('signature');
      toast('✅ Submitted — under review!', 'good');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[28px] border border-gold-400/20 bg-ink-850"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 p-5 pb-2 text-center">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <h3 className="text-xl font-black">🔒 Verify Your Account</h3>
              <p className="text-sm text-white/50">
                Withdrawals over <span className="gold-text font-bold">{fmtCompact(u.verifyThreshold)} MOOLA</span> need a
                one-time verification.
              </p>
            </div>

            <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-28">
              {pending ? (
                <div className="card p-5 text-center">
                  <div className="text-4xl">⏳</div>
                  <div className="mt-2 font-black">Under review</div>
                  <p className="mt-1 text-sm text-white/50">
                    We&apos;ve received your verification. You&apos;ll get a Telegram message once it&apos;s approved.
                  </p>
                </div>
              ) : (
                <>
                  {/* what to write */}
                  <div className="card-neon p-4 text-sm">
                    <div className="mb-2 font-bold">On a sheet of paper, write:</div>
                    <ul className="space-y-1 text-white/75">
                      <li>• <b>Telegram ID:</b> <code className="gold-text">{u.id}</code></li>
                      <li>• Today&apos;s date</li>
                      <li>• <b>MOOLA</b> in large letters</li>
                      <li>• Your signature</li>
                    </ul>
                  </div>

                  {/* steps */}
                  <div className="card space-y-2 p-4 text-sm text-white/75">
                    <Step n={1} t="Record an ~8 sec video: look at the camera and say out loud “I am not a robot”." />
                    <Step n={2} t="In the video, clearly show the paper, your signature and the date." />
                    <Step n={3} t="Then take one clear photo of the same paper." />
                    <Step n={4} t="Submit — an admin reviews it and you’re verified for good." />
                  </div>

                  {/* captures */}
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => videoRef.current?.click()}
                    className={`w-full py-3.5 ${video ? 'btn-ghost' : 'btn-primary'}`}
                  >
                    {video ? '✓ Video attached — retake' : '🎥 Record verification video'}
                  </button>
                  <button
                    onClick={() => photoRef.current?.click()}
                    className={`w-full py-3.5 ${photo ? 'btn-ghost' : 'btn-primary'}`}
                  >
                    {photo ? '✓ Photo attached — retake' : '📸 Take photo of the paper'}
                  </button>

                  <p className="px-1 text-center text-[11px] text-white/35">
                    Keep the video short (≈8s) and well-lit. Your media is sent only to the review desk.
                  </p>
                </>
              )}
            </div>

            {!pending && (
              <div className="shrink-0 border-t border-white/8 bg-ink-850 p-4">
                <button onClick={submit} disabled={busy || !video || !photo} className="btn-gold w-full py-3.5 disabled:opacity-50">
                  {busy ? 'Uploading…' : 'Submit for verification'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step({ n, t }: { n: number; t: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-moo-500/20 text-[11px] font-black text-moo-300">
        {n}
      </span>
      <span>{t}</span>
    </div>
  );
}
