import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mic, Sparkles, BookOpen, GraduationCap, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { pushNow } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { haptic, openBotChat } from '../lib/telegram';
import { track } from '../lib/track';
import { Subject } from '../types';
import { getSubjectById, saveSubject } from '../lib/storage';
import { generateModelAnswer, gradeAnswer, planSubject, questionScore, scoreToGrade, SELF_SCORES } from '../lib/prep';
import { describeGenerationError } from '../lib/ai';
import { AnswerInput } from '../components/AnswerInput';
import { canRecordAudio } from '../lib/useRecorder';
import { looksLikeAnswer } from '../lib/answerInput';
import { readinessColor } from './SubjectsPage';
import { ReportIssue } from '../components/ReportIssue';
import { nextInQueue, placeInQueue, queueOf, usableQueue } from '../lib/practiceQueue';

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

interface QuestionPracticePageProps {
  subjects: Subject[];
  lang: Language;
}

export const QuestionPracticePage: React.FC<QuestionPracticePageProps> = ({ subjects, lang }) => {
  const { id, qid } = useParams();
  const navigate = useNavigate();
  const isUz = lang === 'uz';
  const location = useLocation();
  const subject = subjects.find((s) => s.id === id);
  const question = subject?.questions.find((q) => q.id === qid);

  const [answer, setAnswer] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [busy, setBusy] = useState<'grading' | 'answer' | null>(null);
  // The result is shown in full only for an answer given now; an earlier one stays a small line until opened
  const [gradedNow, setGradedNow] = useState(false);
  const [showOld, setShowOld] = useState(false);
  // Moving to another question (also with the back button) starts it clean
  useEffect(() => {
    setGradedNow(false);
    setShowOld(false);
  }, [qid]);
  const { online } = useAuth();

  if (!subject || !question) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-extrabold text-foreground">{isUz ? 'Savol topilmadi' : 'Вопрос не найден'}</h2>
        <Button variant="primary" onClick={() => navigate(subject ? `/subjects/${subject.id}` : '/subjects')}>{isUz ? 'Orqaga' : 'Назад'}</Button>
      </div>
    );
  }

  const index = subject.questions.findIndex((q) => q.id === question.id);
  const last = question.attempts[question.attempts.length - 1];
  // "Next" follows the order this sitting was opened with (today's plan, the whole list, more practice).
  // Opened without one (a bookmark, a reload that lost it), it goes through today's plan.
  const existing = new Set(subject.questions.map((q) => q.id));
  const opened = queueOf(location.state);
  // Opened from the tickets page: each question is a ticket, so it is shown as "17-bilet", not as one of hundreds
  const fromTickets = (location.state as { tickets?: boolean } | null)?.tickets === true;
  const queue = usableQueue(opened ?? [question.id, ...planSubject(subject).today.map((q) => q.id).filter((x) => x !== question.id)], existing);
  const nextId = nextInQueue(queue, question.id);
  const place = placeInQueue(queue, question.id);

  const saveQuestion = (patch: Partial<typeof question>) => {
    const latest = getSubjectById(subject.id);
    if (!latest) return;
    saveSubject({ ...latest, questions: latest.questions.map((q) => (q.id === question.id ? { ...q, ...patch } : q)) });
  };

  const handleShowModel = async () => {
    if (question.modelAnswer || showModel) {
      setShowModel(!showModel);
      return;
    }
    setBusy('answer');
    try {
      saveQuestion({ modelAnswer: await generateModelAnswer(subject, question, lang) });
      setShowModel(true);
    } catch (e) {
      toast.error(describeGenerationError(e, lang));
    } finally {
      setBusy(null);
    }
  };

  const handleGrade = async () => {
    setBusy('grading');
    try {
      const attempt = await gradeAnswer(subject, question, answer, lang);
      saveQuestion({ attempts: [...question.attempts, attempt] });
      setGradedNow(true);
      track('first_answer', { oncePerSession: true });
    } catch (e) {
      toast.error(describeGenerationError(e, lang));
    } finally {
      setBusy(null);
    }
  };

  // Self-assessment: works without AI (also when the daily limit is used up)
  const selfAssess = (score: number) => {
    saveQuestion({ attempts: [...question.attempts, { at: Date.now(), answer: answer.trim(), score, feedback: '', missing: [] }] });
    setGradedNow(true);
    track('first_answer', { oncePerSession: true });
    haptic.success();
  };

  // Voice answers are recorded in the bot chat: save the subject to the server first,
  // then ask the bot to wait for a voice message about this question
  const answerByVoice = async () => {
    if (!supabase) return;
    setBusy('grading');
    try {
      const latest = getSubjectById(subject.id);
      if (latest) await pushNow('subject', latest);
      const { error } = await supabase.functions.invoke('bot-action', {
        body: { action: 'voice_answer', subjectId: subject.id, questionId: question.id },
      });
      if (error) throw error;
      openBotChat();
    } catch (e) {
      console.error(e);
      toast.error(isUz ? 'Botga ulanib bo\'lmadi' : 'Не удалось связаться с ботом');
    } finally {
      setBusy(null);
    }
  };

  const goNext = () => {
    setAnswer('');
    setShowModel(false);
    setGradedNow(false);
    setShowOld(false);
    if (fromTickets) {
      navigate(nextId ? `/subjects/${subject.id}/q/${nextId}` : `/subjects/${subject.id}/tickets`, nextId ? { state: { queue, tickets: true } } : undefined);
      return;
    }
    navigate(nextId ? `/subjects/${subject.id}/q/${nextId}` : `/subjects/${subject.id}`, nextId ? { state: { queue } } : undefined);
  };

  const gradable = looksLikeAnswer(answer);
  // Phones often have no Uzbek month names ("M11 10"), so they are spelled out here
  const when = (at: number) => {
    const d = new Date(at);
    return isUz ? `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}` : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> {subject.name}
      </button>

      <div className="rounded-3xl bg-card border border-border/80 p-4 sm:p-7 shadow-soft space-y-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className={fromTickets ? 'font-bold text-primary' : ''}>
            {fromTickets
              ? isUz ? `${index + 1}-bilet` : `Билет ${index + 1}`
              : opened && queue.length > 1
              ? isUz ? `Mashq: ${place} / ${queue.length}` : `Практика: ${place} / ${queue.length}`
              : isUz ? `${index + 1}-savol / ${subject.questions.length}` : `Вопрос ${index + 1} / ${subject.questions.length}`}
          </span>
        </div>
        <h1 className="text-xl font-extrabold text-foreground leading-snug">{question.text}</h1>
        <ReportIssue lang={lang} libraryId={subject.libraryId} context={subject.name} questionText={question.text} />

        {/* Student answer */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">{isUz ? 'Javobingiz' : 'Ваш ответ'}</label>
          {online && <AnswerInput lang={lang} disabled={busy !== null} onText={(text) => setAnswer((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))} />}
          <textarea
            rows={7}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isUz ? 'Javobni yozing, gapiring yoki qog\'ozdagi javobingiz rasmini yuklang. AI baholab, nimani unutganingizni ko\'rsatadi.' : 'Напишите ответ, скажите голосом или загрузите фото ответа с бумаги. ИИ оценит и покажет, что вы упустили.'}
            className="w-full p-3.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
          <Button variant="primary" size="lg" className="w-full" onClick={handleGrade} disabled={busy !== null || !gradable} icon={busy === 'grading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}>
            {isUz ? 'Baholash' : 'Оценить'}
          </Button>
          {answer.trim() && !gradable && (
            <p className="text-xs text-muted-foreground text-center">
              {isUz ? "Bu javobga o'xshamaydi: savolga o'z so'zlaringiz bilan javob yozing." : 'Это не похоже на ответ: напишите ответ своими словами.'}
            </p>
          )}
          <div className="space-y-2">
            <Button variant="outline" size="md" className="w-full" onClick={handleShowModel} disabled={busy !== null} icon={showModel ? <EyeOff size={15} /> : <Eye size={15} />}>
              {busy === 'answer' ? (isUz ? 'Tayyorlanmoqda...' : 'Готовим...') : showModel ? (isUz ? 'Yashirish' : 'Скрыть') : (isUz ? 'Javobni ko\'rish' : 'Показать ответ')}
            </Button>
            {question.modelAnswer && (
              <Button variant="outline" size="md" className="w-full" onClick={() => navigate(`/subjects/${subject.id}/board`, { state: { question: question.id } })} icon={<GraduationCap size={16} />}>
                {isUz ? 'Ustoz doskada tushuntirsin' : 'Пусть учитель объяснит на доске'}
              </Button>
            )}
          </div>
          {online && !canRecordAudio() && (
            <Button variant="outline" size="md" className="w-full" onClick={answerByVoice} disabled={busy !== null} icon={<Mic size={15} />}>
              {isUz ? 'Botda ovoz bilan' : 'Голосом в боте'}
            </Button>
          )}
        </div>

        {/* An earlier result: one small line, the details only when asked for */}
        {last && !gradedNow && (
          <button onClick={() => setShowOld((v) => !v)} className="w-full flex items-center gap-2 text-left text-xs text-muted-foreground">
            <span className="flex-1">
              {isUz ? `Oldingi urinish: ${questionScore(question)}% · ${when(last.at)}` : `Прошлая попытка: ${questionScore(question)}% · ${when(last.at)}`}
            </span>
            {(last.feedback || last.missing.length > 0) && <ChevronDown size={14} className={showOld ? 'rotate-180' : ''} />}
          </button>
        )}

        {/* Grading result */}
        {last && (gradedNow || (showOld && (last.feedback || last.missing.length > 0))) && (
          <div className="rounded-2xl border border-border p-4 space-y-3 bg-secondary/30" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className={`w-12 h-12 rounded-xl text-white text-xl font-bold flex items-center justify-center ${readinessColor(last.score)}`}>{scoreToGrade(last.score)}</span>
              <div>
                <div className="text-sm font-bold text-foreground">{last.score}% {gradedNow ? '' : isUz ? `(${when(last.at)})` : `(${when(last.at)})`}</div>
                <div className="text-xs text-muted-foreground">{isUz ? '5 ballik tizimda' : 'по 5-балльной шкале'}</div>
              </div>
            </div>
            {last.feedback && <p className="text-sm text-foreground leading-relaxed">{last.feedback}</p>}
            {last.missing.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">{isUz ? 'Yetishmagan yoki xato joylar:' : 'Упущено или неверно:'}</div>
                <ul className="list-disc pl-5 space-y-0.5 text-sm text-foreground">
                  {last.missing.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Model answer */}
        {showModel && question.modelAnswer && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{isUz ? 'Namunaviy javob' : 'Образцовый ответ'}</div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{question.modelAnswer.summary}</p>
            {question.modelAnswer.keyPoints.length > 0 && (
              <ul className="list-disc pl-5 space-y-0.5 text-sm text-foreground">
                {question.modelAnswer.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            {question.modelAnswer.sources.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                <BookOpen size={13} className="mt-0.5 shrink-0" />
                <span>{question.modelAnswer.sources.join(' · ')}</span>
              </div>
            )}
          </div>
        )}

        {showModel && question.modelAnswer && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {isUz ? 'Javobingiz namunaga qanchalik mos keldi?' : 'Насколько ваш ответ совпал с образцом?'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => selfAssess(SELF_SCORES.know)} className="py-2.5 rounded-2xl text-sm font-bold bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-300 active:translate-y-[2px]">{isUz ? 'Bilaman' : 'Знаю'}</button>
              <button onClick={() => selfAssess(SELF_SCORES.partly)} className="py-2.5 rounded-2xl text-sm font-bold bg-amber-500/15 border-2 border-amber-500/40 text-amber-300 active:translate-y-[2px]">{isUz ? 'Qisman' : 'Частично'}</button>
              <button onClick={() => selfAssess(SELF_SCORES.not)} className="py-2.5 rounded-2xl text-sm font-bold bg-rose-500/15 border-2 border-rose-500/40 text-rose-300 active:translate-y-[2px]">{isUz ? 'Bilmayman' : 'Не знаю'}</button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <Button variant="secondary" size="lg" className="w-full" onClick={goNext} icon={<ArrowRight size={16} />}>
            {nextId ? (fromTickets ? (isUz ? 'Keyingi bilet' : 'Следующий билет') : isUz ? 'Keyingi savol' : 'Следующий вопрос') : isUz ? 'Tugatish' : 'Завершить'}
          </Button>
        </div>
      </div>
    </div>
  );
};
