import React from 'react';
import { TodayPlan } from '../components/prep/TodayPlan';
import { StudyStats } from '../components/dashboard/StudyStats';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject, UserStats } from '../types';
import { useAuth } from '../lib/auth';

interface HomePageProps {
  subjects: Subject[];
  studySets: StudySet[];
  stats: UserStats;
  lang: Language;
}

export const HomePage: React.FC<HomePageProps> = ({ subjects, studySets, stats, lang }) => {
  const { profile } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-4">
        {profile?.first_name ? tr(lang, `Salom, ${profile.first_name}!`, `Привет, ${profile.first_name}!`) : 'Sessiyaga tayyorlan'}
      </h1>

      <TodayPlan subjects={subjects} studySets={studySets} lang={lang} />
      <StudyStats stats={stats} lang={lang} />
    </div>
  );
};
