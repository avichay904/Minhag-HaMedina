import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { LanguageToggle } from './LanguageToggle';
import { useAuth } from '../../features/auth/useAuth';
import { RankChip } from './RankChip';

interface NavItem {
  to: string;
  icon: string;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: '📊', labelKey: 'nav.survey' },
  { to: '/leaderboard', icon: '🏅', labelKey: 'nav.leaderboard' },
  { to: '/results', icon: '📈', labelKey: 'nav.results' },
  { to: '/profile', icon: '👤', labelKey: 'nav.profile' },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const location = useLocation();
  const isHe = i18n.language === 'he';

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-brand-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-brand-100/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🗺️</span>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-brand-900 text-base">{t('app.name')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && <RankChip rank={profile.rank} size="sm" />}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto w-full pb-24">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav
        className={clsx(
          'fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-brand-100/60',
          'safe-area-inset-bottom shadow-[0_-4px_20px_rgba(30,58,95,0.08)]',
        )}
        aria-label={isHe ? 'ניווט ראשי' : 'Main navigation'}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center gap-0.5 flex-1 py-1 group"
                aria-label={t(item.labelKey)}
              >
                <span
                  className={clsx(
                    'text-xl transition-transform duration-200',
                    isActive ? 'scale-110' : 'group-hover:scale-105',
                  )}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span
                  className={clsx(
                    'text-[10px] font-semibold transition-colors duration-200',
                    isActive ? 'text-brand-600' : 'text-brand-400',
                  )}
                >
                  {t(item.labelKey)}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-0.5 inset-x-2 h-0.5 bg-brand-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
