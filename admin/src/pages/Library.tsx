import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudySet, Subject } from '../../../src/types';
import { publishToLibrary, unpublish } from '../../../src/lib/library';
import { supabase } from '../lib/supabase';
import { Audience } from '../lib/audience';
import { copyOf } from '../lib/content';
import { Btn, Card, Pill, timeAgo } from '../ui';
import { SetBuilder } from './library/SetBuilder';
import { SubjectBuilder } from './library/SubjectBuilder';

interface Row {
  id: string;
  kind: 'subject' | 'set';
  source_id: string;
  title: string;
  audience_all: boolean;
  community_ids: string[];
  published: boolean;
  updated_at: string;
  type: string | null;
}
interface Group {
  id: string;
  name: string;
}
type View = { mode: 'list' } | { mode: 'set' | 'subject'; doc?: StudySet | Subject; audience?: Audience; draft?: boolean; presetFiles?: File[] };

const SET_TYPE: Record<string, string> = { quiz: 'Test', exam: 'Imtihon', flashcards: 'Kartalar', notes: 'Konspekt' };

// Everything students can get: subjects and tests/cards. Admins make, edit, hide and remove them here.
export const LibraryPage: React.FC = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    const [items, g] = await Promise.all([
      supabase.from('library_items').select('id, kind, source_id, title, audience_all, community_ids, published, updated_at, type:data->>type').order('updated_at', { ascending: false }),
      supabase.from('communities').select('id, name').order('name'),
    ]);
    if (items.error) return setError("Kutubxonani yuklab bo'lmadi.");
    setError(null);
    setRows((items.data ?? []) as unknown as Row[]);
    setGroups((g.data ?? []) as Group[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // "Shu fayllardan test tuzish" on a request: fetch its files and open the builder with them
  useEffect(() => {
    const from = Number(params.get('from'));
    const as = params.get('as');
    if (!from || (as !== 'set' && as !== 'subject')) return;
    setParams({}, { replace: true });
    setBusy('request');
    (async () => {
      const { data } = await supabase.from('suggestions').select('attachments').eq('id', from).maybeSingle();
      const list = (data?.attachments ?? []) as { path: string; name: string; mime: string }[];
      const files: File[] = [];
      for (const a of list) {
        const { data: blob } = await supabase.storage.from('request-files').download(a.path);
        if (blob) files.push(new File([blob], a.name, { type: a.mime }));
      }
      if (!files.length) throw new Error('no files');
      setView({ mode: as, presetFiles: files });
    })()
      .catch(() => setError("So'rovdagi fayllarni olib bo'lmadi."))
      .finally(() => setBusy(null));
  }, []);

  const audienceText = (r: Row) => (r.audience_all ? 'Hamma talabalar' : r.community_ids.length ? r.community_ids.map((id) => groups.find((x) => x.id === id)?.name ?? '?').join(', ') : 'Hech kimga');

  const fetchDoc = async (r: Row) => {
    const { data, error: err } = await supabase.from('library_items').select('data').eq('id', r.id).single();
    if (err || !data) throw err ?? new Error('not found');
    return data.data as StudySet | Subject;
  };

  const act = async (r: Row, task: () => Promise<void>) => {
    setBusy(r.id);
    setError(null);
    try {
      await task();
      await load();
    } catch {
      setError("Amalni bajarib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  const edit = (r: Row) =>
    act(r, async () => {
      const doc = await fetchDoc(r);
      setView({ mode: r.kind, doc, audience: { all: r.audience_all, groups: r.community_ids }, draft: !r.published });
    });

  const duplicate = (r: Row) =>
    act(r, async () => {
      await publishToLibrary({ kind: r.kind, doc: copyOf(await fetchDoc(r)), audienceAll: false, communityIds: [], published: false });
    });

  const togglePublished = (r: Row) =>
    act(r, async () => {
      const { error: err } = await supabase.from('library_items').update({ published: !r.published }).eq('id', r.id);
      if (err) throw err;
    });

  const remove = (r: Row) => {
    if (!window.confirm(`«${r.title}» o'chirilsinmi? U bilan bog'liq topshiriqlar ham o'chadi. Talabalar o'z natijalarini saqlab qoladi.`)) return;
    act(r, () => unpublish(r.id));
  };

  const done = () => {
    setView({ mode: 'list' });
    load();
  };

  if (view.mode === 'set') {
    return <SetBuilder initial={view.doc as StudySet | undefined} initialAudience={view.audience} initialDraft={view.draft} presetFiles={view.presetFiles} groups={groups} onClose={() => setView({ mode: 'list' })} onSaved={done} />;
  }
  if (view.mode === 'subject') {
    return <SubjectBuilder initial={view.doc as Subject | undefined} initialAudience={view.audience} initialDraft={view.draft} presetFiles={view.presetFiles} groups={groups} onClose={() => setView({ mode: 'list' })} onSaved={done} />;
  }

  return (
    <div className="space-y-4">
      {busy === 'request' && <p className="text-sm text-muted-foreground" role="status">So'rovdagi fayllar yuklanmoqda...</p>}
      <Card title="Yangi">
        <div className="flex flex-wrap gap-2">
          <Btn tone="primary" onClick={() => setView({ mode: 'set' })}>+ Test / kartalar</Btn>
          <Btn tone="primary" onClick={() => setView({ mode: 'subject' })}>+ Fan (imtihon savollari bilan)</Btn>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Test fayldan (AI tuzadi) yoki tayyor Word/Hemis matnidan yaratiladi. Nashr qilingach talabalarning ilovasida o'zi paydo bo'ladi.</p>
      </Card>

      <Card title="Kutubxona">
        {error && <p className="text-sm text-rose-600 mb-3" role="alert">{error}</p>}
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali hech narsa yo'q. Yuqoridan birinchisini yarating.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className={`rounded-xl border border-border p-3 ${r.published ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.kind === 'subject' ? 'Fan' : SET_TYPE[r.type ?? ''] ?? "To'plam"} · {audienceText(r)} · {timeAgo(r.updated_at)}</div>
                  </div>
                  {r.published ? <Pill tone="green">Nashr qilingan</Pill> : <Pill tone="amber">Qoralama</Pill>}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.type !== 'notes' && <Btn disabled={busy === r.id} onClick={() => edit(r)}>Tahrirlash</Btn>}
                  <Btn disabled={busy === r.id} onClick={() => duplicate(r)}>Nusxalash</Btn>
                  <Btn disabled={busy === r.id} onClick={() => togglePublished(r)}>{r.published ? 'Yashirish' : 'Nashr qilish'}</Btn>
                  <Btn tone="danger" disabled={busy === r.id} onClick={() => remove(r)}>O'chirish</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
