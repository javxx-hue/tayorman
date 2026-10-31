import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, HelpCircle, Timer, FileText, ChevronRight } from 'lucide-react';
import { TodayPlan } from '../components/prep/TodayPlan';
import { StudyStats } from '../components/dashboard/StudyStats';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject, UserStats } from '../types';
import { useAuth } from '../lib/auth';

const TYPE_ICON = { quiz: HelpCircle, flashcards: Layers, exam: Timer, notes: FileText };

interface HomePageProps {
  subjects: Subject[];
  studySets: StudySet[];
  stats: UserStats;
  lang: Language;
}

export const HomePage: React.FC<HomePageProps> = ({ subjects, studySets, stats, lang }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const recent = [...studySets].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)).slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-4">
        {profile?.first_name ? tr(lang, `Salom, ${profile.first_name}!`, `Привет, ${profile.first_name}!`) : 'Sessiyaga tayyorlan'}
      </h1>

      <TodayPlan subjects={subjects} studySets={studySets} lang={lang} />
      <StudyStats stats={stats} lang={lang} />

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">{tr(lang, 'Oxirgi to\'plamlar', 'Последние наборы')}</h2>
          <ul className="space-y-2">
            {recent.map((s) => {
              const Icon = TYPE_ICON[s.type];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => navigate(`/study/${s.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50"
                  >
                    <Icon size={18} className="text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm text-foreground truncate">{s.title}</span>
                    {typeof s.lastScore === 'number' && <span className="text-xs text-muted-foreground">{s.lastScore}%</span>}
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
