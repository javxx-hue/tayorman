import React from 'react';

// The big gradient card with a readiness percentage (home page and subject page)
export const ReadinessHero: React.FC<{ value: number; caption: string; footer?: React.ReactNode }> = ({ value, caption, footer }) => (
  <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.7)]" style={{ backgroundImage: 'var(--gradient-hero)' }}>
    <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" aria-hidden />
    <div className="relative">
      <div className="text-5xl font-extrabold leading-none">
        {value}
        <span className="text-2xl align-top">%</span>
      </div>
      <div className="text-sm text-white/85 mt-2">{caption}</div>
      <div className="h-2 mt-4 rounded-full bg-white/25 overflow-hidden">
        <div className="h-full rounded-full bg-white" style={{ width: `${value}%` }} />
      </div>
      {footer && <div className="text-xs text-white/85 mt-3">{footer}</div>}
    </div>
  </div>
);

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-orange-500/20 text-orange-300',
  'bg-violet-500/20 text-violet-300',
  'bg-rose-500/20 text-rose-300',
];

// A subject's first letter on a coloured square; the colour follows the subject's place in the list
export const SubjectAvatar: React.FC<{ name: string; index: number }> = ({ name, index }) => (
  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-extrabold shrink-0 ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
    {name.trim().slice(0, 1).toUpperCase()}
  </span>
);
