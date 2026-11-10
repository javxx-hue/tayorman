import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronRight, Check } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { dailyStudy } from '../../lib/dailyPlan';
import { getProgress, progressKey, type QuizLaunch } from '../../lib/quizProgress';

interface DailyStudyRowsProps {
  subject: Subject;
  studySets: StudySet[];
  lang: Language;
}

// Today's share of a subject's tests, a tap away (flashcards stay in the library, outside the daily plan)
export const DailyStudyRows: React.FC<DailyStudyRowsProps> = ({ subject, studySets, lang }) => {
  const navigate = useNavigate();
  const plan = dailyStudy(subject, studySets, (s) => getProgress(progressKey(s)), () => 0);
  if (!plan.quiz) return null;

  const row = 'w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50';
  const done = <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
  const go = <ChevronRight size={16} className="text-muted-foreground shrink-0" />;

  return (
    <div className="space-y-2">
      {plan.quiz && (() => {
        const { set, target, done: did, dueMistakes } = plan.quiz;
        const left = Math.max(target - did, 0);
        const finished = left === 0 && dueMistakes === 0;
        const launch: QuizLaunch = { count: Math.min(Math.max(left + dueMistakes, 10), 20), autostart: !finished };
        return (
          <button className={row} onClick={() => navigate(`/study/${set.id}`, { state: launch })}>
            <HelpCircle size={18} className="text-creation-quiz-strong shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-foreground">{tr(lang, `Testlar: bugun ${did}/${target}`, `Тесты: сегодня ${did}/${target}`)}</span>
              {dueMistakes > 0 && (
                <span className="block text-xs text-rose-600 dark:text-rose-400">{tr(lang, `${dueMistakes} ta xato qaytadi`, `ошибок к повторению: ${dueMistakes}`)}</span>
              )}
            </span>
            {finished ? done : go}
          </button>
        );
      })()}
    </div>
  );
};
