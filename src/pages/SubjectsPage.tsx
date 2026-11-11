import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { SubjectAvatar } from '../components/prep/Readiness';
import { Button } from '../components/ui/Button';
import { Language } from '../lib/i18n';
import { ExamFormat, StudySet, Subject } from '../types';
import { daysUntil, subjectReadiness } from '../lib/prep';

export const FORMAT_LABELS: Record<ExamFormat, { uz: string; ru: string }> = {
  test: { uz: 'Test', ru: 'Тест' },
  written: { uz: 'Yozma', ru: 'Письменный' },
  oral: { uz: 'Og\'zaki', ru: 'Устный' },
  mixed: { uz: 'Aralash', ru: 'Смешанный' },
};

export function daysLeftLabel(days: number, isUz: boolean): string {
  if (days < 0) return isUz ? 'Imtihon o\'tgan' : 'Экзамен прошёл';
  if (days === 0) return isUz ? 'Imtihon bugun' : 'Экзамен сегодня';
  if (days === 1) return isUz ? 'Imtihon ertaga' : 'Экзамен завтра';
  return isUz ? `${days} kun qoldi` : `Осталось дней: ${days}`;
}

export function readinessColor(pct: number): string {
  if (pct >= 71) return 'bg-emerald-500';
  if (pct >= 56) return 'bg-amber-500';
  return 'bg-rose-500';
}

interface SubjectsPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

// The student's subjects. They arrive from the admin; a student only studies them or asks for more.
export const SubjectsPage: React.FC<SubjectsPageProps> = ({ subjects, studySets, lang }) => {
  const isUz = lang === 'uz';
  const navigate = useNavigate();
  const sorted = [...subjects].sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <div className="mb-4">
        <h1 className="text-2xl font-serif font-bold text-foreground">{isUz ? 'Mening fanlarim' : 'Мои предметы'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isUz ? 'Fanlaringizni administrator biriktiradi. Ular shu yerda o\'zi paydo bo\'ladi.' : 'Предметы назначает администратор. Они появятся здесь сами.'}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
          <BookOpen size={36} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-serif font-bold text-foreground mb-1">{isUz ? 'Hali fan biriktirilmagan' : 'Предметов пока нет'}</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            {isUz
              ? 'Fanlar guruhingizga biriktiriladi. Guruhingizning taklif havolasi bo\'lsa, botni shu havola orqali oching: guruh fanlari o\'zi keladi. Havola bo\'lmasa, kerakli fanni so\'rab yozing.'
              : 'Предметы назначаются вашей группе. Если у вас есть пригласительная ссылка группы, откройте бота по ней: предметы группы появятся сами. Если ссылки нет, напишите, какой предмет нужен.'}
          </p>
          <Button variant="primary" size="md" onClick={() => navigate('/request')}>
            {isUz ? 'Fan so\'rash' : 'Запросить предмет'}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {sorted.map((s) => {
            const days = daysUntil(s.examDate);
            const readiness = subjectReadiness(s, studySets);
            return (
              <button key={s.id} onClick={() => navigate(`/subjects/${s.id}`)} className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-secondary/40">
                <SubjectAvatar name={s.name} index={subjects.indexOf(s)} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-foreground truncate">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.questions.length} {isUz ? 'ta savol' : 'вопросов'} · {daysLeftLabel(days, isUz)} · {FORMAT_LABELS[s.examFormat][lang]}
                  </span>
                  <span className="block h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                    <span className={`block h-full ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
                  </span>
                </span>
                <span className="text-sm font-bold text-muted-foreground w-10 text-right">{readiness}%</span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
