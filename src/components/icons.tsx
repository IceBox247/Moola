'use client';

/** Crisp inline stroke icons — slicker than emoji, theme-friendly. */

type P = { className?: string; active?: boolean };
const base = 'transition-all duration-200';

export function IconMine({ className = '', active }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3c2.5.6 5.4 3.5 6 6" />
      <path d="M12.5 5.5 5 13l3 3 7.5-7.5" />
      <path d="m9.5 12.5 2 2" />
      <path d="M7 15 3 20l1 1 5-4" />
    </svg>
  );
}

export function IconTasks({ className = '', active }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="m8.5 9 1.6 1.6L13.5 7" />
      <path d="M8.5 15h7" />
    </svg>
  );
}

export function IconFriends({ className = '', active }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  );
}

export function IconProfile({ className = '', active }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}
