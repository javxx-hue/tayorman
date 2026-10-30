import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Layers, HelpCircle, Timer, FileText, Check, Plus, Loader2 } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject } from '../types';
import { LibraryItem, addToMine, fetchLibrary } from '../lib/library';
import { useAuth } from '../lib/auth';
import { haptic } from '../lib/telegram';

interface LibraryPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

const SET_ICON = { quiz: HelpCircle, flashcards: Layers, exam: Timer, notes: FileText };

// Content the admin published for this student's audience
export const LibraryPage: React.FC<LibraryPageProps> = ({ subjects, studySets, lang }) => {
  const navigate = useNavigate();
  const { online } = useAuth();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!online) return setItems([]);
    fetchLibrary()
      .then(setItems)
      .catch(() => setFailed(true));
  }, [online]);

  const owned = new Set([...subjects.map((s) => s.libraryId), ...studySets.map((s) => s.libraryId)].filter(Boolean));

  const add = (item: LibraryItem) => {
    const id = addToMine(item);
    haptic.success();
    toast.success(tr(lang, 'Fanlaringizga qo\'shildi', 'Добавлено в ваши предметы'));
    navigate(item.kind === 'subject' ? `/subjects/${id}` : `/study/${id}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <h1 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Kutubxona', 'Библиотека')}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {tr(lang, 'Administrator tayyorlagan fanlar, testlar va kartalar. Natijalaringiz faqat o\'zingizga ko\'rinadi.', 'Предметы, тесты и карточки от администратора. Ваши результаты видны только вам.')}
      </p>

      {items === null && !failed && (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>
      )}
      {failed && <p className="text-sm text-rose-600">{tr(lang, 'Yuklab bo\'lmadi. Keyinroq urinib ko\'ring.', 'Не удалось загрузить. Попробуйте позже.')}</p>}

      {items && items.length === 0 && !failed && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
          <BookOpen size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{tr(lang, 'Hozircha kutubxona bo\'sh. Yangi materiallar paydo bo\'lganda botdan xabar keladi.', 'Библиотека пока пуста. Когда появятся материалы, бот сообщит.')}</p>
        </div>
      )}

      <ul className="space-y-2">
        {items?.map((item) => {
          const Icon = item.kind === 'subject' ? BookOpen : SET_ICON[(item.data as StudySet).type] ?? FileText;
          const have = owned.has(item.id);
          const detail =
            item.kind === 'subject'
              ? tr(lang, `${(item.data as Subject).questions.length} savol · imtihon ${(item.data as Subject).examDate}`, `${(item.data as Subject).questions.length} вопросов · экзамен ${(item.data as Subject).examDate}`)
              : tr(lang, `${(item.data as StudySet).itemCount} ta element`, `элементов: ${(item.data as StudySet).itemCount}`);
          return (
            <li key={item.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
              <span className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0"><Icon size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground truncate">{detail}</div>
              </div>
              {have ? (
                <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={14} />{tr(lang, 'Qo\'shilgan', 'Добавлено')}</span>
              ) : (
                <button onClick={() => add(item)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                  <Plus size={14} /> {tr(lang, 'Qo\'shish', 'Добавить')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
