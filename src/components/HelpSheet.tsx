'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { haptic } from '@/lib/telegram';
import { supportLink } from '@/lib/links';

type QA = { q: string; a: string };

/**
 * Self-service Help / FAQ. Answers the handful of questions that drive almost
 * all support volume (withdrawals, holdings, mining speed) so most users never
 * need a human. A single gated "Contact Support" link sits at the bottom.
 */
const FAQ: QA[] = [
  {
    q: 'Why is my withdrawal “pending”?',
    a: 'Every withdrawal is sent on the TON blockchain by our payout desk. “Pending → Sending → Paid” is the normal flow and can take a few minutes (sometimes longer when the network is busy). Your MOOLA is already deducted and queued — it is not lost. If a payout ever fails on-chain, it is automatically refunded back to your in-app balance, and you can try again.',
  },
  {
    q: 'My withdrawal failed / was refunded. What now?',
    a: 'A failed withdrawal means the on-chain transfer did not go through, so we refunded the full amount to your balance automatically — nothing was taken. Just request it again. Make sure your TON wallet address is correct and that you are a member of our official Telegram channel (required to withdraw).',
  },
  {
    q: 'I hold MOOLA/ATF in my wallet but it shows 0 (or mining is slow).',
    a: 'Your “Wallet Holding” is read live from the blockchain. If it briefly shows 0, the network read was rate-limited — pull to refresh or reopen the app in a minute and it will populate. Your ATF holding boost applies automatically once the holding is read. Mining speed also depends on your level and NFT boost, so level up and equip an NFT for more speed.',
  },
  {
    q: 'I bought MOOLA — where is it?',
    a: 'MOOLA you buy or hold on-chain shows under “Wallet Holding”, which is separate from your in-app “Pool (Spendable)” balance that you mine and withdraw. Holdings power your ATF boost and liquidity rewards; the spendable pool is what you withdraw. They are two different numbers on purpose.',
  },
  {
    q: 'Why do I need to join the Telegram channel?',
    a: 'Mining, tasks and withdrawals require membership of our official channel. It keeps the community real (one person = one account) and is where all announcements and payout updates are posted. Join, then tap the action again.',
  },
  {
    q: 'What is the withdrawal fee and free limit?',
    a: 'Your first withdrawal each 24 hours is free. If you withdraw again within the same 24h window, a small on-chain fee (about $0.10 in TON) goes to the treasury — this covers gas and discourages spam/multi-account abuse. Wait for the free window to reset to withdraw free again.',
  },
  {
    q: 'Why is my first withdrawal held or higher?',
    a: 'To keep payouts fair and block multi-account farming, your very first withdrawal has a higher minimum and unlocks 24 hours after you join. After that first one, normal minimums apply.',
  },
  {
    q: 'Verification — why and how?',
    a: 'Large withdrawals require a quick verification (a short video + photo) to confirm you are a real, single user. Submit it from the Profile tab; it is reviewed manually and you will get a bot message when it is approved.',
  },
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const sLink = supportLink(user?.id);

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
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b0f0c] p-5 pb-8"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-1 text-lg font-black">🐮 Help &amp; Support</div>
            <p className="mb-4 text-[12px] text-white/45">
              Most answers are right here. Tap a question to expand.
            </p>

            <div className="space-y-2">
              {FAQ.map((item, i) => {
                const isOpen = openIdx === i;
                return (
                  <div key={i} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                    <button
                      onClick={() => {
                        haptic('light');
                        setOpenIdx(isOpen ? null : i);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-white/90">{item.q}</span>
                      <span className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="px-4 pb-3 text-[12.5px] leading-relaxed text-white/55">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {sLink ? (
              <a
                href={sLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic('medium')}
                className="btn-primary mt-5 flex w-full items-center justify-center py-3.5"
              >
                💬 Still need help? Contact Support
              </a>
            ) : (
              <p className="mt-5 text-center text-[11px] text-white/35">
                For anything else, reach us in the official Telegram channel.
              </p>
            )}

            <button onClick={onClose} className="btn-ghost mt-3 w-full py-3 text-sm">
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
