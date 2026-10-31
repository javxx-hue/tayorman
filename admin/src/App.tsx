import React from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { AuditPage } from './pages/Audit';

const NAV: { to: string; label: string; adminOnly?: boolean }[] = [
  { to: '/', label: 'Umumiy ko\'rinish', adminOnly: true },
  { to: '/users', label: 'Foydalanuvchilar' },
  { to: '/audit', label: 'Jurnal', adminOnly: true },
];

const SignedOut: React.FC = () => {
  const { error } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-serif font-bold">Admin</h1>
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Kirish uchun Telegram'da botga <b className="text-foreground">/admin</b> deb yozing. Bot 5 daqiqa amal qiladigan, bir martalik havola yuboradi.
        </p>
        <p className="text-xs text-muted-foreground">Parol yo'q. Faqat administratorlar va moderatorlar kira oladi.</p>
      </div>
    </div>
  );
};

const Shell: React.FC = () => {
  const { me, signOut } = useAuth();
  const isAdmin = me?.role === 'admin';
  const items = NAV.filter((n) => isAdmin || !n.adminOnly);
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
        <Routes>
          <Route path="/" element={isAdmin ? <DashboardPage /> : <Navigate to={home} replace />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit" element={isAdmin ? <AuditPage /> : <Navigate to={home} replace />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
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
