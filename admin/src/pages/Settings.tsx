import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseLimit, MAX_AI_LIMIT } from '../lib/limits';
import { Btn, Card } from '../ui';

// App-wide settings. For now one: how many AI requests a student may make per day.
export const SettingsPage: React.FC = () => {
  const [current, setCurrent] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_daily_limit')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) return setError("Sozlamani yuklab bo'lmadi.");
        const n = Number(data?.value);
        setCurrent(Number.isFinite(n) ? n : 30);
        setDraft(String(Number.isFinite(n) ? n : 30));
      });
  }, []);

  const save = async () => {
    setError(null);
    setNotice(null);
    const n = parseLimit(draft);
    if (n === null) return setError(`0 dan ${MAX_AI_LIMIT} gacha butun son kiriting.`);
    setBusy(true);
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'ai_daily_limit', value: n, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setBusy(false);
    if (err) return setError("Saqlab bo'lmadi. Qayta urinib ko'ring.");
    setCurrent(n);
    setNotice(`Saqlandi: har bir talaba kuniga ${n} ta AI so'rov qila oladi.`);
  };

  return (
    <Card title="Kunlik AI limiti">
      <div className="space-y-3 max-w-md">
        <p className="text-sm text-muted-foreground">
          Har bir talaba kuniga shuncha AI so'rov qila oladi (javobni baholash, fayldan test tuzish). Kun Toshkent vaqti bilan 00:00 da yangilanadi.
        </p>
        {current === null && !error ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-24 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Kunlik AI limiti"
            />
            <Btn tone="primary" disabled={busy || current === null || draft === String(current)} onClick={save}>Saqlash</Btn>
          </div>
        )}
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        {notice && <p className="text-sm text-emerald-600" role="status">{notice}</p>}
        <p className="text-xs text-muted-foreground">
          Tartib: avval foydalanuvchining shaxsiy limiti (Foydalanuvchilar), keyin guruh limiti (Guruhlar), oxirida shu umumiy limit. Adminlar ham shu hisobdan sarflaydi; ularga Foydalanuvchilar bo'limida shaxsiy limit berish mumkin.
        </p>
      </div>
    </Card>
  );
};
