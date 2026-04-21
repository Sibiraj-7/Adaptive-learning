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
  const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

  const actionMeta = {
    revisit: {
      icon: '🔁',
      label: 'Revisit',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    practice: {
      icon: '📝',
      label: 'Practice',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    advance: {
      icon: '🚀',
      label: 'Advance',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
  }

  const stateMeta = {
    low: {
      desc: 'Your mastery is low — the AI is sending you back to strengthen the basics.',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    medium: {
      desc: 'You have a medium grasp — the AI wants you to practise more before advancing.',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    high: {
      desc: 'Great mastery! The AI is pushing you to the next level topic.',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
  }

  const getLatestAttemptForQuiz = (quizId, assignmentId) => {
    const attempts = dash?.recent_attempts || []
    if (!quizId || !assignmentId) return null
    return (
      attempts.find(
        (a) =>
          String(a.quiz_id) === String(quizId) &&
          String(a.assignment_id) === String(assignmentId),
      ) || null
    )
  }

  const getAttemptPercentage = (attempt) => {
    if (!attempt) return null
    const total = Number(attempt.total_score)
    const max = Number(attempt.max_score)
    if (!Number.isFinite(total) || !Number.isFinite(max) || max <= 0) return null
    return (total / max) * 100
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
    return () => { cancelled = true }
  }, [])

  const weak = dash?.weak_topics || []
  const rec = dash?.recommended_next_topic || ''

  const latestAttempt = useMemo(() => {
    const attempts = dash?.recent_attempts || []
    return attempts.length > 0 ? attempts[0] : null
  }, [dash])

  const aiDecision = useMemo(() => {
    if (!latestAttempt?.mastery) return null
    const mastery = latestAttempt.mastery
    return {
      action: mastery.action_taken || null,
      masteryLevel: mastery.mastery_level || null,
      masteryPct: mastery.mastery_percentage ?? null,
      qValues: mastery.q_values || null,
      topic: latestAttempt.recommended_next_topic || '',
    }
  }, [latestAttempt])

  const bestByTopicDifficulty = useMemo(() => {
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
        map[key] = { quiz: q, assignmentId: a._id }
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

  const learningPath = useMemo(() => {
    return topics.map((topic) => {
      const completion = completionByTopic?.[topic] || {}
      const stagesCompleted = diffOrder.filter((d) => Boolean(completion[d])).length
      const mastered = stagesCompleted === 3
      const isCurrent = !mastered && stagesCompleted > 0
      const isNext = !mastered && stagesCompleted === 0
      return { topic, stagesCompleted, mastered, isCurrent, isNext }
    }).sort((a, b) => {
      // Order: in-progress first, then not started, then mastered
      if (a.mastered && !b.mastered) return 1
      if (!a.mastered && b.mastered) return -1
      return b.stagesCompleted - a.stagesCompleted
    })
  }, [topics, completionByTopic])

  const canStart = (completion, difficulty) => {
    if (difficulty === 'easy') return true
    if (difficulty === 'medium') return Boolean(completion.easy)
    if (difficulty === 'hard') return Boolean(completion.medium)
    return false
  }

  if (loading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Student Dashboard
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

      {aiDecision?.action && actionMeta[aiDecision.action] && (() => {
        const sInfo = stateMeta[aiDecision.masteryLevel] || stateMeta.low
        const aInfo = actionMeta[aiDecision.action]
        return (
          <div className={`rounded-2xl border p-6 shadow-sm ${sInfo.border} ${sInfo.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🤖</span>
              <h2 className="text-base font-semibold text-slate-900">AI Decision</h2>
              <span className="ml-auto text-xs text-slate-500">Based on your last attempt</span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white/70 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Mastery State</p>
                <p className={`text-sm font-bold capitalize ${sInfo.color}`}>
                  {aiDecision.masteryLevel || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Mastery %</p>
                <p className={`text-sm font-bold ${sInfo.color}`}>
                  {aiDecision.masteryPct != null ? `${aiDecision.masteryPct}%` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Action Taken</p>
                <p className={`text-sm font-bold ${aInfo.color}`}>
                  {aInfo.icon} {aInfo.label}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Next Topic</p>
                <p className={`text-sm font-bold truncate ${sInfo.color}`}>
                  {aiDecision.topic ? formatTopic(aiDecision.topic) : '—'}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600 italic">
              💡 {sInfo.desc}
            </p>

            {aiDecision.qValues && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Q-Table Values (current state: {aiDecision.masteryLevel})
                </p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(aiDecision.qValues).map(([act, value]) => (
                    <div
                      key={act}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border
                        ${act === aiDecision.action
                          ? `${aInfo.bg} ${aInfo.border} ${aInfo.color} ring-2 ring-offset-1`
                          : 'bg-white border-slate-200 text-slate-600'
                        }`}
                    >
                      {act}: <strong>{Number(value).toFixed(3)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <TopicMasteryChart masteryBySubject={dash?.mastery_by_subject} />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your Learning Path</h2>
        <p className="mt-1 text-sm text-slate-500">
          Topics ordered by your progress — focus on the highlighted one first.
        </p>

        {learningPath.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No assigned topics yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {learningPath.map((item, idx) => (
              <div key={item.topic} className="flex items-center gap-2">
                {/* Topic bubble */}
                <div
                  className={`rounded-xl px-4 py-2 text-sm font-semibold border transition
                    ${item.mastered
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : item.isCurrent
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                >
                  {item.mastered ? '✅' : item.isCurrent ? '📍' : '⏳'}{' '}
                  {item.topic}
                  <span className="ml-2 text-xs opacity-75">
                    {item.stagesCompleted}/3
                  </span>
                </div>
                {idx < learningPath.length - 1 && (
                  <span className="text-slate-300 text-lg">→</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Learning Path Progress
        </h2>

        {topics.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No assigned quizzes yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {topics.map((topic) => {
              const completion = completionByTopic?.[topic] || {}
              const stagesCompleted = diffOrder.filter((d) => Boolean(completion[d])).length

              return (
                <div
                  key={topic}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {topic}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {stagesCompleted}/3 stages
                    </span>
                  </div>

                  <div className="flex gap-1 mb-3">
                    {diffOrder.map((d) => (
                      <div
                        key={d}
                        className={`h-2 flex-1 rounded-full transition-all
                          ${completion[d]
                            ? 'bg-emerald-500'
                            : canStart(completion, d)
                            ? 'bg-indigo-300'
                            : 'bg-slate-100'
                          }`}
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    {diffOrder.map((difficulty) => {
                      const entry = bestByTopicDifficulty[`${topic}::${difficulty}`]
                      const unlocked = canStart(completion, difficulty)
                      const hasQuiz = Boolean(entry?.quiz?._id && entry?.assignmentId)
                      const quizId = entry?.quiz?._id
                      const assignmentId = entry?.assignmentId
                      const latestAttempt = hasQuiz
                        ? getLatestAttemptForQuiz(quizId, assignmentId)
                        : null
                      const attemptPct = getAttemptPercentage(latestAttempt)
                      const attempted = Boolean(latestAttempt)
                      const canReattempt = attempted && Number.isFinite(attemptPct) && attemptPct < 70
                      const isPassed = attempted && (!Number.isFinite(attemptPct) || attemptPct >= 70)

                      return (
                        <div
                          key={difficulty}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {isPassed ? '✅' : unlocked ? '🔓' : '🔒'}
                            </span>
                            <p className="text-sm font-medium text-slate-800">
                              {diffLabel[difficulty]}
                            </p>
                            {attempted && attemptPct != null && (
                              <span className="text-xs text-slate-400">
                                ({Math.round(attemptPct)}%)
                              </span>
                            )}
                          </div>

                          {isPassed ? (
                            <button disabled className="rounded-xl bg-gray-400 px-4 py-1.5 text-xs font-semibold text-slate-900 cursor-not-allowed">
                              Completed
                            </button>
                          ) : canReattempt ? (
                            <button
                              className="rounded-xl bg-yellow-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-yellow-600"
                              onClick={() => navigate(`/student/quiz/${entry.quiz._id}?assignment_id=${encodeURIComponent(entry.assignmentId)}`)}
                            >
                              Reattempt
                            </button>
                          ) : !unlocked ? (
                            <span className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                              Locked
                            </span>
                          ) : !hasQuiz ? (
                            <span className="text-xs text-slate-400">No quiz</span>
                          ) : (
                            <button
                              className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                              onClick={() => navigate(`/student/quiz/${entry.quiz._id}?assignment_id=${encodeURIComponent(entry.assignmentId)}`)}
                            >
                              Start
                            </button>
                          )}
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
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Submitted</th>
                  <th className="pb-3 pr-4 font-semibold">Score</th>
                  <th className="pb-3 pr-4 font-semibold">AI Action</th>
                  <th className="pb-3 font-semibold">Recommended topic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dash?.recent_attempts || []).map((a, idx) => {
                  const action = a.mastery?.action_taken
                  const meta = action ? actionMeta[action] : null
                  return (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-3 pr-4">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {a.total_score} / {a.max_score}
                      </td>
                      <td className="py-3 pr-4">
                        {meta ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3">
                        {a.recommended_next_topic ? formatTopic(a.recommended_next_topic) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
