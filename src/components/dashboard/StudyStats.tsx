import React from 'react';
import { Flame, Target } from 'lucide-react';
import { UserStats } from '../../types';
import { Language, getTranslations } from '../../lib/i18n';

interface StudyStatsProps {
  stats: UserStats;
  lang: Language;
}

// Two numbers a student cares about: days in a row, and how well the tests go
export const StudyStats: React.FC<StudyStatsProps> = ({ stats, lang }) => {
  const t = getTranslations(lang).dashboard;
  const tile = 'rounded-2xl bg-card border border-border/80 p-4 shadow-soft flex items-center gap-3';

  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      <div className={tile}>
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
          <Flame size={20} className="fill-orange-500" />
        </div>
        <div>
          <span className="text-xl font-serif font-bold text-foreground">
            {stats.streakDays} <span className="text-xs font-sans text-muted-foreground font-normal">{t.streakDays}</span>
          </span>
          <p className="text-xs text-muted-foreground">{t.streak}</p>
        </div>
      </div>

      <div className={tile}>
        <div className="w-10 h-10 rounded-xl bg-creation-quiz/20 text-creation-quiz-strong flex items-center justify-center shrink-0">
          <Target size={20} />
        </div>
        <div>
          <span className="text-xl font-serif font-bold text-foreground">{stats.averageScore}%</span>
          <p className="text-xs text-muted-foreground">{t.avgScore}</p>
        </div>
      </div>
    </div>
  );
};
