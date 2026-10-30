import { StudySet, UserStats, Language, Subject } from '../types';

const STORAGE_KEYS = {
  SETS: 'tayyorman_study_sets',
  SUBJECTS: 'tayyorman_subjects',
  STATS: 'tayyorman_user_stats',
  LANG: 'tayyorman_language',
  THEME: 'tayyorman_theme',
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

// Clean fresh new user stats
const defaultStats: UserStats = {
  streakDays: 0,
  lastStudyDate: '',
  quizzesTaken: 0,
  cardsMastered: 0,
  totalStudyMinutes: 0,
  averageScore: 0,
};

// Initialize default data if empty (fresh start)
export function initStorage(): void {
  if (typeof window === 'undefined') return;
  
  if (localStorage.getItem(STORAGE_KEYS.SETS) === null) {
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify([]));
  }
  if (localStorage.getItem(STORAGE_KEYS.STATS) === null) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(defaultStats));
  }
}

// Reset to a brand new clean account
export function resetToFreshState(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(defaultStats));
  notifyListeners();
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

export class StorageFullError extends Error {
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

export function deleteStudySet(id: string, opts: { fromSync?: boolean } = {}): void {
  writeJson(STORAGE_KEYS.SETS, getStudySets().filter((s) => s.id !== id));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'set', op: 'delete', id }));
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

export function deleteSubject(id: string, opts: { fromSync?: boolean } = {}): void {
  writeJson(STORAGE_KEYS.SUBJECTS, getSubjects().filter((s) => s.id !== id));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'subject', op: 'delete', id }));
  notifyListeners();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStudySetById(id: string): StudySet | undefined {
  const sets = getStudySets();
  return sets.find((s) => s.id === id);
}

// User Stats & Streak
export function getUserStats(): UserStats {
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    if (!raw) return defaultStats;
    return JSON.parse(raw);
  } catch {
    return defaultStats;
  }
}

// Calendar day in the user's own time zone (toISOString would use UTC,
// which shifts the day for students in UTC+5 studying after midnight)
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextStreak(lastStudyDate: string, streakDays: number, today: string): number {
  if (lastStudyDate === today) return Math.max(streakDays, 1);
  if (!lastStudyDate) return 1;
  const diffDays = Math.round((Date.parse(today) - Date.parse(lastStudyDate)) / 86_400_000);
  return diffDays === 1 ? streakDays + 1 : 1;
}

function withStudyDay(stats: UserStats): UserStats {
  const today = localDateKey();
  return { ...stats, streakDays: nextStreak(stats.lastStudyDate, stats.streakDays, today), lastStudyDate: today };
}

export function recordQuizCompletion(scorePercentage: number, questionsCount: number, set?: StudySet): void {
  // Keep the latest result on the set itself; subject readiness reads it
  if (set) saveStudySet({ ...set, lastScore: scorePercentage, completedAt: Date.now() });
  const stats = withStudyDay(getUserStats());
  const updatedStats: UserStats = {
    ...stats,
    quizzesTaken: stats.quizzesTaken + 1,
    averageScore: Math.round((stats.averageScore * stats.quizzesTaken + scorePercentage) / (stats.quizzesTaken + 1)),
    totalStudyMinutes: stats.totalStudyMinutes + Math.ceil(questionsCount * 1.5),
  };
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
  notifyListeners();
}

// Flashcard reviews count toward the streak too
export function recordStudyActivity(): void {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(withStudyDay(getUserStats())));
  notifyListeners();
}

// Language
export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'uz';
  return (localStorage.getItem(STORAGE_KEYS.LANG) as Language) || 'uz';
}

export function setSavedLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LANG, lang);
  notifyListeners();
}

// Theme
export function getSavedTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
}

export function setSavedTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  notifyListeners();
}

// -------------------------------------------------------------
// Data Export & Import Helpers
// -------------------------------------------------------------
export function exportSetsToJson(): void {
  const sets = getStudySets();
  const blob = new Blob([JSON.stringify(sets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quizpilot-study-sets-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSetsFromJson(jsonContent: string): { success: boolean; count: number } {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) return { success: false, count: 0 };

    const current = getStudySets();
    const currentIds = new Set(current.map((s) => s.id));
    
    // Add new sets
    const newSets = parsed.filter((s) => s.id && !currentIds.has(s.id));
    const merged = [...newSets, ...current];
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(merged));
    notifyListeners();
    return { success: true, count: newSets.length };
  } catch {
    return { success: false, count: 0 };
  }
}

export function exportFlashcardsToCsv(set: StudySet): void {
  if (!set.flashcards || set.flashcards.length === 0) return;
  
  const rows = set.flashcards.map((fc) => {
    const front = `"${(fc.front || '').replace(/"/g, '""')}"`;
    const back = `"${(fc.back || '').replace(/"/g, '""')}"`;
    return `${front},${back}`;
  });

  const csvContent = 'Front,Back\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.title.replace(/\s+/g, '-').toLowerCase()}-anki-cards.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
