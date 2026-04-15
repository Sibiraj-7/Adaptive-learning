import { useEffect, useState } from 'react'
import { api } from '../services/api'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

export default function AssignQuiz({ onDone }) {
  const [quizzes, setQuizzes] = useState([])
  const [quizId, setQuizId] = useState('')
  const [targetType, setTargetType] = useState('department')
  const [department, setDepartment] = useState('')
  const [studentIds, setStudentIds] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [res, deptRes] = await Promise.all([
          api.getQuizzes(),
          api.getDepartments().catch(() => ({ departments: [] })),
        ])
        if (!cancelled) {
          const list = res.quizzes || []
          setQuizzes(list)
          if (list[0]) setQuizId(list[0]._id)
          setDepartments(deptRes.departments || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load quizzes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const payload = {
      quiz_id: quizId,
      target_type: targetType,
    }
    if (targetType === 'department') {
      payload.department = department.trim()
    } else {
      payload.student_ids = studentIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (dueAt.trim()) payload.due_at = new Date(dueAt).toISOString()

    setSaving(true)
    try {
      await api.assignQuiz(payload)
      setSuccess('Quiz assigned successfully.')
    } catch (err) {
      setError(err.message || 'Assignment failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        {onDone && (
          <button
            type="button"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            onClick={() => onDone()}
          >
            ← Back to quizzes
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900">Assign quiz</h1>
        <p className="text-slate-600">
          Target a whole department or specific student accounts.
        </p>
      </div>

      <form
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Quiz</label>
          <select
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            required
            className={inputClass}
          >
            {quizzes.length === 0 ? (
              <option value="">No quizzes — create one first</option>
            ) : (
              quizzes.map((q) => (
                <option key={q._id} value={q._id}>
                  {q.title}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Target</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className={inputClass}
          >
            <option value="department">Department</option>
            <option value="students">Specific students</option>
          </select>
        </div>

        {targetType === 'department' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Department name
            </label>
            <input
              list="assign-department-suggestions"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              placeholder="Type or pick a suggestion (e.g. CSE-2024)"
              className={inputClass}
              autoComplete="off"
            />
            <datalist id="assign-department-suggestions">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Student ids (comma-separated)
            </label>
            <textarea
              rows={3}
              value={studentIds}
              onChange={(e) => setStudentIds(e.target.value)}
              required
              placeholder="User account ids as strings"
              className={`${inputClass} resize-y`}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Due date (optional)
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !quizzes.length}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Assigning…' : 'Assign'}
        </button>
      </form>
    </div>
  )
}
