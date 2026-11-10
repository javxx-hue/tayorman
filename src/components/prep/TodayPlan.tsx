import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Layers, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { setsOfSubject, todayOverview } from '../../lib/prep';
import { dueQueue } from '../../lib/srs';
import { currentBudget, DEFAULT_NEW_CARDS, limitNewCards, newCardsToday } from '../../lib/dailyPlan';
import { DailyStudyRows } from './DailyStudy';
import { daysLeftLabel } from '../../pages/SubjectsPage';

interface TodayPlanProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

// "What do I do today?" across all subjects: plan questions + due flashcards
export const TodayPlan: React.FC<TodayPlanProps> = ({ subjects, studySets, lang }) => {
  const isUz = lang === 'uz';
  const navigate = useNavigate();
  const { tasks } = todayOverview(subjects, studySets);
  // Decks of a subject are in that subject's rows; the rest show here, new cards held to the daily allowance
  const inSubjects = new Set(subjects.flatMap((s) => setsOfSubject(s, studySets).map((x) => x.id)));
  const looseDue = (s: StudySet) => limitNewCards(dueQueue(s.flashcards ?? []), Math.max(0, DEFAULT_NEW_CARDS - newCardsToday(s))).length;
  const looseDecks = studySets.filter((s) => s.flashcards?.length && !inSubjects.has(s.id));
  const dueCards = looseDecks.reduce((n, s) => n + looseDue(s), 0);
  const firstDueDeck = looseDecks.find((s) => looseDue(s) > 0);
  const budget = currentBudget(subjects, studySets);

  return (
    <section className="mb-6 rounded-3xl border border-primary/25 bg-card p-5 sm:p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
          <CalendarCheck size={20} /> {isUz ? 'Bugungi reja' : 'План на сегодня'}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => navigate('/subjects')}>{isUz ? 'Fanlarim' : 'Мои предметы'}</Button>
      </div>
      {tasks.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          {isUz ? `Bugun ~${budget.planned} daqiqa · kunlik vaqtingiz ${budget.minutes} daqiqa` : `Сегодня ~${budget.planned} мин · ваше время ${budget.minutes} мин`}
          {budget.wanted > budget.planned + 2 && (isUz ? ". Sig'magani keyingi kunlarga o'tadi." : '. Остальное перейдёт на следующие дни.')}
        </p>
      )}

      {tasks.length === 0 && dueCards === 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isUz
              ? 'Fanlaringizni administrator biriktiradi, shundan keyin har kuni nimani o\'qishni aytib turamiz. Kerakli fanni so\'rab yozing.'
              : 'Предметы назначает администратор, после этого мы будем подсказывать, что учить каждый день. Напишите, какой предмет нужен.'}
          </p>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/request')}>
            {isUz ? 'Fan so\'rash' : 'Запросить предмет'}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map(({ subject, plan }) => {
            const allowed = budget.bySubject[subject.id];
            const todayQs = allowed ? plan.today.slice(0, allowed.questions) : plan.today;
            return (
            <li key={subject.id}>
              <button
                onClick={() => (todayQs[0] ? navigate(`/subjects/${subject.id}/q/${todayQs[0].id}`, { state: { queue: todayQs.map((q) => q.id) } }) : navigate(`/subjects/${subject.id}`))}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{subject.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {daysLeftLabel(plan.daysLeft, isUz)} ·{' '}
                    {subject.questions.length === 0
                      ? isUz ? 'savollar kiritilmagan' : 'вопросов пока нет'
                      : todayQs.length
                        ? isUz ? `bugun ${todayQs.length} ta savol` : `сегодня вопросов: ${todayQs.length}`
                        : isUz ? 'hammasi o\'zlashtirilgan' : 'всё выучено'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
              {plan.daysLeft >= 0 && (
                <div className="mt-2 pl-3 border-l-2 border-border">
                  <DailyStudyRows subject={subject} studySets={studySets} lang={lang} allowance={allowed} />
                </div>
              )}
            </li>
            );
          })}
          {dueCards > 0 && firstDueDeck && (
            <li>
              <button
                onClick={() => navigate(`/study/${firstDueDeck.id}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50"
              >
                <Layers size={18} className="text-creation-flashcards-strong shrink-0" />
                <span className="flex-1 text-sm text-foreground">
                  {isUz ? `${dueCards} ta karta takrorlashni kutyapti` : `карточек к повторению: ${dueCards}`}
                </span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
};
