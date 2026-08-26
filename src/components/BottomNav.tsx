'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { selection, haptic } from '@/lib/telegram';
import { IconMine, IconTasks, IconFriends, IconProfile } from './icons';

export type Tab = 'mine' | 'tasks' | 'nfts' | 'friends' | 'profile';

const side: { id: Tab; label: string; Icon: typeof IconMine }[] = [
  { id: 'mine', label: 'Mine', Icon: IconMine },
  { id: 'tasks', label: 'Tasks', Icon: IconTasks },
  { id: 'friends', label: 'Friends', Icon: IconFriends },
  { id: 'profile', label: 'Profile', Icon: IconProfile },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const go = (t: Tab) => {
    selection();
    if (t === 'nfts') haptic('light');
    onChange(t);
  };

  const left = side.slice(0, 2);
  const right = side.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="relative flex items-stretch justify-between rounded-[28px] border border-white/10 bg-ink-850/80 px-2 py-2 shadow-[0_-2px_30px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        {/* soft top highlight */}
        <div className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        {left.map((it) => (
          <NavItem key={it.id} {...it} active={tab === it.id} onClick={() => go(it.id)} />
        ))}

        {/* Center — the Moola cow */}
        <button onClick={() => go('nfts')} className="relative -mt-9 flex w-[70px] flex-col items-center" aria-label="NFTs">
          <span
            className={`pointer-events-none absolute top-1 h-16 w-16 rounded-full blur-md transition-opacity ${
              tab === 'nfts' ? 'opacity-90' : 'opacity-50'
            }`}
            style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.65), transparent 70%)' }}
          />
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={tab === 'nfts' ? { y: [0, -3, 0] } : {}}
            transition={{ duration: 2.4, repeat: Infinity }}
            className={`relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 bg-ink-900 ${
              tab === 'nfts' ? 'border-moo-300 shadow-neon-lg' : 'border-moo-500/50 shadow-neon'
            }`}
          >
            <Image src="/brand/logo.png" alt="Moola" width={46} height={46} className="drop-shadow-[0_0_6px_rgba(15,217,75,0.6)]" />
          </motion.div>
          <span className={`mt-1 text-[10px] font-bold ${tab === 'nfts' ? 'text-moo-300' : 'text-white/45'}`}>NFTs</span>
        </button>

        {right.map((it) => (
          <NavItem key={it.id} {...it} active={tab === it.id} onClick={() => go(it.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: typeof IconMine;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2" aria-label={label}>
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-x-2 inset-y-0.5 -z-10 rounded-2xl bg-moo-500/[0.12]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon
        active={active}
        className={`h-6 w-6 ${active ? 'text-moo-300 drop-shadow-[0_0_6px_rgba(15,217,75,0.55)]' : 'text-white/45'}`}
      />
      <span className={`text-[10px] font-semibold ${active ? 'text-moo-300' : 'text-white/45'}`}>{label}</span>
    </button>
  );
}
