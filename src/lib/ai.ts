import { StudySet, StudySetType, Difficulty, Language, QuizQuestion, Flashcard } from '../types';
import { supabase } from './supabase';
import { MATH_STYLE_RULE, plainMath } from './mathText';

export interface GenerationParams {
  rawContent: string;
  sourceType: 'text' | 'pdf' | 'prompt' | 'topic';
  targetType: StudySetType;
  title?: string;
  count?: number;
  difficulty?: Difficulty;
  language?: Language;
}

export type GenerationErrorCode = 'NO_API_KEY' | 'API_ERROR' | 'BAD_RESPONSE' | 'EMPTY_SOURCE' | 'LIMIT_REACHED' | 'NOT_AN_ANSWER';

export class GenerationError extends Error {
  constructor(public code: GenerationErrorCode, message: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }; // base64 image

export interface GeminiOptions {
  json?: boolean;
  temperature?: number;
  tier?: 'fast' | 'smart'; // fast: grading and reading speech or handwriting; smart (default): writing tests and answers
}

// The key lives on the server (Edge Function "gemini"); each student has a daily limit.
export async function geminiGenerate(parts: GeminiPart[], opts: GeminiOptions = {}): Promise<string> {
  // Mini App: AI always goes through the server (key stays there, daily limit applies)
  if (!supabase) throw new GenerationError('NO_API_KEY', 'AI service is not configured.');
  const { data, error } = await supabase.functions.invoke('gemini', { body: { parts, ...opts } });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 429) throw new GenerationError('LIMIT_REACHED', 'Daily AI limit reached.');
    throw new GenerationError('API_ERROR', `Gemini proxy: ${error.message}`);
  }
  if (!data?.text) throw new GenerationError('BAD_RESPONSE', 'Gemini returned an empty response.');
  return data.text;
}


export function parseJson<T = any>(raw: string): T {
  try {
    return JSON.parse(raw);
  } catch {
    // Models occasionally wrap JSON in ```json fences
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        /* fall through */
      }
    }
    throw new GenerationError('BAD_RESPONSE', 'Gemini response is not valid JSON.');
  }
}

function buildPrompt(params: GenerationParams): string {
  const { rawContent, sourceType, targetType, title, count = 5, difficulty = 'medium', language = 'uz' } = params;
  const grounding =
    sourceType === 'topic'
      ? 'The source below is only a topic name. Use well-established textbook knowledge and avoid uncertain claims.'
      : 'Use ONLY the source material below. Do not invent facts that are not supported by it. When the source has [Sahifa N] markers, mention the page in explanations.';
  return `
You are an educational assistant helping university students prepare for exams.
${grounding}

${MATH_STYLE_RULE}

Language: ${language === 'uz' ? "Uzbek (O'zbek tili, lotin yozuvi)" : 'Russian (русский язык)'}
Target Type: ${targetType}
Difficulty: ${difficulty}
Count: ${count}
Title: ${title || 'Infer an appropriate concise title'}

Source Material:
"""
${rawContent.slice(0, 20000)}
"""

Output MUST be strict valid JSON matching one of these formats:

If targetType is "quiz" or "exam":
{
  "title": "Set title",
  "description": "Short description of the quiz",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "hint": "Helpful hint without revealing the answer",
      "explanation": "Why this answer is correct",
      "source": "Where in the source this comes from, e.g. Sahifa 3 (omit if unknown)"
    }
  ]
}
"correctAnswer" is the 0-based index of the correct option. Vary its position across questions.

If targetType is "flashcards":
{
  "title": "Deck title",
  "description": "Short description",
  "flashcards": [
    { "front": "Term / Question", "back": "Clear definition / Answer", "example": "Example from the source", "source": "e.g. Sahifa 3 (omit if unknown)" }
  ]
}
`;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function parseQuestions(raw: unknown, now: number): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (q: any) =>
        isNonEmptyString(q?.question) &&
        Array.isArray(q?.options) &&
        q.options.length >= 2 &&
        q.options.every(isNonEmptyString) &&
        Number.isInteger(q?.correctAnswer) &&
        q.correctAnswer >= 0 &&
        q.correctAnswer < q.options.length
    )
    .map((q: any, i: number) => ({
      id: `q-${now}-${i}`,
      question: plainMath(q.question),
      options: q.options.map(plainMath),
      correctAnswer: q.correctAnswer,
      hint: isNonEmptyString(q.hint) ? plainMath(q.hint) : '',
      explanation: isNonEmptyString(q.explanation) ? plainMath(q.explanation) : '',
      source: isNonEmptyString(q.source) ? q.source : undefined,
    }));
}

function parseFlashcards(raw: unknown, now: number): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((fc: any) => isNonEmptyString(fc?.front) && isNonEmptyString(fc?.back))
    .map((fc: any, i: number) => ({
      id: `fc-${now}-${i}`,
      front: plainMath(fc.front),
      back: plainMath(fc.back),
      example: isNonEmptyString(fc.example) ? plainMath(fc.example) : undefined,
      source: isNonEmptyString(fc.source) ? fc.source : undefined,
    }));
}

// -------------------------------------------------------------
// Main entry point. Throws GenerationError instead of faking results.
// -------------------------------------------------------------
export async function generateStudySet(params: GenerationParams): Promise<StudySet> {
  const { rawContent, targetType, title, difficulty = 'medium', sourceType } = params;

  if (!rawContent.trim()) {
    throw new GenerationError('EMPTY_SOURCE', 'Source material is empty.');
  }

  const parsed: any = parseJson(await geminiGenerate([{ text: buildPrompt(params) }], { json: true }));

  const now = Date.now();
  const base = {
    id: `set-${now}`,
    title: isNonEmptyString(parsed.title) ? parsed.title : title || 'AI Generated Set',
    type: targetType,
    description: isNonEmptyString(parsed.description) ? parsed.description : '',
    createdAt: now,
    difficulty,
    sourceType,
    sourceSnippet: rawContent.slice(0, 200),
  };

  if (targetType === 'quiz' || targetType === 'exam') {
    const questions = parseQuestions(parsed.questions, now);
    if (questions.length === 0) throw new GenerationError('BAD_RESPONSE', 'No valid questions in response.');
    return { ...base, itemCount: questions.length, questions };
  }

  const flashcards = parseFlashcards(parsed.flashcards, now);
  if (flashcards.length === 0) throw new GenerationError('BAD_RESPONSE', 'No valid flashcards in response.');
  return { ...base, itemCount: flashcards.length, flashcards };
}

export function describeGenerationError(error: unknown, lang: Language): string {
  const isUz = lang === 'uz';
  const code = error instanceof GenerationError ? error.code : 'API_ERROR';
  switch (code) {
    case 'NO_API_KEY':
      return isUz
        ? 'Gemini API kaliti kiritilmagan. Yuqoridagi kalit belgisini bosib, kalitni kiriting.'
        : 'Сервис ИИ не настроен. Сообщите администратору.';
    case 'NOT_AN_ANSWER':
      return isUz ? "Bu javobga o'xshamaydi, shuning uchun baholanmadi. Savolga o'z so'zlaringiz bilan javob yozing." : 'Это не похоже на ответ, поэтому оценки нет. Напишите ответ своими словами.';
    case 'EMPTY_SOURCE':
      return isUz ? 'Manbadan matn olinmadi. Boshqa fayl yoki matn bilan urinib ko\'ring.' : 'Не удалось извлечь текст из источника.';
    case 'LIMIT_REACHED':
      return isUz ? 'Bugungi AI limiti tugadi. Ertaga yana urinib ko\'ring.' : 'Дневной лимит ИИ исчерпан. Попробуйте завтра.';
    case 'BAD_RESPONSE':
      return isUz ? 'AI javobi noto\'g\'ri formatda keldi. Qayta urinib ko\'ring.' : 'ИИ вернул некорректный ответ. Попробуйте ещё раз.';
    default:
      return isUz ? 'AI xizmatiga ulanib bo\'lmadi. Kalit va internetni tekshiring.' : 'Не удалось связаться с ИИ. Проверьте интернет и попробуйте ещё раз.';
  }
}
