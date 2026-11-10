import React, { useState, useEffect } from 'react';
import { StudySet, QuizQuestion } from '../../types';
import { Button } from '../ui/Button';
import { Check, X, Lightbulb, ArrowRight, RotateCcw, Trophy, Award, Sparkles, ChevronRight, HelpCircle, Clock, Volume2 } from 'lucide-react';
import { Language, getTranslations } from '../../lib/i18n';
import { recordQuizCompletion, saveStudySet } from '../../lib/storage';
import { useSpeech } from '../../lib/speech';
import { ReportIssue } from '../ReportIssue';
import { getProgress, overview, progressKey, recordAnswers } from '../../lib/quizProgress';

interface QuizRunnerProps {
  set: StudySet;
  lang: Language;
  onFinish: () => void;
  onRetake: () => void;
  // A sitting with part of the set (chosen on the start screen). Every answer is remembered per question.
  session?: {
    questions: QuizQuestion[];
    onRetryMistakes: (ids: string[]) => void;
    onMore: () => void;
  };
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({ set, lang, onFinish, onRetake, session }) => {
  const t = getTranslations(lang).quiz;
  const speech = useSpeech(lang);
  const questions: QuizQuestion[] = session?.questions ?? set.questions ?? [];
  const [wrongIds, setWrongIds] = useState<string[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const hasAnswered = selectedOption !== null;
  const isCorrect = hasAnswered && selectedOption === currentQ?.correctAnswer;

  // Question Timer countdown
  useEffect(() => {
    if (!timerEnabled || hasAnswered || isFinished) return;
    setSecondsLeft(30);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto select wrong or reveal answer
          handleSelectOption(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, timerEnabled, hasAnswered, isFinished]);

  // Global Keyboard listener: A/B/C/D, 1/2/3/4, H, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input, ignore
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toLowerCase();
      
      if (!hasAnswered) {
        if (key === 'a' || key === '1') handleSelectOption(0);
        else if (key === 'b' || key === '2') handleSelectOption(1);
        else if (key === 'c' || key === '3') handleSelectOption(2);
        else if (key === 'd' || key === '4') handleSelectOption(3);
        else if (key === 'h') setShowHint(true);
      } else {
        if (key === 'enter' || key === ' ' || key === 'arrowright') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, currentIndex, currentQ, isCorrect, score, totalQ]);

  const handleSelectOption = (idx: number) => {
    if (hasAnswered) return;
    setSelectedOption(idx);
    const correct = idx === currentQ.correctAnswer;
    if (correct) {
      setScore((prev) => prev + 1);
    } else {
      setWrongIds((prev) => [...prev, currentQ.id]);
    }
    if (session) recordAnswers(progressKey(set), [{ id: currentQ.id, correct }]);
  };

  const handleNext = () => {
    if (currentIndex < totalQ - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setShowHint(false);
    } else {
      const finalScore = Math.round(((score + (isCorrect ? 0 : 0)) / totalQ) * 100);
      if (session) {
        // The set's score is the whole picture (latest answer of every question so far), not just this sitting
        recordQuizCompletion(finalScore, totalQ);
        const all = overview(set.questions ?? [], getProgress(progressKey(set)));
        saveStudySet({ ...set, lastScore: all.accuracy ?? finalScore, completedAt: Date.now() });
      } else {
        recordQuizCompletion(finalScore, totalQ, set);
      }
      setIsFinished(true);
    }
  };

  if (!currentQ || totalQ === 0) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center bg-card rounded-3xl border border-border">
        <HelpCircle size={40} className="mx-auto text-muted-foreground mb-3" />
        <h3 className="text-xl font-serif font-bold">Savollar mavjud emas</h3>
        <p className="text-xs text-muted-foreground mt-2 mb-6">Ushbu to'plamda savollar topilmadi.</p>
        <Button variant="primary" onClick={onFinish}>Kabinetga qaytish</Button>
      </div>
    );
  }

  // Final Results Screen
  if (isFinished) {
    const finalPct = Math.round((score / totalQ) * 100);
    const passed = finalPct >= 70;

    return (
      <div className="max-w-xl mx-auto my-8 p-8 sm:p-10 rounded-3xl bg-card border border-border/80 shadow-elevated text-center animate-in zoom-in-95 duration-200">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 shadow-sm ${
          passed ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        }`}>
          {passed ? <Trophy size={40} /> : <Award size={40} />}
        </div>

        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
          {t.resultsTitle}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {passed ? t.passed : t.needImprovement}
        </p>

        {/* Score Ring */}
        <div className="inline-block p-6 rounded-3xl bg-background border border-border/80 mb-8 shadow-soft">
          <span className="text-5xl font-serif font-bold text-foreground">
            {finalPct}%
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            {score} / {totalQ} {lang === 'uz' ? 'to\'g\'ri javob' : 'верно'}
          </p>
        </div>

        {session && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
            {wrongIds.length > 0 && (
              <Button variant="primary" size="md" onClick={() => session.onRetryMistakes(wrongIds)} icon={<RotateCcw size={16} />} className="w-full sm:w-auto">
                {lang === 'uz' ? `Xatolarni qayta ishlash (${wrongIds.length})` : `Повторить ошибки (${wrongIds.length})`}
              </Button>
            )}
            <Button variant="outline" size="md" onClick={session.onMore} icon={<ChevronRight size={16} />} className="w-full sm:w-auto">
              {lang === 'uz' ? 'Keyingi savollar' : 'Следующие вопросы'}
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={onRetake}
            icon={<RotateCcw size={16} />}
            className="w-full sm:w-auto"
          >
            {t.retake}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onFinish}
            icon={<ArrowRight size={16} />}
            className="w-full sm:w-auto"
          >
            {t.backToDashboard}
          </Button>
        </div>
      </div>
    );
  }

  const progressPct = ((currentIndex + 1) / totalQ) * 100;

  return (
    <div className="max-w-3xl mx-auto my-4 sm:my-8 px-4">
      
      {/* Quiz Header with progress */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2">
            <span className="font-serif text-base text-foreground font-bold">
              {set.title}
            </span>
            <button
              onClick={() => setTimerEnabled(!timerEnabled)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
                timerEnabled ? 'bg-secondary text-foreground border-border' : 'bg-muted/40 text-muted-foreground border-transparent'
              }`}
              title="Vaqt bosimi rejimini yoqish/o'chirish"
            >
              <Clock size={12} />
              {timerEnabled ? `${secondsLeft}s` : 'Taymer o\'chiq'}
            </button>
          </div>

          <span>
            {t.question} {currentIndex + 1} {t.of} {totalQ}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-creation-quiz-strong transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-3xl bg-card border border-border/80 shadow-elevated p-6 sm:p-8 space-y-6">
        
        {/* Question Text */}
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl sm:text-2xl font-serif text-foreground leading-snug">
            {currentQ.question}
          </h3>
          {speech.available && (
            <button
              onClick={() => speech.speak(currentQ.question)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0 transition-colors"
              title={lang === 'uz' ? 'Ovozli eshitish' : 'Прослушать'}
            >
              <Volume2 size={18} />
            </button>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            const isThisSelected = selectedOption === idx;
            const isThisCorrect = idx === currentQ.correctAnswer;

            let optionStyle = 'bg-background border-border hover:bg-secondary/40 text-foreground';
            if (hasAnswered) {
              if (isThisCorrect) {
                optionStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-semibold shadow-xs';
              } else if (isThisSelected) {
                optionStyle = 'bg-rose-500/15 border-rose-500 text-rose-900 dark:text-rose-300 font-semibold';
              } else {
                optionStyle = 'bg-background/50 border-border/50 text-muted-foreground opacity-60';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                disabled={hasAnswered}
                className={`w-full p-4 rounded-2xl border text-left text-sm sm:text-base font-medium flex items-center justify-between transition-all duration-150 ${optionStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/60">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>
                {hasAnswered && isThisCorrect && (
                  <Check size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {hasAnswered && isThisSelected && !isThisCorrect && (
                  <X size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hint Section */}
        {currentQ.hint && !hasAnswered && (
          <div className="pt-2 flex items-center justify-between">
            {!showHint ? (
              <button
                onClick={() => setShowHint(true)}
                className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
              >
                <Lightbulb size={14} />
                {t.needHint} <span className="text-[10px] text-muted-foreground font-mono">[H]</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in flex items-start gap-2 w-full">
                <Lightbulb size={15} className="shrink-0 mt-0.5" />
                <div>
                  <strong>{t.hintTitle}:</strong> {currentQ.hint}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instant Explanation Drawer */}
        {hasAnswered && currentQ.explanation && (
          <div className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed animate-in fade-in space-y-1.5 ${
            isCorrect
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles size={15} />
              {isCorrect ? t.correctToast : t.incorrectToast}
            </div>
            <p className="text-muted-foreground dark:text-foreground/90">
              <strong>{t.explanationTitle}:</strong> {currentQ.explanation}
            </p>
            {currentQ.source && (
              <p className="text-[11px] font-semibold opacity-80">📖 {lang === 'uz' ? 'Manba' : 'Источник'}: {currentQ.source}</p>
            )}
          </div>
        )}

        {hasAnswered && <ReportIssue lang={lang} libraryId={set.libraryId} context={set.title} questionText={currentQ.question} />}

        {/* Action Controls */}
        <div className="pt-4 border-t border-border/60 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onFinish}>
            {lang === 'uz' ? 'To\'xtatish' : 'Выйти'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Klaviatura: <kbd className="px-1.5 py-0.5 bg-secondary rounded border text-[10px]">A</kbd> <kbd className="px-1.5 py-0.5 bg-secondary rounded border text-[10px]">B</kbd> <kbd className="px-1.5 py-0.5 bg-secondary rounded border text-[10px]">C</kbd> <kbd className="px-1.5 py-0.5 bg-secondary rounded border text-[10px]">D</kbd>
            </span>
            {hasAnswered && (
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                icon={<ChevronRight size={16} />}
                className="animate-in fade-in"
              >
                {currentIndex < totalQ - 1 ? t.nextQuestion : t.finishQuiz} <span className="text-[10px] opacity-75 font-mono ml-1">[Enter]</span>
              </Button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
