import React from 'react';
import { Flame, CheckCircle, Brain, Clock } from 'lucide-react';
import { UserStats } from '../../types';
import { Language, getTranslations } from '../../lib/i18n';

interface StudyStatsProps {
  stats: UserStats;
  lang: Language;
}

export const StudyStats: React.FC<StudyStatsProps> = ({ stats, lang }) => {
  const t = getTranslations(lang).dashboard;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* Streak */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-soft flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
          <Flame size={24} className="fill-orange-500" />
        </div>
        <div>
          <span className="text-2xl font-serif font-bold text-foreground">
            {stats.streakDays} <span className="text-xs font-sans text-muted-foreground font-normal">{t.streakDays}</span>
          </span>
          <p className="text-xs text-muted-foreground">{t.streak}</p>
        </div>
      </div>

      {/* Quizzes Taken */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-soft flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-creation-quiz/20 text-creation-quiz-strong flex items-center justify-center shrink-0">
          <CheckCircle size={24} />
        </div>
        <div>
          <span className="text-2xl font-serif font-bold text-foreground">
            {stats.quizzesTaken}
          </span>
          <p className="text-xs text-muted-foreground">{t.quizzesTaken}</p>
        </div>
      </div>

      {/* Cards Mastered */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-soft flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-creation-flashcards/20 text-creation-flashcards-strong flex items-center justify-center shrink-0">
          <Brain size={24} />
        </div>
        <div>
          <span className="text-2xl font-serif font-bold text-foreground">
            {stats.cardsMastered}
          </span>
          <p className="text-xs text-muted-foreground">{t.cardsMastered}</p>
        </div>
      </div>

      {/* Average Score */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-soft flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-creation-notes/20 text-creation-notes-strong flex items-center justify-center shrink-0">
          <Clock size={24} />
        </div>
        <div>
          <span className="text-2xl font-serif font-bold text-foreground">
            {stats.averageScore}%
          </span>
          <p className="text-xs text-muted-foreground">{t.avgScore}</p>
        </div>
      </div>

    </div>
  );
};
