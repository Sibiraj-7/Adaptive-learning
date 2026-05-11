import { useEffect, useState } from 'react'
import { api } from '../services/api'

const ROLES = ['student', 'teacher']

export default function AdminDashboard() {
  const [stats, setStats]         = useState(null)
  const [students, setStudents]   = useState([])
  const [teachers, setTeachers]   = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [form, setForm] = useState({
    role: 'student', full_name: '', email: '', password: '', department: '',
  })
  const [formError, setFormError]     = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const [resetUserId, setResetUserId]     = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetMsg, setResetMsg]           = useState('')

  const [editUserId, setEditUserId]   = useState('')
  const [editForm, setEditForm]       = useState({ full_name: '', email: '', department: '' })
  const [editMsg, setEditMsg]         = useState('')
  const [editLoading, setEditLoading] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, t, st] = await Promise.all([
        api.adminGetUsers('student'),
        api.adminGetUsers('teacher'),
        api.adminGetStats(),
      ])
      setStudents(s.users || [])
      setTeachers(t.users || [])
      setStats(st)
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setFormLoading(true)
    try {
      await api.adminCreateUser(form)
      setFormSuccess(`${form.role === 'student' ? 'Student' : 'Teacher'} account created successfully!`)
      setForm({ role: form.role, full_name: '', email: '', password: '', department: '' })
      loadAll()
    } catch (err) {
      setFormError(err.message || 'Failed to create user')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Delete account for ${name}? This cannot be undone.`)) return
    try {
      await api.adminDeleteUser(userId)
      loadAll()
    } catch (err) {
      alert(err.message || 'Failed to delete user')
    }
  }

  const handleResetPassword = async (userId) => {
    if (!resetPassword || resetPassword.length < 6) {
      setResetMsg('Password must be at least 6 characters')
      return
    }
    try {
      await api.adminResetPassword(userId, resetPassword)
      setResetMsg('Password reset successfully!')
      setResetUserId('')
      setResetPassword('')
    } catch (err) {
      setResetMsg(err.message || 'Failed to reset password')
    }
  }

  const openEdit = (user) => {
    setEditUserId(user._id)
    setEditForm({
      full_name:  user.full_name  || '',
      email:      user.email      || '',
      department: user.department || '',
    })
    setEditMsg('')
    setResetUserId('')
  }

  const handleEdit = async (userId) => {
    setEditLoading(true)
    setEditMsg('')
    try {
      await api.adminUpdateUser(userId, editForm)
      setEditMsg('Updated successfully!')
      loadAll()
    } catch (err) {
      setEditMsg(err.message || 'Failed to update')
    } finally {
      setEditLoading(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'students', label: `👨‍🎓 Students (${students.length})` },
    { id: 'teachers', label: `👨‍🏫 Teachers (${teachers.length})` },
    { id: 'create',   label: '➕ Create User' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-slate-500">Manage users and monitor system activity</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`cursor-pointer rounded-t-lg px-4 py-2 text-sm font-medium transition
              ${activeTab === t.id
                ? 'border-b-2 border-slate-800 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Students', value: stats.total_students, color: 'text-indigo-600' },
              { label: 'Total Teachers', value: stats.total_teachers, color: 'text-emerald-600' },
              { label: 'Total Quizzes',  value: stats.total_quizzes,  color: 'text-amber-600' },
              { label: 'Total Attempts', value: stats.total_attempts, color: 'text-rose-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {stats.dept_breakdown?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Department-wise Student Count</h2>
              <div className="space-y-3">
                {stats.dept_breakdown.map((d) => (
                  <div key={d.department} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-slate-700 truncate">{d.department}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, (d.count / stats.total_students) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <UserTable
          users={students}
          role="student"
          onDelete={handleDelete}
          resetUserId={resetUserId}
          setResetUserId={setResetUserId}
          resetPassword={resetPassword}
          setResetPassword={setResetPassword}
          resetMsg={resetMsg}
          setResetMsg={setResetMsg}
          onResetPassword={handleResetPassword}
          editUserId={editUserId}
          editForm={editForm}
          setEditForm={setEditForm}
          editMsg={editMsg}
          editLoading={editLoading}
          onOpenEdit={openEdit}
          onSaveEdit={handleEdit}
          onCancelEdit={() => { setEditUserId(''); setEditMsg('') }}
        />
      )}

      {activeTab === 'teachers' && (
        <UserTable
          users={teachers}
          role="teacher"
          onDelete={handleDelete}
          resetUserId={resetUserId}
          setResetUserId={setResetUserId}
          resetPassword={resetPassword}
          setResetPassword={setResetPassword}
          resetMsg={resetMsg}
          setResetMsg={setResetMsg}
          onResetPassword={handleResetPassword}
          editUserId={editUserId}
          editForm={editForm}
          setEditForm={setEditForm}
          editMsg={editMsg}
          editLoading={editLoading}
          onOpenEdit={openEdit}
          onSaveEdit={handleEdit}
          onCancelEdit={() => { setEditUserId(''); setEditMsg('') }}
        />
      )}

      {activeTab === 'create' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Create New Account</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
            )}
            {formSuccess && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{formSuccess}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <div className="flex gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={`cursor-pointer flex-1 rounded-xl border py-2 text-sm font-semibold transition
                      ${form.role === r
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                  >
                    {r === 'student' ? '👨‍🎓 Student' : '👨‍🏫 Teacher'}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Full Name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} required />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="e.g. student@college.edu" required />
            <Field label="Password (min 6 chars)" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Set a password" required />
            <Field label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} placeholder="e.g. Information Technology" />
            <button
              type="submit"
              disabled={formLoading}
              className="w-full cursor-pointer rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              {formLoading ? 'Creating…' : `Create ${form.role === 'student' ? 'Student' : 'Teacher'} Account`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
      />
    </div>
  )
}

function UserTable({
  users, role, onDelete,
  resetUserId, setResetUserId, resetPassword, setResetPassword, resetMsg, setResetMsg, onResetPassword,
  editUserId, editForm, setEditForm, editMsg, editLoading, onOpenEdit, onSaveEdit, onCancelEdit,
}) {
  if (users.length === 0) {
    return <p className="text-sm text-slate-500">No {role}s found.</p>
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <>
                <tr key={u._id} className="text-slate-800 hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium">{u.full_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => editUserId === u._id ? onCancelEdit() : onOpenEdit(u)}
                        className="cursor-pointer rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        {editUserId === u._id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => {
                          setResetUserId(resetUserId === u._id ? '' : u._id)
                          setResetPassword('')
                          setResetMsg('')
                          if (editUserId === u._id) onCancelEdit()
                        }}
                        className="cursor-pointer rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => onDelete(u._id, u.full_name || u.email)}
                        className="cursor-pointer rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>

                {editUserId === u._id && (
                  <tr key={`edit-${u._id}`} className="bg-indigo-50">
                    <td colSpan={4} className="px-4 py-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={editForm.full_name}
                            onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                            placeholder="Full name"
                            className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            placeholder="Email"
                            className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                          <input
                            type="text"
                            value={editForm.department}
                            onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                            placeholder="Department"
                            className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          onClick={() => onSaveEdit(u._id)}
                          disabled={editLoading}
                          className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                        >
                          {editLoading ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="cursor-pointer text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        {editMsg && (
                          <span className={`text-xs font-medium ${editMsg.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
                            {editMsg}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {resetUserId === u._id && (
                  <tr key={`reset-${u._id}`} className="bg-amber-50">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="New password (min 6 chars)"
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300 w-64"
                        />
                        <button
                          onClick={() => onResetPassword(u._id)}
                          className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition"
                        >
                          Confirm Reset
                        </button>
                        <button
                          onClick={() => { setResetUserId(''); setResetMsg('') }}
                          className="cursor-pointer text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        {resetMsg && (
                          <span className={`text-xs font-medium ${resetMsg.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
                            {resetMsg}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}