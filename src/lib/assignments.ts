// Assignments (topshiriq): an admin gives a published subject or study set to groups with a deadline.
// The content arrives through the library (see library.ts); this file knows which assignments a
// student has, how far they got, and tells the server (never the other way round).
import { StudySet, Subject } from '../types';
import { supabase } from './supabase';
import { PASS_SCORE, questionScore } from './prep';
import { isMastered } from './srs';

export interface Assignment {
  id: string;
  title: string;
  note: string | null;
  library_item_id: string;
  due_at: string | null;
  created_at: string;
}

export type ProgressStatus = 'new' | 'started' | 'done';
export interface Progress {
  status: ProgressStatus;
  score: number | null;
}

export async function fetchAssignments(): Promise<Assignment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('assignments')
    .select('id, title, note, library_item_id, due_at, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function fetchServerProgress(): Promise<Record<string, Progress>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('assignment_progress').select('assignment_id, status, score');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.assignment_id as string, { status: r.status as ProgressStatus, score: (r.score as number | null) ?? null }]));
}

// The student's copy of what the assignment points at (matched through the library id)
export function localItem(a: Assignment, subjects: Subject[], sets: StudySet[]): { kind: 'subject'; item: Subject } | { kind: 'set'; item: StudySet } | null {
  const subject = subjects.find((s) => s.libraryId === a.library_item_id);
  if (subject) return { kind: 'subject', item: subject };
  const set = sets.find((s) => s.libraryId === a.library_item_id);
  return set ? { kind: 'set', item: set } : null;
}

const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

// Done means different things for different content:
//  subject: every question answered well enough (PASS_SCORE); quiz/exam: finished once;
//  flashcards: every card rated at least once.
export function progressOf(local: ReturnType<typeof localItem>): Progress {
  if (!local) return { status: 'new', score: null };

  if (local.kind === 'subject') {
    const qs = local.item.questions;
    if (!qs.length) return { status: 'new', score: null };
    const scores = qs.map(questionScore);
    const touched = qs.some((q) => q.attempts.length > 0);
    if (!touched) return { status: 'new', score: null };
    return { status: qs.every((q) => questionScore(q) >= PASS_SCORE) ? 'done' : 'started', score: average(scores) };
  }

  const set = local.item;
  if (set.type === 'flashcards') {
    const cards = set.flashcards ?? [];
    const rated = cards.filter((c) => c.srs).length;
    if (!cards.length || !rated) return { status: 'new', score: null };
    return { status: rated === cards.length ? 'done' : 'started', score: Math.round((cards.filter(isMastered).length / cards.length) * 100) };
  }
  return typeof set.lastScore === 'number' ? { status: 'done', score: set.lastScore } : { status: 'new', score: null };
}

// What to write to the server: only real progress, and a finished assignment never goes back
export function needsSync(now: Progress, server: Progress | undefined): boolean {
  if (now.status === 'new') return false;
  if (!server) return true;
  if (server.status === 'done' && now.status !== 'done') return false;
  return server.status !== now.status || server.score !== now.score;
}

export async function pushProgress(assignmentId: string, p: Progress): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('assignment_progress')
    .upsert({ assignment_id: assignmentId, status: p.status, score: p.score, updated_at: new Date().toISOString() }, { onConflict: 'assignment_id,user_id' });
  return !error;
}

export interface DueInfo {
  overdue: boolean;
  days: number; // whole days left (0 = today)
  hours: number; // hours left when under a day
}

export function dueInfo(dueAt: string, now = Date.now()): DueInfo {
  const ms = new Date(dueAt).getTime() - now;
  return { overdue: ms < 0, days: Math.max(Math.floor(ms / 86_400_000), 0), hours: Math.max(Math.ceil(ms / 3_600_000), 0) };
}
