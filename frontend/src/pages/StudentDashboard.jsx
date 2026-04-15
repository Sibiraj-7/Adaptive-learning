import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import TopicMasteryChart from '../components/charts/TopicMasteryChart'
import { formatTopic } from '../utils/formatTopic'

export default function StudentDashboard() {
  const [dash, setDash] = useState(null)
  const [assigned, setAssigned] = useState([])
  const [completionByTopic, setCompletionByTopic] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const diffOrder = ['easy', 'medium', 'hard']
  const diffLabel = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      try {
        const [d, a] = await Promise.all([
          api.getStudentDashboard(),
          api.getAssignedQuizzes(),
        ])
        if (!cancelled) {
          setDash(d)
          setAssigned(a.assignments || [])
          setCompletionByTopic(a.completion_by_topic || {})
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const weak = dash?.weak_topics || []
  const rec = dash?.recommended_next_topic || ''

  const bestByTopicDifficulty = useMemo(() => {
    // Pick one quiz per (topic, difficulty), preferring the most recently created quiz.
    const map = {}
    const getTime = (v) => {
      if (!v) return 0
      const ms = Date.parse(v)
      return Number.isFinite(ms) ? ms : 0
    }

    for (const row of assigned || []) {
      const q = row?.quiz
      const a = row?.assignment
      if (!q || !a) continue

      const topic = (q.topic || 'General').toString().trim()
      const difficulty = (q.difficulty || 'medium').toString().toLowerCase()
      if (!diffOrder.includes(difficulty)) continue

      const key = `${topic}::${difficulty}`
      const currentBest = map[key]

      const quizTime = getTime(q.created_at)
      const bestTime = getTime(currentBest?.quiz?.created_at)
      if (!currentBest || quizTime >= bestTime) {
        map[key] = {
          quiz: q,
          assignmentId: a._id,
        }
      }
    }

    return map
  }, [assigned])

  const topics = useMemo(() => {
    const s = new Set()
    for (const key of Object.keys(bestByTopicDifficulty)) {
      const topic = key.split('::')[0]
      if (topic) s.add(topic)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [bestByTopicDifficulty])

  const canStart = (completion, difficulty) => {
    if (difficulty === 'easy') return true
    if (difficulty === 'medium') return Boolean(completion.easy)
    if (difficulty === 'hard') return Boolean(completion.medium)
    return false
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Student dashboard
        </h1>
        <p className="mt-1 text-slate-600">Your progress and recommendations</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <p className="text-sm font-medium text-indigo-800">Recommended next topic</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">
          {rec ? formatTopic(rec) : '—'}
        </p>
      </div>

      <TopicMasteryChart masteryBySubject={dash?.mastery_by_subject} />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Learning Path Progress
        </h2>

        {topics.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No assigned quizzes yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {topics.map((topic) => {
              const completion = completionByTopic?.[topic] || {}

              return (
                <div
                  key={topic}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    Topic: {topic}
                  </h3>

                  <div className="mt-3 space-y-2">
                    {diffOrder.map((difficulty) => {
                      const entry =
                        bestByTopicDifficulty[`${topic}::${difficulty}`]

                      const isCompleted = Boolean(completion[difficulty])

                      const unlocked = canStart(completion, difficulty)
                      const hasQuiz = Boolean(entry?.quiz?._id && entry?.assignmentId)

                      if (isCompleted) {
                        return (
                          <div
                            key={difficulty}
                            className="flex items-center justify-between gap-3"
                          >
                            <p className="text-sm font-medium text-slate-800">
                              {diffLabel[difficulty]}
                            </p>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              ✓ Completed
                            </span>
                          </div>
                        )
                      }

                      if (!unlocked) {
                        return (
                          <div
                            key={difficulty}
                            className="flex items-center justify-between gap-3"
                          >
                            <p className="text-sm font-medium text-slate-800">
                              {diffLabel[difficulty]}
                            </p>
                            <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                              Locked
                            </span>
                          </div>
                        )
                      }

                      if (!hasQuiz) {
                        return (
                          <div
                            key={difficulty}
                            className="flex items-center justify-between gap-3"
                          >
                            <p className="text-sm font-medium text-slate-800">
                              {diffLabel[difficulty]}
                            </p>
                            <span className="text-sm text-slate-500">
                              No quiz available
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={difficulty}
                          className="flex items-center justify-between gap-3"
                        >
                          <p className="text-sm font-medium text-slate-800">
                            {diffLabel[difficulty]}
                          </p>
                          <button
                            type="button"
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                            onClick={() =>
                              navigate(
                                `/student/quiz/${entry.quiz._id}?assignment_id=${encodeURIComponent(
                                  entry.assignmentId,
                                )}`,
                              )
                            }
                          >
                            ▶ Start Quiz
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Weak areas</h2>
          {weak.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Complete a quiz to see mastery estimates.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {weak.slice(0, 10).map((w) => (
                <li
                  key={w.key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-800">{formatTopic(w.key)}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                    {(w.mastery * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Suggested materials</h2>
          {(dash?.suggested_materials || []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No materials in the database for this topic yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(dash?.suggested_materials || []).map((m, mi) => (
                <li key={`${m.title}-${mi}`}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {m.title}
                  </a>
                  {m.topic && (
                    <p className="text-xs text-slate-500">{formatTopic(m.topic)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent attempts</h2>
        {(dash?.recent_attempts || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No attempts yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Submitted</th>
                  <th className="pb-3 pr-4 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Recommended topic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dash?.recent_attempts || []).map((a, idx) => (
                  <tr key={idx} className="text-slate-800">
                    <td className="py-3 pr-4">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {a.total_score} / {a.max_score}
                    </td>
                    <td className="py-3">
                      {a.recommended_next_topic
                        ? formatTopic(a.recommended_next_topic)
                        : '—'}
                    </td>
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
