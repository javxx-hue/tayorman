// Admin library: subjects and study sets the admin publishes to an audience.
// Students create nothing: published items arrive in their app on their own and stay up to date.
// Their progress stays private and survives an update.
import { StudySet, Subject } from '../types';
import { supabase } from './supabase';
import { track } from './track';
import { deleteStudySet, deleteSubject, getStudySets, getSubjects, saveStudySet, saveSubject, newId } from './storage';

export interface LibraryItem {
  id: string;
  kind: 'subject' | 'set';
  source_id: string;
  title: string;
  data: Subject | StudySet;
  audience_all: boolean;
  community_ids: string[];
  published: boolean;
  updated_at: string;
}

// Throws when it cannot ask: an empty answer must mean "nothing is published for you", never "no connection"
export async function fetchLibrary(): Promise<LibraryItem[]> {
  if (!supabase) throw new Error('offline');
  const { data, error } = await supabase.from('library_items').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LibraryItem[];
}

// Progress (attempts, card schedule, scores) never travels with a published copy
export function stripProgress(doc: Subject | StudySet, kind: 'subject' | 'set'): Subject | StudySet {
  if (kind === 'subject') {
    const s = doc as Subject;
    return { ...s, questions: s.questions.map((q) => ({ ...q, attempts: [] })) };
  }
  const set = doc as StudySet;
  return {
    ...set,
    lastScore: undefined,
    completedAt: undefined,
    flashcards: set.flashcards?.map(({ srs, rating, ...card }) => card),
  };
}

export interface PublishInput {
  kind: 'subject' | 'set';
  doc: Subject | StudySet;
  audienceAll: boolean;
  communityIds: string[];
  published: boolean;
}

// Returns the library item's id (a new one for something published for the first time)
export async function publishToLibrary(input: PublishInput): Promise<string> {
  if (!supabase) throw new Error('offline');
  const title = 'name' in input.doc ? input.doc.name : input.doc.title;
  const { data, error } = await supabase.from('library_items').upsert(
    {
      kind: input.kind,
      source_id: input.doc.id,
      title,
      data: stripProgress(input.doc, input.kind),
      audience_all: input.audienceAll,
      community_ids: input.audienceAll ? [] : input.communityIds,
      published: input.published,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'kind,source_id' }
  ).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function unpublish(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('library_items').delete().eq('id', id);
  if (error) throw error;
}

// Puts one library item into the student's data: a new copy, or a refresh of the existing
// copy when the admin changed it. Attempts, scores and card schedules are kept.
export function deliver(item: LibraryItem, subjects: Subject[], sets: StudySet[]): 'new' | 'updated' | null {
  const now = Date.now();
  if (item.kind === 'subject') {
    const incoming = item.data as Subject;
    const own = subjects.find((s) => s.libraryId === item.id);
    if (own?.libraryUpdatedAt === item.updated_at) return null;
    saveSubject({
      ...incoming,
      id: own?.id ?? newId('sub'),
      libraryId: item.id,
      libraryUpdatedAt: item.updated_at,
      createdAt: own?.createdAt ?? now,
      updatedAt: now,
      questions: incoming.questions.map((q) => {
        const old = own?.questions.find((o) => o.id === q.id);
        return old ? { ...q, attempts: old.attempts } : q;
      }),
    });
    return own ? 'updated' : 'new';
  }
  const incoming = item.data as StudySet;
  const own = sets.find((s) => s.libraryId === item.id);
  if (own?.libraryUpdatedAt === item.updated_at) return null;
  saveStudySet({
    ...incoming,
    id: own?.id ?? newId('set'),
    libraryId: item.id,
    libraryUpdatedAt: item.updated_at,
    createdAt: own?.createdAt ?? now,
    updatedAt: now,
    lastScore: own?.lastScore,
    completedAt: own?.completedAt,
    flashcards: incoming.flashcards?.map((c) => {
      const old = own?.flashcards?.find((o) => o.id === c.id);
      return old ? { ...c, srs: old.srs, rating: old.rating } : c;
    }),
  });
  return own ? 'updated' : 'new';
}

// Copies on this device whose library item is no longer there for this student (deleted, hidden,
// or the student left the group): the admin took it back, so it goes from the app too.
export function withdrawn(visibleIds: Set<string>, subjects: Subject[], sets: StudySet[]): { subjects: string[]; sets: string[] } {
  const gone = (x: { libraryId?: string }) => !!x.libraryId && !visibleIds.has(x.libraryId);
  return { subjects: subjects.filter(gone).map((s) => s.id), sets: sets.filter(gone).map((s) => s.id) };
}

// Fetches everything published for this student, delivers it and takes back what was withdrawn.
// Returns how many copies changed.
export async function deliverLibrary(): Promise<number> {
  const items = (await fetchLibrary()).filter((i) => i.published);
  let changed = 0;
  let arrived = 0;
  for (const item of items) {
    const result = deliver(item, getSubjects(), getStudySets());
    if (result) changed++;
    if (result === 'new') arrived++;
  }
  if (arrived) track('got_content', { oncePerSession: true });

  const gone = withdrawn(new Set(items.map((i) => i.id)), getSubjects(), getStudySets());
  gone.subjects.forEach(deleteSubject);
  gone.sets.forEach(deleteStudySet);
  return changed + gone.subjects.length + gone.sets.length;
}
