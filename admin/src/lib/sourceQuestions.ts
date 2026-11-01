// Exam questions from a subject's lecture files: take the list a document already contains, or have the AI write one.
import { geminiGenerate, parseJson } from '../../../src/lib/ai';
import { buildMaterialContext } from '../../../src/lib/materials';
import { Material } from '../../../src/types';

export type Mode = 'extract' | 'generate';
interface Options {
  mode: Mode;
  count: number;
  language: 'uz' | 'ru';
}

const LANGUAGE = { uz: "Uzbek (o'zbek tili, lotin yozuvi)", ru: 'Russian' };

export function buildPrompt(material: string, { mode, count, language }: Options): string {
  const task =
    mode === 'extract'
      ? `The material below may contain a list of exam questions (numbered or not). Return those questions exactly as written, in the order given, without answers and without numbers. If the material contains no list of questions, return an empty list. Do not invent questions.`
      : `Write ${count} exam questions that a teacher could ask on this material. Cover its main topics, one question each, in ${LANGUAGE[language]}. Use only what the material supports. Do not add answers or numbers.`;
  return `You prepare university exam materials.\n${task}\n\nReturn strict JSON: { "questions": ["...", "..."] }\n\nMATERIAL:\n${material}`;
}

// Only real questions: strings of a sensible length, no duplicates, no leading numbers or bullets
export function parseQuestions(raw: string): string[] {
  const list = (parseJson(raw) as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const text = item.replace(/^\s*(?:[-•*–]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();
    if (text.length < 5 || text.length > 500 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

export async function questionsFromMaterials(materials: Material[], options: Options): Promise<string[]> {
  const raw = await geminiGenerate([{ text: buildPrompt(buildMaterialContext(materials), options) }], { json: true, temperature: options.mode === 'extract' ? 0 : 0.4 });
  return parseQuestions(raw);
}
