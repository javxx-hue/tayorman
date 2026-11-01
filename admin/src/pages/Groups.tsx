import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { BOT, inviteLink } from '../lib/config';
import { Btn, Card, Pill, timeAgo } from '../ui';

type Kind = 'university' | 'faculty' | 'course' | 'group' | 'other';
interface Group {
  id: string;
  name: string;
  kind: Kind;
  invite_code: string;
  invite_enabled: boolean;
  ai_daily_limit: number | null;
  created_at: string;
}
interface Person {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: 'student' | 'moderator' | 'admin';
  blocked: boolean;
}

const KIND_LABEL: Record<Kind, string> = { university: 'OTM', faculty: 'Fakultet', course: 'Kurs', group: 'Guruh', other: 'Boshqa' };
const MEMBER_LIMIT = 300;

const nameOf = (p: Person | undefined) => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || String(p.telegram_id) : 'Noma\'lum');

// Profiles for a list of ids; asked in chunks so the request address stays short
async function fetchPeople(ids: string[]): Promise<Record<string, Person>> {
  const out: Record<string, Person> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from('profiles')
      .select('id, telegram_id, first_name, last_name, username, role, blocked')
      .in('id', ids.slice(i, i + 100));
    for (const p of (data ?? []) as Person[]) out[p.id] = p;
  }
  return out;
}

const inputClass = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';

// ---------------------------------------------------------------- list
export const GroupsPage: React.FC = () => {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [groups, setGroups] = useState<(Group & { members: number })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('group');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('communities')
      .select('id, name, kind, invite_code, invite_enabled, ai_daily_limit, created_at, community_members(count)')
      .order('created_at', { ascending: false });
    if (err) return setError("Guruhlarni yuklab bo'lmadi.");
    setError(null);
    setGroups(
      (data ?? []).map((g) => ({ ...(g as unknown as Group), members: (g as unknown as { community_members: { count: number }[] }).community_members?.[0]?.count ?? 0 }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const { error: err } = await supabase.from('communities').insert({ name: trimmed, kind });
    setBusy(false);
    if (err) return setError("Guruh yaratib bo'lmadi.");
    setName('');
    load();
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card title="Yangi guruh">
          <div className="flex flex-wrap gap-2">
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Iqtisodiyot 1-kurs, 101-guruh" className={`${inputClass} flex-1 min-w-[14rem]`} />
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputClass}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
            <Btn tone="primary" disabled={!name.trim() || busy} onClick={create}>Yaratish</Btn>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Guruh yaratilgach, taklif havolasini talabalarga yuboring: ular havola orqali o'zi qo'shiladi.</p>
        </Card>
      )}

      <Card title={isAdmin ? 'Guruhlar' : 'Sizning guruhlaringiz'}>
        {error && <p className="text-sm text-rose-600 mb-3" role="alert">{error}</p>}
        {groups === null ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAdmin ? "Hali guruh yo'q. Yuqorida birinchisini yarating." : "Sizga hali guruh biriktirilmagan."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Guruh</th>
                  <th className="py-1 pr-3 font-medium">A'zolar</th>
                  <th className="py-1 pr-3 font-medium">AI limit</th>
                  <th className="py-1 font-medium">Havola</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Link to={`/groups/${g.id}`} className="font-semibold hover:underline">{g.name}</Link>
                      <div className="text-xs text-muted-foreground">{KIND_LABEL[g.kind]}</div>
                    </td>
                    <td className="py-2 pr-3">{g.members}</td>
                    <td className="py-2 pr-3 text-xs">{g.ai_daily_limit === null ? 'umumiy' : g.ai_daily_limit}</td>
                    <td className="py-2">{g.invite_enabled ? <Pill tone="green">Ochiq</Pill> : <Pill tone="red">O'chirilgan</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- one group
interface Member {
  user_id: string;
  joined_at: string;
}

export const GroupDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [group, setGroup] = useState<Group | null | undefined>(undefined); // undefined = loading, null = not found
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [moderatorIds, setModeratorIds] = useState<string[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');

  const load = useCallback(async () => {
    const { data: g } = await supabase.from('communities').select('id, name, kind, invite_code, invite_enabled, ai_daily_limit, created_at').eq('id', id).maybeSingle();
    if (!g) return setGroup(null);
    setGroup(g as Group);
    setLimitDraft(g.ai_daily_limit === null ? '' : String(g.ai_daily_limit));

    const [{ data: m, count }, { data: mods }] = await Promise.all([
      supabase.from('community_members').select('user_id, joined_at', { count: 'exact' }).eq('community_id', id).order('joined_at', { ascending: false }).limit(MEMBER_LIMIT),
      supabase.from('community_moderators').select('user_id').eq('community_id', id),
    ]);
    const list = (m ?? []) as Member[];
    const modIds = (mods ?? []).map((r) => r.user_id as string);
    setMembers(list);
    setTotal(count ?? list.length);
    setModeratorIds(modIds);
    setPeople(await fetchPeople([...new Set([...list.map((x) => x.user_id), ...modIds])]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs one change, reports a short message, reloads
  const run = async (task: () => Promise<string | null>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const problem = await task();
    setBusy(false);
    if (problem) return setError(problem);
    if (ok) setNotice(ok);
    load();
  };

  if (group === undefined) return <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>;
  if (group === null) {
    return (
      <Card>
        <p className="text-sm">Guruh topilmadi.</p>
        <Link to="/groups" className="text-sm text-primary underline">Guruhlarga qaytish</Link>
      </Card>
    );
  }

  const link = inviteLink(BOT, group.invite_code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('Havola nusxalandi.');
    } catch {
      setError("Nusxalab bo'lmadi. Havolani qo'lda belgilab oling.");
    }
  };

  const regenerate = () => {
    if (!window.confirm("Yangi havola yaratilsa, eskisi ishlamay qoladi. Davom etasizmi?")) return;
    run(async () => ((await supabase.rpc('regenerate_invite', { p_community: group.id })).error ? "Havolani yangilab bo'lmadi." : null), 'Yangi havola yaratildi.');
  };

  const toggleInvite = () =>
    run(async () => ((await supabase.from('communities').update({ invite_enabled: !group.invite_enabled }).eq('id', group.id)).error ? "O'zgartirib bo'lmadi." : null));

  const saveLimit = (value: number | null) =>
    run(async () => ((await supabase.from('communities').update({ ai_daily_limit: value }).eq('id', group.id)).error ? "Limitni saqlab bo'lmadi." : null), 'AI limit saqlandi.');

  const removeMember = (userId: string) => {
    if (!window.confirm(`${nameOf(people[userId])} guruhdan chiqarilsinmi?`)) return;
    run(async () => ((await supabase.from('community_members').delete().eq('community_id', group.id).eq('user_id', userId)).error ? "Chiqarib bo'lmadi." : null));
  };

  // The moderator role itself is on the profile; the group link is a separate row. Both are needed.
  const addModerator = (userId: string) =>
    run(async () => {
      if (people[userId]?.role === 'student') {
        if ((await supabase.rpc('admin_set_user', { p_user: userId, p_role: 'moderator' })).error) return "Moderator qilib bo'lmadi.";
      }
      return (await supabase.from('community_moderators').insert({ community_id: group.id, user_id: userId })).error ? "Guruhga moderator qilib bo'lmadi." : null;
    });

  const removeModerator = (userId: string) =>
    run(async () => {
      if ((await supabase.from('community_moderators').delete().eq('community_id', group.id).eq('user_id', userId)).error) return "Olib bo'lmadi.";
      // Someone who moderates no group any more goes back to being a student
      const { count } = await supabase.from('community_moderators').select('user_id', { count: 'exact', head: true }).eq('user_id', userId);
      if (!count && people[userId]?.role === 'moderator') await supabase.rpc('admin_set_user', { p_user: userId, p_role: 'student' });
      return null;
    });

  const deleteGroup = () => {
    if (!window.confirm(`«${group.name}» guruhi o'chirilsinmi? ${total} ta a'zo guruhdan chiqadi. Bu amalni qaytarib bo'lmaydi.`)) return;
    run(async () => {
      const { error: err } = await supabase.from('communities').delete().eq('id', group.id);
      if (err) return "Guruhni o'chirib bo'lmadi.";
      navigate('/groups');
      return null;
    });
  };

  const limitNumber = /^\d{1,4}$/.test(limitDraft) ? Number(limitDraft) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Link to="/groups" className="text-muted-foreground hover:text-foreground">&larr; Guruhlar</Link>
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      {notice && <p className="text-sm text-emerald-600" role="status">{notice}</p>}

      <Card title={group.name} right={<Pill tone="gray">{KIND_LABEL[group.kind]}</Pill>}>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Taklif havolasi {group.invite_enabled ? <Pill tone="green">Ochiq</Pill> : <Pill tone="red">O'chirilgan</Pill>}</div>
            <code className="block text-xs break-all rounded-lg bg-secondary px-3 py-2">{link}</code>
            <div className="flex flex-wrap gap-2 mt-2">
              <Btn onClick={copy}>Nusxalash</Btn>
              <Btn disabled={busy} onClick={regenerate}>Havolani yangilash</Btn>
              {isAdmin && <Btn tone={group.invite_enabled ? 'danger' : 'outline'} disabled={busy} onClick={toggleInvite}>{group.invite_enabled ? "Havolani o'chirish" : 'Havolani yoqish'}</Btn>}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Kunlik AI limit (har bir a'zo uchun)</div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <input value={limitDraft} onChange={(e) => setLimitDraft(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="umumiy" className={`${inputClass} w-24`} />
                <Btn tone="primary" disabled={busy || limitNumber === null} onClick={() => saveLimit(limitNumber)}>Saqlash</Btn>
                <Btn disabled={busy || group.ai_daily_limit === null} onClick={() => saveLimit(null)}>Umumiy limitga qaytarish</Btn>
              </div>
            ) : (
              <span className="text-sm">{group.ai_daily_limit === null ? 'umumiy limit' : group.ai_daily_limit}</span>
            )}
            <p className="text-xs text-muted-foreground mt-1">Foydalanuvchining o'z limiti bo'lsa, u ustun turadi. Bo'sh qoldirsangiz umumiy limit amal qiladi.</p>
          </div>
        </div>
      </Card>

      <Card title={`A'zolar (${total})`}>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali a'zo yo'q. Taklif havolasini yuboring.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {members.map((m) => {
                  const p = people[m.user_id];
                  const isMod = moderatorIds.includes(m.user_id);
                  return (
                    <tr key={m.user_id} className="border-t border-border align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold">{nameOf(p)}</div>
                        <div className="text-xs text-muted-foreground">{p?.username ? `@${p.username} · ` : ''}{p?.telegram_id}</div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {isMod && <Pill tone="amber">Moderator</Pill>} {p?.role === 'admin' && <Pill tone="blue">Admin</Pill>} {p?.blocked && <Pill tone="red">Bloklangan</Pill>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(m.joined_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {isAdmin && p?.role !== 'admin' && (isMod
                            ? <Btn disabled={busy} onClick={() => removeModerator(m.user_id)}>Moderatorlikdan olish</Btn>
                            : <Btn disabled={busy} onClick={() => addModerator(m.user_id)}>Moderator qilish</Btn>)}
                          <Btn tone="danger" disabled={busy} onClick={() => removeMember(m.user_id)}>Chiqarish</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {total > members.length && <p className="text-xs text-muted-foreground mt-2">Oxirgi {members.length} ta a'zo ko'rsatilgan (jami {total}).</p>}
          </div>
        )}
      </Card>

      {isAdmin && (
        <Card title="Xavfli amallar">
          <Btn tone="danger" disabled={busy} onClick={deleteGroup}>Guruhni o'chirish</Btn>
        </Card>
      )}
    </div>
  );
};
