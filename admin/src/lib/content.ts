// Pure rules for the admin library editor: what a finished test or subject must look like.
import { ExamQuestion, Flashcard, QuizQuestion, StudySet, Subject } from '../../../src/types';
import { parseQuestionList } from '../../../src/lib/prep';
import { newId } from '../../../src/lib/storage';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

// Blank options are dropped; every question needs text, two real options and a marked right answer
export function checkQuiz(questions: QuizQuestion[]): Checked<QuizQuestion[]> {
  if (!questions.length) return { ok: false, error: "Kamida bitta savol kerak." };
  const out: QuizQuestion[] = [];
  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    if (!q.question.trim()) return { ok: false, error: `${n}-savol matni bo'sh.` };
    const kept = q.options.map((text, idx) => ({ text: text.trim(), idx })).filter((o) => o.text);
    if (kept.length < 2) return { ok: false, error: `${n}-savolda kamida 2 ta variant kerak.` };
    const right = kept.findIndex((o) => o.idx === q.correctAnswer);
    if (right < 0) return { ok: false, error: `${n}-savolda to'g'ri javob belgilanmagan (yoki u bo'sh variant).` };
    out.push({ ...q, question: q.question.trim(), options: kept.map((o) => o.text), correctAnswer: right });
  }
  return { ok: true, value: out };
}

export function checkCards(cards: Flashcard[]): Checked<Flashcard[]> {
  const out = cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => ({ ...c, front: c.front.trim(), back: c.back.trim() }));
  return out.length ? { ok: true, value: out } : { ok: false, error: 'Kamida bitta to\'liq karta kerak (old va orqa tomoni).' };
}

// A subject's questions are edited as plain text; a question whose text did not change keeps its id and answer
export function questionsKeepingAnswers(text: string, existing: ExamQuestion[]): ExamQuestion[] {
  return parseQuestionList(text).map((t) => existing.find((q) => q.text === t) ?? { id: newId('q'), text: t, attempts: [] });
}

export const questionsAsText = (questions: ExamQuestion[]) => questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n');

// A copy to work on without touching the original; it starts as a draft
export function copyOf<T extends StudySet | Subject>(doc: T): T {
  const prefix = 'name' in doc ? 'sub' : 'set';
  return { ...doc, id: newId(prefix), ...('name' in doc ? { name: `${doc.name} (nusxa)` } : { title: `${(doc as StudySet).title} (nusxa)` }) };
}
