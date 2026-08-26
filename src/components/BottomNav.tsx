'use client';

import { motion } from 'framer-motion';
import { selection } from '@/lib/telegram';

export type Tab = 'mine' | 'tasks' | 'nfts' | 'friends' | 'profile';

const items: { id: Tab; label: string; icon: string }[] = [
  { id: 'mine', label: 'Mine', icon: '⛏️' },
  { id: 'tasks', label: 'Tasks', icon: '📝' },
  { id: 'nfts', label: 'NFTs', icon: '🐮' },
  { id: 'friends', label: 'Friends', icon: '👥' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="mx-3 mb-3 flex items-end justify-around rounded-[26px] border border-white/10 bg-ink-850/90 px-2 py-2 shadow-card backdrop-blur-xl">
        {items.map((it) => {
          const active = tab === it.id;
          const center = it.id === 'nfts';
          if (center) {
            return (
              <button
                key={it.id}
                onClick={() => {
                  selection();
                  onChange(it.id);
                }}
                className="relative -mt-7 flex flex-col items-center"
                aria-label={it.label}
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl transition-all ${
                    active
                      ? 'border-moo-300 bg-gradient-to-b from-moo-400 to-moo-600 shadow-neon-lg'
                      : 'border-moo-500/50 bg-ink-800 shadow-neon'
                  }`}
                >
                  {it.icon}
                </div>
                <span className={`mt-1 text-[11px] font-semibold ${active ? 'text-moo-300' : 'text-white/50'}`}>
                  {it.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={it.id}
              onClick={() => {
                selection();
                onChange(it.id);
              }}
              className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
              aria-label={it.label}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : 'opacity-60'}`}>{it.icon}</span>
              <span className={`text-[11px] font-semibold ${active ? 'text-moo-300' : 'text-white/45'}`}>
                {it.label}
              </span>
              {active && (
                <motion.span
                  layoutId="nav-dot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-moo-400 shadow-neon"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
