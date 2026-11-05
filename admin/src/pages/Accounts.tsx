import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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

const call = async <T,>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('admin-accounts', { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    const message = await res?.json().then((j: { error?: string }) => j.error).catch(() => undefined);
    return { error: message ?? "So'rov bajarilmadi" };
  }
  return { data: data as T };
};

// Only the owner sees this page. Passwords are made by the server and shown once; nobody can read them again.
export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await call<{ accounts: Account[] }>({ action: 'list' });
    if (r.error) return setError(r.error);
    setError(null);
    setAccounts(r.data!.accounts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async (a: Account) => {
    const name = a.first_name ?? a.username ?? 'Admin';
    if (a.credential && !confirm(`${name} ning eski paroli ishlamay qoladi. Yangi parol berilsinmi?`)) return;
    let login = a.credential?.login ?? a.suggested;
    if (!a.credential) {
      const typed = prompt(`${name} uchun login (a-z, 0-9, nuqta, chiziq; 3-32 belgi):`, login);
      if (typed === null) return;
      login = typed;
    }
    setBusy(a.id);
    setError(null);
    const r = await call<{ login: string; password: string }>({ action: 'issue', userId: a.id, login });
    setBusy(null);
    if (r.error) return setError(r.error);
    setCopied(false);
    setIssued({ name, login: r.data!.login, password: r.data!.password });
    load();
  };

  const revoke = async (a: Account) => {
    if (!confirm(`${a.first_name ?? a.username ?? 'Admin'} ning login va paroli o'chirilsinmi? Telegram orqali kira oladi.`)) return;
    setBusy(a.id);
    const r = await call({ action: 'revoke', userId: a.id });
    setBusy(null);
    if (r.error) return setError(r.error);
    load();
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(`Login: ${issued.login}\nParol: ${issued.password}`);
      setCopied(true);
    } catch {
      setError("Nusxalab bo'lmadi. Login va parolni qo'lda ko'chiring.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-serif font-bold">Hisoblar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adminlar va moderatorlar saytga Telegramsiz, login va parol bilan ham kira oladi. Faqat siz (ega) berasiz. Parolni tizim o'zi yaratadi va faqat bir marta ko'rsatadi. Yangi odam uchun avval uni admin ro'yxatiga yoki moderatorlikka qo'shing, so'ng shu yerdan login bering.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {issued && (
        <Card title={`${issued.name} uchun yangi login va parol`} className="border-amber-500/40 bg-amber-500/5">
          <div className="space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">Login</span>
              <code className="font-mono font-semibold break-all">{issued.login}</code>
              <span className="text-muted-foreground">Parol</span>
              <code className="font-mono font-semibold break-all select-all">{issued.password}</code>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300">Parol faqat hozir ko'rinadi. Yopsangiz, uni qayta ko'rib bo'lmaydi (faqat yangisini berish mumkin). Uni odamga shaxsan yoki yopiq xabarda yuboring.</p>
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
                    <Btn tone={a.credential ? 'outline' : 'primary'} disabled={busy === a.id} onClick={() => issue(a)}>
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
