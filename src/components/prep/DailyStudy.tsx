import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Layers, ChevronRight, Check } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { dailyStudy, newCardsToday } from '../../lib/dailyPlan';
import { getProgress, progressKey, type QuizLaunch } from '../../lib/quizProgress';

interface DailyStudyRowsProps {
  subject: Subject;
  studySets: StudySet[];
  lang: Language;
}

// Today's share of a subject's tests and flashcards, each a tap away
export const DailyStudyRows: React.FC<DailyStudyRowsProps> = ({ subject, studySets, lang }) => {
  const navigate = useNavigate();
  const plan = dailyStudy(subject, studySets, (s) => getProgress(progressKey(s)), (s) => newCardsToday(s));
  if (!plan.quiz && !plan.cards) return null;

  const row = 'w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50';
  const done = <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
  const go = <ChevronRight size={16} className="text-muted-foreground shrink-0" />;

  return (
    <div className="space-y-2">
      {plan.quiz && (() => {
        const { set, target, done: did, dueMistakes } = plan.quiz;
        const left = Math.max(target - did, 0);
        const finished = left === 0 && dueMistakes === 0;
        const launch: QuizLaunch = { mode: 'mixed', count: Math.max(left + dueMistakes, 10), autostart: !finished };
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
      {plan.cards && (() => {
        const { set, newTarget, newDone, reviewsDue } = plan.cards;
        const finished = newDone >= newTarget && reviewsDue === 0;
        return (
          <button className={row} onClick={() => navigate(`/study/${set.id}`)}>
            <Layers size={18} className="text-creation-flashcards-strong shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-foreground">
              {tr(lang, `Kartochkalar: ${newDone}/${newTarget} yangi`, `Карточки: новых ${newDone}/${newTarget}`)}
              {reviewsDue > 0 && <span className="text-muted-foreground">{tr(lang, ` · ${reviewsDue} takrorlash`, ` · повторить ${reviewsDue}`)}</span>}
            </span>
            {finished ? done : go}
          </button>
        );
      })()}
    </div>
  );
};
