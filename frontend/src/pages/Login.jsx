import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Login functionality will be added later')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>

        <p className="mt-2 text-sm text-slate-600">
          Teachers and students use the same login page.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="font-medium text-indigo-600 hover:text-indigo-800">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}