import React from 'react';
import { Flashcard, QuizQuestion } from '../../../src/types';
import { newId } from '../../../src/lib/storage';
import { plainMath } from '../../../src/lib/mathText';
import { Btn } from '../ui';

const field = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export const QuizEditor: React.FC<{ questions: QuizQuestion[]; onChange: (next: QuizQuestion[]) => void }> = ({ questions, onChange }) => {
  const patch = (i: number, change: Partial<QuizQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...change } : q)));
  const patchOption = (i: number, k: number, text: string) => patch(i, { options: questions[i].options.map((o, m) => (m === k ? text : o)) });

  const cleaned = questions.map((q) => ({ ...q, question: plainMath(q.question), options: q.options.map(plainMath), hint: plainMath(q.hint), explanation: plainMath(q.explanation) }));
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(questions);

  return (
    <div className="space-y-3">
      {dirty && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs">
          <span>Ba'zi savollarda formulalar kod ko'rinishida yozilgan ($...$, \sqrt, ^{'{'}-1{'}'}).</span>
          <Btn onClick={() => onChange(cleaned)}>Formulalarni tozalash</Btn>
        </div>
      )}
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground pt-2.5 w-6 shrink-0">{i + 1}.</span>
            <textarea value={q.question} rows={2} onChange={(e) => patch(i, { question: e.target.value })} className={field} placeholder="Savol" />
          </div>
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2 pl-8">
              <button
                type="button"
                onClick={() => patch(i, { correctAnswer: k })}
                aria-label="To'g'ri javob"
                title="To'g'ri javob"
                className={`w-6 h-6 rounded-full border shrink-0 text-xs ${q.correctAnswer === k ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'}`}
              >
                {q.correctAnswer === k ? '✓' : ''}
              </button>
              <input value={o} onChange={(e) => patchOption(i, k, e.target.value)} className={field} placeholder={`Variant ${k + 1}`} />
            </div>
          ))}
          <div className="pl-8 flex flex-wrap gap-2 items-center">
            <input value={q.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} className={`${field} flex-1 min-w-[12rem]`} placeholder="Izoh (ixtiyoriy)" />
            <Btn tone="danger" onClick={() => onChange(questions.filter((_, j) => j !== i))}>O'chirish</Btn>
          </div>
        </div>
      ))}
      <Btn onClick={() => onChange([...questions, { id: newId('q'), question: '', options: ['', '', '', ''], correctAnswer: 0, hint: '', explanation: '' }])}>+ Savol qo'shish</Btn>
    </div>
  );
};

export const CardsEditor: React.FC<{ cards: Flashcard[]; onChange: (next: Flashcard[]) => void }> = ({ cards, onChange }) => {
  const patch = (i: number, change: Partial<Flashcard>) => onChange(cards.map((c, j) => (j === i ? { ...c, ...change } : c)));
  return (
    <div className="space-y-3">
      {cards.map((c, i) => (
        <div key={c.id} className="rounded-xl border border-border p-3 space-y-2">
          <input value={c.front} onChange={(e) => patch(i, { front: e.target.value })} className={field} placeholder="Savol / tushuncha" />
          <textarea value={c.back} rows={2} onChange={(e) => patch(i, { back: e.target.value })} className={field} placeholder="Javob / ta'rif" />
          <Btn tone="danger" onClick={() => onChange(cards.filter((_, j) => j !== i))}>O'chirish</Btn>
        </div>
      ))}
      <Btn onClick={() => onChange([...cards, { id: newId('fc'), front: '', back: '' }])}>+ Karta qo'shish</Btn>
    </div>
  );
};
