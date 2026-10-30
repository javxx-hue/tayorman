import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language, tr } from '../lib/i18n';
import { Flashcard, QuizQuestion, StudySet } from '../types';
import { newId, saveStudySet } from '../lib/storage';

const input =
  'w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

// Manual editing of quizzes / flashcards, mainly to fix what the AI got wrong
export const SetEditorPage: React.FC<{ studySets: StudySet[]; lang: Language }> = ({ studySets, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const original = studySets.find((s) => s.id === id);
  const [title, setTitle] = useState(original?.title ?? '');
  const [questions, setQuestions] = useState<QuizQuestion[]>(original?.questions ?? []);
  const [cards, setCards] = useState<Flashcard[]>(original?.flashcards ?? []);

  if (!original || (original.type !== 'quiz' && original.type !== 'exam' && original.type !== 'flashcards')) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <p className="text-sm text-muted-foreground">{tr(lang, 'Bu to\'plamni tahrirlab bo\'lmaydi.', 'Этот набор нельзя редактировать.')}</p>
        <Button variant="primary" onClick={() => navigate(-1)}>{tr(lang, 'Orqaga', 'Назад')}</Button>
      </div>
    );
  }
  const isCards = original.type === 'flashcards';

  const patchQ = (i: number, patch: Partial<QuizQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const patchOption = (i: number, k: number, value: string) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? value : o)) } : q)));
  const patchCard = (i: number, patch: Partial<Flashcard>) => setCards((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = () => {
    const cleanQuestions = questions.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
    const cleanCards = cards.filter((c) => c.front.trim() && c.back.trim());
    if (title.trim() === '' || (isCards ? cleanCards.length === 0 : cleanQuestions.length === 0)) {
      toast.error(tr(lang, 'Nom va kamida bitta to\'liq element kerak', 'Нужны название и хотя бы один заполненный элемент'));
      return;
    }
    saveStudySet({
      ...original,
      title: title.trim(),
      ...(isCards ? { flashcards: cleanCards, itemCount: cleanCards.length } : { questions: cleanQuestions, itemCount: cleanQuestions.length }),
    });
    toast.success(tr(lang, 'Saqlandi', 'Сохранено'));
    navigate(-1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-4">
      <h1 className="text-xl font-serif font-bold text-foreground">{tr(lang, 'Tahrirlash', 'Редактирование')}</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder={tr(lang, 'Nomi', 'Название')} />

      {isCards
        ? cards.map((c, i) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <input value={c.front} onChange={(e) => patchCard(i, { front: e.target.value })} className={input} placeholder={tr(lang, 'Savol / tushuncha', 'Вопрос / термин')} />
              <textarea value={c.back} rows={2} onChange={(e) => patchCard(i, { back: e.target.value })} className={input} placeholder={tr(lang, 'Javob / ta\'rif', 'Ответ / определение')} />
              <button onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-rose-600 flex items-center gap-1">
                <Trash2 size={12} /> {tr(lang, 'O\'chirish', 'Удалить')}
              </button>
            </div>
          ))
        : questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <textarea value={q.question} rows={2} onChange={(e) => patchQ(i, { question: e.target.value })} className={input} placeholder={tr(lang, 'Savol', 'Вопрос')} />
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <button
                    onClick={() => patchQ(i, { correctAnswer: k })}
                    aria-label={tr(lang, 'To\'g\'ri javob', 'Правильный ответ')}
                    className={`w-7 h-7 rounded-full border shrink-0 flex items-center justify-center ${q.correctAnswer === k ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'}`}
                  >
                    {q.correctAnswer === k && <Check size={14} />}
                  </button>
                  <input value={o} onChange={(e) => patchOption(i, k, e.target.value)} className={input} placeholder={`${tr(lang, 'Variant', 'Вариант')} ${k + 1}`} />
                </div>
              ))}
              <input value={q.explanation} onChange={(e) => patchQ(i, { explanation: e.target.value })} className={input} placeholder={tr(lang, 'Izoh (ixtiyoriy)', 'Пояснение (необязательно)')} />
              <button onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-rose-600 flex items-center gap-1">
                <Trash2 size={12} /> {tr(lang, 'O\'chirish', 'Удалить')}
              </button>
            </div>
          ))}

      <button
        onClick={() =>
          isCards
            ? setCards((cs) => [...cs, { id: newId('fc'), front: '', back: '' }])
            : setQuestions((qs) => [...qs, { id: newId('q'), question: '', options: ['', '', '', ''], correctAnswer: 0, hint: '', explanation: '' }])
        }
        className="w-full py-3 rounded-2xl border border-dashed border-border text-sm text-muted-foreground flex items-center justify-center gap-1.5"
      >
        <Plus size={16} /> {isCards ? tr(lang, 'Karta qo\'shish', 'Добавить карточку') : tr(lang, 'Savol qo\'shish', 'Добавить вопрос')}
      </button>

      <div className="flex gap-2 justify-end sticky bottom-20">
        <Button variant="outline" onClick={() => navigate(-1)}>{tr(lang, 'Bekor qilish', 'Отмена')}</Button>
        <Button variant="primary" onClick={save}>{tr(lang, 'Saqlash', 'Сохранить')}</Button>
      </div>
    </div>
  );
};
