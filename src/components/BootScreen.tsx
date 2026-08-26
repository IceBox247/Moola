'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export function BootScreen({ label = 'Warming up the rig…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-8">
      <div className="relative">
        <motion.div
          className="absolute -inset-6 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,217,75,0.35), transparent 65%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="relative h-36 w-36"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Image src="/brand/logo.png" alt="Moola" fill sizes="144px" className="object-contain drop-shadow-[0_0_24px_rgba(15,217,75,0.6)]" priority />
        </motion.div>
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-moo-400 to-moo-600"
          animate={{ x: ['-120%', '320%'] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="text-sm text-white/50">{label}</p>
    </div>
  );
}
