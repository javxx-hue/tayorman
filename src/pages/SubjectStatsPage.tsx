import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject } from '../types';
import { PASS_SCORE, questionScore, readinessParts, READINESS_WEIGHTS } from '../lib/prep';
import { readinessColor } from './SubjectsPage';

interface SubjectStatsPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

const share = (w: number) => Math.round((w / (READINESS_WEIGHTS.written + READINESS_WEIGHTS.tests + READINESS_WEIGHTS.cards)) * 100);

// Where a subject's readiness comes from, said openly
export const SubjectStatsPage: React.FC<SubjectStatsPageProps> = ({ subjects, studySets, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const subject = subjects.find((s) => s.id === id);
  if (!subject) return null;

  const parts = readinessParts(subject, studySets);
  const answered = subject.questions.filter((q) => q.attempts.length > 0);
  const toRepeat = answered.filter((q) => questionScore(q) < PASS_SCORE).length;

  const rows: { label: string; weight: number; value: number | null }[] = [
    { label: tr(lang, 'Yozma javoblar', 'Письменные ответы'), weight: READINESS_WEIGHTS.written, value: parts.written },
    { label: tr(lang, 'Testlar', 'Тесты'), weight: READINESS_WEIGHTS.tests, value: parts.tests },
    { label: tr(lang, 'Kartochkalar', 'Карточки'), weight: READINESS_WEIGHTS.cards, value: parts.cards },
  ];
  const tiles = [
    { n: answered.length, label: tr(lang, 'ishlangan savol', 'отвечено') },
    { n: subject.questions.length - answered.length, label: tr(lang, "hali ko'rilmagan", 'ещё не начато') },
    { n: toRepeat, label: tr(lang, 'takrorlash kerak', 'нужно повторить') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-4">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {subject.name}
      </button>
      <h1 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Statistika', 'Статистика')}</h1>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-4xl font-serif font-bold text-foreground">{parts.total}%</div>
        <div className="text-xs text-muted-foreground">{tr(lang, 'tayyorlik', 'готовность')}</div>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">
                  {r.label} <span className="text-xs text-muted-foreground">({share(r.weight)}%)</span>
                </span>
                <span className="font-semibold text-foreground">{r.value === null ? '—' : `${r.value}%`}</span>
              </div>
              <div className="h-1.5 mt-1 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full ${readinessColor(r.value ?? 0)}`} style={{ width: `${r.value ?? 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-3">
            <div className="text-xl font-bold text-foreground">{t.n}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {tr(
          lang,
          `Tayyorlik = yozma javoblar (${share(READINESS_WEIGHTS.written)}%) + testlar (${share(READINESS_WEIGHTS.tests)}%) + kartochkalar (${share(READINESS_WEIGHTS.cards)}%). Hali boshlanmagan qism («—») hisobga olinmaydi, uning ulushi qolganlariga bo'linadi. Yozma javob ${PASS_SCORE}% va undan yuqori baholansa, savol tayyor hisoblanadi.`,
          `Готовность = письменные ответы (${share(READINESS_WEIGHTS.written)}%) + тесты (${share(READINESS_WEIGHTS.tests)}%) + карточки (${share(READINESS_WEIGHTS.cards)}%). Ещё не начатая часть («—») не учитывается, её доля делится между остальными. Вопрос готов, если ответ оценён на ${PASS_SCORE}% и выше.`
        )}
      </p>
    </div>
  );
};
