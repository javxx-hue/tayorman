import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bars, Card, Stat, shortDay } from '../ui';

interface Dashboard {
  dau: { day: string; users: number }[];
  new_users: { day: string; n: number }[];
  ai_per_day: { day: string; n: number }[];
  funnel: { registered: number; opened_app: number; got_content: number; first_answer: number };
  open_suggestions: number;
  open_reports: number;
}
interface Totals {
  users_total: number;
  users_samdu: number;
  users_new_7d: number;
  active_today: number;
  active_7d: number;
  ai_today: number;
  by_university: Record<string, number>;
}
interface HardQuestion {
  subject: string;
  question: string;
  attempts: number;
  avg_score: number;
}

const FUNNEL: [keyof Dashboard['funnel'], string][] = [
  ['registered', 'Ro\'yxatdan o\'tdi'],
  ['opened_app', 'Ilovani ochdi'],
  ['got_content', 'Fan yoki test oldi'],
  ['first_answer', 'Birinchi javobni berdi'],
];

export const DashboardPage: React.FC = () => {
  const [d, setD] = useState<Dashboard | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [hard, setHard] = useState<HardQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([supabase.rpc('admin_dashboard', { p_days: 14 }), supabase.rpc('admin_stats'), supabase.rpc('admin_hard_questions', { p_limit: 10 })]).then(
      ([dash, stats, hq]) => {
        if (dash.error || stats.error) return setError('Ma\'lumotni yuklab bo\'lmadi. Bazaga 0002 migratsiyasi qo\'llanganini tekshiring.');
        setD(dash.data as Dashboard);
        setTotals(stats.data as Totals);
        setHard((hq.data ?? []) as HardQuestion[]);
      }
    );
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!d || !totals) return <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>;

  const top = Math.max(d.funnel.opened_app, d.funnel.registered, 1);
  const pct = (n: number) => `${Math.round((n / top) * 100)}%`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Foydalanuvchilar" value={totals.users_total} hint={`SamDU: ${totals.users_samdu}`} />
        <Stat label="Bugun faol" value={totals.active_today} hint={`7 kunda: ${totals.active_7d}`} />
        <Stat label="7 kunda yangi" value={totals.users_new_7d} />
        <Stat label="AI so'rovlar bugun" value={totals.ai_today} />
        <Stat label="Yangi takliflar" value={d.open_suggestions} tone={d.open_suggestions > 0 ? 'warn' : 'default'} />
        <Stat label="Ochiq xato xabarlari" value={d.open_reports} tone={d.open_reports > 0 ? 'warn' : 'default'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Kunlik faol foydalanuvchilar (14 kun)">
          <Bars data={d.dau.map((x) => ({ label: shortDay(x.day), value: x.users }))} empty="Faollik ma'lumoti yig'ilmoqda: foydalanuvchilar ilovani ochgach paydo bo'ladi" />
        </Card>
        <Card title="Yangi foydalanuvchilar (14 kun)">
          <Bars data={d.new_users.map((x) => ({ label: shortDay(x.day), value: x.n }))} />
        </Card>
        <Card title="Qayerda to'xtashadi? (14 kun)">
          <ol className="space-y-2">
            {FUNNEL.map(([key, label]) => (
              <li key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{d.funnel[key]} · {pct(d.funnel[key])}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary/80" style={{ width: pct(d.funnel[key]) }} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="AI so'rovlar (14 kun)">
          <Bars data={d.ai_per_day.map((x) => ({ label: shortDay(x.day), value: Number(x.n) }))} />
        </Card>
      </div>

      <Card title="Eng ko'p xato qilinadigan savollar">
        {hard.length === 0 ? (
          <p className="text-xs text-muted-foreground">Hali ma'lumot yo'q: kamida 3 ta baholangan urinish kerak.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Fan</th>
                  <th className="py-1 pr-3 font-medium">Savol</th>
                  <th className="py-1 pr-3 font-medium text-right">Urinish</th>
                  <th className="py-1 font-medium text-right">O'rtacha ball</th>
                </tr>
              </thead>
              <tbody>
                {hard.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{h.subject}</td>
                    <td className="py-1.5 pr-3">{h.question}</td>
                    <td className="py-1.5 pr-3 text-right">{h.attempts}</td>
                    <td className="py-1.5 text-right font-semibold">{h.avg_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
