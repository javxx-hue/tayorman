// Getting a student's answer into the text box without typing it: from their voice, or from a photo of the
// paper they wrote it on. The text always lands in the box for the student to check before it is graded.
import { Language } from './i18n';
import { geminiGenerate } from './ai';
import { MATH_STYLE_RULE, plainMath } from './mathText';
import { blobToWav } from './audioWav';

const LANGUAGE: Record<Language, string> = { uz: "Uzbek (o'zbek tili, lotin yozuvi; Cyrillic only if the student used it)", ru: 'Russian' };

export const audioPrompt = (lang: Language) =>
  `This is a recording of a university student answering an exam question aloud. The language is ${LANGUAGE[lang]}. ` +
  `Write down exactly what the student said, with normal punctuation. Do not correct their mistakes, do not add or explain anything. ` +
  `${MATH_STYLE_RULE} If no words can be made out, output nothing.`;

export const handwritingPrompt = (lang: Language) =>
  `This is a photo of a university student's handwritten answer to an exam question. The language is ${LANGUAGE[lang]}. ` +
  `Transcribe all the text exactly as written, keeping the student's own wording, mistakes and line breaks. Do not correct or add anything. ` +
  `${MATH_STYLE_RULE} If nothing readable is written, output nothing.`;

// Models answer silence with tags like <noise> or [inaudible]; those are not an answer
export function cleanTranscript(raw: string): string {
  const text = raw
    .replace(/^```[a-z]*\n?|```$/gim, '')
    .replace(/<[^<>\n]{1,40}>|\[[^\]\n]{1,40}\]/g, (tag) => (/^[<[]\s*(noise|silence|inaudible|music|unintelligible|speech|no speech|nothing)/i.test(tag) ? '' : tag))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plainMath(text);
}

// The largest size that fits in a square of `max`, never enlarging
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Phone photos are several MB; the AI reads handwriting fine at this size and it is sent in seconds
async function shrinkImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not prepare the photo');
  return blob;
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export async function transcribeAudio(recording: Blob, lang: Language): Promise<string> {
  const wav = await blobToWav(recording);
  return cleanTranscript(await geminiGenerate([{ text: audioPrompt(lang) }, { inline_data: { mime_type: 'audio/wav', data: await toBase64(wav) } }], { temperature: 0, tier: 'fast' }));
}

export async function transcribeHandwriting(photo: Blob, lang: Language): Promise<string> {
  const small = await shrinkImage(photo);
  return cleanTranscript(await geminiGenerate([{ text: handwritingPrompt(lang) }, { inline_data: { mime_type: 'image/jpeg', data: await toBase64(small) } }], { temperature: 0, tier: 'fast' }));
}

// Worth sending to the AI grader: at least a few words. A single run of random letters is not graded
// (it used to cost an AI request and leave a confusing 0% behind).
export const MIN_ANSWER_WORDS = 3;
export function isGradable(answer: string): boolean {
  return answer.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length >= MIN_ANSWER_WORDS;
}
