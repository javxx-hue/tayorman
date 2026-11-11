import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { questionScore, PASS_SCORE } from '../lib/prep';

interface TicketsPageProps {
  subjects: Subject[];
  lang: Language;
}

// How far a question is: never answered, started, half way, or ready
export type TicketState = 'new' | 'started' | 'half' | 'ready';
export function ticketState(attempts: number, score: number): TicketState {
  if (attempts === 0) return 'new';
  if (score >= PASS_SCORE) return 'ready';
  return score >= 50 ? 'half' : 'started';
}

const STYLE: Record<TicketState, string> = {
  new: 'bg-secondary text-foreground border-border',
  started: 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/40',
  half: 'bg-blue-500/20 text-blue-900 dark:text-blue-200 border-blue-500/40',
  ready: 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border-emerald-500/50',
};
const DOT: Record<TicketState, string> = { new: 'bg-secondary border border-border', started: 'bg-amber-500', half: 'bg-blue-500', ready: 'bg-emerald-500' };

// Every exam question as a numbered ticket, coloured by how ready it is; opening one goes on through the rest
export const TicketsPage: React.FC<TicketsPageProps> = ({ subjects, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const subject = subjects.find((s) => s.id === id);
  const [search, setSearch] = useState('');
  if (!subject) return null;

  const ids = subject.questions.map((q) => q.id);
  const open = (i: number) => navigate(`/subjects/${subject.id}/q/${ids[i]}`, { state: { queue: ids.slice(i), tickets: true } });
  const wanted = Number(search);
  const shown = subject.questions.map((q, i) => ({ q, i })).filter(({ i }) => !search || String(i + 1).startsWith(search.trim()));
  const legend: { key: TicketState; label: string }[] = [
    { key: 'new', label: tr(lang, 'boshlanmagan', 'не начат') },
    { key: 'started', label: tr(lang, 'boshlangan', 'начат') },
    { key: 'half', label: '50%+' },
    { key: 'ready', label: tr(lang, 'tayyor', 'готов') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-4">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {subject.name}
      </button>
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">{tr(lang, 'Biletlar', 'Билеты')}</h1>
        <p className="text-sm text-muted-foreground">{tr(lang, 'Rang tayyorlik darajasini bildiradi.', 'Цвет показывает готовность.')}</p>
      </div>

      <input
        inputMode="numeric"
        value={search}
        onChange={(e) => setSearch(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && wanted >= 1 && wanted <= ids.length && open(wanted - 1)}
        placeholder={tr(lang, 'Bilet raqami (masalan: 17)', 'Номер билета (например: 17)')}
        className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm"
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${DOT[l.key]}`} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
        {shown.map(({ q, i }) => (
          <button
            key={q.id}
            onClick={() => open(i)}
            className={`aspect-square rounded-xl border text-sm font-semibold flex items-center justify-center ${STYLE[ticketState(q.attempts.length, questionScore(q))]}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">{tr(lang, "Bunday raqamli bilet yo'q.", 'Билета с таким номером нет.')}</p>}
    </div>
  );
};
