'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { enableAudio, startAmbience, stopAmbience } from '@/lib/sound';
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

  // Unlock audio on the first interaction (autoplay policy).
  useEffect(() => {
    const onGesture = () => enableAudio();
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  // Mining-rig ambience: play while a session is active and sound is on.
  const miningActive = user?.mining.active ?? false;
  const soundOn = user?.soundFx ?? false;
  useEffect(() => {
    if (miningActive && soundOn) startAmbience();
    else stopAmbience();
    return () => stopAmbience();
  }, [miningActive, soundOn]);

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
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'mine' && <MineScreen />}
            {tab === 'tasks' && <TasksScreen />}
            {tab === 'nfts' && <NftScreen />}
            {tab === 'friends' && <FriendsScreen />}
            {tab === 'profile' && <ProfileScreen goMine={() => setTab('mine')} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
