// Text from files sent to the bot. Office files are unzipped here; PDFs and
// photos are read by Gemini (counts against the user's daily AI limit).
import JSZip from 'npm:jszip@3.10.1';
import { bytesToBase64, callGemini } from './gemini.ts';

export type FileKind = 'pdf' | 'pptx' | 'docx' | 'text' | 'image';

export function kindOf(fileName: string, mime?: string): FileKind | null {
  const n = fileName.toLowerCase();
  if (n.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (n.endsWith('.pptx')) return 'pptx';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.txt') || n.endsWith('.md')) return 'text';
  if (mime?.startsWith('image/')) return 'image';
  return null;
}

// Gemini is only needed for these kinds
export const needsAi = (kind: FileKind) => kind === 'pdf' || kind === 'image';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()]
  );

// Same logic as officeXmlToText in src/lib/materials.ts
function officeXmlToText(xml: string, tag: string, para: string): string {
  const runRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g');
  return xml
    .split(`</${para}>`)
    .map((p) => Array.from(p.matchAll(runRe), (m) => decode(m[1])).join('').trim())
    .filter(Boolean)
    .join('\n');
}

const PROMPT_PDF =
  'Extract all text of this lecture document in reading order, keeping the original language. ' +
  'Before the text of each page write a marker like [Sahifa 3]. Keep headings, lists and formulas. Output only the text.';
const PROMPT_IMAGE =
  'Transcribe all text in this photo of study notes exactly as written, keeping the original language ' +
  '(often Uzbek Latin, Uzbek Cyrillic or Russian). Keep formulas, lists and headings. Output only the text.';

export async function extractText(kind: FileKind, bytes: Uint8Array, mime: string): Promise<string> {
  if (kind === 'text') return new TextDecoder().decode(bytes);
  if (kind === 'pptx' || kind === 'docx') {
    const zip = await JSZip.loadAsync(bytes);
    if (kind === 'docx') {
      const doc = zip.file('word/document.xml');
      return doc ? officeXmlToText(await doc.async('string'), 'w:t', 'w:p') : '';
    }
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
  return callGemini(
    [{ text: kind === 'pdf' ? PROMPT_PDF : PROMPT_IMAGE }, { inline_data: { mime_type: mime, data: bytesToBase64(bytes) } }],
    { temperature: 0 }
  );
}
