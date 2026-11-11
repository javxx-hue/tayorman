import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Play, PenLine, HelpCircle, Layers, Grid3x3, BarChart3, Timer, ChevronRight, Brain, TextCursorInput, Presentation } from 'lucide-react';
import { BOARD_SITTING } from './BoardPage';
import { RECALL_SITTING } from './RecallPage';
import { CLOZE_SITTING } from './ClozePage';
import { Button } from '../components/ui/Button';
import { Language, tr } from '../lib/i18n';
import { ExamQuestion, StudySet, Subject } from '../types';
import { planSubject, practiceOrder, setsOfSubject, subjectReadiness, daysUntil } from '../lib/prep';
import { FORMAT_LABELS, daysLeftLabel } from './SubjectsPage';
import { ReadinessHero } from '../components/prep/Readiness';
import { DailyStudyRows } from '../components/prep/DailyStudy';

interface SubjectPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

// A written-answer sitting is short on purpose
export const WRITE_SITTING = 5;

const Row: React.FC<{ icon: React.ReactNode; title: string; hint: string; onClick: () => void }> = ({ icon, title, hint, onClick }) => (
  <button onClick={onClick} className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-secondary/50 first:rounded-t-2xl last:rounded-b-2xl">
    <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="text-lg font-serif text-foreground mb-2">{title}</h2>
    <div className="rounded-2xl border border-border bg-card divide-y divide-border">{children}</div>
  </section>
);

// One subject: readiness, today's work, then everything grouped as Prepare / Materials / Analysis
export const SubjectPage: React.FC<SubjectPageProps> = ({ subjects, studySets, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isUz = lang === 'uz';
  const subject = subjects.find((s) => s.id === id);

  if (!subject) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Fan topilmadi', 'Предмет не найден')}</h2>
        <Button variant="primary" onClick={() => navigate('/subjects')}>{tr(lang, 'Fanlarga qaytish', 'К предметам')}</Button>
      </div>
    );
  }

  const days = daysUntil(subject.examDate);
  const plan = planSubject(subject);
  const readiness = subjectReadiness(subject, studySets);
  const own = setsOfSubject(subject, studySets);
  const quiz = own.find((s) => s.type === 'quiz');
  const cards = own.find((s) => s.type === 'flashcards');
  const exams = own.filter((s) => s.type === 'exam');

  // Opens a question with the order to go through them in
  const practise = (ids: string[], first = ids[0]) => navigate(`/subjects/${subject.id}/q/${first}`, { state: { queue: ids } });
  const idsOf = (qs: ExamQuestion[]) => qs.map((q) => q.id);
  const writeQueue = practiceOrder(subject).slice(0, WRITE_SITTING);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-5">
      <button onClick={() => navigate('/subjects')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {tr(lang, 'Fanlarim', 'Мои предметы')}
      </button>

      <div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays size={13} />
          {subject.examDate} · {daysLeftLabel(days, isUz)} · {FORMAT_LABELS[subject.examFormat][lang]}
        </div>
        <h1 className="text-3xl font-serif text-foreground mt-1">{subject.name}</h1>
      </div>

      <ReadinessHero
        value={readiness}
        caption={tr(lang, 'tayyorlik', 'готовность')}
        footer={tr(
          lang,
          `Savollar: ${subject.questions.length} · siz ishlagan: ${subject.questions.filter((q) => q.attempts.length > 0).length}`,
          `Вопросов: ${subject.questions.length} · вы ответили: ${subject.questions.filter((q) => q.attempts.length > 0).length}`
        )}
      />

      {subject.questions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-serif font-bold text-lg text-foreground">{tr(lang, 'Savollar tayyorlanmoqda', 'Вопросы готовятся')}</h3>
          <p className="text-sm text-muted-foreground">
            {tr(lang, "Administrator bu fan uchun savollarni tez orada qo'shadi. Shoshilsangiz, so'rov yuboring.", 'Администратор скоро добавит вопросы по этому предмету. Если срочно, отправьте запрос.')}
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/request')}>{tr(lang, 'Adminga yozish', 'Написать админу')}</Button>
        </div>
      ) : (
        <>
          {days >= 0 && (
            <section>
              <h2 className="text-lg font-serif text-foreground mb-2">{tr(lang, 'Bugun', 'Сегодня')}</h2>
              <div className="space-y-2">
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {plan.isReviewDay
                        ? tr(lang, 'Ertaga imtihon: umumiy takrorlash', 'Экзамен завтра: общее повторение')
                        : tr(lang, `Imtihon savollari: ${plan.doneToday}/${plan.perDay}`, `Вопросы экзамена: ${plan.doneToday}/${plan.perDay}`)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {plan.today.length
                        ? tr(lang, `Bugun yana ${plan.today.length} ta savol`, `Сегодня ещё ${plan.today.length}`)
                        : plan.remaining === 0
                          ? tr(lang, "Hammasi o'zlashtirilgan", 'Всё выучено')
                          : tr(lang, 'Bugungi reja bajarildi ✅', 'План на сегодня выполнен ✅')}
                    </div>
                  </div>
                  {plan.today.length > 0 && (
                    <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={() => practise(idsOf(plan.today))}>
                      {tr(lang, 'Boshlash', 'Начать')}
                    </Button>
                  )}
                </div>
                <DailyStudyRows subject={subject} studySets={studySets} lang={lang} />
              </div>
            </section>
          )}

          <Section title={tr(lang, 'Tayyorlanish', 'Подготовка')}>
            <Row
              icon={<Presentation size={18} className="text-teal-500" />}
              title={tr(lang, 'Ustoz tushuntiradi', 'Учитель объясняет')}
              hint={tr(lang, `Ustoz javobni doskaga yozib, qadam-baqadam tushuntiradi · ${BOARD_SITTING} tadan`, `Учитель пишет ответ на доске и объясняет по шагам · по ${BOARD_SITTING}`)}
              onClick={() => navigate(`/subjects/${subject.id}/board`)}
            />
            <Row
              icon={<PenLine size={18} className="text-emerald-600 dark:text-emerald-400" />}
              title={tr(lang, 'Javob yozib ko\'rish', 'Написать ответ')}
              hint={tr(lang, `${WRITE_SITTING} ta savol · AI tekshiradi`, `${WRITE_SITTING} вопросов · проверяет ИИ`)}
              onClick={() => practise(idsOf(writeQueue))}
            />
            <Row
              icon={<Brain size={18} className="text-violet-600 dark:text-violet-400" />}
              title={tr(lang, "Eslab ko'rish", 'Вспомнить ответ')}
              hint={tr(lang, `Eslaganingizni yozing → to'g'ri javob bilan solishtiring · ${RECALL_SITTING} tadan`, `Запишите, что помните → сравните с ответом · по ${RECALL_SITTING}`)}
              onClick={() => navigate(`/subjects/${subject.id}/recall`)}
            />
            <Row
              icon={<TextCursorInput size={18} className="text-orange-600 dark:text-orange-400" />}
              title={tr(lang, "Bo'sh joyni to'ldirish", 'Заполнить пропуски')}
              hint={tr(lang, `Javobdagi kalit atamalar · ${CLOZE_SITTING} tadan`, `Ключевые термины ответа · по ${CLOZE_SITTING}`)}
              onClick={() => navigate(`/subjects/${subject.id}/cloze`)}
            />
            {quiz && (
              <Row
                icon={<HelpCircle size={18} className="text-creation-quiz-strong" />}
                title={tr(lang, 'Testlar', 'Тесты')}
                hint={tr(lang, `${quiz.questions?.length ?? quiz.itemCount} ta test · 10 tadan`, `${quiz.questions?.length ?? quiz.itemCount} тестов · по 10`)}
                onClick={() => navigate(`/study/${quiz.id}`)}
              />
            )}
            {cards && (
              <Row
                icon={<Layers size={18} className="text-creation-flashcards-strong" />}
                title={tr(lang, 'Kartochkalar', 'Карточки')}
                hint={tr(lang, 'Eslang, oching, baholang · 20 tadan', 'Вспомните, откройте, оцените · по 20')}
                onClick={() => navigate(`/study/${cards.id}`)}
              />
            )}
            {exams.map((s) => (
              <Row key={s.id} icon={<Timer size={18} />} title={s.title} hint={tr(lang, 'Imtihon sinovi (vaqt bilan)', 'Пробный экзамен (на время)')} onClick={() => navigate(`/study/${s.id}`)} />
            ))}
          </Section>

          <Section title={tr(lang, 'Materiallar', 'Материалы')}>
            <Row
              icon={<Grid3x3 size={18} className="text-blue-600 dark:text-blue-400" />}
              title={tr(lang, 'Biletlar', 'Билеты')}
              hint={tr(lang, `${subject.questions.length} ta savol va namunaviy javoblar`, `${subject.questions.length} вопросов и образцы ответов`)}
              onClick={() => navigate(`/subjects/${subject.id}/tickets`)}
            />
          </Section>

          <Section title={tr(lang, 'Tahlil', 'Анализ')}>
            <Row
              icon={<BarChart3 size={18} className="text-rose-600 dark:text-rose-400" />}
              title={tr(lang, 'Statistika', 'Статистика')}
              hint={tr(lang, 'Tayyorlik qanday hisoblanadi', 'Как считается готовность')}
              onClick={() => navigate(`/subjects/${subject.id}/stats`)}
            />
          </Section>
        </>
      )}
    </div>
  );
};
