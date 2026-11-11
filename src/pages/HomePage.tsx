import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { TodayPlan } from '../components/prep/TodayPlan';
import { StudyStats } from '../components/dashboard/StudyStats';
import { ReadinessHero, SubjectAvatar } from '../components/prep/Readiness';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject, UserStats } from '../types';
import { subjectReadiness } from '../lib/prep';
import { readinessColor } from './SubjectsPage';
import { useAuth } from '../lib/auth';

interface HomePageProps {
  subjects: Subject[];
  studySets: StudySet[];
  stats: UserStats;
  lang: Language;
}

// Home: how ready the student is overall and per subject, then today's work
export const HomePage: React.FC<HomePageProps> = ({ subjects, studySets, stats, lang }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const scores = subjects.map((s) => ({ subject: s, readiness: subjectReadiness(s, studySets) }));
  const average = scores.length ? Math.round(scores.reduce((sum, x) => sum + x.readiness, 0) / scores.length) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-6">
      <div>
        {profile?.first_name && <div className="text-sm text-muted-foreground">{tr(lang, `Salom, ${profile.first_name}`, `Привет, ${profile.first_name}`)}</div>}
        <h1 className="text-3xl font-serif text-foreground">{tr(lang, 'Asosiy', 'Главная')}</h1>
      </div>

      {scores.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-serif text-foreground">{tr(lang, 'Imtihonga tayyorlik', 'Готовность к экзамену')}</h2>
          <ReadinessHero value={average} caption={tr(lang, `${scores.length} ta fan bo'yicha o'rtacha`, `В среднем по ${scores.length} предметам`)} />
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {scores.map(({ subject, readiness }, i) => (
              <button key={subject.id} onClick={() => navigate(`/subjects/${subject.id}`)} className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-secondary/40">
                <SubjectAvatar name={subject.name} index={i} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-foreground truncate">{subject.name}</span>
                  <span className="block h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                    <span className={`block h-full ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
                  </span>
                </span>
                <span className="text-sm font-bold text-muted-foreground w-10 text-right">{readiness}%</span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      <TodayPlan subjects={subjects} studySets={studySets} lang={lang} />
      <StudyStats stats={stats} lang={lang} />
    </div>
  );
};
