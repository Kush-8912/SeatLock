import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Ticket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navClass = ({ isActive }) =>
  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg">SeatLock</span>
          </Link>
          <nav className="flex items-center gap-1">
            {user?.role === 'organizer' && (
              <NavLink to="/organizer" className={navClass}>
                <LayoutDashboard className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">My events</span>
              </NavLink>
            )}
            {user?.role === 'attendee' && (
              <NavLink to="/tickets" className={navClass}>
                <Ticket className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">My tickets</span>
              </NavLink>
            )}
            {user ? (
              <>
                <span className="hidden px-2 text-sm text-slate-500 md:inline">Hi, {user.name.split(' ')[0]}</span>
                <button type="button" className="btn-ghost" onClick={async () => { await logout(); navigate('/'); }} aria-label="Log out">
                  <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Log out</span>
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>Log in</NavLink>
                <Link to="/register" className="btn-primary">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        SeatLock · demo payments only, no real money is charged
      </footer>
    </div>
  );
}
