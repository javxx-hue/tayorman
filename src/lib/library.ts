// Admin library: subjects and study sets the admin publishes to an audience.
// Students copy an item into their own data; their progress stays private.
import { StudySet, Subject } from '../types';
import { supabase } from './supabase';
import { saveStudySet, saveSubject, newId } from './storage';

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

// Copies a library item into the student's own subjects / sets; returns the new id
export function addToMine(item: LibraryItem): string {
  const now = Date.now();
  if (item.kind === 'subject') {
    const s = item.data as Subject;
    const copy: Subject = { ...s, id: newId('sub'), libraryId: item.id, createdAt: now, updatedAt: now };
    saveSubject(copy);
    return copy.id;
  }
  const set = item.data as StudySet;
  const copy: StudySet = { ...set, id: newId('set'), libraryId: item.id, createdAt: now, updatedAt: now };
  saveStudySet(copy);
  return copy.id;
}
