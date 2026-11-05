import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { copyText } from '../lib/clipboard';
import { Btn, Card, Pill, timeAgo } from '../ui';

interface Account {
  id: string;
  first_name: string | null;
  username: string | null;
  role: 'admin' | 'moderator';
  suggested: string;
  credential: { login: string; created_at: string; password_changed_at: string; last_login_at: string | null; locked_until: string | null } | null;
}
interface Issued {
  name: string;
  login: string;
  password: string;
}

const MESSAGES: Record<string, string> = {
  password_short: "Parol kamida 10 belgidan iborat bo'lishi kerak.",
  password_long: 'Parol juda uzun (eng ko\'pi 100 belgi).',
  password_contains_login: "Parolda login bo'lmasligi kerak.",
  password_common: "Parol juda oddiy. Boshqasini tanlang yoki bo'sh qoldiring, tizim o'zi yaratadi.",
  'This login is already used': 'Bu login band. Boshqasini tanlang.',
  'Login: 3-32 characters, a-z, 0-9, dot, dash or underscore': "Login 3-32 belgi: a-z, 0-9, nuqta, chiziq yoki pastki chiziq. Bosh harf va bo'sh joy mumkin emas.",
};

const call = async <T,>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('admin-accounts', { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    const message = await res?.json().then((j: { error?: string }) => j.error).catch(() => undefined);
    return { error: (message && MESSAGES[message]) ?? message ?? "So'rov bajarilmadi" };
  }
  return { data: data as T };
};

const nameOf = (a: Account) => a.first_name ?? a.username ?? 'Admin';

// Only the owner sees this page. The owner can type a login and password or let the server make the password;
// the server stores only a hash, so a password cannot be read back afterwards.
export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const r = await call<{ accounts: Account[] }>({ action: 'list' });
    if (r.error) return setError(r.error);
    setAccounts(r.data!.accounts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (a: Account) => {
    setEditing(a);
    setLogin(a.credential?.login ?? a.suggested);
    setPassword('');
    setReveal(false);
    setIssued(null);
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(editing.id);
    setError(null);
    const r = await call<{ login: string; password: string }>({ action: 'issue', userId: editing.id, login, password });
    setBusy(null);
    if (r.error) return setError(r.error);
    setCopied(null);
    setIssued({ name: nameOf(editing), login: r.data!.login, password: r.data!.password });
    setEditing(null);
    setPassword('');
    load();
  };

  const revoke = async (a: Account) => {
    if (!confirm(`${nameOf(a)} ning login va paroli o'chirilsinmi? U Telegram orqali kira oladi.`)) return;
    setBusy(a.id);
    const r = await call({ action: 'revoke', userId: a.id });
    setBusy(null);
    if (r.error) return setError(r.error);
    load();
  };

  const copy = async () => {
    if (!issued) return;
    setCopied(await copyText(`Login: ${issued.login}\nParol: ${issued.password}`));
  };

  const input = 'w-full px-3 py-2 rounded-xl border border-border bg-background text-sm';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-serif font-bold">Hisoblar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adminlar va moderatorlar saytga login va parol bilan kiradi. Faqat siz (ega) bera olasiz. Loginni ham, parolni ham o'zingiz yozishingiz mumkin; parolni bo'sh qoldirsangiz, tizim kuchli parol yaratadi. Yangi odam uchun avval uni admin ro'yxatiga yoki moderatorlikka qo'shing, so'ng shu yerdan login bering.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {editing && (
        <Card title={`${nameOf(editing)}: ${editing.credential ? 'yangi parol' : 'login va parol'}`}>
          <form onSubmit={save} className="space-y-3">
            {editing.credential && <p className="text-xs text-amber-700 dark:text-amber-300">Eski parol ishlamay qoladi.</p>}
            <label className="block text-xs text-muted-foreground space-y-1">
              Login
              <input value={login} onChange={(e) => setLogin(e.target.value)} className={input} autoCapitalize="none" autoComplete="off" spellCheck={false} />
            </label>
            <label className="block text-xs text-muted-foreground space-y-1">
              Parol (kamida 10 belgi; bo'sh qoldirsangiz, tizim yaratadi)
              <div className="flex gap-2">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={reveal ? 'text' : 'password'} className={input} autoComplete="new-password" spellCheck={false} />
                <Btn type="button" onClick={() => setReveal((v) => !v)}>{reveal ? 'Yashirish' : "Ko'rsatish"}</Btn>
              </div>
            </label>
            <div className="flex gap-2">
              <Btn type="submit" tone="primary" disabled={busy === editing.id || !login.trim()}>{busy === editing.id ? 'Saqlanmoqda...' : 'Saqlash'}</Btn>
              <Btn type="button" onClick={() => setEditing(null)}>Bekor qilish</Btn>
            </div>
          </form>
        </Card>
      )}

      {issued && (
        <Card title={`${issued.name} uchun login va parol saqlandi`} className="border-amber-500/40 bg-amber-500/5">
          <div className="space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">Login</span>
              <code className="font-mono font-semibold break-all select-all">{issued.login}</code>
              <span className="text-muted-foreground">Parol</span>
              <code className="font-mono font-semibold break-all select-all">{issued.password}</code>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300">Parol faqat hozir ko'rinadi: yopsangiz, uni qayta ko'rib bo'lmaydi (faqat yangisini berish mumkin). Uni odamga shaxsan yoki yopiq xabarda yuboring.</p>
            {copied === false && <p className="text-xs text-rose-600" role="alert">Avtomatik nusxalab bo'lmadi. Login va parolni belgilab (bosib turib) qo'lda nusxalang.</p>}
            <div className="flex gap-2">
              <Btn tone="primary" onClick={copy}>{copied ? 'Nusxalandi' : 'Nusxalash'}</Btn>
              <Btn onClick={() => setIssued(null)}>Yopish</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {!accounts ? (
          <p className="text-sm text-muted-foreground">{error ? '' : 'Yuklanmoqda...'}</p>
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => {
              const locked = a.credential?.locked_until && Date.parse(a.credential.locked_until) > Date.now();
              return (
                <li key={a.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {a.first_name ?? 'Nomsiz'} {a.username && <span className="font-normal text-muted-foreground">@{a.username}</span>}{' '}
                      <Pill tone={a.role === 'admin' ? 'blue' : 'gray'}>{a.role === 'admin' ? 'admin' : 'moderator'}</Pill>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.credential ? (
                        <>
                          Login: <code className="font-mono">{a.credential.login}</code> · parol {timeAgo(a.credential.password_changed_at)} berilgan ·{' '}
                          {a.credential.last_login_at ? `oxirgi kirish ${timeAgo(a.credential.last_login_at)}` : 'hali kirmagan'}
                          {locked && <> · <Pill tone="amber">vaqtincha to'xtatilgan</Pill></>}
                        </>
                      ) : (
                        'Login va parol berilmagan'
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn tone={a.credential ? 'outline' : 'primary'} disabled={busy === a.id} onClick={() => open(a)}>
                      {a.credential ? 'Yangi parol' : 'Login va parol berish'}
                    </Btn>
                    {a.credential && (
                      <Btn tone="danger" disabled={busy === a.id} onClick={() => revoke(a)}>
                        O'chirish
                      </Btn>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
