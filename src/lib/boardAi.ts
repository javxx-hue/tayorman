// A student's own question to the board's teacher, answered by AI and written up on the board.
// Only for students the admin chose (profiles.board_ai); it uses the student's usual daily AI limit.
import { ExamQuestion } from '../types';
import { Language } from './i18n';
import { BoardStep } from './board';
import { geminiGenerate, parseJson } from './ai';

const MAX_LINES = 6;
const MAX_POINTS = 3;
const MAX_TEXT = 300;
export const MAX_ASK = 300;

export function boardAskPrompt(question: ExamQuestion, ask: string, lang: Language): string {
  const answer = question.modelAnswer;
  return [
    lang === 'uz'
      ? "Sen universitet o'qituvchisisan va doskada tushuntirasan. Javobni o'zbek tilida (lotin), sodda va qisqa yoz."
      : 'Ты преподаватель университета и объясняешь у доски. Отвечай по-русски, просто и коротко.',
    `Imtihon savoli: ${question.text}`,
    answer ? `Namunaviy javob: ${answer.summary}` : '',
    `Talabaning savoli: ${ask.trim().slice(0, MAX_ASK)}`,
    `Faqat JSON qaytar: {"lines": [...], "points": [...]}. "lines" — tushuntirish, har biri bitta qisqa gap, ko'pi bilan ${MAX_LINES} ta. "points" — eslab qolish uchun ko'pi bilan ${MAX_POINTS} ta qisqa fikr. Savol fanga aloqasiz bo'lsa, bitta qatorda shuni ayt.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// The AI's answer as board steps, under the student's question as the title
export function parseBoardAnswer(raw: string, ask: string): BoardStep[] {
  const data = parseJson<{ lines?: unknown; points?: unknown }>(raw);
  const clean = (v: unknown, max: number): string[] =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, max)
      .map((x) => x.trim().slice(0, MAX_TEXT));
  const lines = clean(data?.lines, MAX_LINES);
  if (lines.length === 0) throw new Error('empty board answer');
  return [
    { kind: 'title', text: ask.trim().slice(0, MAX_ASK) },
    ...lines.map((text) => ({ kind: 'line' as const, text })),
    ...clean(data?.points, MAX_POINTS).map((text) => ({ kind: 'point' as const, text })),
  ];
}

export async function askBoard(question: ExamQuestion, ask: string, lang: Language): Promise<BoardStep[]> {
  const raw = await geminiGenerate([{ text: boardAskPrompt(question, ask, lang) }], { json: true, temperature: 0.3 });
  return parseBoardAnswer(raw, ask);
}
