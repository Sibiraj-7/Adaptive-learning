import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, user } = useAuth()
  const navigate        = useNavigate()
  const location        = useLocation()
  const from            = location.state?.from?.pathname

  const [mode, setMode]         = useState('user')   // 'user' | 'admin'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  if (user) {
    if (user.role === 'admin')   return <Navigate to="/admin"   replace />
    if (user.role === 'teacher') return <Navigate to="/teacher" replace />
    return <Navigate to="/student" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'admin') {
        const data = await api.adminLogin(email.trim(), password)
        login(data.token, data.user)
        navigate('/admin', { replace: true })
      } else {
        const data = await api.login(email.trim(), password)
        login(data.token, data.user)
        const dest = from || (data.user.role === 'teacher' ? '/teacher' : '/student')
        navigate(dest, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = mode === 'admin'

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center px-4 py-12 transition-colors duration-300
      ${isAdmin ? 'bg-gradient-to-b from-slate-800 to-slate-900' : 'bg-gradient-to-b from-indigo-50 to-slate-50'}`}
    >
      <div className={`w-full max-w-md rounded-2xl border p-8 shadow-xl transition-colors duration-300
        ${isAdmin
          ? 'border-slate-600 bg-slate-800 shadow-slate-900/50'
          : 'border-slate-200 bg-white shadow-slate-200/50'
        }`}
      >
        <div className={`flex rounded-xl p-1 mb-6 ${isAdmin ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <button
            type="button"
            onClick={() => { setMode('user'); setError('') }}
            className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition
              ${!isAdmin
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            👨‍🎓 Student / Teacher
          </button>
          <button
            type="button"
            onClick={() => { setMode('admin'); setError('') }}
            className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition
              ${isAdmin
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            🔐 Admin
          </button>
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-bold ${isAdmin ? 'text-white' : 'text-slate-900'}`}>
          {isAdmin ? 'Admin Portal' : 'Sign in'}
        </h1>
        <p className={`mt-1 text-sm ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`}>
          {isAdmin
            ? 'Restricted access — administrators only.'
            : 'Students and teachers use the same login.'}
        </p>

        {/* Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div>
            <label className={`block text-sm font-medium ${isAdmin ? 'text-slate-300' : 'text-slate-700'}`}>
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2
                ${isAdmin
                  ? 'border-slate-600 bg-slate-700 text-white placeholder-slate-500 focus:border-slate-400 focus:ring-slate-400/20'
                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${isAdmin ? 'text-slate-300' : 'text-slate-700'}`}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2
                ${isAdmin
                  ? 'border-slate-600 bg-slate-700 text-white placeholder-slate-500 focus:border-slate-400 focus:ring-slate-400/20'
                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full cursor-pointer rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60
              ${isAdmin
                ? 'bg-slate-600 hover:bg-slate-500 shadow-slate-900/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
              }`}
          >
            {loading ? 'Signing in…' : isAdmin ? 'Sign in as Admin' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className={`text-sm font-medium transition
              ${isAdmin ? 'text-slate-400 hover:text-slate-200' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}