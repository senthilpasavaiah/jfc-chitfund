import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/members', label: 'Members' },
  { to: '/chits', label: 'Chits' },
  { to: '/expenses', label: 'Expenses' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-60 shrink-0 bg-ledger text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="text-xs uppercase tracking-[0.2em] text-gold-light">Jolly Friends Club</div>
          <h1 className="font-display text-xl mt-1">Chit Ledger</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-gold text-ledger' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-sm">
          <div className="text-white/60 text-xs uppercase tracking-wide">Signed in as</div>
          <div className="font-medium">{user?.phone}</div>
          <div className="text-gold-light text-xs">{user?.role}</div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-paper overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
