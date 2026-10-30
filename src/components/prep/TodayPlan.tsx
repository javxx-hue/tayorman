import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Layers, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { todayOverview } from '../../lib/prep';
import { dueQueue } from '../../lib/srs';
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
  const { tasks, dueCards } = todayOverview(subjects, studySets);
  const firstDueDeck = studySets.find((s) => s.flashcards && dueQueue(s.flashcards).length > 0);

  return (
    <section className="mb-6 rounded-3xl border border-primary/25 bg-card p-5 sm:p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
          <CalendarCheck size={20} /> {isUz ? 'Bugungi reja' : 'План на сегодня'}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => navigate('/subjects')}>{isUz ? 'Fanlarim' : 'Мои предметы'}</Button>
      </div>

      {tasks.length === 0 && dueCards === 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isUz
              ? 'Sessiyadagi fanlaringizni qo\'shing: imtihon sanasi va savollar asosida har kuni nimani o\'qishni aytib turamiz.'
              : 'Добавьте свои экзамены, и мы будем подсказывать, что учить каждый день.'}
          </p>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/subjects')}>
            {isUz ? 'Fan qo\'shish' : 'Добавить предмет'}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map(({ subject, plan }) => (
            <li key={subject.id}>
              <button
                onClick={() => navigate(plan.today[0] ? `/subjects/${subject.id}/q/${plan.today[0].id}` : `/subjects/${subject.id}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{subject.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {daysLeftLabel(plan.daysLeft, isUz)} ·{' '}
                    {subject.questions.length === 0
                      ? isUz ? 'savollar kiritilmagan' : 'вопросов пока нет'
                      : plan.today.length
                        ? isUz ? `bugun ${plan.today.length} ta savol` : `сегодня вопросов: ${plan.today.length}`
                        : isUz ? 'hammasi o\'zlashtirilgan' : 'всё выучено'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
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
