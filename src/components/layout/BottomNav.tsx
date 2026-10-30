import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Library, User, Shield } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { haptic } from '../../lib/telegram';

// Tab roots hide Telegram's back button; every other page shows it
export const TAB_ROOTS = ['/', '/subjects', '/library', '/profile', '/admin'];

export const BottomNav: React.FC<{ lang: Language }> = ({ lang }) => {
  const { isAdmin } = useAuth();
  const tabs = [
    { to: '/', icon: Home, label: tr(lang, 'Bugun', 'Сегодня') },
    { to: '/subjects', icon: BookOpen, label: tr(lang, 'Fanlar', 'Предметы') },
    { to: '/library', icon: Library, label: tr(lang, 'Kutubxona', 'Библиотека') },
    { to: '/profile', icon: User, label: tr(lang, 'Profil', 'Профиль') },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-3xl mx-auto flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => haptic.tap()}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
