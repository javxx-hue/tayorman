import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Btn, Card, Pill, formatTime } from '../ui';

type Status = 'open' | 'fixed' | 'dismissed';
interface Report {
  id: number;
  user_id: string;
  library_item_id: string | null;
  context: string | null;
  question_text: string | null;
  note: string | null;
  status: Status;
  created_at: string;
}

const STATUS: Record<Status, { label: string; tone: 'amber' | 'green' | 'gray' }> = {
  open: { label: 'Ochiq', tone: 'amber' },
  fixed: { label: 'Tuzatilgan', tone: 'green' },
  dismissed: { label: 'Rad etilgan', tone: 'gray' },
};
const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'open', label: 'Ochiq' },
  { key: 'fixed', label: 'Tuzatilgan' },
  { key: 'dismissed', label: 'Rad etilgan' },
  { key: 'all', label: 'Hammasi' },
];

// Students' "this question has a mistake" reports. The same question reported twice is shown once with a count.
export const IssuesPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Status | 'all'>('open');
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from('issue_reports')
      .select('id, user_id, library_item_id, context, question_text, note, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error: err } = await q;
    if (err) return setError("Xabarlarni yuklab bo'lmadi.");
    setError(null);
    setRows((data ?? []) as Report[]);
  }, [filter]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const setStatus = async (ids: number[], status: Status) => {
    setError(null);
    const { error: err } = await supabase.from('issue_reports').update({ status }).in('id', ids);
    if (err) return setError("O'zgartirib bo'lmadi.");
    load();
  };

  // One group per library item and question text
  const groups = new Map<string, Report[]>();
  for (const r of rows ?? []) {
    const key = `${r.library_item_id ?? ''}|${r.question_text ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

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
      ) : groups.size === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Bu bo'limda xabar yo'q.</p></Card>
      ) : (
        [...groups.values()].map((reports) => {
          const first = reports[0];
          const ids = reports.map((r) => r.id);
          return (
            <Card key={first.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{first.context ?? '-'}</div>
                  <p className="text-sm font-semibold mt-0.5 whitespace-pre-wrap">{first.question_text}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {reports.length > 1 && <Pill tone="red">{reports.length} ta talaba</Pill>}
                  <Pill tone={STATUS[first.status].tone}>{STATUS[first.status].label}</Pill>
                </div>
              </div>
              <ul className="mt-2 space-y-1.5">
                {reports.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm rounded-lg bg-secondary/60 px-3 py-1.5">
                    {r.note} <span className="text-xs text-muted-foreground">· {formatTime(r.created_at)}</span>
                  </li>
                ))}
                {reports.length > 5 && <li className="text-xs text-muted-foreground">... va yana {reports.length - 5} ta</li>}
              </ul>
              <div className="flex flex-wrap gap-2 mt-3">
                {first.library_item_id && <Btn tone="primary" onClick={() => navigate(`/library?edit=${first.library_item_id}`)}>Kutubxonada ochish</Btn>}
                {first.status !== 'fixed' && <Btn onClick={() => setStatus(ids, 'fixed')}>Tuzatildi</Btn>}
                {first.status !== 'dismissed' && <Btn onClick={() => setStatus(ids, 'dismissed')}>Rad etish</Btn>}
                {first.status !== 'open' && <Btn onClick={() => setStatus(ids, 'open')}>Qayta ochish</Btn>}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
