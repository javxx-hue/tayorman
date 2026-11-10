import React, { useMemo, useState } from 'react';
import { Play, ArrowLeft, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';
import { QuizQuestion, StudySet } from '../../types';
import { getProgress, overview, pickQuestions, progressKey, topicSummaries } from '../../lib/quizProgress';

interface QuizSetupProps {
  set: StudySet;
  lang: Language;
  onStart: (questions: QuizQuestion[]) => void;
  onBack: () => void;
}

const SITTING = 10;
const COUNTS = [10, 20, 50];

const barColor = (pct: number | null) => (pct === null ? 'bg-secondary' : pct >= 71 ? 'bg-emerald-500' : pct >= 56 ? 'bg-amber-500' : 'bg-rose-500');

// The start screen of a large test set: 10 questions (new ones, with mistakes that came back), or only mistakes.
// Choosing a topic and a count is there for whoever wants it, folded away.
export const QuizSetup: React.FC<QuizSetupProps> = ({ set, lang, onStart, onBack }) => {
  const questions = set.questions ?? [];
  const progress = useMemo(() => getProgress(progressKey(set)), [set]);
  const ov = overview(questions, progress);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(SITTING);
  const [topic, setTopic] = useState<number | null>(null);
  const topics = useMemo(() => topicSummaries(questions, set.topics ?? [], progress), [questions, set.topics, progress]);

  const sitting = pickQuestions(questions, progress, { mode: 'mixed', count: SITTING });
  const mistakes = pickQuestions(questions, progress, { mode: 'mistakes', count: SITTING });
  const chosen = pickQuestions(questions, progress, { mode: 'mixed', count, topic });

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {tr(lang, 'Orqaga', 'Назад')}
      </button>

      <div className="rounded-2xl bg-card border border-border p-4">
        <h1 className="text-xl font-serif font-bold text-foreground">{set.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tr(lang, `Ishlangan: ${ov.seen}/${ov.total}`, `Решено: ${ov.seen}/${ov.total}`)}
          {ov.accuracy !== null && tr(lang, ` · to'g'ri: ${ov.accuracy}%`, ` · верно: ${ov.accuracy}%`)}
        </p>
      </div>

      <Button variant="primary" size="lg" className="w-full" icon={<Play size={16} />} disabled={sitting.length === 0} onClick={() => onStart(sitting)}>
        {tr(lang, `${sitting.length} ta savol boshlash`, `Начать ${sitting.length} вопросов`)}
      </Button>
      <Button variant="outline" size="lg" className="w-full" icon={<RotateCcw size={16} />} disabled={mistakes.length === 0} onClick={() => onStart(mistakes)}>
        {ov.mistakes ? tr(lang, `Xatolarim (${ov.mistakes})`, `Мои ошибки (${ov.mistakes})`) : tr(lang, "Xatolar yo'q", 'Ошибок нет')}
      </Button>

      {topics.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground">
            {tr(lang, 'Mavzu va son tanlash', 'Выбрать тему и количество')}
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {[...COUNTS, questions.length].map((n, i) => (
                  <button
                    key={i}
                    onClick={() => setCount(n)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium ${count === n ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {i === COUNTS.length ? tr(lang, `Hammasi (${n})`, `Все (${n})`) : n}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => setTopic(null)}
                  className={`w-full text-left p-3 rounded-xl border text-sm ${topic === null ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}`}
                >
                  {tr(lang, 'Barcha mavzular', 'Все темы')}
                </button>
                {topics.map((t) => (
                  <button
                    key={t.no}
                    onClick={() => setTopic(t.no)}
                    className={`w-full text-left p-3 rounded-xl border ${topic === t.no ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground min-w-0">{t.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t.seen}/{t.total}
                        {t.accuracy !== null && ` · ${t.accuracy}%`}
                      </span>
                    </div>
                    <div className="h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full ${barColor(t.accuracy)}`} style={{ width: `${t.total ? Math.round((t.seen / t.total) * 100) : 0}%` }} />
                    </div>
                  </button>
                ))}
              </div>
              <Button variant="primary" size="md" className="w-full" icon={<Play size={16} />} disabled={chosen.length === 0} onClick={() => onStart(chosen)}>
                {tr(lang, `Boshlash (${chosen.length} ta)`, `Начать (${chosen.length})`)}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
