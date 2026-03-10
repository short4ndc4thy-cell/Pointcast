import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-accent-blue flex items-center justify-center font-mono font-bold text-sm text-white group-hover:shadow-lg group-hover:shadow-accent-blue/30 transition-shadow">
              P
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              Point<span className="text-accent-blue">Cast</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white rounded-md hover:bg-surface-200 transition-colors">
              Markets
            </Link>
            <Link to="/leaderboard" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white rounded-md hover:bg-surface-200 transition-colors">
              Leaderboard
            </Link>
            {profile?.is_admin && (
              <Link to="/admin" className="px-3 py-1.5 text-sm text-accent-blue hover:text-blue-400 rounded-md hover:bg-surface-200 transition-colors">
                Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user && profile ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-200 transition-colors">
                  <span className="text-sm text-gray-300">{profile.username}</span>
                  <span className="font-mono text-sm font-semibold text-accent-green">
                    {profile.points?.toLocaleString()} pts
                  </span>
                </Link>
                <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Log In
                </Link>
                <Link to="/signup" className="btn-primary text-sm !py-1.5">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-md hover:bg-surface-200">
              Markets
            </Link>
            <Link to="/leaderboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-md hover:bg-surface-200">
              Leaderboard
            </Link>
            {profile?.is_admin && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-accent-blue hover:text-blue-400 rounded-md hover:bg-surface-200">
                Admin
              </Link>
            )}
            {user && profile ? (
              <>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-300">
                  {profile.username} — <span className="font-mono text-accent-green">{profile.points?.toLocaleString()} pts</span>
                </Link>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="block w-full text-left px-3 py-2 text-sm text-gray-400">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-300">Log In</Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-accent-blue">Sign Up</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
