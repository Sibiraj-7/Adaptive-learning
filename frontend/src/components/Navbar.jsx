import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()
  const pathname = location.pathname || ''

  const linkBase =
    'rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 hover:text-slate-900'
  const linkActive = 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/60'
  const linkInactive = 'text-slate-700'

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="text-lg font-semibold text-indigo-900 transition hover:text-indigo-700"
        >
          Adaptive Learning
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className={`${linkBase} ${
              pathname === '/' ? linkActive : linkInactive
            }`}
          >
            Home
          </Link>

          <Link
            to="/login"
            className={`${linkBase} ${
              pathname === '/login' ? linkActive : linkInactive
            }`}
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  )
}