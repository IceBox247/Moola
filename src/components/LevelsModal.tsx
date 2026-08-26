'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { fmt, fmtCompact } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { openLink } from '@/lib/telegram';
import { stonfiBuyMoola } from '@/lib/links';
import { requiredMoola, baseDailyYield, hashrate as hashrateFor, MAX_LEVEL } from '@/lib/config';

export function LevelsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();
  const u = user!;

  const rows = useMemo(() => {
    const start = Math.max(1, u.level - 2);
    const end = Math.min(MAX_LEVEL, start + 14);
    const list = [];
    for (let n = start; n <= end; n++) {
      const req = requiredMoola(n);
      list.push({
        n,
        req,
        yield: baseDailyYield(n),
        ths: hashrateFor(n, 1),
        unlocked: u.held >= req,
        current: n === u.level,
        missing: Math.max(0, req - u.held),
      });
    }
    return list;
  }, [u.level, u.held]);

  function buy(missing: number) {
    haptic('heavy');
    openLink(stonfiBuyMoola(missing));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[28px] border border-white/10 bg-ink-850"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="shrink-0 p-5 pb-3 text-center">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
              <h3 className="text-xl font-black">Mining Levels</h3>
              <p className="text-sm text-white/50">Hold more MOOLA to level up &amp; mine faster</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniStat label="Level" value={`${u.level}`} />
                <MiniStat label="Holding" value={fmtCompact(u.held)} />
                <MiniStat label="Speed" value={`${u.hashrate} TH/s`} gold />
              </div>
              {u.toNextLevel > 0 && (
                <div className="mt-3 rounded-2xl border border-moo-500/30 bg-moo-500/[0.06] px-4 py-2 text-sm">
                  <span className="neon-text font-bold">{fmt(u.toNextLevel, 2)} MOOLA</span>
                  <span className="text-white/55"> to reach Lvl {u.level + 1}</span>
                </div>
              )}
            </div>

            {/* level list */}
            <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
              {rows.map((r) => (
                <div
                  key={r.n}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    r.current
                      ? 'border-moo-400/60 bg-moo-500/[0.08] shadow-neon'
                      : r.unlocked
                        ? 'border-white/8 bg-white/[0.03]'
                        : 'border-white/8 bg-black/20'
                  }`}
                >
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">Lvl</div>
                    <div className={`text-lg font-black ${r.current ? 'neon-text' : 'text-white'}`}>{r.n}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold gold-text">{fmtCompact(r.yield)} MOOLA/day</div>
                    <div className="text-[11px] text-white/45">
                      {r.ths} TH/s · needs {fmtCompact(r.req)} held
                    </div>
                  </div>
                  {r.current ? (
                    <span className="chip bg-moo-500 text-ink-900">Current</span>
                  ) : r.unlocked ? (
                    <span className="chip bg-white/10 text-white/60">✓ Unlocked</span>
                  ) : (
                    <button onClick={() => buy(r.missing)} className="btn-gold px-3 py-2 text-xs">
                      Buy {fmtCompact(r.missing)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MiniStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-2 py-2">
      <div className="label">{label}</div>
      <div className={`text-sm font-black ${gold ? 'gold-text' : 'text-white'}`}>{value}</div>
    </div>
  );
}
