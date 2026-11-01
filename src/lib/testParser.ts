import { QuizQuestion } from '../types';
import { newId } from './storage';

/**
 * Parses raw text from Word, TXT, or Hemis exam question files into QuizQuestion objects.
 * Supports:
 * - Hemis standard: Question line followed by 4 options (one starting with +)
 * - A/B/C/D option blocks with explicit "Javob: X" or "+A)"
 * - Separators: double newlines, '====', or '----'
 */
export interface ParsedQuestions {
  questions: QuizQuestion[];
  skipped: number; // looked like a question but had no marked correct answer
}

export function parseExamQuestionsFromText(raw: string): ParsedQuestions {
  if (!raw || !raw.trim()) return { questions: [], skipped: 0 };

  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into candidate blocks by separators or double newlines
  const blocks = normalized
    .split(/\n\s*(?:={3,}|-{3,}|\+{3,})\s*\n|\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions: QuizQuestion[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) continue;

    // Check if any line has an explicit marker
    const hasPlusMarker = lines.some((l) => l.startsWith('+'));
    const hasLetterMarker = lines.some((l) => /^[A-Da-d][\)\.]/.test(l));

    let qText = '';
    const rawOptions: { text: string; isCorrect: boolean }[] = [];

    if (hasPlusMarker && !hasLetterMarker) {
      // Hemis style: First line is question, remaining lines are options (one marked with +)
      qText = lines[0].replace(/^(?:№\s*)?\d+[\.\)\s-]+\s*/, '').trim();
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const isCorrect = line.startsWith('+');
        const text = line.replace(/^\+\s*/, '').trim();
        if (text) {
          rawOptions.push({ text, isCorrect });
        }
      }
    } else {
      // Standard or Lettered style (A, B, C, D or Javob: X)
      let inOptions = false;
      let explicitCorrectLetter: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for "Javob: C"
        const ansMatch = line.match(/^(?:To'?g'?ri\s+)?javob\s*:\s*([A-Da-d0-9\+]+)/i);
        if (ansMatch) {
          explicitCorrectLetter = ansMatch[1].toUpperCase();
          continue;
        }

        // Check for +A) or +Option
        if (line.startsWith('+')) {
          inOptions = true;
          const text = line.replace(/^\+\s*(?:[A-Da-d0-9][\)\.]\s*)?/, '').trim();
          rawOptions.push({ text, isCorrect: true });
          continue;
        }

        // Check for A) or A. option
        const letterMatch = line.match(/^([A-Da-d])[\)\.]\s*(.*)$/);
        if (letterMatch && (inOptions || i >= 1)) {
          inOptions = true;
          rawOptions.push({ text: letterMatch[2].trim(), isCorrect: false });
          continue;
        }

        if (!inOptions && i === 0) {
          const cleaned = line.replace(/^(?:№\s*)?\d+[\.\)\s-]+\s*/, '').trim();
          qText = cleaned;
        } else if (!inOptions && !line.endsWith('?') && lines[i - 1]?.endsWith('?')) {
          inOptions = true;
          rawOptions.push({ text: line, isCorrect: false });
        } else if (!inOptions) {
          qText = qText ? `${qText} ${line}` : line;
        } else {
          rawOptions.push({ text: line, isCorrect: false });
        }
      }

      if (explicitCorrectLetter) {
        const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
        const idx = letterMap[explicitCorrectLetter];
        if (idx !== undefined && rawOptions[idx]) {
          rawOptions.forEach((o, i) => (o.isCorrect = i === idx));
        }
      }
    }

    if (qText && rawOptions.length >= 2) {
      // Never guess: a question without a marked answer would teach students something wrong
      const correctIdx = rawOptions.findIndex((o) => o.isCorrect);
      if (correctIdx < 0) {
        skipped++;
        continue;
      }

      questions.push({
        id: newId('q'),
        question: qText,
        options: rawOptions.map((o) => o.text),
        correctAnswer: correctIdx,
        hint: '',
        explanation: `To'g'ri javob: ${rawOptions[correctIdx]?.text || ''}`,
      });
    }
  }

  return { questions, skipped };
}
