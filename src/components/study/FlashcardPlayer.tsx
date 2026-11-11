import React, { useState, useEffect } from 'react';
import { StudySet, Flashcard } from '../../types';
import { Button } from '../ui/Button';
import { RotateCw, ArrowLeft, ArrowRight, Shuffle, RotateCcw, Check, Trophy, Maximize, Minimize, Volume2, CalendarClock } from 'lucide-react';
import { Language, getTranslations } from '../../lib/i18n';
import { saveStudySet } from '../../lib/storage';
import { useSpeech } from '../../lib/speech';
import { dueQueue, reviewCard, shouldRequeue, nextDueDate, previewIntervals, formatInterval, isMastered, isNew, ReviewRating } from '../../lib/srs';
import { countNewCard, limitNewCards } from '../../lib/dailyPlan';

interface FlashcardPlayerProps {
  set: StudySet;
  lang: Language;
  onFinish: () => void;
  newLimit?: number; // how many new cards may still be started today; due reviews are never held back
}

// review: FSRS queue of due cards, ratings are saved and scheduled.
// practice: flip through every card in order, nothing is scheduled.
// A review sitting shows at most this many cards; the rest wait for the next one
const CARDS_PER_SITTING = 20;

type Mode = 'review' | 'practice';

const RATINGS: { key: ReviewRating; hotkey: string; className: string }[] = [
  { key: 'again', hotkey: '1', className: 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-800 dark:text-rose-300' },
  { key: 'hard', hotkey: '2', className: 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-800 dark:text-amber-300' },
  { key: 'good', hotkey: '3', className: 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30 text-blue-800 dark:text-blue-300' },
  { key: 'easy', hotkey: '4', className: 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' },
];

export const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({ set, lang, onFinish, newLimit }) => {
  const t = getTranslations(lang).flashcards;
  const isUz = lang === 'uz';
  const speech = useSpeech(lang);

  const [deck, setDeck] = useState<Flashcard[]>(set.flashcards || []);
  const [mode, setMode] = useState<Mode>('review');
  // Card ids still to show; review mode re-appends cards that come back within minutes
  const [queue, setQueue] = useState<string[]>(() => {
    const due = dueQueue(set.flashcards || []);
    return (newLimit === undefined ? due : limitNewCards(due, newLimit)).slice(0, CARDS_PER_SITTING).map((c) => c.id);
  });
  const [reviewedCount, setReviewedCount] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentId = mode === 'review' ? queue[0] : deck[practiceIndex]?.id;
  const currentCard = deck.find((c) => c.id === currentId);
  const noneDue = mode === 'review' && queue.length === 0 && reviewedCount === 0;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const startPractice = () => {
    setMode('practice');
    setPracticeIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  };

  const handleNext = () => {
    if (practiceIndex < deck.length - 1) {
      setPracticeIndex((i) => i + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (practiceIndex > 0) {
      setPracticeIndex((i) => i - 1);
      setIsFlipped(false);
    }
  };

  const handleRating = (rating: ReviewRating) => {
    if (!currentCard || !isFlipped) return;
    if (mode === 'practice') {
      handleNext();
      return;
    }

    if (isNew(currentCard)) countNewCard(set);
    const updated = reviewCard(currentCard, rating);
    const nextDeck = deck.map((c) => (c.id === updated.id ? updated : c));
    setDeck(nextDeck);
    saveStudySet({ ...set, flashcards: nextDeck });

    const rest = queue.slice(1);
    const nextQueue = shouldRequeue(updated) ? [...rest, updated.id] : rest;
    setQueue(nextQueue);
    setReviewedCount((n) => n + 1);
    setIsFlipped(false);
    if (nextQueue.length === 0) setIsCompleted(true);
  };

  const handleShuffle = () => {
    if (mode === 'review') {
      setQueue((q) => [...q].sort(() => Math.random() - 0.5));
    } else {
      setDeck((d) => [...d].sort(() => Math.random() - 0.5));
      setPracticeIndex(0);
    }
    setIsFlipped(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (mode === 'practice' && e.code === 'ArrowRight') {
        handleNext();
      } else if (mode === 'practice' && e.code === 'ArrowLeft') {
        handlePrev();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else {
        const r = RATINGS.find((x) => x.hotkey === e.key);
        if (r) handleRating(r.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (deck.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-8 p-12 text-center bg-card rounded-3xl border border-border">
        <h3 className="text-xl font-serif font-bold">{isUz ? 'Kartalar mavjud emas' : 'В этой колоде нет карточек'}</h3>
        <Button variant="primary" onClick={onFinish} className="mt-4">{isUz ? 'Kabinetga qaytish' : 'На главную'}</Button>
      </div>
    );
  }

  // Nothing due today
  if (noneDue) {
    const next = nextDueDate(deck);
    return (
      <div className="max-w-xl mx-auto my-8 p-8 sm:p-10 rounded-3xl bg-card border border-border/80 shadow-elevated text-center">
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 bg-creation-flashcards/20 text-creation-flashcards-strong">
          <CalendarClock size={40} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
          {isUz ? 'Bugun takrorlanadigan karta yo\'q' : 'Сегодня повторять нечего'}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {next
            ? isUz
              ? `Keyingi takrorlash: ${next.toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })}`
              : `Следующее повторение: ${next.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}`
            : ''}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" size="md" onClick={startPractice} icon={<RotateCcw size={16} />}>
            {isUz ? 'Baribir hammasini ko\'rib chiqish' : 'Всё равно повторить все'}
          </Button>
          <Button variant="primary" size="md" onClick={onFinish} icon={<Check size={16} />}>
            {isUz ? 'Kabinetga qaytish' : 'На главную'}
          </Button>
        </div>
      </div>
    );
  }

  if (isCompleted || !currentCard) {
    const mastered = deck.filter(isMastered).length;
    return (
      <div className="max-w-xl mx-auto my-8 p-8 sm:p-10 rounded-3xl bg-card border border-border/80 shadow-elevated text-center animate-in zoom-in-95 duration-200">
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 bg-creation-flashcards/20 text-creation-flashcards-strong shadow-sm">
          <Trophy size={40} />
        </div>
        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">{t.completedTitle}</h2>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === 'review'
            ? isUz
              ? `${reviewedCount} ta takrorlash. Yodlangan: ${mastered} / ${deck.length} karta.`
              : `Повторений: ${reviewedCount}. Выучено: ${mastered} / ${deck.length} карточек.`
            : t.completedDesc}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" size="md" onClick={startPractice} icon={<RotateCcw size={16} />}>
            {isUz ? 'Hammasini qayta ko\'rish' : 'Повторить все'}
          </Button>
          <Button variant="primary" size="md" onClick={onFinish} icon={<Check size={16} />}>
            {isUz ? 'Kabinetga qaytish' : 'На главную'}
          </Button>
        </div>
      </div>
    );
  }

  const intervals = mode === 'review' ? previewIntervals(currentCard) : null;
  const progressPct =
    mode === 'review'
      ? (reviewedCount / (reviewedCount + queue.length)) * 100
      : ((practiceIndex + 1) / deck.length) * 100;

  return (
    <div className="max-w-2xl mx-auto my-4 sm:my-8 px-4">
      {/* Deck Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">{set.title}</h2>
          <span className="text-xs text-muted-foreground">
            {mode === 'review'
              ? isUz
                ? `Bugun qoldi: ${queue.length} · Takrorlandi: ${reviewedCount}`
                : `Осталось сегодня: ${queue.length} · Повторено: ${reviewedCount}`
              : `${t.card} ${practiceIndex + 1} / ${deck.length} · ${isUz ? 'mashq rejimi' : 'режим практики'}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {speech.available && (
            <button
              onClick={() => speech.speak(isFlipped ? currentCard.back : currentCard.front)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={isUz ? 'Ovozli eshitish' : 'Прослушать'}
            >
              <Volume2 size={16} />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={isUz ? 'To\'liq ekran (F)' : 'Во весь экран (F)'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <Button variant="ghost" size="sm" onClick={handleShuffle} icon={<Shuffle size={14} />}>
            {t.shuffle}
          </Button>
          <Button variant="ghost" size="sm" onClick={onFinish}>
            {isUz ? 'Chiqish' : 'Выйти'}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-secondary mb-6 overflow-hidden">
        <div className="h-full bg-creation-flashcards-strong transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* 3D Flip Card Container */}
      <div className="w-full h-80 sm:h-96 perspective-1000 cursor-pointer select-none mb-6" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`relative w-full h-full duration-500 transform-style-preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* Front Side */}
          <div className="absolute inset-0 w-full h-full rounded-3xl bg-card border border-border shadow-elevated p-8 flex flex-col justify-between backface-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-creation-flashcards-strong">
                {isUz ? 'Savol / Tushuncha' : 'Вопрос / Термин'}
              </span>
              <span className="flex items-center gap-1">
                <RotateCw size={13} />
                {t.flipHint}
              </span>
            </div>
            <div className="my-auto text-center px-4">
              <h3 className="text-2xl sm:text-3xl font-serif text-foreground font-normal leading-relaxed">{currentCard.front}</h3>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {isUz ? '[Space] yoki bosish orqali aylantiring' : 'Нажмите, чтобы перевернуть'}
            </div>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-br from-card via-secondary/20 to-creation-flashcards/10 border border-creation-flashcards/40 shadow-elevated p-8 flex flex-col justify-between backface-hidden rotate-y-180">
            <div className="flex items-center justify-between text-xs text-creation-flashcards-strong font-semibold uppercase tracking-wider">
              <span>{isUz ? 'Ta\'rif / Javob' : 'Определение / Ответ'}</span>
            </div>
            <div className="my-auto text-center px-4 space-y-3">
              <p className="text-lg sm:text-xl font-medium text-foreground leading-relaxed">{currentCard.back}</p>
              {currentCard.example && (
                <p className="text-xs sm:text-sm text-muted-foreground italic border-t border-border/50 pt-2">{currentCard.example}</p>
              )}
              {currentCard.source && (
                <p className="text-[11px] font-semibold text-muted-foreground">📖 {currentCard.source}</p>
              )}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {isUz ? 'Qanchalik yaxshi eslaganingizni baholang' : 'Оцените, насколько хорошо вы помнили'}
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons (after flip) or flip/navigation */}
      {isFlipped ? (
        <div className="grid grid-cols-4 gap-2 animate-in fade-in">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              onClick={() => handleRating(r.key)}
              className={`p-3 rounded-2xl border text-xs sm:text-sm font-semibold transition-all flex flex-col items-center gap-1 ${r.className}`}
            >
              <span>{t.ratings[r.key]}</span>
              <span className="text-[10px] font-mono opacity-70">
                {intervals ? formatInterval(intervals[r.key], lang) : `[${r.hotkey}]`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          {mode === 'practice' ? (
            <Button variant="outline" size="md" onClick={handlePrev} disabled={practiceIndex === 0} icon={<ArrowLeft size={16} />}>
              {isUz ? 'Oldingisi' : 'Предыдущая'}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" size="md" onClick={() => setIsFlipped(true)} icon={<RotateCw size={15} />}>
            {t.flipBtn}
          </Button>
          {mode === 'practice' ? (
            <Button variant="outline" size="md" onClick={handleNext} icon={<ArrowRight size={16} />}>
              {isUz ? 'Keyingisi' : 'Далее'}
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Hint Legend */}
      <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span><kbd className="px-1 py-0.5 rounded bg-secondary border">Space</kbd> {isUz ? 'Aylantirish' : 'Перевернуть'}</span>
        {mode === 'practice' && (
          <span><kbd className="px-1 py-0.5 rounded bg-secondary border">←</kbd> <kbd className="px-1 py-0.5 rounded bg-secondary border">→</kbd> {isUz ? 'Navigatsiya' : 'Навигация'}</span>
        )}
        <span><kbd className="px-1 py-0.5 rounded bg-secondary border">1-4</kbd> {isUz ? 'Baholash' : 'Оценка'}</span>
        <span><kbd className="px-1 py-0.5 rounded bg-secondary border">F</kbd> {isUz ? 'To\'liq ekran' : 'Во весь экран'}</span>
      </div>
    </div>
  );
};
