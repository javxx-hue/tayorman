import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { covers, expand, tashkentToIso } from '../lib/audience';
import { Btn, Card, Pill, formatTime } from '../ui';

interface Item {
  id: string;
  kind: 'subject' | 'set';
  title: string;
  audience_all: boolean;
  community_ids: string[];
  published: boolean;
  type: string | null; // quiz, exam, flashcards, notes (sets only)
}
interface Group {
  id: string;
  name: string;
}
interface Assignment {
  id: string;
  title: string;
  note: string | null;
  library_item_id: string;
  audience_all: boolean;
  community_ids: string[];
  due_at: string | null;
  status: 'active' | 'archived';
  notified_at: string | null;
  created_by: string | null;
  created_at: string;
}
interface Stats {
  audience: number;
  started: number;
  done: number;
  avg_score: number | null;
  by_community: { name: string; members: number; done: number }[];
}

const inputClass = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export const AssignmentsPage: React.FC = () => {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form
  const [itemId, setItemId] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [toAll, setToAll] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [notify, setNotify] = useState(true);

  // stats opened per assignment
  const [stats, setStats] = useState<Record<string, Stats | 'loading' | 'error'>>({});

  const load = useCallback(async () => {
    const [i, g, a] = await Promise.all([
      supabase.from('library_items').select('id, kind, title, audience_all, community_ids, published, type:data->>type').eq('published', true).order('title'),
      supabase.from('communities').select('id, name').order('name'),
      supabase
        .from('assignments')
        .select('id, title, note, library_item_id, audience_all, community_ids, due_at, status, notified_at, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (a.error) return setError("Topshiriqlarni yuklab bo'lmadi.");
    // notes cannot be "done", so they are not offered
    setItems(((i.data ?? []) as unknown as Item[]).filter((x) => x.type !== 'notes'));
    setGroups((g.data ?? []) as Group[]);
    setRows((a.data ?? []) as Assignment[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const itemTitle = (id: string) => items.find((x) => x.id === id)?.title ?? 'Kutubxonadan olib tashlangan';
  const audienceNames = (a: Assignment) => (a.audience_all ? 'Hamma talabalar' : a.community_ids.map((id) => groups.find((g) => g.id === id)?.name ?? '?').join(', '));

  const pickItem = (id: string) => {
    setItemId(id);
    const item = items.find((x) => x.id === id);
    if (item && !title.trim()) setTitle(item.title);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    const item = items.find((x) => x.id === itemId);
    const dueIso = due ? tashkentToIso(due) : null;
    if (!item) return setError('Kutubxonadan fan yoki to\'plamni tanlang.');
    if (!title.trim()) return setError('Topshiriq nomini yozing.');
    if (!toAll && !picked.length) return setError('Kamida bitta guruhni tanlang.');
    if (due && !dueIso) return setError("Muddat noto'g'ri.");
    if (dueIso && new Date(dueIso).getTime() <= Date.now()) return setError("Muddat o'tib ketgan vaqtni ko'rsatmoqda.");

    const wanted = { all: toAll, groups: picked };
    const current = { all: item.audience_all, groups: item.community_ids };
    setBusy(true);

    // Students must be able to see the content itself, not only the assignment
    if (!covers(current, wanted)) {
      if (!isAdmin) {
        setBusy(false);
        return setError("Bu material tanlangan guruhlarga ochiq emas. Administratordan guruhlarga ochishni so'rang.");
      }
      const next = expand(current, wanted);
      const names = next.all ? 'barcha talabalar' : next.groups.map((id) => groups.find((g) => g.id === id)?.name).join(', ');
      if (!window.confirm(`«${item.title}» hozir tanlangan guruhlarga ochiq emas. Topshiriq berilsa, u shularga ochiladi: ${names}. Davom etasizmi?`)) return setBusy(false);
      const { error: libErr } = await supabase.from('library_items').update({ audience_all: next.all, community_ids: next.groups }).eq('id', item.id);
      if (libErr) {
        setBusy(false);
        return setError("Materialni guruhlarga ochib bo'lmadi.");
      }
    }

    const { data: created, error: insErr } = await supabase
      .from('assignments')
      .insert({ title: title.trim(), note: note.trim() || null, library_item_id: item.id, audience_all: toAll, community_ids: toAll ? [] : picked, due_at: dueIso, notify })
      .select('id')
      .single();
    if (insErr || !created) {
      setBusy(false);
      return setError("Topshiriqni saqlab bo'lmadi.");
    }

    let message = 'Topshiriq yaratildi.';
    if (notify) {
      const { data: res, error: fnErr } = await supabase.functions.invoke('assignment-notify', { body: { id: created.id } });
      message = fnErr ? "Topshiriq yaratildi, lekin botga xabar yuborib bo'lmadi." : `Topshiriq yaratildi. Botda ${res?.sent ?? 0} ta talabaga xabar yuborildi${res?.failed ? `, ${res.failed} tasiga yetmadi` : ''}.`;
    }
    setBusy(false);
    setNotice(message);
    setItemId('');
    setTitle('');
    setNote('');
    setPicked([]);
    setToAll(false);
    setDue('');
    load();
  };

  const openStats = async (a: Assignment) => {
    if (stats[a.id] && stats[a.id] !== 'error') return setStats((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== a.id)));
    setStats((s) => ({ ...s, [a.id]: 'loading' }));
    const { data, error: err } = await supabase.rpc('assignment_stats', { p_assignment: a.id });
    setStats((s) => ({ ...s, [a.id]: err ? 'error' : (data as Stats) }));
  };

  const setStatus = async (a: Assignment, status: 'active' | 'archived') => {
    setError(null);
    const { error: err } = await supabase.from('assignments').update({ status }).eq('id', a.id);
    if (err) return setError("O'zgartirib bo'lmadi.");
    load();
  };

  const remove = async (a: Assignment) => {
    if (!window.confirm(`«${a.title}» o'chirilsinmi? Talabalarning natijalari ham o'chadi.`)) return;
    setError(null);
    const { error: err } = await supabase.from('assignments').delete().eq('id', a.id);
    if (err) return setError("O'chirib bo'lmadi.");
    load();
  };

  const toggleGroup = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-4">
      <Card title="Yangi topshiriq">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Material (kutubxonadan)</label>
            <select value={itemId} onChange={(e) => pickItem(e.target.value)} className={`${inputClass} w-full`}>
              <option value="">Tanlang...</option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>{x.kind === 'subject' ? 'Fan' : 'To\'plam'}: {x.title}</option>
              ))}
            </select>
            {items.length === 0 && <p className="text-xs text-muted-foreground mt-1">Kutubxona bo'sh. Avval Mini App'dagi Admin bo'limidan fan yoki to'plamni nashr qiling.</p>}
          </div>

          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Topshiriq nomi" className={`${inputClass} w-full`} />
          <textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy): talabaga nima qilish kerak" className={`${inputClass} w-full`} />

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Kimga</div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={toAll} onChange={(e) => setToAll(e.target.checked)} /> Hamma talabalarga
              </label>
            )}
            {!toAll && (
              <div className="flex flex-wrap gap-2">
                {groups.length === 0 && <span className="text-xs text-muted-foreground">Avval «Guruhlar» bo'limida guruh yarating.</span>}
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${picked.includes(g.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Muddat (Toshkent vaqti, ixtiyoriy)</label>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm pb-1.5">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Botda xabar yuborish
            </label>
          </div>

          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          {notice && <p className="text-sm text-emerald-600" role="status">{notice}</p>}
          <Btn tone="primary" disabled={busy} onClick={submit}>{busy ? 'Yuborilmoqda...' : 'Topshiriq berish'}</Btn>
        </div>
      </Card>

      <Card title="Topshiriqlar">
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali topshiriq yo'q.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => {
              const s = stats[a.id];
              const mine = isAdmin || a.created_by === me?.id;
              const overdue = a.due_at && new Date(a.due_at).getTime() < Date.now();
              return (
                <li key={a.id} className={`rounded-xl border border-border p-3 ${a.status === 'archived' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{itemTitle(a.library_item_id)} · {audienceNames(a)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {a.due_at && <span className="text-muted-foreground">{formatTime(a.due_at)}</span>}
                      {overdue && a.status === 'active' && <Pill tone="red">Muddati o'tgan</Pill>}
                      {a.status === 'archived' ? <Pill tone="gray">Arxiv</Pill> : <Pill tone="green">Faol</Pill>}
                      {a.notified_at && <Pill tone="blue">Xabar yuborilgan</Pill>}
                    </div>
                  </div>
                  {a.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.note}</p>}

                  <div className="flex flex-wrap gap-2 mt-2">
                    <Btn onClick={() => openStats(a)}>{s && s !== 'error' ? 'Natijalarni yopish' : 'Natijalar'}</Btn>
                    {mine && (a.status === 'active' ? <Btn onClick={() => setStatus(a, 'archived')}>Arxivlash</Btn> : <Btn onClick={() => setStatus(a, 'active')}>Faollashtirish</Btn>)}
                    {mine && <Btn tone="danger" onClick={() => remove(a)}>O'chirish</Btn>}
                  </div>

                  {s === 'loading' && <p className="text-xs text-muted-foreground mt-2">Hisoblanmoqda...</p>}
                  {s === 'error' && <p className="text-xs text-rose-600 mt-2">Natijalarni yuklab bo'lmadi.</p>}
                  {s && s !== 'loading' && s !== 'error' && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        <span>Auditoriya: <b>{s.audience}</b></span>
                        <span>Boshlagan: <b>{s.started}</b></span>
                        <span>Bajargan: <b>{s.done}</b> ({pct(s.done, s.audience)}%)</span>
                        <span>O'rtacha ball: <b>{s.avg_score ?? '-'}</b></span>
                      </div>
                      {s.by_community.map((c) => (
                        <div key={c.name}>
                          <div className="flex justify-between"><span>{c.name}</span><span className="text-muted-foreground">{c.done} / {c.members}</span></div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct(c.done, c.members)}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
