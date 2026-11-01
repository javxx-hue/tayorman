import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, MessageSquarePlus, ClipboardList, User } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { haptic } from '../../lib/telegram';

// Tab roots hide Telegram's back button; every other page shows it
export const TAB_ROOTS = ['/', '/assignments', '/subjects', '/request', '/profile'];

export const BottomNav: React.FC<{ lang: Language; openAssignments?: number }> = ({ lang, openAssignments = 0 }) => {
  const tabs = [
    { to: '/', icon: Home, label: tr(lang, 'Bugun', 'Сегодня') },
    { to: '/assignments', icon: ClipboardList, label: tr(lang, 'Topshiriq', 'Задания'), badge: openAssignments },
    { to: '/subjects', icon: BookOpen, label: tr(lang, 'Fanlar', 'Предметы') },
    { to: '/request', icon: MessageSquarePlus, label: tr(lang, "So'rov", 'Запрос') },
    { to: '/profile', icon: User, label: tr(lang, 'Profil', 'Профиль') },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-3xl mx-auto flex">
        {tabs.map(({ to, icon: Icon, label, badge }) => (
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
