import React, { useMemo, useState } from 'react';
import { Play, ArrowLeft, RotateCcw, Sparkles, Shuffle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';
import { QuizQuestion, StudySet } from '../../types';
import { getProgress, overview, pickQuestions, PickMode, progressKey, topicSummaries } from '../../lib/quizProgress';

interface QuizSetupProps {
  set: StudySet;
  lang: Language;
  initialMode?: PickMode;
  initialCount?: number;
  initialTopic?: number | null;
  onStart: (questions: QuizQuestion[]) => void;
  onBack: () => void;
}

const COUNTS = [10, 20, 50];

const barColor = (pct: number | null) => (pct === null ? 'bg-secondary' : pct >= 71 ? 'bg-emerald-500' : pct >= 56 ? 'bg-amber-500' : 'bg-rose-500');

// The start screen of a large test set: what to practise (new, mistakes or both), how many, and which topic
export const QuizSetup: React.FC<QuizSetupProps> = ({ set, lang, initialMode, initialCount, initialTopic, onStart, onBack }) => {
  const questions = set.questions ?? [];
  const progress = useMemo(() => getProgress(progressKey(set)), [set]);
  const ov = overview(questions, progress);
  const [mode, setMode] = useState<PickMode>(initialMode ?? (ov.dueMistakes > 0 ? 'mixed' : 'new'));
  const [count, setCount] = useState<number>(initialCount ?? 20);
  const [topic, setTopic] = useState<number | null>(initialTopic ?? null);

  const topics = useMemo(() => topicSummaries(questions, set.topics ?? [], progress), [questions, set.topics, progress]);
  const picked = pickQuestions(questions, progress, { mode, count, topic });

  const modes: { key: PickMode; label: string; hint: string }[] = [
    { key: 'new', label: tr(lang, 'Yangi savollar', 'Новые вопросы'), hint: tr(lang, 'Hali ishlanmaganlar birinchi', 'Сначала нерешённые') },
    {
      key: 'mistakes',
      label: tr(lang, `Xatolarim (${ov.mistakes})`, `Мои ошибки (${ov.mistakes})`),
      hint: tr(lang, 'Faqat xato qilingan savollar', 'Только вопросы с ошибками'),
    },
    { key: 'mixed', label: tr(lang, 'Aralash', 'Смешанно'), hint: tr(lang, 'Yangi + qaytadigan xatolar', 'Новые + ошибки к повторению') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-8 space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {tr(lang, 'Orqaga', 'Назад')}
      </button>

      <div className="rounded-2xl bg-card border border-border p-4">
        <h1 className="text-xl font-serif font-bold text-foreground">{set.title}</h1>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-secondary/60 p-2">
            <div className="text-lg font-bold text-foreground">{ov.seen}/{ov.total}</div>
            <div className="text-[11px] text-muted-foreground">{tr(lang, 'ishlangan', 'решено')}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2">
            <div className="text-lg font-bold text-foreground">{ov.accuracy === null ? '—' : `${ov.accuracy}%`}</div>
            <div className="text-[11px] text-muted-foreground">{tr(lang, "to'g'ri", 'верно')}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2">
            <div className="text-lg font-bold text-foreground">{ov.mistakes}</div>
            <div className="text-[11px] text-muted-foreground">
              {ov.dueMistakes ? tr(lang, `xato · ${ov.dueMistakes} tasi bugun`, `ошибок · ${ov.dueMistakes} сегодня`) : tr(lang, 'xato', 'ошибок')}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{tr(lang, 'Nimani ishlaysiz?', 'Что решаем?')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`text-left p-3 rounded-xl border transition-colors ${mode === m.key ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary/50'}`}
            >
              <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                {m.key === 'new' ? <Sparkles size={14} /> : m.key === 'mistakes' ? <RotateCcw size={14} /> : <Shuffle size={14} />}
                {m.label}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{tr(lang, 'Nechta savol?', 'Сколько вопросов?')}</h2>
        <div className="flex flex-wrap gap-2">
          {[...COUNTS, questions.length].map((n, i) => (
            <button
              key={i}
              onClick={() => setCount(n)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium ${count === n ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
            >
              {i === COUNTS.length ? tr(lang, `Hammasi (${n})`, `Все (${n})`) : n}
            </button>
          ))}
        </div>
      </section>

      {topics.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{tr(lang, 'Mavzu', 'Тема')}</h2>
          <div className="space-y-1.5">
            <button
              onClick={() => setTopic(null)}
              className={`w-full text-left p-3 rounded-xl border text-sm font-medium ${topic === null ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-secondary/50'}`}
            >
              {tr(lang, 'Barcha mavzular', 'Все темы')}
            </button>
            {topics.map((t) => (
              <button
                key={t.no}
                onClick={() => setTopic(t.no)}
                className={`w-full text-left p-3 rounded-xl border ${topic === t.no ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary/50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground min-w-0">{t.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.seen}/{t.total}
                    {t.accuracy !== null && ` · ${t.accuracy}%`}
                    {t.mistakes > 0 && <span className="text-rose-600 dark:text-rose-400"> · {t.mistakes} {tr(lang, 'xato', 'ош.')}</span>}
                  </span>
                </div>
                <div className="h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full ${barColor(t.accuracy)}`} style={{ width: `${t.total ? Math.round((t.seen / t.total) * 100) : 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-20 pt-2">
        <Button variant="primary" size="lg" className="w-full" icon={<Play size={16} />} disabled={picked.length === 0} onClick={() => onStart(picked)}>
          {picked.length
            ? tr(lang, `Boshlash (${picked.length} ta savol)`, `Начать (${picked.length})`)
            : mode === 'mistakes'
              ? tr(lang, "Xatolar yo'q", 'Ошибок нет')
              : tr(lang, "Savol yo'q", 'Нет вопросов')}
        </Button>
      </div>
    </div>
  );
};
