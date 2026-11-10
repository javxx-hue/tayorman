// Mirrors localStorage to Supabase for signed-in users, so study data
// survives a cleared browser and follows the student to another device.
// localStorage stays the source the UI reads from; this only copies.
import { supabase } from './supabase';
import { StudySet, Subject } from '../types';
import { getStudySets, getSubjects, saveStudySet, saveSubject, onLocalChange, LocalChange } from './storage';
import { getAllProgress, getProgress, mergeProgress, onProgressChange, saveProgress, SetProgress } from './quizProgress';

type Doc = { id: string };
type Table = 'study_sets' | 'subjects';

const stampSet = (s: StudySet) => s.updatedAt ?? s.createdAt;
const stampSubject = (s: Subject) => s.updatedAt;

// Newer copy wins per id; items only on one side are copied to the other.
export function mergeById<T extends Doc>(local: T[], remote: T[], stamp: (x: T) => number): { toLocal: T[]; toRemote: T[] } {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((l) => l.id));
  const toLocal: T[] = remote.filter((r) => !localIds.has(r.id));
  const toRemote: T[] = [];
  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r || stamp(l) > stamp(r)) toRemote.push(l);
    else if (stamp(r) > stamp(l)) toLocal.push(r);
  }
  return { toLocal, toRemote };
}

async function pull<T>(table: Table): Promise<T[]> {
  const { data, error } = await supabase!.from(table).select('data');
  if (error) throw error;
  return (data ?? []).map((row: { data: T }) => row.data);
}

async function push(table: Table, docs: Doc[]): Promise<void> {
  if (!docs.length) return;
  const rows = docs.map((d) => ({ id: d.id, data: d, updated_at: new Date().toISOString() }));
  const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw error;
}

async function remove(table: Table, id: string): Promise<void> {
  const { error } = await supabase!.from(table).delete().eq('id', id);
  if (error) throw error;
}

async function pushProgress(setKey: string, data: SetProgress): Promise<void> {
  const { error } = await supabase!.from('quiz_progress').upsert({ set_key: setKey, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,set_key' });
  if (error) throw error;
}

// Both sides keep every answer: per set, merge this phone with the cloud and write back only what changed
async function syncAllProgress(): Promise<void> {
  const { data, error } = await supabase!.from('quiz_progress').select('set_key, data');
  if (error) throw error;
  const remote = new Map((data ?? []).map((r: { set_key: string; data: SetProgress }) => [r.set_key, r.data]));
  const local = getAllProgress();
  for (const key of new Set([...remote.keys(), ...Object.keys(local)])) {
    const merged = mergeProgress(local[key] ?? {}, remote.get(key) ?? {});
    const text = JSON.stringify(merged);
    if (text !== JSON.stringify(local[key] ?? {})) saveProgress(key, merged, { fromSync: true });
    if (text !== JSON.stringify(remote.get(key) ?? {})) await pushProgress(key, merged);
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// Starts syncing for the signed-in user; returns a stop function.
export function startSync(onStatus: (status: SyncStatus) => void): () => void {
  if (!supabase) return () => {};
  let stopped = false;
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>();

  const run = async (task: () => Promise<void>) => {
    onStatus('syncing');
    try {
      await task();
      if (!stopped) onStatus('synced');
    } catch (e) {
      console.error('Sync failed', e);
      if (!stopped) onStatus('error');
    }
  };

  // Initial two-way merge
  run(async () => {
    const [remoteSets, remoteSubjects] = await Promise.all([pull<StudySet>('study_sets'), pull<Subject>('subjects')]);
    if (stopped) return;
    const sets = mergeById(getStudySets(), remoteSets, stampSet);
    const subjects = mergeById(getSubjects(), remoteSubjects, stampSubject);
    sets.toLocal.forEach((s) => saveStudySet(s, { fromSync: true }));
    subjects.toLocal.forEach((s) => saveSubject(s, { fromSync: true }));
    await Promise.all([push('study_sets', sets.toRemote), push('subjects', subjects.toRemote)]);
    await syncAllProgress();
  });

  // Then mirror every local write, debounced per document (flashcard reviews write often)
  const unsubscribe = onLocalChange((change: LocalChange) => {
    const table: Table = change.kind === 'set' ? 'study_sets' : 'subjects';
    const id = change.op === 'delete' ? change.id : change.value.id;
    const key = `${table}:${id}`;
    const send = () => {
      pending.delete(key);
      if (change.op === 'delete') run(() => remove(table, id));
      else run(() => push(table, [change.value]));
    };
    const previous = pending.get(key);
    if (previous) clearTimeout(previous.timer);
    pending.set(key, { timer: setTimeout(send, 1500), send });
  });

  // Test progress: one small row per set, written a few seconds after the last answer
  const unsubscribeProgress = onProgressChange((setKey) => {
    const key = `quiz_progress:${setKey}`;
    const send = () => {
      pending.delete(key);
      run(() => pushProgress(setKey, getProgress(setKey)));
    };
    const previous = pending.get(key);
    if (previous) clearTimeout(previous.timer);
    pending.set(key, { timer: setTimeout(send, 3000), send });
  });

  // Don't lose debounced writes when the tab is closed or hidden
  const flush = () => pending.forEach(({ timer, send }) => (clearTimeout(timer), send()));
  const onHide = () => document.visibilityState === 'hidden' && flush();
  document.addEventListener('visibilitychange', onHide);

  return () => {
    flush();
    stopped = true;
    unsubscribe();
    unsubscribeProgress();
    document.removeEventListener('visibilitychange', onHide);
  };
}


// Writes one document right away. The bot reads subjects from the database, so
// the Mini App uses this before asking the bot to act on a subject.
export async function pushNow(kind: 'set' | 'subject', doc: StudySet | Subject): Promise<void> {
  if (!supabase) return;
  await push(kind === 'set' ? 'study_sets' : 'subjects', [doc]);
}
