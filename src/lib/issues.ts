// A student tells the admin that a question or an answer in a test looks wrong.
import { supabase } from './supabase';

export interface IssueInput {
  libraryId?: string; // the admin's library item the student's copy came from
  context: string; // the subject or test it happened in
  questionText: string;
  note: string;
}

export class IssueLimitError extends Error {}

const clip = (s: string, max: number) => s.trim().slice(0, max);

// The row as the table accepts it (lengths are limited there)
export function issueRow(input: IssueInput) {
  return {
    library_item_id: input.libraryId ?? null,
    context: clip(input.context, 300),
    question_text: clip(input.questionText, 1000),
    note: clip(input.note, 1000),
  };
}

export async function reportIssue(input: IssueInput): Promise<void> {
  if (!supabase) throw new Error('offline');
  const { error } = await supabase.from('issue_reports').insert(issueRow(input));
  if (error) {
    // The daily-limit trigger says "daily limit reached"
    if (/limit/i.test(error.message)) throw new IssueLimitError();
    throw error;
  }
}
