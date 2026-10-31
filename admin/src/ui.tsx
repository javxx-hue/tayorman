import React from 'react';

export const Card: React.FC<{ title?: string; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, right, className = '', children }) => (
  <section className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-3 mb-3">
        {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
        {right}
      </div>
    )}
    {children}
  </section>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'warn' }> = ({ label, value, hint, tone = 'default' }) => (
  <div className={`rounded-2xl border p-4 ${tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'}`}>
    <div className="text-2xl font-bold text-foreground">{value}</div>
    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    {hint && <div className="text-[11px] text-muted-foreground/80 mt-1">{hint}</div>}
  </div>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'outline' | 'danger' }> = ({ tone = 'outline', className = '', ...props }) => {
  const tones = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    outline: 'border border-border bg-background hover:bg-secondary',
    danger: 'border border-rose-500/40 text-rose-600 hover:bg-rose-500/10',
  };
  return <button {...props} className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:pointer-events-none ${tones[tone]} ${className}`} />;
};

export const Pill: React.FC<{ tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }> = ({ tone = 'gray', children }) => {
  const tones = {
    gray: 'bg-secondary text-muted-foreground',
    green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    red: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};

export const Bars: React.FC<{ data: { label: string; value: number }[]; empty?: string }> = ({ data, empty = 'Ma\'lumot hali yo\'q' }) => {
  if (!data.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] text-muted-foreground">{d.value}</span>
          <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max((d.value / max) * 100, 3)}%` }} />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// "2026-10-31" -> "31.10"
export const shortDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '-';
  const min = Math.round((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daq oldin`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}
