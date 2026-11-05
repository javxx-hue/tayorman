import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, type SignInResult } from './lib/auth';
import { BOT } from './lib/config';

// Code-split pages so the admin panel loads instantly without bundling heavy libraries (PDF, docx) upfront
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import('./pages/Users').then((m) => ({ default: m.UsersPage })));
const AuditPage = lazy(() => import('./pages/Audit').then((m) => ({ default: m.AuditPage })));
const RequestsPage = lazy(() => import('./pages/Requests').then((m) => ({ default: m.RequestsPage })));
const GroupsPage = lazy(() => import('./pages/Groups').then((m) => ({ default: m.GroupsPage })));
const GroupDetailPage = lazy(() => import('./pages/Groups').then((m) => ({ default: m.GroupDetailPage })));
const AssignmentsPage = lazy(() => import('./pages/Assignments').then((m) => ({ default: m.AssignmentsPage })));
const LibraryPage = lazy(() => import('./pages/Library').then((m) => ({ default: m.LibraryPage })));
const BroadcastsPage = lazy(() => import('./pages/Broadcasts').then((m) => ({ default: m.BroadcastsPage })));
const AccountsPage = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.AccountsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const IssuesPage = lazy(() => import('./pages/Issues').then((m) => ({ default: m.IssuesPage })));

const NAV: { to: string; label: string; adminOnly?: boolean; ownerOnly?: boolean }[] = [
  { to: '/', label: 'Umumiy ko\'rinish', adminOnly: true },
  { to: '/requests', label: "So'rovlar", adminOnly: true },
  { to: '/library', label: 'Kutubxona', adminOnly: true },
  { to: '/issues', label: 'Xatolar', adminOnly: true },
  { to: '/assignments', label: 'Topshiriqlar' },
  { to: '/broadcasts', label: 'Xabarlar', adminOnly: true },
  { to: '/groups', label: 'Guruhlar' },
  { to: '/users', label: 'Foydalanuvchilar' },
  { to: '/accounts', label: 'Hisoblar', adminOnly: true, ownerOnly: true },
  { to: '/settings', label: 'Sozlamalar', adminOnly: true },
  { to: '/audit', label: 'Jurnal', adminOnly: true },
];

const POLL_MS = 2000;
const WAIT_MS = 5 * 60 * 1000; // the bot's confirmation is valid for 5 minutes

const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

const FAILED: Record<'denied' | 'gone' | 'error', string> = {
  denied: "Bu Telegram hisobi uchun admin huquqi yo'q.",
  gone: 'Tasdiq eskirdi. Qayta urinib ko\'ring.',
  error: "Kirib bo'lmadi. Qayta urinib ko'ring.",
};

// Login and password the owner has given: for people who cannot or do not want to open Telegram each time
const PasswordForm: React.FC = () => {
  const { signInWithPassword } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await signInWithPassword(login, password);
    setBusy(false);
    if (result === 'ok') return;
    setPassword('');
    setMessage(
      result === 'denied'
        ? "Login yoki parol noto'g'ri. 5 marta xato kiritilsa, kirish 15 daqiqaga to'xtaydi."
        : "Kirib bo'lmadi. Qayta urinib ko'ring."
    );
  };

  return (
    <form onSubmit={submit} className="space-y-2 text-left">
      <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Login" autoComplete="username" autoCapitalize="none" spellCheck={false} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Parol" autoComplete="current-password" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
      {message && <p className="text-xs text-rose-600" role="alert">{message}</p>}
      <button type="submit" disabled={busy || !login.trim() || !password} className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50">
        {busy ? 'Tekshirilmoqda...' : 'Kirish'}
      </button>
    </form>
  );
};

// Opened from the bot's Admin button: Telegram already says who this is, so one tap is enough
const TelegramButton: React.FC<{ onFailed: (message: string) => void }> = ({ onFailed }) => {
  const { signInWithTelegram } = useAuth();
  const [busy, setBusy] = useState(false);
  const tap = async () => {
    setBusy(true);
    const result = await signInWithTelegram();
    setBusy(false);
    if (result !== 'ok') onFailed(FAILED[result === 'denied' ? 'denied' : 'error']);
  };
  return (
    <button onClick={tap} disabled={busy} className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50">
      {busy ? 'Tekshirilmoqda...' : 'Telegram hisobim bilan kirish'}
    </button>
  );
};

const SignedOut: React.FC = () => {
  const { error, inTelegram, signInWithNonce } = useAuth();
  const [nonce, setNonce] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const signIn = useRef(signInWithNonce);
  signIn.current = signInWithNonce;

  // Keeps asking until the admin has confirmed in the bot (or the time runs out)
  useEffect(() => {
    if (!nonce) return;
    let stopped = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (stopped) return;
      const result: SignInResult = await signIn.current(nonce);
      if (stopped || result === 'ok') return;
      if (result !== 'pending') {
        setFailed(FAILED[result]);
        return setNonce(null);
      }
      if (Date.now() - startedAt > WAIT_MS) {
        setFailed("Vaqt tugadi. Qayta urinib ko'ring.");
        return setNonce(null);
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [nonce]);

  const start = () => {
    const next = newNonce();
    setFailed(null);
    setNonce(next);
    window.open(`https://t.me/${BOT}?start=a_${next}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-serif font-bold">Admin</h1>
        {(failed || error) && <p className="text-sm text-rose-600" role="alert">{failed ?? error}</p>}
        {nonce ? (
          <>
            <p className="text-sm text-muted-foreground">Telegram'da bot ochildi. Botdagi kod bilan shu kod bir xilligini tekshiring va <b className="text-foreground">Tasdiqlash</b> ni bosing.</p>
            <div className="text-3xl font-mono font-bold tracking-widest">{nonce.slice(0, 4).toUpperCase()}</div>
            <p className="text-xs text-muted-foreground">Tasdiqlashni kutyapman...</p>
            <a href={`https://t.me/${BOT}?start=a_${nonce}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Bot ochilmadimi? Qayta ochish</a>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Login va parolingizni kiriting. Ularni sayt egasi beradi.</p>
            <PasswordForm />
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex-1 border-t border-border" />yoki<span className="flex-1 border-t border-border" /></div>
            {inTelegram ? (
              <TelegramButton onFailed={setFailed} />
            ) : (
              <button onClick={start} className="w-full px-4 py-2.5 rounded-xl border border-border font-semibold text-sm hover:bg-secondary">Telegram orqali kirish (bot tasdiqlaydi)</button>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">Faqat administratorlar va moderatorlar kira oladi.</p>
      </div>
    </div>
  );
};

const Shell: React.FC = () => {
  const { me, owner, signOut } = useAuth();
  const isAdmin = me?.role === 'admin';
  const items = NAV.filter((n) => (isAdmin || !n.adminOnly) && (owner || !n.ownerOnly));
  const home = isAdmin ? '/' : '/users';

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card p-3 md:p-4 flex md:flex-col gap-2 md:gap-1 overflow-x-auto">
        <div className="hidden md:block text-lg font-serif font-bold px-2 pb-3">Admin</div>
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${isActive ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-secondary'}`}
          >
            {n.label}
          </NavLink>
        ))}
        <div className="md:mt-auto flex md:flex-col items-center md:items-stretch gap-2 ml-auto md:ml-0 text-xs text-muted-foreground">
          <span className="px-2 whitespace-nowrap">{me?.first_name ?? 'Admin'} · {isAdmin ? 'admin' : 'moderator'}</span>
          <button onClick={signOut} className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-foreground whitespace-nowrap">Chiqish</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-6 max-w-6xl w-full">
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>}>
          <Routes>
            <Route path="/" element={isAdmin ? <DashboardPage /> : <Navigate to={home} replace />} />
            <Route path="/requests" element={isAdmin ? <RequestsPage /> : <Navigate to={home} replace />} />
            <Route path="/issues" element={isAdmin ? <IssuesPage /> : <Navigate to={home} replace />} />
            <Route path="/library" element={isAdmin ? <LibraryPage /> : <Navigate to={home} replace />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/broadcasts" element={isAdmin ? <BroadcastsPage /> : <Navigate to={home} replace />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/accounts" element={owner ? <AccountsPage /> : <Navigate to={home} replace />} />
            <Route path="/settings" element={isAdmin ? <SettingsPage /> : <Navigate to={home} replace />} />
            <Route path="/audit" element={isAdmin ? <AuditPage /> : <Navigate to={home} replace />} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

const Gate: React.FC = () => {
  const { status } = useAuth();
  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Yuklanmoqda...</div>;
  return status === 'ready' ? <Shell /> : <SignedOut />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
