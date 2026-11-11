import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, User } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { haptic } from '../../lib/telegram';

// Tab roots hide Telegram's back button; every other page shows it
export const TAB_ROOTS = ['/', '/subjects', '/assignments', '/profile'];

// Four sections in a floating bar; requests to the admin live in Profile
export const BottomNav: React.FC<{ lang: Language; openAssignments?: number }> = ({ lang, openAssignments = 0 }) => {
  const tabs = [
    { to: '/', icon: Home, label: tr(lang, 'Asosiy', 'Главная') },
    { to: '/subjects', icon: BookOpen, label: tr(lang, 'Fanlar', 'Предметы') },
    { to: '/assignments', icon: ClipboardList, label: tr(lang, 'Topshiriq', 'Задания'), badge: openAssignments },
    { to: '/profile', icon: User, label: tr(lang, 'Profil', 'Профиль') },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      <div className="max-w-md mx-auto flex gap-1 p-1.5 rounded-3xl bg-card/95 backdrop-blur border border-border shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)]">
        {tabs.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => haptic.tap()}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl text-[11px] font-bold transition-colors ${
                isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <span className="relative">
              <Icon size={20} />
              {!!badge && (
                <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4 text-center font-semibold">{badge}</span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
