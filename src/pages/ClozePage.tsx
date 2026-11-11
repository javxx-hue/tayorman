import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { practiceOrder } from '../lib/prep';
import { clozeScore, makeCloze, sameAnswer } from '../lib/cloze';
import { saveAttempt } from '../lib/attempts';

interface ClozePageProps {
  subjects: Subject[];
  lang: Language;
}

export const CLOZE_SITTING = 5;

// Fill in the blanks: a few key terms of the model answer are hidden and typed back. No AI involved.
export const ClozePage: React.FC<ClozePageProps> = ({ subjects, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const subject = subjects.find((s) => s.id === id);
  const items = useMemo(
    () =>
      (subject ? practiceOrder(subject) : [])
        .map((q) => ({ q, cloze: q.modelAnswer ? makeCloze(q.modelAnswer.summary, q.modelAnswer.keyPoints) : null }))
        .filter((x): x is { q: typeof x.q; cloze: NonNullable<typeof x.cloze> } => x.cloze !== null)
        .slice(0, CLOZE_SITTING),
    [subject?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [total, setTotal] = useState({ right: 0, blanks: 0 });
  if (!subject) return null;

  const back = () => navigate(`/subjects/${subject.id}`);
  const item = items[index];

  if (!item) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Mashq tugadi', 'Готово')}</h2>
        <p className="text-sm text-muted-foreground">{tr(lang, `To'g'ri: ${total.right} / ${total.blanks}`, `Верно: ${total.right} / ${total.blanks}`)}</p>
        <Button variant="primary" onClick={back}>{tr(lang, 'Fanga qaytish', 'К предмету')}</Button>
      </div>
    );
  }

  const { q, cloze } = item;
  const right = cloze.answers.map((a, i) => sameAnswer(typed[i] ?? '', a));
  const check = () => {
    const n = right.filter(Boolean).length;
    saveAttempt(subject.id, q.id, { at: Date.now(), answer: typed.join(' | '), score: clozeScore(n, cloze.answers.length), feedback: '', missing: [], mode: 'cloze' });
    setTotal((t) => ({ right: t.right + n, blanks: t.blanks + cloze.answers.length }));
    setChecked(true);
  };
  const next = () => {
    setIndex((i) => i + 1);
    setTyped([]);
    setChecked(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={back} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {subject.name}
        </button>
        <span className="text-xs text-muted-foreground">{index + 1} / {items.length}</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <span className="text-xs font-semibold text-primary">{tr(lang, `${cloze.answers.length} ta atama`, `Терминов: ${cloze.answers.length}`)}</span>
        <h1 className="text-base font-serif font-bold text-foreground leading-snug">{q.text}</h1>
        <p className="text-sm text-foreground leading-loose border-t border-border pt-4">
          {cloze.parts.map((p, i) =>
            typeof p === 'string' ? (
              <span key={i}>{p}</span>
            ) : checked ? (
              <span key={i} className={`px-1.5 py-0.5 rounded-md font-semibold ${right[p.blank] ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-800 dark:text-rose-300'}`}>
                {right[p.blank] ? cloze.answers[p.blank] : `${typed[p.blank] || '—'} → ${cloze.answers[p.blank]}`}
              </span>
            ) : (
              <input
                key={i}
                value={typed[p.blank] ?? ''}
                onChange={(e) => setTyped((t) => Object.assign([...t], { [p.blank]: e.target.value }))}
                aria-label={tr(lang, `${p.blank + 1}-bo'sh joy`, `Пропуск ${p.blank + 1}`)}
                className="mx-1 w-28 px-2 py-0.5 rounded-md border border-primary/50 bg-background text-sm"
                autoCapitalize="none"
                autoCorrect="off"
              />
            )
          )}
        </p>
      </div>

      {!checked ? (
        <Button variant="primary" size="lg" className="w-full" icon={<Check size={16} />} disabled={!typed.some((t) => t?.trim())} onClick={check}>
          {tr(lang, 'Tekshirish', 'Проверить')}
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={next}>
          {index + 1 < items.length ? tr(lang, 'Keyingisi', 'Дальше') : tr(lang, 'Yakunlash', 'Завершить')}
        </Button>
      )}
    </div>
  );
};
