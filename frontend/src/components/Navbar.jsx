import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, isTeacher, isStudent } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname || ''

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  //  Hide navbar if not logged in
  if (!user) return null

  const linkBase =
    'rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 hover:text-slate-900'
  const linkActive = 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/60'
  const linkInactive = 'text-slate-700'

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        
        <Link
          to="/"
          className="text-lg font-semibold text-indigo-900 transition hover:text-indigo-700"
        >
          Adaptive Learning
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {isTeacher && (
            <>
              <Link
                to="/teacher"
                className={`${linkBase} ${
                  pathname === '/teacher' ? linkActive : linkInactive
                }`}
              >
                Dashboard
              </Link>

              <Link
                to="/teacher/quizzes"
                className={`${linkBase} ${
                  pathname.startsWith('/teacher/quizzes')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Quizzes
              </Link>

              <Link
                to="/teacher/materials"
                className={`${linkBase} ${
                  pathname.startsWith('/teacher/materials')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Materials
              </Link>
            </>
          )}

          {isStudent && (
            <>
              <Link
                to="/student"
                className={`${linkBase} ${
                  pathname === '/student' ||
                  pathname.startsWith('/student/quiz/')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Dashboard
              </Link>

              <Link
                to="/student/quizzes"
                className={`${linkBase} ${
                  pathname.startsWith('/student/quizzes')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Quizzes
              </Link>

              <Link
                to="/student/progress"
                className={`${linkBase} ${
                  pathname.startsWith('/student/progress')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Progress
              </Link>

              <Link
                to="/student/materials"
                className={`${linkBase} ${
                  pathname.startsWith('/student/materials')
                    ? linkActive
                    : linkInactive
                }`}
              >
                Materials
              </Link>
            </>
          )}
        </nav>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          
          {/* ✅ Safe access */}
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user?.full_name || user?.email}
          </span>

          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-indigo-800">
            {user?.role}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}