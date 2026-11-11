import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language } from '../../lib/i18n';
import { StudySet, Subject } from '../../types';
import { setsOfSubject, todayOverview } from '../../lib/prep';
import { dueQueue } from '../../lib/srs';
import { DEFAULT_NEW_CARDS, limitNewCards, newCardsToday } from '../../lib/dailyPlan';
import { DailyStudyRows } from './DailyStudy';
import { SubjectAvatar } from './Readiness';
import { daysLeftLabel } from '../../pages/SubjectsPage';

interface TodayPlanProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

// "What do I do today?" across all subjects: each subject's questions and tests, then cards outside any subject
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

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-serif text-foreground">{isUz ? 'Bugun' : 'Сегодня'}</h2>

      {tasks.length === 0 && dueCards === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {isUz
              ? "Fanlaringizni administrator biriktiradi, shundan keyin har kuni nimani o'qishni aytib turamiz. Kerakli fanni so'rab yozing."
              : 'Предметы назначает администратор, после этого мы будем подсказывать, что учить каждый день. Напишите, какой предмет нужен.'}
          </p>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/request')}>
            {isUz ? "Fan so'rash" : 'Запросить предмет'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(({ subject, plan }, i) => (
            <div key={subject.id} className="rounded-2xl border border-border bg-card p-2 space-y-2">
              <button
                onClick={() =>
                  plan.today[0]
                    ? navigate(`/subjects/${subject.id}/q/${plan.today[0].id}`, { state: { queue: plan.today.map((q) => q.id) } })
                    : navigate(`/subjects/${subject.id}`)
                }
                className="w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40"
              >
                <SubjectAvatar name={subject.name} index={i} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{subject.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {daysLeftLabel(plan.daysLeft, isUz)} ·{' '}
                    {subject.questions.length === 0
                      ? isUz ? 'savollar kiritilmagan' : 'вопросов пока нет'
                      : plan.today.length
                        ? isUz ? `bugun ${plan.today.length} ta savol` : `сегодня вопросов: ${plan.today.length}`
                        : isUz ? "hammasi o'zlashtirilgan" : 'всё выучено'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
              {plan.daysLeft >= 0 && <DailyStudyRows subject={subject} studySets={studySets} lang={lang} />}
            </div>
          ))}
          {dueCards > 0 && firstDueDeck && (
            <button
              onClick={() => navigate(`/study/${firstDueDeck.id}`)}
              className="w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-secondary/40"
            >
              <Layers size={18} className="text-creation-flashcards-strong shrink-0" />
              <span className="flex-1 text-sm text-foreground">
                {isUz ? `${dueCards} ta karta takrorlashni kutyapti` : `карточек к повторению: ${dueCards}`}
              </span>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
