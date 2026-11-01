import React, { useState, useEffect } from 'react';
import { StudySet, QuizQuestion } from '../../types';
import { Button } from '../ui/Button';
import { Timer, Flag, Check, AlertTriangle, Trophy, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Language, getTranslations, tr } from '../../lib/i18n';
import { recordQuizCompletion } from '../../lib/storage';

interface ExamSimulatorProps {
  set: StudySet;
  lang: Language;
  onFinish: () => void;
  onRetake: () => void;
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({ set, lang, onFinish, onRetake }) => {
  const t = getTranslations(lang).exam;
  const [reviewMistakesMode, setReviewMistakesMode] = useState(false);
  const [activeWeakQuestions, setActiveWeakQuestions] = useState<QuizQuestion[]>([]);

  const activeQuestions: QuizQuestion[] = reviewMistakesMode ? activeWeakQuestions : (set.questions || []);
  const totalQ = activeQuestions.length;

  // 15 seconds per question default timer
  const initialSeconds = Math.max(120, totalQ * 60);
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (isSubmitted || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, secondsRemaining]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [currentIdx]: optIdx }));
  };

  const toggleFlag = () => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentIdx]: !prev[currentIdx],
    }));
  };

  const handleSubmit = () => {
    setShowConfirmModal(false);
    setIsSubmitted(true);

    // Calculate score
    let correctCount = 0;
    activeQuestions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) {
        correctCount += 1;
      }
    });
    const finalPct = Math.round((correctCount / totalQ) * 100);
    if (!reviewMistakesMode) recordQuizCompletion(finalPct, totalQ, set);
  };

  const currentQ = activeQuestions[currentIdx];

  // Diagnostic Results Screen
  if (isSubmitted) {
    let correctCount = 0;
    const weakQuestions: QuizQuestion[] = [];
    activeQuestions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) {
        correctCount += 1;
      } else {
        weakQuestions.push(q);
      }
    });

    const finalPct = Math.round((correctCount / totalQ) * 100);
    const passed = finalPct >= 70;
    const timeSpent = initialSeconds - secondsRemaining;

    return (
      <div className="max-w-3xl mx-auto my-8 p-6 sm:p-10 rounded-3xl bg-card border border-border shadow-elevated animate-in zoom-in-95">
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${
            passed ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          }`}>
            {passed ? <Trophy size={40} /> : <AlertTriangle size={40} />}
          </div>
          <h2 className="text-3xl font-serif font-bold text-foreground">
            {t.diagnosticsTitle}
          </h2>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              passed ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}>
              {passed ? t.passedBadge : t.failedBadge}
            </span>
            <span className="text-xs text-muted-foreground">
              Vaqt: {Math.floor(timeSpent / 60)} daq {timeSpent % 60} soniya
            </span>
          </div>
        </div>

        {/* Score metrics */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="p-4 rounded-2xl bg-background border border-border">
            <span className="text-3xl font-serif font-bold text-foreground">{finalPct}%</span>
            <p className="text-xs text-muted-foreground mt-1">Umumiy Natija</p>
          </div>
          <div className="p-4 rounded-2xl bg-background border border-border">
            <span className="text-3xl font-serif font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</span>
            <p className="text-xs text-muted-foreground mt-1">To'g'ri Javoblar</p>
          </div>
          <div className="p-4 rounded-2xl bg-background border border-border">
            <span className="text-3xl font-serif font-bold text-rose-600 dark:text-rose-400">{totalQ - correctCount}</span>
            <p className="text-xs text-muted-foreground mt-1">Xatolar</p>
          </div>
        </div>

        {/* Weak spots section */}
        {weakQuestions.length > 0 && (
          <div className="mb-8 space-y-3">
            <h3 className="text-base font-serif font-bold text-foreground flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-500" />
              {t.weakSpots} ({weakQuestions.length})
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {weakQuestions.map((q, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs sm:text-sm space-y-1">
                  <p className="font-semibold text-foreground">{q.question}</p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    ✓ To'g'ri javob: {q.options[q.correctAnswer]}
                  </p>
                  <p className="text-muted-foreground text-xs">{q.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-border">
          {weakQuestions.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-semibold"
              onClick={() => {
                setActiveWeakQuestions(weakQuestions);
                setReviewMistakesMode(true);
                setCurrentIdx(0);
                setUserAnswers({});
                setFlaggedQuestions({});
                setSecondsRemaining(Math.max(120, weakQuestions.length * 60));
                setIsSubmitted(false);
              }}
              icon={<RotateCcw size={16} />}
            >
              {tr(lang, 'Xatolar ustida ishlash', 'Работа над ошибками')} ({weakQuestions.length})
            </Button>
          )}
          <Button variant="outline" size="md" onClick={onRetake} icon={<RotateCcw size={16} />}>
            Qaytadan topshirish
          </Button>
          <Button variant="primary" size="md" onClick={onFinish} icon={<Check size={16} />}>
            Kabinetga qaytish
          </Button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="max-w-4xl mx-auto my-4 sm:my-8 px-4">
      
      {/* Top Exam Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif font-bold text-foreground">
              {set.title}
            </h2>
            {reviewMistakesMode && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 uppercase">
                {tr(lang, 'Xatolar tahlili', 'Разбор ошибок')}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {answeredCount} / {totalQ} javob berildi
          </span>
        </div>

        {/* Live Timer */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-mono font-bold text-base">
            <Timer size={18} className="animate-pulse" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowConfirmModal(true)}
          >
            {t.submitExam}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Current Question Area */}
        <div className="lg:col-span-8 rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-3">
            <span className="font-semibold text-foreground">Savol {currentIdx + 1} / {totalQ}</span>
            <button
              onClick={toggleFlag}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                flaggedQuestions[currentIdx]
                  ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Flag size={13} className={flaggedQuestions[currentIdx] ? 'fill-amber-500' : ''} />
              {t.flagQuestion}
            </button>
          </div>

          <h3 className="text-xl sm:text-2xl font-serif text-foreground leading-snug">
            {currentQ.question}
          </h3>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = userAnswers[currentIdx] === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-4 rounded-2xl border text-left text-sm sm:text-base font-medium flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                      : 'bg-background border-border text-foreground hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-primary-foreground text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>
                  {isSelected && <Check size={18} />}
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              icon={<ChevronLeft size={16} />}
            >
              {lang === 'uz' ? 'Oldingisi' : 'Назад'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIdx((p) => Math.min(totalQ - 1, p + 1))}
              disabled={currentIdx === totalQ - 1}
              icon={<ChevronRight size={16} />}
            >
              {lang === 'uz' ? 'Keyingisi' : 'Далее'}
            </Button>
          </div>
        </div>

        {/* Right: Question Matrix Navigation */}
        <div className="lg:col-span-4 rounded-3xl bg-card border border-border p-6 shadow-soft space-y-4">
          <h4 className="text-sm font-serif font-bold text-foreground">
            {t.questionList}
          </h4>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {activeQuestions.map((_, idx) => {
              const isAnswered = typeof userAnswers[idx] === 'number';
              const isFlagged = flaggedQuestions[idx];
              const isCurrent = currentIdx === idx;

              let style = 'bg-background border-border text-muted-foreground';
              if (isAnswered) style = 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold';
              if (isFlagged) style = 'bg-amber-500/25 text-amber-800 dark:text-amber-300 border-amber-500/50 font-bold';
              if (isCurrent) style += ' ring-2 ring-primary ring-offset-2';

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`h-9 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${style}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border text-[11px] text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50 inline-block" />
              <span>Yechilgan savol</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50 inline-block" />
              <span>Belgilangan (Flagged)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-background border border-border inline-block" />
              <span>Kutilayotgan</span>
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-elevated space-y-4">
            <h3 className="text-lg font-serif font-bold text-foreground">
              {t.confirmSubmitTitle}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {answeredCount < totalQ
                ? `Diqqat: Siz ${totalQ} ta savoldan faqat ${answeredCount} tasiga javob berdingiz.`
                : 'Barcha savollarga javob berildi. Imtihonni topshirmoqchimisiz?'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmModal(false)}>
                Davom etish
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit}>
                Ha, topshirish
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
