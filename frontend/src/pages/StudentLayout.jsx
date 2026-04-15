import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'

export default function StudentLayout() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'student') return <Navigate to="/" replace />

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
