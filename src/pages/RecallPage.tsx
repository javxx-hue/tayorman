import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { practiceOrder, SELF_SCORES } from '../lib/prep';
import { saveAttempt } from '../lib/attempts';

interface RecallPageProps {
  subjects: Subject[];
  lang: Language;
}

export const RECALL_SITTING = 20;

// Recall: the exam question, then the model answer on request, then the student's own verdict. No AI involved.
export const RecallPage: React.FC<RecallPageProps> = ({ subjects, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const subject = subjects.find((s) => s.id === id);
  // The sitting is fixed when it starts, so rating a card does not reshuffle what comes next
  const queue = useMemo(() => (subject ? practiceOrder(subject).filter((q) => q.modelAnswer).slice(0, RECALL_SITTING) : []), [subject?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [tally, setTally] = useState({ know: 0, partly: 0, not: 0 });
  if (!subject) return null;

  const back = () => navigate(`/subjects/${subject.id}`);
  const question = queue[index];

  if (!question) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Mashq tugadi', 'Готово')}</h2>
        <p className="text-sm text-muted-foreground">
          {tr(lang, `Bilaman: ${tally.know} · Qisman: ${tally.partly} · Bilmayman: ${tally.not}`, `Знаю: ${tally.know} · Частично: ${tally.partly} · Не знаю: ${tally.not}`)}
        </p>
        <Button variant="primary" onClick={back}>{tr(lang, 'Fanga qaytish', 'К предмету')}</Button>
      </div>
    );
  }

  const rate = (verdict: keyof typeof SELF_SCORES) => {
    saveAttempt(subject.id, question.id, { at: Date.now(), answer: '', score: SELF_SCORES[verdict], feedback: '', missing: [], mode: 'recall' });
    setTally((t) => ({ ...t, [verdict]: t[verdict] + 1 }));
    setOpen(false);
    setIndex((i) => i + 1);
  };
  const number = subject.questions.findIndex((q) => q.id === question.id) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={back} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {subject.name}
        </button>
        <span className="text-xs text-muted-foreground">{index + 1} / {queue.length}</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <span className="text-xs font-semibold text-primary">{tr(lang, `${number}-bilet`, `Билет ${number}`)}</span>
        <h1 className="text-lg font-serif font-bold text-foreground leading-snug">{question.text}</h1>
        {!open ? (
          <p className="text-sm text-muted-foreground rounded-xl bg-secondary/60 p-3">
            {tr(lang, "Javob rejasini ichingizda yoki qog'ozda eslang. Tayyor bo'lsangiz, oching.", 'Вспомните план ответа про себя или на бумаге. Готовы — откройте.')}
          </p>
        ) : (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{question.modelAnswer?.summary}</p>
            {!!question.modelAnswer?.keyPoints.length && (
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                {question.modelAnswer.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {!open ? (
        <Button variant="primary" size="lg" className="w-full" icon={<Eye size={16} />} onClick={() => setOpen(true)}>
          {tr(lang, 'Javobni ochish', 'Открыть ответ')}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground">{tr(lang, 'Qanchalik esladingiz?', 'Насколько вспомнили?')}</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => rate('not')} className="py-3 rounded-xl text-sm font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300">{tr(lang, 'Bilmayman', 'Не знаю')}</button>
            <button onClick={() => rate('partly')} className="py-3 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300">{tr(lang, 'Qisman', 'Частично')}</button>
            <button onClick={() => rate('know')} className="py-3 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">{tr(lang, 'Bilaman', 'Знаю')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
