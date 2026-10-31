import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mic, MicOff, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { pushNow } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { haptic, openBotChat } from '../lib/telegram';
import { track } from '../lib/track';
import { Subject } from '../types';
import { getSubjectById, saveSubject, recordStudyActivity } from '../lib/storage';
import { generateModelAnswer, gradeAnswer, planSubject, questionScore, scoreToGrade } from '../lib/prep';
import { describeGenerationError } from '../lib/ai';
import { useDictation } from '../lib/useDictation';
import { readinessColor } from './SubjectsPage';

interface QuestionPracticePageProps {
  subjects: Subject[];
  lang: Language;
}

export const QuestionPracticePage: React.FC<QuestionPracticePageProps> = ({ subjects, lang }) => {
  const { id, qid } = useParams();
  const navigate = useNavigate();
  const isUz = lang === 'uz';
  const subject = subjects.find((s) => s.id === id);
  const question = subject?.questions.find((q) => q.id === qid);

  const [answer, setAnswer] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [busy, setBusy] = useState<'grading' | 'answer' | null>(null);
  const { online } = useAuth();
  const dictation = useDictation(lang, (text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text)));

  if (!subject || !question) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{isUz ? 'Savol topilmadi' : 'Вопрос не найден'}</h2>
        <Button variant="primary" onClick={() => navigate(subject ? `/subjects/${subject.id}` : '/subjects')}>{isUz ? 'Orqaga' : 'Назад'}</Button>
      </div>
    );
  }

  const index = subject.questions.findIndex((q) => q.id === question.id);
  const last = question.attempts[question.attempts.length - 1];
  // Next: today's plan first, otherwise the next question in the list
  const todayIds = planSubject(subject).today.map((q) => q.id).filter((x) => x !== question.id);
  const nextId = todayIds[0] ?? subject.questions[index + 1]?.id;

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
    dictation.stop();
    setBusy('grading');
    try {
      const attempt = await gradeAnswer(subject, question, answer, lang);
      saveQuestion({ attempts: [...question.attempts, attempt] });
      recordStudyActivity();
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
    recordStudyActivity();
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
    navigate(nextId ? `/subjects/${subject.id}/q/${nextId}` : `/subjects/${subject.id}`);
  };

  const gradedNow = last && last.answer === answer.trim();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> {subject.name}
      </button>

      <div className="rounded-3xl bg-card border border-border/80 p-5 sm:p-7 shadow-soft space-y-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isUz ? `${index + 1}-savol / ${subject.questions.length}` : `Вопрос ${index + 1} / ${subject.questions.length}`}</span>
          {question.attempts.length > 0 && (
            <span>{isUz ? `Oxirgi natija: ${questionScore(question)}%` : `Последний результат: ${questionScore(question)}%`}</span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground leading-snug">{question.text}</h1>

        {/* Student answer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">{isUz ? 'Javobingiz' : 'Ваш ответ'}</label>
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.listening ? dictation.stop : dictation.start}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  dictation.listening ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {dictation.listening ? <MicOff size={14} /> : <Mic size={14} />}
                {dictation.listening ? (isUz ? 'To\'xtatish' : 'Стоп') : (isUz ? 'Gapirib javob berish' : 'Ответить голосом')}
              </button>
            )}
          </div>
          <textarea
            rows={7}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isUz ? 'Imtihondagidek javob yozing yoki gapiring. AI baholab, nimani unutganingizni ko\'rsatadi.' : 'Ответьте как на экзамене. ИИ оценит ответ и покажет, что вы упустили.'}
            className="w-full p-3.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
          <div className="flex flex-wrap gap-2 justify-end">
            {online && (
              <Button variant="outline" size="sm" onClick={answerByVoice} disabled={busy !== null} icon={<Mic size={14} />}>
                {isUz ? 'Botda ovoz bilan' : 'Голосом в боте'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleShowModel} disabled={busy !== null} icon={showModel ? <EyeOff size={14} /> : <Eye size={14} />}>
              {busy === 'answer' ? (isUz ? 'Tayyorlanmoqda...' : 'Готовим...') : showModel ? (isUz ? 'Javobni yashirish' : 'Скрыть ответ') : (isUz ? 'To\'g\'ri javobni ko\'rish' : 'Показать правильный ответ')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleGrade} disabled={busy !== null || answer.trim().length < 10} icon={busy === 'grading' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
              {isUz ? 'Baholash' : 'Оценить'}
            </Button>
          </div>
        </div>

        {/* Grading result */}
        {last && (gradedNow || question.attempts.length > 0) && (
          <div className="rounded-2xl border border-border p-4 space-y-3 bg-secondary/30" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className={`w-12 h-12 rounded-xl text-white text-xl font-bold flex items-center justify-center ${readinessColor(last.score)}`}>{scoreToGrade(last.score)}</span>
              <div>
                <div className="text-sm font-bold text-foreground">{last.score}% {gradedNow ? '' : isUz ? '(oldingi urinish)' : '(прошлая попытка)'}</div>
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
              <button onClick={() => selfAssess(90)} className="py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">{isUz ? 'Bilaman' : 'Знаю'}</button>
              <button onClick={() => selfAssess(60)} className="py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300">{isUz ? 'Qisman' : 'Частично'}</button>
              <button onClick={() => selfAssess(20)} className="py-2.5 rounded-xl text-sm font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300">{isUz ? 'Bilmayman' : 'Не знаю'}</button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border flex justify-end">
          <Button variant="secondary" size="md" onClick={goNext} icon={<ArrowRight size={15} />}>
            {nextId ? (isUz ? 'Keyingi savol' : 'Следующий вопрос') : (isUz ? 'Fanga qaytish' : 'К предмету')}
          </Button>
        </div>
      </div>
    </div>
  );
};
