import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Btn, Card, Pill, formatTime } from '../ui';

type Status = 'new' | 'seen' | 'accepted' | 'declined';
interface Row {
  id: number;
  user_id: string;
  kind: 'new_subject' | 'questions' | 'bug' | 'other';
  text: string;
  status: Status;
  admin_reply: string | null;
  created_at: string;
}
interface Who {
  first_name: string | null;
  username: string | null;
}

const KIND: Record<Row['kind'], string> = {
  new_subject: 'Yangi fan',
  questions: 'Savol / material',
  bug: 'Xato',
  other: 'Boshqa',
};
const STATUS: Record<Status, { label: string; tone: 'blue' | 'gray' | 'green' | 'red' }> = {
  new: { label: 'Yangi', tone: 'blue' },
  seen: { label: "Ko'rildi", tone: 'gray' },
  accepted: { label: 'Qabul qilindi', tone: 'green' },
  declined: { label: 'Rad etildi', tone: 'red' },
};
const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'new', label: 'Yangi' },
  { key: 'seen', label: "Ko'rilgan" },
  { key: 'accepted', label: 'Qabul' },
  { key: 'declined', label: 'Rad' },
  { key: 'all', label: 'Hammasi' },
];

// Student requests ("Taklif qutisi"). The answer is saved and sent to the student in the bot.
export const RequestsPage: React.FC = () => {
  const [filter, setFilter] = useState<Status | 'all'>('new');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [who, setWho] = useState<Record<string, Who>>({});
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase.from('suggestions').select('id, user_id, kind, text, status, admin_reply, created_at').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error: err } = await q;
    if (err) return setError("So'rovlarni yuklab bo'lmadi.");
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: people } = await supabase.from('profiles').select('id, first_name, username').in('id', ids);
      setWho(Object.fromEntries((people ?? []).map((p) => [p.id, { first_name: p.first_name, username: p.username }])));
    }
  }, [filter]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const act = async (row: Row, status: Status, withReply: boolean) => {
    const reply = withReply ? (replies[row.id] ?? '').trim() : '';
    if (withReply && !reply) return;
    setBusy(row.id);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('admin-reply', { body: { id: row.id, status, reply } });
    setBusy(null);
    if (err) return setError("Saqlab bo'lmadi. Qayta urinib ko'ring.");
    if (withReply && data && data.delivered === false) setError("Javob saqlandi, lekin talabaga botdan yuborilmadi (u botni bloklagan bo'lishi mumkin).");
    setReplies((r) => ({ ...r, [row.id]: '' }));
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Bu bo'limda so'rov yo'q.</p></Card>
      ) : (
        rows.map((r) => {
          const p = who[r.user_id];
          const name = [p?.first_name, p?.username ? `@${p.username}` : null].filter(Boolean).join(' ') || 'Talaba';
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold text-foreground">{name} <span className="font-normal text-muted-foreground">· {KIND[r.kind]}</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {formatTime(r.created_at)} <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{r.text}</p>
              {r.admin_reply && <p className="mt-2 text-sm rounded-xl bg-primary/5 border border-primary/20 p-2.5 whitespace-pre-wrap"><b>Javobingiz: </b>{r.admin_reply}</p>}

              <textarea
                rows={2}
                maxLength={2000}
                value={replies[r.id] ?? ''}
                onChange={(e) => setReplies((x) => ({ ...x, [r.id]: e.target.value }))}
                placeholder="Talabaga javob (botga yuboriladi)"
                className="mt-3 w-full p-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Btn tone="primary" disabled={busy === r.id || !(replies[r.id] ?? '').trim()} onClick={() => act(r, 'accepted', true)}>Javob + qabul</Btn>
                <Btn disabled={busy === r.id || !(replies[r.id] ?? '').trim()} onClick={() => act(r, 'declined', true)}>Javob + rad</Btn>
                <Btn disabled={busy === r.id || r.status === 'seen'} onClick={() => act(r, 'seen', false)}>Ko'rildi</Btn>
                <Btn disabled={busy === r.id || r.status === 'accepted'} onClick={() => act(r, 'accepted', false)}>Qabul</Btn>
                <Btn tone="danger" disabled={busy === r.id || r.status === 'declined'} onClick={() => act(r, 'declined', false)}>Rad</Btn>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
