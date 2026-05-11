import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminLayout() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-slate-800 px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 text-sm font-bold">
              A
            </div>
            <span className="text-base font-semibold text-white">
              Admin Portal
            </span>
            <span className="rounded-full bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-200">
              ADMIN
            </span>
          </div>
          <button
            onClick={logout}
            className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}