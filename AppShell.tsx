import { useState, type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS: Record<string, ReactElement> = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  members: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20" /><circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M19 20v-1.5a3.5 3.5 0 0 0-2.5-3.36" /><path d="M15 4.13a3.5 3.5 0 0 1 0 6.74" />
    </svg>
  ),
  chits: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" />
    </svg>
  ),
  funds: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 4l9 5.5" /><path d="M4.5 9.5v9M9 9.5v9M15 9.5v9M19.5 9.5v9" /><path d="M2.5 21h19" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 2.5Z" /><path d="M13.5 2.5V8a1 1 0 0 0 1 1H19.5" />
      <path d="M8.5 13h7M8.5 16.5h7M8.5 9.5h2" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V10M10 19V5M16 19v-7M20 19H4" />
    </svg>
  ),
  calculator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M8 6.5h8" />
      <circle cx="8.3" cy="11" r="0.9" fill="currentColor" stroke="none" /><circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="11" r="0.9" fill="currentColor" stroke="none" /><circle cx="8.3" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="15.7" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8.3" cy="18" r="0.9" fill="currentColor" stroke="none" /><rect x="11" y="17" width="5.6" height="1.9" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.25" /><circle cx="12" cy="10" r="3.2" /><path d="M5.5 19a7 7 0 0 1 13 0" />
    </svg>
  ),
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_ITEMS = [
    { to: '/', key: 'overview', label: 'Overview', end: true },
    { to: '/members', key: 'members', label: 'Members' },
    { to: '/chits', key: 'chits', label: isAdmin ? 'Chit Management' : 'Chit' },
    { to: '/payments', key: 'payments', label: 'Payments' },
    { to: '/funds', key: 'funds', label: 'Funds' },
    { to: '/notifications', key: 'notifications', label: 'Notifications' },
    { to: '/documents', key: 'documents', label: 'Documents' },
    { to: '/reports', key: 'reports', label: 'Reports' },
    { to: '/calculator', key: 'calculator', label: 'Chit Calculator' },
    { to: '/profile', key: 'profile', label: isAdmin ? 'Admin Profile' : 'My Profile' },
  ];

  // Matches the prototype's own `titles` map exactly - the topbar heading is
  // a longer descriptive title, distinct from the shorter sidebar label.
  const PAGE_TITLES: Record<string, string> = {
    '/': 'Overview',
    '/members': 'Members',
    '/chits': isAdmin ? 'Chit Management' : 'Chit',
    '/payments': 'Payment Management',
    '/funds': 'Fund & Expense Tracking',
    '/notifications': 'Notifications & Communication',
    '/documents': 'Association Documents',
    '/reports': 'Reports',
    '/calculator': 'Chit Calculator',
    '/profile': isAdmin ? 'Admin Profile' : 'My Profile',
  };
  const currentPath = location.pathname.startsWith('/chits/') ? '/chits' : location.pathname;
  const pageTitle = PAGE_TITLES[currentPath] || 'Overview';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const displayName = user?.name || user?.phone || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full min-h-screen relative">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`bg-navy text-white flex flex-col shrink-0 transition-all duration-200 z-40
          fixed md:static inset-y-0 left-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-20' : 'md:w-64'} w-64`}
        style={{ background: 'linear-gradient(180deg, #00203f 0%, #001529 100%)' }}
      >
        <div className={`px-4 py-5 border-b border-white/10 flex items-center gap-3 overflow-hidden`}>
          <img src="/jfc-logo.png" alt="Jolly Friends Club logo" className="w-9 h-9 object-contain shrink-0" />
          <div
            className="transition-all duration-200 overflow-hidden whitespace-nowrap"
            style={collapsed ? { opacity: 0, maxWidth: 0 } : { opacity: 1, maxWidth: 200 }}
          >
            <h1 className="font-bold text-sm leading-tight">JOLLY FRIENDS CLUB</h1>
            <div className="text-[11px] text-white/70">Chit management system</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer overflow-hidden ${
                  isActive ? 'bg-gold text-navy' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
              title={item.label}
            >
              <span className="w-5 h-5 shrink-0">{ICONS[item.key]}</span>
              <span
                className="transition-all duration-200 overflow-hidden whitespace-nowrap"
                style={collapsed ? { opacity: 0, maxWidth: 0 } : { opacity: 1, maxWidth: 200 }}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 text-sm">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs hover:bg-white/10 transition-colors cursor-pointer overflow-hidden"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
            <span
              className="transition-all duration-200 overflow-hidden whitespace-nowrap"
              style={collapsed ? { opacity: 0, maxWidth: 0 } : { opacity: 1, maxWidth: 100 }}
            >
              Logout
            </span>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex items-center justify-center absolute -right-3 top-16 w-6 h-6 rounded-full bg-navy-light border-2 border-navy-dark text-white cursor-pointer hover:bg-gold hover:text-navy transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - title + welcome live here, matching the prototype exactly */}
        <header className="bg-white border-b border-line px-4 md:px-7 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden cursor-pointer text-ink shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold text-ink leading-tight truncate">{pageTitle}</h1>
              <div className="text-xs text-ink-muted mt-0.5">Welcome, {displayName}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button className="cursor-pointer text-ink-muted hover:text-navy transition-colors relative p-1.5" title="Notifications" onClick={() => navigate('/notifications')}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-gold text-navy font-bold text-[13px] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              title={displayName}
            >
              {initials || 'U'}
            </button>
          </div>
        </header>

        <main className="flex-1 bg-paper overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
