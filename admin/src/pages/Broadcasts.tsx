import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AudiencePicker } from '../components/AudiencePicker';
import { Audience, tashkentToIso } from '../lib/audience';
import { Btn, Card, Pill, formatTime } from '../ui';

interface Group {
  id: string;
  name: string;
}
interface Broadcast {
  id: number;
  text: string;
  audience_all: boolean;
  community_ids: string[];
  status: 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
}

const STATUS: Record<Broadcast['status'], { label: string; tone: 'blue' | 'amber' | 'green' | 'gray' }> = {
  scheduled: { label: 'Rejalashtirilgan', tone: 'blue' },
  sending: { label: 'Yuborilmoqda', tone: 'amber' },
  sent: { label: 'Yuborilgan', tone: 'green' },
  cancelled: { label: 'Bekor qilingan', tone: 'gray' },
};
const inputClass = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const MAX = 4000;

// Messages through the bot: now or at a chosen time, with how many actually arrived
export const BroadcastsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<Broadcast[] | null>(null);
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<Audience>({ all: true, groups: [] });
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState('');
  const [reach, setReach] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, b] = await Promise.all([
      supabase.from('communities').select('id, name').order('name'),
      supabase
        .from('broadcasts')
        .select('id, text, audience_all, community_ids, status, scheduled_at, sent_at, created_at, total_count, sent_count, failed_count')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (b.error) return setError("Xabarlar tarixini yuklab bo'lmadi.");
    setGroups((g.data ?? []) as Group[]);
    setRows((b.data ?? []) as Broadcast[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // How many students the chosen audience is (members of several groups count once)
  useEffect(() => {
    let stale = false;
    (async () => {
      if (audience.all) {
        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('blocked', false);
        if (!stale) setReach(count ?? null);
      } else if (!audience.groups.length) {
        if (!stale) setReach(0);
      } else {
        const { data } = await supabase.from('community_members').select('user_id').in('community_id', audience.groups).limit(5000);
        if (!stale) setReach(new Set((data ?? []).map((m) => m.user_id as string)).size);
      }
    })();
    return () => {
      stale = true;
    };
  }, [audience]);

  const audienceText = (b: Broadcast) => (b.audience_all ? 'Hamma talabalar' : b.community_ids.map((id) => groups.find((g) => g.id === id)?.name ?? '?').join(', '));

  const send = async () => {
    setError(null);
    setNotice(null);
    const scheduledAt = later ? tashkentToIso(when) : null;
    if (!text.trim()) return setError('Xabar matnini yozing.');
    if (!audience.all && !audience.groups.length) return setError('Kimga yuborilishini tanlang.');
    if (later && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) return setError("Kelajakdagi vaqtni tanlang (Toshkent vaqti bilan).");

    const who = reach === null ? 'tanlangan' : `≈${reach} ta`;
    const question = later ? `Xabar ${formatTime(scheduledAt)} da ${who} talabaga yuboriladi. Tasdiqlaysizmi?` : `Xabar hoziroq ${who} talabaga yuboriladi. Tasdiqlaysizmi?`;
    if (!window.confirm(question)) return;

    setBusy(true);
    const { data, error: err } = await supabase.functions.invoke('admin-broadcast', {
      body: { text: text.trim(), audienceAll: audience.all, communityIds: audience.groups, ...(scheduledAt ? { scheduledAt } : {}) },
    });
    setBusy(false);
    if (err) return setError("Yuborib bo'lmadi. Qayta urinib ko'ring.");
    setNotice(data?.scheduled ? 'Xabar rejalashtirildi.' : `Yuborildi: ${data?.sent ?? 0} ta yetdi${data?.failed ? `, ${data.failed} tasiga yetmadi` : ''}.`);
    setText('');
    setWhen('');
    setLater(false);
    load();
  };

  const cancel = async (b: Broadcast) => {
    if (!window.confirm('Rejalashtirilgan xabar bekor qilinsinmi?')) return;
    setError(null);
    // Only while it is still waiting: if it has just started, it is no longer cancelled
    const { data, error: err } = await supabase.from('broadcasts').update({ status: 'cancelled' }).eq('id', b.id).eq('status', 'scheduled').select('id');
    if (err) return setError("Bekor qilib bo'lmadi.");
    if (!data?.length) setError('Xabar allaqachon yuborila boshlagan.');
    load();
  };

  return (
    <div className="space-y-4">
      <Card title="Yangi xabar">
        <div className="space-y-3">
          <textarea value={text} maxLength={MAX} rows={5} onChange={(e) => setText(e.target.value)} placeholder="Xabar matni (botda talabalarga boradi)" className={`${inputClass} w-full`} />
          <div className="text-xs text-muted-foreground text-right">{text.length} / {MAX}</div>

          <AudiencePicker groups={groups} value={audience} onChange={setAudience} allowAll />
          {reach !== null && <p className="text-xs text-muted-foreground">Taxminan <b className="text-foreground">{reach}</b> ta talabaga boradi.</p>}

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} /> Keyinroq yuborish
            </label>
            {later && (
              <label className="text-xs font-semibold text-muted-foreground">
                Vaqt (Toshkent)
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputClass} block mt-1`} />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          {notice && <p className="text-sm text-emerald-600" role="status">{notice}</p>}
          <Btn tone="primary" disabled={busy} onClick={send}>{busy ? 'Yuborilmoqda...' : later ? 'Rejalashtirish' : 'Hozir yuborish'}</Btn>
        </div>
      </Card>

      <Card title="Tarix">
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali xabar yuborilmagan.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-xs text-muted-foreground">{audienceText(b)}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{formatTime(b.status === 'scheduled' ? b.scheduled_at : b.sent_at ?? b.created_at)}</span>
                    <Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill>
                  </div>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{b.text.length > 300 ? `${b.text.slice(0, 300)}...` : b.text}</p>
                {b.status === 'sent' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Yetdi: <b className="text-foreground">{b.sent_count}</b> · Yetmadi: <b className="text-foreground">{b.failed_count}</b> · Jami: {b.total_count}
                    {b.failed_count > 0 && ' (odatda botni bloklaganlar)'}
                  </p>
                )}
                {b.status === 'scheduled' && <div className="mt-2"><Btn tone="danger" onClick={() => cancel(b)}>Bekor qilish</Btn></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
