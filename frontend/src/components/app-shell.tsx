import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/map', label: 'карта' },
  { to: '/events', label: 'журнал' },
  { to: '/dashboard', label: 'сводка' },
];

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="chrome">
        <NavLink to="/map" className="brand">
          Монитор
        </NavLink>
        <div className="hair" aria-hidden="true" />
        <nav className="filters" aria-label="Разделы">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="control">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
