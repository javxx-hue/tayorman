import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Play } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Language } from '../lib/i18n';
import { StudySet, Subject } from '../types';
import { planSubject, questionScore, scoreToGrade, subjectReadiness, daysUntil, PASS_SCORE } from '../lib/prep';
import { FORMAT_LABELS, daysLeftLabel, readinessColor } from './SubjectsPage';

type Tab = 'plan' | 'questions' | 'practice';

interface SubjectPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

const SET_LABEL: Record<StudySet['type'], { uz: string; ru: string }> = {
  quiz: { uz: 'Test', ru: 'Тест' },
  exam: { uz: 'Imtihon', ru: 'Экзамен' },
  flashcards: { uz: 'Kartalar', ru: 'Карточки' },
  notes: { uz: 'Konspekt', ru: 'Конспект' },
};

// One subject for a student: today's questions, the whole list, and the tests and cards that came with it
export const SubjectPage: React.FC<SubjectPageProps> = ({ subjects, studySets, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isUz = lang === 'uz';
  const subject = subjects.find((s) => s.id === id);
  const [tab, setTab] = useState<Tab>('plan');

  if (!subject) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{isUz ? 'Fan topilmadi' : 'Предмет не найден'}</h2>
        <Button variant="primary" onClick={() => navigate('/subjects')}>{isUz ? 'Fanlarga qaytish' : 'К предметам'}</Button>
      </div>
    );
  }

  const days = daysUntil(subject.examDate);
  const plan = planSubject(subject);
  const readiness = subjectReadiness(subject, studySets);
  const ownSets = studySets.filter((s) => s.subjectId === subject.id);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'plan', label: isUz ? 'Bugun' : 'Сегодня' },
    { key: 'questions', label: isUz ? 'Savollar' : 'Вопросы', count: subject.questions.length },
    { key: 'practice', label: isUz ? 'Mashq' : 'Практика', count: ownSets.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <button onClick={() => navigate('/subjects')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> {isUz ? 'Fanlarim' : 'Мои предметы'}
      </button>

      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <h1 className="text-2xl font-serif font-bold text-foreground">{subject.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1"><CalendarDays size={13} />{subject.examDate} · {daysLeftLabel(days, isUz)}</span>
          <span>{FORMAT_LABELS[subject.examFormat][lang]}</span>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{isUz ? 'Tayyorlik' : 'Готовность'}</span>
            <span className="font-bold text-foreground">{readiness}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full transition-all ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-secondary/80 rounded-xl border border-border/60 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <div className="space-y-4">
          {subject.questions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-serif font-bold text-lg text-foreground">{isUz ? 'Savollar tayyorlanmoqda' : 'Вопросы готовятся'}</h3>
              <p className="text-sm text-muted-foreground">
                {isUz ? 'Administrator bu fan uchun savollarni tez orada qo\'shadi. Shoshilsangiz, so\'rov yuboring.' : 'Администратор скоро добавит вопросы по этому предмету. Если срочно, отправьте запрос.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate('/request')}>{isUz ? 'Adminga yozish' : 'Написать админу'}</Button>
            </div>
          ) : days < 0 ? (
            <p className="text-sm text-muted-foreground">{isUz ? 'Bu fan imtihoni o\'tib ketgan.' : 'Экзамен по этому предмету уже прошёл.'}</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">
                    {plan.isReviewDay ? (isUz ? 'Ertaga imtihon: umumiy takrorlash' : 'Экзамен завтра: общее повторение') : (isUz ? 'Bugungi savollar' : 'Вопросы на сегодня')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isUz
                      ? `${plan.remaining} ta savol hali o'zlashtirilmagan (${PASS_SCORE}% dan past). Kuniga ~${plan.perDay} ta.`
                      : `Не выучено вопросов (ниже ${PASS_SCORE}%): ${plan.remaining}. Примерно ${plan.perDay} в день.`}
                  </p>
                </div>
                {plan.today.length > 0 && (
                  <Button variant="primary" size="md" icon={<Play size={15} />} onClick={() => navigate(`/subjects/${subject.id}/q/${plan.today[0].id}`)}>
                    {isUz ? 'Boshlash' : 'Начать'}
                  </Button>
                )}
              </div>
              {plan.today.length === 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                  {isUz ? 'Barcha savollar o\'zlashtirilgan! Test yoki kartalar bilan mustahkamlang.' : 'Все вопросы выучены! Закрепите тестами или карточками.'}
                </p>
              ) : (
                <ol className="space-y-2">
                  {plan.today.map((q) => (
                    <li key={q.id}>
                      <button onClick={() => navigate(`/subjects/${subject.id}/q/${q.id}`)} className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50">
                        <span className="text-sm text-foreground">{q.text}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{q.attempts.length ? `${questionScore(q)}%` : isUz ? 'yangi' : 'новый'}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'questions' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          {subject.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isUz ? 'Savollar hali qo\'shilmagan.' : 'Вопросы пока не добавлены.'}</p>
          ) : (
            <ol className="space-y-2">
              {subject.questions.map((q, i) => {
                const score = questionScore(q);
                return (
                  <li key={q.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                    <button onClick={() => navigate(`/subjects/${subject.id}/q/${q.id}`)} className="flex-1 text-left text-sm text-foreground hover:underline min-w-0">
                      {q.text}
                    </button>
                    {q.attempts.length > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md text-white ${readinessColor(score)}`}>{scoreToGrade(score)} · {score}%</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'practice' && (
        <div className="space-y-2">
          {ownSets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isUz ? 'Testlar va kartalarni administrator qo\'shadi. Ular shu yerda paydo bo\'ladi.' : 'Тесты и карточки добавляет администратор. Они появятся здесь.'}</p>
          ) : (
            ownSets.map((s) => (
              <button key={s.id} onClick={() => navigate(`/study/${s.id}`)} className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50">
                <span className="text-sm text-foreground truncate">{s.title} · {SET_LABEL[s.type][lang]}</span>
                <span className="text-xs text-muted-foreground shrink-0">{typeof s.lastScore === 'number' ? `${s.lastScore}%` : `${s.itemCount}`}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
