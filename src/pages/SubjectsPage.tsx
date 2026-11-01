import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, BookOpen, ListChecks, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/ui/Toast';
import { Language } from '../lib/i18n';
import { ExamFormat, StudySet, Subject } from '../types';
import { saveSubject, newId, localDateKey } from '../lib/storage';
import { track } from '../lib/track';
import { useAuth } from '../lib/auth';
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

interface SubjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  initial?: Subject;
  onSaved: (subject: Subject) => void;
}

export const SubjectForm: React.FC<SubjectFormProps> = ({ isOpen, onClose, lang, initial, onSaved }) => {
  const isUz = lang === 'uz';
  const [name, setName] = useState(initial?.name ?? '');
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [examFormat, setExamFormat] = useState<ExamFormat>(initial?.examFormat ?? 'oral');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !examDate) return;
    const now = Date.now();
    const subject: Subject = initial
      ? { ...initial, name: name.trim(), examDate, examFormat }
      : { id: newId('sub'), name: name.trim(), examDate, examFormat, createdAt: now, updatedAt: now, materials: [], questions: [] };
    saveSubject(subject);
    if (!initial) track('subject_created');
    toast.success(isUz ? 'Saqlandi' : 'Сохранено');
    onSaved(subject);
    onClose();
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? (isUz ? 'Fanni tahrirlash' : 'Изменить предмет') : (isUz ? 'Yangi fan' : 'Новый предмет')} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{isUz ? 'Fan nomi' : 'Название предмета'}</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={isUz ? 'Masalan: Iqtisodiyot nazariyasi' : 'Например: Экономическая теория'} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{isUz ? 'Imtihon sanasi' : 'Дата экзамена'}</label>
            <input required type="date" min={initial ? undefined : localDateKey()} value={examDate} onChange={(e) => setExamDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{isUz ? 'Imtihon shakli' : 'Форма экзамена'}</label>
            <select value={examFormat} onChange={(e) => setExamFormat(e.target.value as ExamFormat)} className={inputClass}>
              {(Object.keys(FORMAT_LABELS) as ExamFormat[]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f][lang]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="pt-2 flex justify-end gap-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{isUz ? 'Bekor qilish' : 'Отмена'}</Button>
          <Button type="submit" variant="primary" size="sm">{isUz ? 'Saqlash' : 'Сохранить'}</Button>
        </div>
      </form>
    </Modal>
  );
};

interface SubjectsPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

export const SubjectsPage: React.FC<SubjectsPageProps> = ({ subjects, studySets, lang }) => {
  const isUz = lang === 'uz';
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const sorted = [...subjects].sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">{isUz ? 'Mening fanlarim' : 'Мои предметы'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? isUz
                ? 'Har bir fanga ma\'ruzalar va imtihon savollarini yuklang, so\'ng kutubxonaga chiqaring.'
                : 'Добавьте лекции и вопросы по каждому предмету, затем опубликуйте в библиотеке.'
              : isUz
                ? 'Fanlaringizni administrator biriktiradi. Ular shu yerda o\'zi paydo bo\'ladi.'
                : 'Предметы назначает администратор. Они появятся здесь сами.'}
          </p>
        </div>
        {isAdmin ? (
          <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setIsFormOpen(true)}>
            {isUz ? 'Yangi fan' : 'Новый предмет'}
          </Button>
        ) : (
          <Button variant="outline" size="md" onClick={() => navigate('/request')}>
            {isUz ? 'Adminga yozish' : 'Написать админу'}
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
          <BookOpen size={36} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-serif font-bold text-foreground mb-1">{isUz ? 'Hali fan biriktirilmagan' : 'Предметов пока нет'}</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            {isAdmin
              ? isUz
                ? 'Birinchi fanni qo\'shing: nomi, imtihon sanasi va shakli.'
                : 'Добавьте первый предмет: название, дату и форму экзамена.'
              : isUz
                ? 'Administrator fanlarni sizga biriktirganda ular shu yerda paydo bo\'ladi. Kerakli fanni so\'rab yozing.'
                : 'Когда администратор назначит вам предметы, они появятся здесь. Напишите, какой предмет нужен.'}
          </p>
          {isAdmin ? (
            <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setIsFormOpen(true)}>
              {isUz ? 'Fan qo\'shish' : 'Добавить предмет'}
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={() => navigate('/request')}>
              {isUz ? 'Fan so\'rash' : 'Запросить предмет'}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => {
            const days = daysUntil(s.examDate);
            const readiness = subjectReadiness(s, studySets);
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/subjects/${s.id}`)}
                className="w-full text-left rounded-2xl bg-card border border-border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-serif font-bold text-foreground truncate">{s.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><CalendarDays size={13} />{daysLeftLabel(days, isUz)}</span>
                      <span>{FORMAT_LABELS[s.examFormat][lang]}</span>
                      <span className="flex items-center gap-1"><ListChecks size={13} />{s.questions.length} {isUz ? 'savol' : 'вопросов'}</span>
                      <span>{s.materials.length} {isUz ? 'material' : 'материалов'}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{isUz ? 'Tayyorlik' : 'Готовность'}</span>
                    <span className="font-bold text-foreground">{readiness}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SubjectForm
        key={isFormOpen ? 'open' : 'closed'}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        lang={lang}
        onSaved={(s) => navigate(`/subjects/${s.id}`)}
      />
    </div>
  );
};
