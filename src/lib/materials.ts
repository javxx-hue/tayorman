// Turns uploaded lecture material into plain text with location markers
// ([Sahifa N], [Slayd N], [mm:ss]) that the AI cites in answers.
import { Material, MaterialKind } from '../types';
import { extractTextFromPdf } from './pdfParser';
import { geminiGenerate, GenerationError } from './ai';
import { extractYouTubeId } from './youtubeParser';
import { newId } from './storage';

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return XML_ENTITIES[e.toLowerCase()];
  });
}

// Text runs (<a:t> in slides, <w:t> in Word) grouped by paragraph
export function officeXmlToText(xml: string, tag: 'a:t' | 'w:t', paragraphTag: 'a:p' | 'w:p'): string {
  const runRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g');
  return xml
    .split(`</${paragraphTag}>`)
    .map((para) => Array.from(para.matchAll(runRe), (m) => decodeXml(m[1])).join(''))
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter((s) => s.n > 0)
    .sort((a, b) => a.n - b.n);

  const parts: string[] = [];
  for (const s of slides) {
    const text = officeXmlToText(await zip.file(s.name)!.async('string'), 'a:t', 'a:p');
    if (text) parts.push(`[Slayd ${s.n}]\n${text}`);
  }
  return parts.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file('word/document.xml');
  return doc ? officeXmlToText(await doc.async('string'), 'w:t', 'w:p') : '';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Photos of handwritten or printed notes, read by Gemini
async function extractImage(file: File): Promise<string> {
  const data = await fileToBase64(file);
  return geminiGenerate(
    [
      {
        text:
          'Transcribe all text in this photo of study notes exactly as written, keeping the original language ' +
          '(often Uzbek Latin, Uzbek Cyrillic or Russian). Keep formulas, lists and headings. ' +
          'Output only the transcribed text. If there is no readable text, output nothing.',
      },
      { inline_data: { mime_type: file.type || 'image/jpeg', data } },
    ],
    { temperature: 0 }
  );
}

// Gemini watches public YouTube videos directly, so no transcript scraping is needed
export async function extractYouTube(url: string): Promise<string> {
  const id = extractYouTubeId(url);
  if (!id) throw new GenerationError('EMPTY_SOURCE', 'Not a YouTube link.');
  return geminiGenerate(
    [
      { file_data: { file_uri: `https://www.youtube.com/watch?v=${id}` } },
      {
        text:
          'This is a lecture. Write detailed study notes of everything taught, in the language of the lecture, ' +
          'in order, as plain text. Start each new part with its timestamp like [12:30]. ' +
          'Include definitions, formulas, examples and lists. Do not add facts that are not in the video.',
      },
    ],
    { temperature: 0.2 }
  );
}

export const ACCEPTED_FILES = '.pdf,.pptx,.docx,.txt,.md,image/*';

export function kindForFile(file: File): MaterialKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.pptx')) return 'pptx';
  if (name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.md')) return 'text';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

export async function materialFromFile(file: File): Promise<Material> {
  const kind = kindForFile(file);
  if (!kind) throw new GenerationError('EMPTY_SOURCE', `Unsupported file: ${file.name}`);

  const lower = file.name.toLowerCase();
  const text =
    kind === 'pdf' ? await extractTextFromPdf(file)
    : kind === 'pptx' ? await extractPptx(file)
    : kind === 'image' ? await extractImage(file)
    : lower.endsWith('.docx') ? await extractDocx(file)
    : await file.text();

  if (!text.trim()) throw new GenerationError('EMPTY_SOURCE', `No text found in ${file.name}`);
  return { id: newId('mat'), name: file.name, kind, text: text.trim(), createdAt: Date.now() };
}

export async function materialFromYouTube(url: string, title?: string): Promise<Material> {
  const text = await extractYouTube(url);
  if (!text.trim()) throw new GenerationError('EMPTY_SOURCE', 'No content extracted from video.');
  return { id: newId('mat'), name: title || url, kind: 'youtube', text: text.trim(), createdAt: Date.now() };
}

// All materials of a subject as one prompt context, each under its file name,
// trimmed to fit (Gemini Flash handles long context, but cost grows with size)
export function buildMaterialContext(materials: Material[], maxChars = 120_000): string {
  let out = '';
  for (const m of materials) {
    const block = `=== ${m.name} ===\n${m.text}\n\n`;
    if (out.length + block.length > maxChars) {
      out += block.slice(0, Math.max(0, maxChars - out.length));
      break;
    }
    out += block;
  }
  return out.trim();
}
