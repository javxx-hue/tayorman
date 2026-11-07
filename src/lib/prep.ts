// Session prep logic: exam question lists, AI model answers and grading,
// readiness and the day-by-day plan until the exam.
import { AnswerAttempt, ExamFormat, ExamQuestion, ModelAnswer, StudySet, Subject } from '../types';
import { Language } from './i18n';
import { geminiGenerate, GenerationError, parseJson } from './ai';
import { MATH_STYLE_RULE, plainMath } from './mathText';
import { buildMaterialContext } from './materials';
import { localDateKey } from './storage';
import { dueQueue, isMastered } from './srs';

// ---------------------------------------------------------------
// Question list parsing
// ---------------------------------------------------------------
// "№3", "№ 3." or "3." / "3)" / "3-" / "3-savol." (a bare "1991 ..." is not a number prefix)
const NUMBERED = /^\s*(?:№\s*\d{1,3}[.)\-:]?|\d{1,3}\s*(?:-?\s*savol\s*[.:)]?|[.)\-:]))\s*/i;
const BULLET = /^\s*[-•*–]\s+/;

// Accepts what teachers usually hand out: "1. ...", "1) ...", "№1 ...",
// "1-savol. ...", bullets, or one question per line. Lines that continue a
// numbered question are joined to it.
export function parseQuestionList(raw: string): string[] {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const numbered = lines.filter((l) => NUMBERED.test(l)).length;
  const useNumbers = numbered >= 2 && numbered >= lines.length / 3;

  const out: string[] = [];
  for (const line of lines) {
    if (useNumbers) {
      if (NUMBERED.test(line)) out.push(line.replace(NUMBERED, '').trim());
      else if (out.length) out[out.length - 1] += ' ' + line;
    } else {
      out.push(line.replace(BULLET, '').replace(NUMBERED, '').trim());
    }
  }
  return out.map((q) => q.replace(/\s+/g, ' ').trim()).filter((q) => q.length > 2);
}

// ---------------------------------------------------------------
// AI: model answer and grading
// ---------------------------------------------------------------
const FORMAT_HINT: Record<ExamFormat, string> = {
  test: 'The exam is a multiple-choice test, so focus on precise facts and definitions.',
  written: 'The exam is written, so the answer should be a structured essay-style answer.',
  oral: 'The exam is oral, so the answer should be easy to say out loud in 2-3 minutes.',
  mixed: 'The exam mixes test and written/oral parts.',
};

const langName = (lang: Language) => (lang === 'uz' ? "Uzbek (o'zbek tili, lotin yozuvi)" : 'Russian (русский язык)');

export async function generateModelAnswer(subject: Subject, question: ExamQuestion, lang: Language): Promise<ModelAnswer> {
  if (subject.materials.length === 0) {
    throw new GenerationError('EMPTY_SOURCE', 'Subject has no materials.');
  }
  const prompt = `
You help a university student prepare for the "${subject.name}" exam. ${FORMAT_HINT[subject.examFormat]}
Answer the exam question using ONLY the lecture materials below. If the materials do not cover it, say so in the summary.
Write in ${langName(lang)}.
${MATH_STYLE_RULE}

Exam question: ${question.text}

Lecture materials (file names in === headers, locations in [Sahifa N] / [Slayd N] / [mm:ss] markers):
"""
${buildMaterialContext(subject.materials)}
"""

Return strict JSON:
{
  "summary": "A complete answer the student can learn, 120-250 words",
  "keyPoints": ["The 3-7 points an examiner expects"],
  "sources": ["file name + location for each part used, e.g. Ma'ruza 3.pdf, Sahifa 5"]
}`;
  const parsed = parseJson(await geminiGenerate([{ text: prompt }], { json: true, temperature: 0.3 }));
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new GenerationError('BAD_RESPONSE', 'Model answer missing.');
  }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
  return { summary: plainMath(parsed.summary.trim()), keyPoints: strings(parsed.keyPoints).map(plainMath), sources: strings(parsed.sources) };
}

export async function gradeAnswer(
  subject: Subject,
  question: ExamQuestion,
  answer: string,
  lang: Language
): Promise<AnswerAttempt> {
  if (!answer.trim()) throw new GenerationError('EMPTY_SOURCE', 'Answer is empty.');
  const reference = question.modelAnswer
    ? `Reference answer:\n${question.modelAnswer.summary}\nExpected points:\n- ${question.modelAnswer.keyPoints.join('\n- ')}`
    : `Lecture materials:\n${buildMaterialContext(subject.materials, 30_000)}`;
  const prompt = `
You are a fair but demanding university examiner for "${subject.name}". ${FORMAT_HINT[subject.examFormat]}
Grade the student's answer against the reference. Judge content, not spelling. Write feedback in ${langName(lang)},
addressing the student directly, 2-4 sentences: what was good, what was wrong.
${MATH_STYLE_RULE}

Exam question: ${question.text}

${reference}

Student's answer:
"""
${answer.slice(0, 6000)}
"""

Return strict JSON:
{ "score": 0-100 integer, "feedback": "...", "missing": ["important points the student left out or got wrong"] }`;
  const parsed = parseJson(await geminiGenerate([{ text: prompt }], { json: true, temperature: 0.1, tier: 'fast' }));
  const score = Math.round(Number(parsed.score));
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new GenerationError('BAD_RESPONSE', 'Invalid score.');
  return {
    at: Date.now(),
    answer: answer.trim(),
    score,
    feedback: typeof parsed.feedback === 'string' ? plainMath(parsed.feedback.trim()) : '',
    missing: Array.isArray(parsed.missing) ? parsed.missing.filter((x: unknown): x is string => typeof x === 'string' && !!x.trim()).map(plainMath) : [],
  };
}

// Common 5-point scale in Uzbek universities (86+ a'lo, 71+ yaxshi, 56+ qoniqarli)
export function scoreToGrade(score: number): 2 | 3 | 4 | 5 {
  if (score >= 86) return 5;
  if (score >= 71) return 4;
  if (score >= 56) return 3;
  return 2;
}

// ---------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------
export function questionScore(q: ExamQuestion): number {
  return q.attempts.length ? q.attempts[q.attempts.length - 1].score : 0;
}

// The tests and cards that belong to a subject. A student's own sets name the subject by its local id;
// sets that came from the library name the admin's subject id, which the delivered subject keeps as librarySourceId.
export function setsOfSubject(subject: Subject, sets: StudySet[]): StudySet[] {
  return sets.filter(
    (s) => s.subjectId === subject.id || (!!s.libraryId && !!subject.librarySourceId && s.subjectId === subject.librarySourceId)
  );
}

// 0-100. Question list counts most; quizzes and flashcards of the subject fill in
export function subjectReadiness(subject: Subject, sets: StudySet[]): number {
  const own = setsOfSubject(subject, sets);
  const parts: { value: number; weight: number }[] = [];

  if (subject.questions.length) {
    const avg = subject.questions.reduce((sum, q) => sum + questionScore(q), 0) / subject.questions.length;
    parts.push({ value: avg, weight: 3 });
  }
  const quizzes = own.filter((s) => (s.type === 'quiz' || s.type === 'exam') && typeof s.lastScore === 'number');
  if (quizzes.length) {
    parts.push({ value: quizzes.reduce((sum, s) => sum + (s.lastScore ?? 0), 0) / quizzes.length, weight: 1 });
  }
  const cards = own.flatMap((s) => s.flashcards ?? []);
  if (cards.length) parts.push({ value: (cards.filter(isMastered).length / cards.length) * 100, weight: 1 });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  return totalWeight ? Math.round(parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight) : 0;
}

// ---------------------------------------------------------------
// Session plan
// ---------------------------------------------------------------
export const PASS_SCORE = 71; // "4" or better counts as learned

export function daysUntil(examDate: string, today: string = localDateKey()): number {
  return Math.round((Date.parse(examDate) - Date.parse(today)) / 86_400_000);
}

export interface SubjectPlan {
  daysLeft: number;
  remaining: number; // questions below PASS_SCORE
  perDay: number;
  today: ExamQuestion[]; // still to do today
  doneToday: number; // answered today already
  more: ExamQuestion[]; // the next weakest ones, for whoever wants to go beyond today's share
  isReviewDay: boolean; // day before the exam: go over everything
}

const MORE_PRACTICE = 10;

// Weakest questions first, spread evenly over the days left, keeping the
// day before the exam free for a full review when there is room for it.
export function planSubject(subject: Subject, today: string = localDateKey()): SubjectPlan {
  const daysLeft = daysUntil(subject.examDate, today);
  const pending = subject.questions
    .map((q, index) => ({ q, index, score: questionScore(q) }))
    .filter((x) => x.score < PASS_SCORE)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((x) => x.q);

  if (daysLeft <= 0) return { daysLeft, remaining: pending.length, perDay: 0, today: [], doneToday: 0, more: [], isReviewDay: false };

  const isReviewDay = daysLeft === 1 && subject.questions.length > 0;
  if (isReviewDay) {
    return { daysLeft, remaining: pending.length, perDay: pending.length, today: pending, doneToday: 0, more: [], isReviewDay };
  }

  // The day's share is fixed in the morning: what was still to learn then, over the days left.
  // Questions answered today count towards it, so the plan can actually be finished.
  const answeredToday = (q: ExamQuestion) => q.attempts.some((a) => localDateKey(new Date(a.at)) === today);
  const done = subject.questions.filter(answeredToday);
  const learnedToday = done.filter((q) => questionScore(q) >= PASS_SCORE).length;
  const studyDays = daysLeft >= 3 ? daysLeft - 1 : daysLeft;
  const perDay = Math.ceil((pending.length + learnedToday) / studyDays);
  const todo = pending.filter((q) => !answeredToday(q));
  const left = Math.max(perDay - done.length, 0);
  return { daysLeft, remaining: pending.length, perDay, today: todo.slice(0, left), doneToday: done.length, more: todo.slice(left, left + MORE_PRACTICE), isReviewDay };
}

export interface TodayTask {
  subject: Subject;
  plan: SubjectPlan;
}

export interface TodayOverview {
  tasks: TodayTask[]; // upcoming exams, soonest first
  dueCards: number;
}

export function todayOverview(subjects: Subject[], sets: StudySet[], now: Date = new Date()): TodayOverview {
  const today = localDateKey(now);
  const tasks = subjects
    .map((subject) => ({ subject, plan: planSubject(subject, today) }))
    .filter((t) => t.plan.daysLeft >= 0)
    .sort((a, b) => a.plan.daysLeft - b.plan.daysLeft);
  const dueCards = sets.reduce((sum, s) => sum + (s.flashcards ? dueQueue(s.flashcards, now).length : 0), 0);
  return { tasks, dueCards };
}
