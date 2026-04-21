import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

const diffOrder = ['easy', 'medium', 'hard']
const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export default function StudentQuizzes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignments, setAssignments] = useState([])
  const [completionByTopic, setCompletionByTopic] = useState({})
  const [dash, setDash] = useState(null)
  const [difficultyFilter, setDifficultyFilter] = useState('All')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError('')
      setLoading(true)
      try {
        const [res, d] = await Promise.all([
          api.getAssignedQuizzes(),
          api.getStudentDashboard(),
        ])
        if (cancelled) return
        setAssignments(res.assignments || [])
        setCompletionByTopic(res.completion_by_topic || {})
        setDash(d || null)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load quizzes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const bestByTopicDifficulty = useMemo(() => {
    const map = {}
    const getTime = (v) => {
      if (!v) return 0
      const ms = Date.parse(v)
      return Number.isFinite(ms) ? ms : 0
    }
    for (const row of assignments || []) {
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
  }, [assignments])

  const topics = useMemo(() => {
    const s = new Set()
    for (const key of Object.keys(bestByTopicDifficulty)) {
      const topic = key.split('::')[0]
      if (topic) s.add(topic)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [bestByTopicDifficulty])

  const difficultyFilterNormalized =
    difficultyFilter === 'All' ? 'All' : difficultyFilter.toString().toLowerCase()

  const topicsToRender = useMemo(() => {
    if (difficultyFilterNormalized === 'All') return topics
    return topics.filter((topic) =>
      Boolean(bestByTopicDifficulty[`${topic}::${difficultyFilterNormalized}`])
    )
  }, [topics, bestByTopicDifficulty, difficultyFilterNormalized])

  const canStart = (topic, difficulty) => {
    if (difficulty === 'easy') return true
    const completion = completionByTopic?.[topic] || {}
    if (difficulty === 'medium') return Boolean(completion.easy)
    if (difficulty === 'hard') return Boolean(completion.medium)
    return false
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

  const summary = useMemo(() => {
    const total = topics.length
    const completed = topics.filter((t) => {
      const c = completionByTopic?.[t] || {}
      return diffOrder.every((d) => Boolean(c[d]))
    }).length
    const inProgress = topics.filter((t) => {
      const c = completionByTopic?.[t] || {}
      const done = diffOrder.filter((d) => Boolean(c[d])).length
      return done > 0 && done < 3
    }).length
    return { total, completed, inProgress }
  }, [topics, completionByTopic])

  if (loading) return <p className="text-slate-500">Loading quizzes…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quiz Navigation</h1>
        <p className="mt-1 text-slate-600">
          Complete quizzes in order — Easy → Medium → Hard per topic.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-700">{summary.total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Topics</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-indigo-600">{summary.inProgress}</p>
          <p className="text-xs text-slate-500 mt-1">In Progress</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-emerald-600">{summary.completed}</p>
          <p className="text-xs text-slate-500 mt-1">Completed</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Filter by Stage</p>
            <p className="mt-1 text-sm text-slate-500">
              Showing:{' '}
              {difficultyFilterNormalized === 'All'
                ? 'All stages'
                : diffLabel[difficultyFilterNormalized]}
            </p>
          </div>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All">All Stages</option>
            <option value="easy">🟢 Easy</option>
            <option value="medium">🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {topicsToRender.length === 0 ? (
          <p className="text-sm text-slate-500">No assigned quizzes yet.</p>
        ) : (
          topicsToRender.map((topic) => {
            const completion = completionByTopic?.[topic] || {}
            const stagesCompleted = diffOrder.filter((d) => Boolean(completion[d])).length
            const allDone = stagesCompleted === 3

            return (
              <div
                key={topic}
                className={`rounded-2xl border bg-white p-6 shadow-sm
                  ${allDone ? 'border-emerald-200' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {allDone ? '✅ ' : ''}{topic}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {stagesCompleted}/3 stages done
                  </span>
                </div>

                <div className="flex gap-1 mb-4 mt-2">
                  {diffOrder.map((d) => (
                    <div
                      key={d}
                      className={`h-1.5 flex-1 rounded-full
                        ${completion[d]
                          ? 'bg-emerald-500'
                          : canStart(topic, d)
                          ? 'bg-indigo-300'
                          : 'bg-slate-100'
                        }`}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  {diffOrder.map((difficulty) => {
                    if (
                      difficultyFilterNormalized !== 'All' &&
                      difficultyFilterNormalized !== difficulty
                    ) return null

                    const entry = bestByTopicDifficulty[`${topic}::${difficulty}`]
                    const hasQuiz = Boolean(entry?.quiz?._id && entry?.assignmentId)
                    const unlocked = canStart(topic, difficulty)
                    const quizId = entry?.quiz?._id
                    const assignmentId = entry?.assignmentId
                    const latestAttempt = hasQuiz
                      ? getLatestAttemptForQuiz(quizId, assignmentId)
                      : null
                    const attemptPct = getAttemptPercentage(latestAttempt)
                    const attempted = Boolean(latestAttempt)
                    const canReattempt = attempted && Number.isFinite(attemptPct) && attemptPct < 70
                    const isPassed = attempted && (!Number.isFinite(attemptPct) || attemptPct >= 70)

                    const stageIcon =
                      difficulty === 'easy' ? '🟢' :
                      difficulty === 'medium' ? '🟡' : '🔴'

                    return (
                      <div
                        key={difficulty}
                        className={`flex items-center justify-between gap-3 rounded-xl p-3 border
                          ${isPassed
                            ? 'bg-emerald-50 border-emerald-100'
                            : canReattempt
                            ? 'bg-amber-50 border-amber-100'
                            : unlocked && hasQuiz
                            ? 'bg-indigo-50 border-indigo-100'
                            : 'bg-slate-50 border-slate-100'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{stageIcon}</span>
                          <p className="text-sm font-medium text-slate-800">
                            {diffLabel[difficulty]}
                          </p>
                          {attempted && attemptPct != null && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                              ${attemptPct >= 70
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {Math.round(attemptPct)}%
                            </span>
                          )}
                        </div>

                        {isPassed ? (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl bg-emerald-100 px-4 py-1.5 text-xs font-semibold text-emerald-800 cursor-not-allowed"
                          >
                            ✅ Completed
                          </button>
                        ) : canReattempt ? (
                          <button
                            type="button"
                            className="rounded-xl bg-yellow-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-yellow-600"
                            onClick={() =>
                              navigate(
                                `/student/quiz/${entry.quiz._id}?assignment_id=${encodeURIComponent(entry.assignmentId)}`
                              )
                            }
                          >
                            Reattempt
                          </button>
                        ) : unlocked && hasQuiz ? (
                          <button
                            type="button"
                            className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            onClick={() =>
                              navigate(
                                `/student/quiz/${entry.quiz._id}?assignment_id=${encodeURIComponent(entry.assignmentId)}`
                              )
                            }
                          >
                            Start Quiz
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200 cursor-not-allowed"
                          >
                            🔒 Locked
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
