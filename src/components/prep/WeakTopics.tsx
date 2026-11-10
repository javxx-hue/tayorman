import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { setsOfSubject } from '../../lib/prep';
import { getProgress, progressKey, topicSummaries, weakTopics, type QuizLaunch } from '../../lib/quizProgress';

interface WeakTopicsProps {
  subject: Subject;
  studySets: StudySet[];
  lang: Language;
}

// This student's weakest topics in a subject, from their own test answers, each with a short practice
export const WeakTopics: React.FC<WeakTopicsProps> = ({ subject, studySets, lang }) => {
  const navigate = useNavigate();
  const quiz = setsOfSubject(subject, studySets).find((s) => s.type === 'quiz' && (s.topics?.length ?? 0) > 0);
  if (!quiz) return null;

  const summaries = topicSummaries(quiz.questions ?? [], quiz.topics ?? [], getProgress(progressKey(quiz)));
  const weak = weakTopics(summaries);
  const practise = (topic: number) => {
    const launch: QuizLaunch = { mode: 'mixed', topic, count: 10, autostart: true };
    navigate(`/study/${quiz.id}`, { state: launch });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
        <Target size={18} /> {tr(lang, 'Zaif mavzularingiz', 'Ваши слабые темы')}
      </h3>
      {weak.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr(
            lang,
            "Testlarni ishlaganingiz sari qaysi mavzu qiyinroq ekani shu yerda chiqadi. Har bir mavzudan kamida 3 ta savol ishlang.",
            'По мере решения тестов здесь появятся темы, которые даются труднее. Решите хотя бы 3 вопроса по теме.'
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {weak.map((t) => (
            <li key={t.no} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
              <div className="min-w-0">
                <div className="text-sm text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {tr(lang, `To'g'ri: ${t.accuracy ?? 0}% · xato: ${t.mistakes} · ishlangan: ${t.seen}/${t.total}`, `Верно: ${t.accuracy ?? 0}% · ошибок: ${t.mistakes} · решено: ${t.seen}/${t.total}`)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => practise(t.no)}>
                {tr(lang, 'Mashq', 'Практика')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
