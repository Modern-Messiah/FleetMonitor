import { NavLink, Outlet } from 'react-router-dom';
import { LocaleSwitch, MessageKey, useI18n } from '@/lib/i18n';

const navItems: Array<{ to: string; label: MessageKey }> = [
  { to: '/map', label: 'map' },
  { to: '/events', label: 'journal' },
  { to: '/dashboard', label: 'summary' },
];

export function AppShell() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <header className="chrome">
        <NavLink to="/map" className="brand">
          {t('brand')}
        </NavLink>
        <div className="hair" aria-hidden="true" />
        <nav className="filters" aria-label={t('sections')}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="control">
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <LocaleSwitch />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
