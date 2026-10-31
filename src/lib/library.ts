// Admin library: subjects and study sets the admin publishes to an audience.
// Students create nothing: published items arrive in their app on their own and stay up to date.
// Their progress stays private and survives an update.
import { StudySet, Subject } from '../types';
import { supabase } from './supabase';
import { getStudySets, getSubjects, saveStudySet, saveSubject, newId } from './storage';

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

export async function fetchLibrary(): Promise<LibraryItem[]> {
  if (!supabase) return [];
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

export async function publishToLibrary(input: PublishInput): Promise<void> {
  if (!supabase) throw new Error('offline');
  const title = 'name' in input.doc ? input.doc.name : input.doc.title;
  const { error } = await supabase.from('library_items').upsert(
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
  );
  if (error) throw error;
}

export async function unpublish(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('library_items').delete().eq('id', id);
  if (error) throw error;
}

// Puts one library item into the student's data: a new copy, or a refresh of the existing
// copy when the admin changed it. Attempts, scores and card schedules are kept.
export function deliver(item: LibraryItem, subjects: Subject[], sets: StudySet[]): boolean {
  const now = Date.now();
  if (item.kind === 'subject') {
    const incoming = item.data as Subject;
    const own = subjects.find((s) => s.libraryId === item.id);
    if (own?.libraryUpdatedAt === item.updated_at) return false;
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
    return true;
  }
  const incoming = item.data as StudySet;
  const own = sets.find((s) => s.libraryId === item.id);
  if (own?.libraryUpdatedAt === item.updated_at) return false;
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
  return true;
}

// Fetches everything published for this student and delivers it. Returns how many changed.
export async function deliverLibrary(): Promise<number> {
  const items = (await fetchLibrary()).filter((i) => i.published);
  let changed = 0;
  for (const item of items) {
    if (deliver(item, getSubjects(), getStudySets())) changed++;
  }
  return changed;
}
