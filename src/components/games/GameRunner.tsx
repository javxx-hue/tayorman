import React, { useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { QuizQuestion } from '../../types';
import { Language, tr } from '../../lib/i18n';
import { haptic } from '../../lib/telegram';
import { Button } from '../ui/Button';

interface Props {
  title: string;
  questions: QuizQuestion[];
  lang: Language;
  onDone: (correct: number) => void;
  onExit: () => void;
}

// A short game round (challenge or duel): one question at a time, the right answer shown after each pick
export const GameRunner: React.FC<Props> = ({ title, questions, lang, onDone, onExit }) => {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = questions[index];
  const last = index === questions.length - 1;

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correctAnswer) {
      setCorrect((c) => c + 1);
      haptic.success();
    } else haptic.error();
  };

  const next = () => {
    if (last) {
      onDone(correct);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onExit} aria-label={tr(lang, 'Chiqish', 'Выйти')} className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-secondary/60">
          <X size={20} />
        </button>
        <span className="flex-1 text-sm font-bold text-foreground truncate">{title}</span>
        <span className="text-sm font-bold text-muted-foreground">{index + 1}/{questions.length}</span>
      </div>

      <div className="flex gap-1.5">
        {questions.map((x, i) => (
          <span key={x.id} className={`h-1.5 flex-1 rounded-full ${i < index || (i === index && picked !== null) ? 'bg-primary' : 'bg-secondary'}`} />
        ))}
      </div>

      <p className="text-lg font-bold text-foreground leading-snug whitespace-pre-wrap">{q.question}</p>

      <div className="space-y-2">
        {q.options.map((option, i) => {
          const right = picked !== null && i === q.correctAnswer;
          const wrong = picked === i && i !== q.correctAnswer;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={picked !== null}
              className={`w-full text-left p-3.5 rounded-2xl border-2 text-sm font-semibold flex items-start gap-2 transition-colors ${
                right ? 'border-emerald-500 bg-emerald-500/15 text-foreground' : wrong ? 'border-rose-500 bg-rose-500/15 text-foreground' : 'border-border bg-card text-foreground hover:border-primary/60'
              }`}
            >
              <span className="flex-1">{option}</span>
              {right && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
              {wrong && <XCircle size={18} className="text-rose-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <>
          {q.explanation && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.explanation}</p>}
          <Button className="w-full" size="lg" onClick={next}>
            {last ? tr(lang, 'Yakunlash', 'Завершить') : tr(lang, 'Keyingi', 'Далее')}
          </Button>
        </>
      )}
    </div>
  );
};
