import { StudySet, Subject } from '../types';

const STORAGE_KEYS = {
  SETS: 'sessiyagatayyorlan_study_sets',
  SUBJECTS: 'sessiyagatayyorlan_subjects',
  LANG: 'sessiyagatayyorlan_language',
};

// Listeners for reactive updates
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeStorage(callback: StorageListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Initialize default data if empty (fresh start)
export function initStorage(): void {
  if (typeof window === 'undefined') return;
  
  // Migrate legacy keys if present
  if (localStorage.getItem(STORAGE_KEYS.SETS) === null && localStorage.getItem('tayyorman_study_sets')) {
    localStorage.setItem(STORAGE_KEYS.SETS, localStorage.getItem('tayyorman_study_sets')!);
  }
  if (localStorage.getItem(STORAGE_KEYS.SUBJECTS) === null && localStorage.getItem('tayyorman_subjects')) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, localStorage.getItem('tayyorman_subjects')!);
  }
  if (localStorage.getItem(STORAGE_KEYS.LANG) === null && localStorage.getItem('tayyorman_language')) {
    localStorage.setItem(STORAGE_KEYS.LANG, localStorage.getItem('tayyorman_language')!);
  }

  if (localStorage.getItem(STORAGE_KEYS.SETS) === null) {
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify([]));
  }
  if (localStorage.getItem(STORAGE_KEYS.SUBJECTS) === null) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
  }
}

// Study Sets
export function getStudySets(): StudySet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse study sets from storage', e);
    return [];
  }
}

// Local writes are reported here so the cloud sync (lib/sync.ts) can mirror them
export type LocalChange =
  | { kind: 'set'; op: 'upsert'; value: StudySet }
  | { kind: 'subject'; op: 'upsert'; value: Subject }
  | { kind: 'set' | 'subject'; op: 'delete'; id: string };

const changeHooks = new Set<(change: LocalChange) => void>();

export function onLocalChange(fn: (change: LocalChange) => void): () => void {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full');
    this.name = 'StorageFullError';
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new StorageFullError();
    throw e;
  }
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index < 0) return [item, ...list];
  const copy = [...list];
  copy[index] = item;
  return copy;
}

export function saveStudySet(set: StudySet, opts: { fromSync?: boolean } = {}): void {
  const value = opts.fromSync ? set : { ...set, updatedAt: Date.now() };
  writeJson(STORAGE_KEYS.SETS, upsertById(getStudySets(), value));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'set', op: 'upsert', value }));
  notifyListeners();
}

// Subjects (fan): materials + exam question list
export function getSubjects(): Subject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSubjectById(id: string): Subject | undefined {
  return getSubjects().find((s) => s.id === id);
}

export function saveSubject(subject: Subject, opts: { fromSync?: boolean } = {}): void {
  const value = opts.fromSync ? subject : { ...subject, updatedAt: Date.now() };
  writeJson(STORAGE_KEYS.SUBJECTS, upsertById(getSubjects(), value));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'subject', op: 'upsert', value }));
  notifyListeners();
}

// Removed from the device and, through the sync hook, from the cloud copy too
export function deleteStudySet(id: string): void {
  writeJson(STORAGE_KEYS.SETS, getStudySets().filter((s) => s.id !== id));
  changeHooks.forEach((fn) => fn({ kind: 'set', op: 'delete', id }));
  notifyListeners();
}

export function deleteSubject(id: string): void {
  writeJson(STORAGE_KEYS.SUBJECTS, getSubjects().filter((s) => s.id !== id));
  changeHooks.forEach((fn) => fn({ kind: 'subject', op: 'delete', id }));
  notifyListeners();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Calendar day in the user's own time zone (toISOString would use UTC,
// which shifts the day for students in UTC+5 studying after midnight)
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The latest result of a whole test set is kept on the set; subject readiness reads it
export function recordQuizCompletion(scorePercentage: number, set: StudySet): void {
  saveStudySet({ ...set, lastScore: scorePercentage, completedAt: Date.now() });
}
