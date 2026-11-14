import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { parseLimit } from '../lib/limits';
import { Btn, Card, Pill, timeAgo } from '../ui';

interface UserRow {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  university: string | null;
  role: 'student' | 'moderator' | 'admin';
  blocked: boolean;
  ai_daily_limit: number | null;
  last_seen_at: string;
  ai_today: number;
  groups: string[];
  total: number;
}

const PAGE = 50;
const ROLE_LABEL = { student: 'Talaba', moderator: 'Moderator', admin: 'Admin' } as const;

export const UsersPage: React.FC = () => {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  // Other pages can open this one already searching for someone (/users?q=<telegram id>)
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState<Record<string, string>>({});
  const [boardAi, setBoardAi] = useState<Set<string>>(new Set()); // students given AI questions on the board

  // Wait until the admin stops typing before asking the database
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('admin_users', { p_search: query || null, p_limit: PAGE, p_offset: page * PAGE });
    if (err) return setError('Ro\'yxatni yuklab bo\'lmadi.');
    setError(null);
    setRows((data ?? []) as UserRow[]);
    if (isAdmin) {
      const { data: on } = await supabase.from('profiles').select('id').eq('board_ai', true);
      setBoardAi(new Set((on ?? []).map((r: { id: string }) => r.id)));
    }
  }, [query, page, isAdmin]);

  const toggleBoardAi = async (u: UserRow) => {
    setBusy(u.id);
    const { error: err } = await supabase.rpc('admin_set_board_ai', { p_user: u.id, p_on: !boardAi.has(u.id) });
    setBusy(null);
    if (err) return setError("Amalni bajarib bo'lmadi.");
    await load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const act = async (u: UserRow, args: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(u.id);
    const { error: err } = await supabase.rpc('admin_set_user', { p_user: u.id, ...args });
    setBusy(null);
    if (err) {
      setError(
        /lock yourself/.test(err.message)
          ? 'O\'zingizni bloklab bo\'lmaydi.'
          : /ADMIN_TELEGRAM_IDS/.test(err.message)
            ? 'Admin rolini faqat ADMIN_TELEGRAM_IDS ro\'yxati orqali berish mumkin.'
            : 'Amalni bajarib bo\'lmadi.'
      );
      return;
    }
    await load();
  };

  const total = rows?.[0]?.total ?? 0;
  const pages = Math.max(Math.ceil(Number(total) / PAGE), 1);

  return (
    <Card
      title={isAdmin ? 'Foydalanuvchilar' : 'Guruhingiz a\'zolari'}
      right={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism, @username yoki Telegram ID" className="w-64 max-w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />}
    >
      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Hech kim topilmadi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Foydalanuvchi</th>
                <th className="py-1 pr-3 font-medium">OTM / guruhlar</th>
                <th className="py-1 pr-3 font-medium">Rol</th>
                <th className="py-1 pr-3 font-medium">AI bugun</th>
                <th className="py-1 pr-3 font-medium">Faolligi</th>
                {isAdmin && <th className="py-1 font-medium">Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={`border-t border-border align-top ${u.blocked ? 'opacity-60' : ''}`}>
                  <td className="py-2 pr-3">
                    <div className="font-semibold">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}</div>
                    <div className="text-xs text-muted-foreground">{u.username ? `@${u.username} · ` : ''}{u.telegram_id}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <div>{u.university === 'samdu' ? 'SamDU' : u.university ?? '-'}</div>
                    <div className="text-muted-foreground">{u.groups.length ? u.groups.join(', ') : 'guruhsiz'}</div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Pill tone={u.role === 'admin' ? 'blue' : u.role === 'moderator' ? 'amber' : 'gray'}>{ROLE_LABEL[u.role]}</Pill>
                    {u.blocked && <> <Pill tone="red">Bloklangan</Pill></>}
                    {boardAi.has(u.id) && <> <Pill tone="blue">AI doska</Pill></>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs">
                    {u.ai_today}{u.ai_daily_limit !== null && <span className="text-muted-foreground"> / {u.ai_daily_limit}</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(u.last_seen_at)}</td>
                  {isAdmin && (
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {u.role === 'admin' ? (
                          <span className="text-xs text-muted-foreground">admin: ro'yxat orqali</span>
                        ) : (
                          <>
                          <Btn
                            tone={u.blocked ? 'outline' : 'danger'}
                            disabled={busy === u.id}
                            onClick={() => act(u, { p_blocked: !u.blocked }, u.blocked ? undefined : `${u.first_name ?? 'Foydalanuvchi'} bloklansinmi? U botdan foydalana olmaydi.`)}
                          >
                            {u.blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                          </Btn>
                          <Btn disabled={busy === u.id} onClick={() => act(u, { p_role: u.role === 'moderator' ? 'student' : 'moderator' })}>
                            {u.role === 'moderator' ? 'Moderatorlikdan olish' : 'Moderator qilish'}
                          </Btn>
                          {u.role === 'student' && (
                            <Btn disabled={busy === u.id} onClick={() => toggleBoardAi(u)}>
                              {boardAi.has(u.id) ? "AI doskani o'chirish" : 'AI doska berish'}
                            </Btn>
                          )}
                          </>
                        )}
                          <input
                            value={limitDraft[u.id] ?? ''}
                            onChange={(e) => setLimitDraft((s) => ({ ...s, [u.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            placeholder="AI limit"
                            className="w-20 px-2 py-1 rounded-lg border border-border bg-background text-xs"
                          />
                          <Btn disabled={busy === u.id || parseLimit(limitDraft[u.id] ?? '') === null} onClick={() => act(u, { p_ai_limit: parseLimit(limitDraft[u.id] ?? '') }).then(() => setLimitDraft((s) => ({ ...s, [u.id]: '' })))}>Saqlash</Btn>
                          {u.ai_daily_limit !== null && <Btn disabled={busy === u.id} onClick={() => act(u, { p_clear_ai_limit: true })}>Limitni olib tashlash</Btn>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        <span>Jami: {Number(total)}</span>
        <div className="flex items-center gap-2">
          <Btn disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Oldingi</Btn>
          <span>{page + 1} / {pages}</span>
          <Btn disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Keyingi</Btn>
        </div>
      </div>
    </Card>
  );
};
