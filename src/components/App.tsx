'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { ErrorBoundary } from './ErrorBoundary';
import { unlockAudio, startMiningLoop, stopMiningLoop, playSfx } from '@/lib/audio';
import { BootScreen } from './BootScreen';
import { Onboarding } from './Onboarding';
import { BottomNav, type Tab } from './BottomNav';
import { Toasts } from './ui';
import { MineScreen } from '@/screens/Mine';
import { TasksScreen } from '@/screens/Tasks';
import { NftScreen } from '@/screens/Nfts';
import { FriendsScreen } from '@/screens/Friends';
import { ProfileScreen } from '@/screens/Profile';

export function App() {
  const { user, loading, error } = useStore();
  const [tab, setTab] = useState<Tab>('mine');

  // Unlock the audio engine on the first interaction (autoplay policy).
  useEffect(() => {
    const onGesture = () => unlockAudio();
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  // Mining ambient loop reflects the real mining-session state.
  const miningActive = user?.mining.active ?? false;
  useEffect(() => {
    if (miningActive) startMiningLoop();
    else stopMiningLoop();
    return () => stopMiningLoop();
  }, [miningActive]);

  // Level-up chime on a confirmed level increase.
  const level = user?.level ?? 0;
  const prevLevel = useRef(0);
  useEffect(() => {
    if (level > prevLevel.current && prevLevel.current > 0) playSfx('level_up');
    prevLevel.current = level;
  }, [level]);

  if (loading) return <BootScreen />;

  if (error && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">🐮</div>
        <p className="text-white/70">Couldn&apos;t connect to the herd.</p>
        <p className="text-xs text-white/40">{error}</p>
      </div>
    );
  }

  if (!user) return <BootScreen label="Fetching your miner…" />;

  if (!user.onboarded) return <Onboarding />;

  return (
    <>
      <Toasts />
      <main className="safe-bottom min-h-screen px-4 pt-4">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <ErrorBoundary key={tab}>
            {tab === 'mine' && <MineScreen />}
            {tab === 'tasks' && <TasksScreen />}
            {tab === 'nfts' && <NftScreen />}
            {tab === 'friends' && <FriendsScreen />}
            {tab === 'profile' && <ProfileScreen goMine={() => setTab('mine')} />}
          </ErrorBoundary>
        </motion.div>
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
