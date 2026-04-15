import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CreateQuiz from './CreateQuiz'
import AssignQuiz from './AssignQuiz'
import { api } from '../services/api'

export default function Quizzes() {
  const [mode, setMode] = useState('view')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedQuizId, setSelectedQuizId] = useState(null)
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [attemptsError, setAttemptsError] = useState('')
  const [attempts, setAttempts] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  const studentSummary = useMemo(() => {
    const map = new Map()
    for (const a of attempts) {
      const sid = a.student_id
      if (!sid) continue
      if (!map.has(sid)) {
        map.set(sid, {
          student_id: sid,
          student_name: a.student_name || '—',
          department: a.department || '—',
          total: 0,
          highest: 0,
        })
      }
      const g = map.get(sid)
      g.total += 1
      const pct = Number(a.score_percent)
      if (Number.isFinite(pct) && pct > g.highest) g.highest = pct
    }
    return Array.from(map.values()).sort((x, y) =>
      (x.student_name || '').localeCompare(y.student_name || '', undefined, {
        sensitivity: 'base',
      }),
    )
  }, [attempts])

  const loadQuizzes = useCallback(async () => {
    setError('')
    try {
      const res = await api.getQuizzes()
      setQuizzes(res.quizzes || [])
    } catch (e) {
      setError(e.message || 'Failed to load quizzes')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await loadQuizzes()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadQuizzes])

  const handleDoneCreate = async () => {
    await loadQuizzes()
    setMode('view')
  }

  const handleDoneAssign = () => {
    setMode('view')
  }

  const handleViewAttempts = useCallback(async (quizId) => {
    if (!quizId) return
    setSelectedQuizId(quizId)
    setAttemptsLoading(true)
    setAttemptsError('')
    setAttempts([])

    try {
      const res = await api.getQuizAttempts(quizId)
      setAttempts(res || [])
    } catch (e) {
      setAttemptsError(e.message || 'Failed to load attempts')
    } finally {
      setAttemptsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (location.state?.from === 'attempts' && location.state?.quizId) {
      setMode('attempts')
      setSelectedQuizId(location.state.quizId)
    }
  }, [location.state])

  useEffect(() => {
    if (location.state?.from === 'attempts' && location.state?.quizId) {
      handleViewAttempts(location.state.quizId)
    }
  }, [location.state])

  useEffect(() => {
    if (location.state?.scrollY !== undefined) {
      window.scrollTo(0, location.state.scrollY)
    }
  }, [location.state])

  if (mode === 'create') {
    return <CreateQuiz onDone={handleDoneCreate} heading="Create quiz" />
  }

  if (mode === 'assign') {
    return <AssignQuiz onDone={handleDoneAssign} />
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quizzes</h1>
        <p className="mt-1 text-slate-600">
          Create quizzes, assign them, and review student attempts.
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
            mode === 'create'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
          onClick={() => setMode('create')}
        >
          Create Quiz
        </button>
        <button
          type="button"
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
            mode === 'view'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
          onClick={() => setMode('view')}
        >
          View Quizzes
        </button>
        <button
          type="button"
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
            mode === 'attempts'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
          onClick={() => {
            const first = quizzes?.[0]?._id || null
            setMode('attempts')
            if (first) handleViewAttempts(first)
          }}
        >
          View Attempts
        </button>
      </div>

      {mode === 'attempts' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">View Attempts</h2>
              <p className="mt-1 text-sm text-slate-600">Select a quiz to see student attempts.</p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => setMode('view')}
            >
              ← Back
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Quiz</label>
            <select
              value={selectedQuizId || ''}
              onChange={(e) => {
                const nextId = e.target.value
                setSelectedQuizId(nextId)
                handleViewAttempts(nextId)
              }}
              className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {quizzes.length === 0 ? (
                <option value="">No quizzes yet</option>
              ) : (
                quizzes.map((q) => (
                  <option key={q._id} value={q._id}>
                    {q.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mt-6">
            {attemptsLoading && (
              <p className="text-sm text-slate-600">Loading attempts…</p>
            )}
            {attemptsError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {attemptsError}
              </p>
            )}

            {!attemptsLoading && !attemptsError && attempts.length === 0 && (
              <p className="text-sm text-slate-500">No attempts yet.</p>
            )}

            {!attemptsLoading && !attemptsError && attempts.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="pb-3 pr-4 font-semibold">Student Name</th>
                        <th className="pb-3 pr-4 font-semibold">Department</th>
                        <th className="pb-3 pr-4 font-semibold">Total Attempts</th>
                        <th className="pb-3 font-semibold">Highest Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentSummary.map((row) => (
                        <tr
                          key={row.student_id}
                          className="cursor-pointer text-slate-800 transition hover:bg-slate-50"
                          onClick={() => {
                            if (!selectedQuizId) return
                            navigate(
                              `/teacher/quizzes/${encodeURIComponent(
                                selectedQuizId,
                              )}/student/${encodeURIComponent(row.student_id)}`,
                              {
                                state: {
                                  from: 'attempts',
                                  quizId: selectedQuizId,
                                  scrollY: window.scrollY,
                                },
                              },
                            )
                          }}
                        >
                          <td className="py-3 pr-4">{row.student_name}</td>
                          <td className="py-3 pr-4">{row.department}</td>
                          <td className="py-3 pr-4">{row.total}</td>
                          <td className="py-3">
                            {row.highest != null ? `${Math.round(row.highest)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Your quizzes</h2>
          <div className="mt-4 space-y-4">
            {quizzes.length === 0 ? (
              <p className="text-sm text-slate-500">
                No quizzes yet. Create a quiz to see it here.
              </p>
            ) : (
              quizzes.map((q) => (
                <div
                  key={q._id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{q.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Topic: {q.topic || '—'} · Difficulty: {q.difficulty || '—'} ·{' '}
                        Questions: {(q.question_ids || []).length}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('assign')}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        Assign Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('attempts')
                          handleViewAttempts(q._id)
                        }}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                      >
                        View Attempts
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
