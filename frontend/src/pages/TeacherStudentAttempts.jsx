import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'

export default function TeacherStudentAttempts() {
  const { quizId, studentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [attempts, setAttempts] = useState([])
  const [quizTitle, setQuizTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setLoading(true)
      try {
        const [attemptRows, quizRes] = await Promise.all([
          api.getQuizAttempts(quizId),
          api.getQuizzes().catch(() => ({ quizzes: [] })),
        ])
        if (cancelled) return
        setAttempts(Array.isArray(attemptRows) ? attemptRows : [])
        const q = (quizRes.quizzes || []).find((x) => x._id === quizId)
        setQuizTitle(q?.title || '')
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load attempts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (quizId) load()
    return () => {
      cancelled = true
    }
  }, [quizId])

  const studentAttempts = useMemo(() => {
    const rows = (attempts || []).filter((a) => a?.student_id === studentId)
    return rows.sort((a, b) =>
      String(a?.submitted_at || '').localeCompare(String(b?.submitted_at || '')),
    )
  }, [attempts, studentId])

  const studentName = studentAttempts[0]?.student_name || '—'
  const department = studentAttempts[0]?.department || '—'
  const fallbackDifficulty = studentAttempts[0]?.quiz_difficulty || '—'
  const fallbackTopic = studentAttempts[0]?.quiz_topic || '—'

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          navigate('/teacher/quizzes', {
            state: {
              from: 'attempts',
              quizId: location.state?.quizId ?? quizId,
              scrollY: location.state?.scrollY,
            },
          })
        }
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        ← Back to Attempts
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Student Attempts</h1>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Student Name:</span>{' '}
            {studentName}
          </p>
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Department:</span>{' '}
            {department}
          </p>
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Quiz Title:</span>{' '}
            {quizTitle || '—'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading && <p className="text-sm text-slate-600">Loading attempts…</p>}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {!loading && !error && studentAttempts.length === 0 && (
          <p className="text-sm text-slate-500">No attempts found for this student.</p>
        )}
        {!loading && !error && studentAttempts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Attempt Time</th>
                  <th className="pb-3 pr-4 font-semibold">Score</th>
                  <th className="pb-3 pr-4 font-semibold">Quiz Difficulty</th>
                  <th className="pb-3 font-semibold">Topic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentAttempts.map((a, idx) => (
                  <tr key={`${a.student_id}-${idx}`} className="text-slate-800">
                    <td className="py-3 pr-4">{a.submitted_at || '—'}</td>
                    <td className="py-3 pr-4">
                      {a.score_percent != null
                        ? `${a.score_percent}%`
                        : `${a.total_score ?? '—'} / ${a.max_score ?? '—'}`}
                    </td>
                    <td className="py-3 pr-4 capitalize">
                      {a.quiz_difficulty || fallbackDifficulty}
                    </td>
                    <td className="py-3">{a.quiz_topic || fallbackTopic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
