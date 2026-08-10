import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const NAV_ITEMS = [
    { to: '/', label: 'Overview', end: true },
    { to: '/members', label: 'Members' },
    { to: '/chits', label: isAdmin ? 'Chit Management' : 'Chit' },
    { to: '/payments', label: 'Payments' },
    { to: '/funds', label: 'Funds' },
    { to: '/notifications', label: 'Notifications' },
    { to: '/documents', label: 'Documents' },
    { to: '/calculator', label: 'Chit Calculator' },
    { to: '/profile', label: isAdmin ? 'Admin Profile' : 'My Profile' },
  ];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 shrink-0 bg-navy text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <img src="/jfc-logo.png" alt="Jolly Friends Club logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-sm leading-tight">JOLLY FRIENDS CLUB</h1>
            <div className="text-[11px] text-white/70">Chit management system</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-gold text-navy' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-sm">
          <div className="text-white/60 text-xs uppercase tracking-wide">Signed in as</div>
          <div className="font-medium">{user?.phone}</div>
          <div className="text-gold-dim text-xs">{user?.role}</div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
          >
            Logout
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
