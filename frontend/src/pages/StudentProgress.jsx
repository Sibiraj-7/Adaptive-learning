import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

const diffOrder = ['easy', 'medium', 'hard']

function isoDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(0, 10)
}

function pct(totalScore, maxScore) {
  const t = Number(totalScore ?? 0)
  const m = Number(maxScore ?? 0)
  if (!m) return null
  return Math.round((t / m) * 100)
}

export default function StudentProgress() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dash, setDash] = useState(null)
  const [assigned, setAssigned] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [d, a] = await Promise.all([
          api.getStudentDashboard(),
          api.getAssignedQuizzes(),
        ])
        if (cancelled) return
        setDash(d)
        setAssigned(a)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load progress')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const quizMetaByQuizId = useMemo(() => {
    const map = {}
    const rows = assigned?.assignments || []
    for (const row of rows) {
      const quiz = row?.quiz
      if (!quiz?._id) continue
      map[quiz._id] = {
        topic: (quiz.topic || 'General').toString().trim(),
        difficulty: (quiz.difficulty || 'medium').toString().toLowerCase(),
      }
    }
    return map
  }, [assigned])

  const masteryByTopic = useMemo(() => {
    const out = {}
    const masteryBySubject = dash?.mastery_by_subject || {}
    for (const subjKey of Object.keys(masteryBySubject || {})) {
      const doc = masteryBySubject[subjKey] || {}
      const topicMastery = doc.topic_mastery || {}
      for (const topic of Object.keys(topicMastery || {})) {
        const v = Number(topicMastery[topic])
        if (!Number.isFinite(v)) continue
        if (!out[topic] || v > out[topic]) out[topic] = v
      }
    }
    return out
  }, [dash])

  const attemptsByTopicDifficulty = useMemo(() => {
    const out = {}
    const recent = dash?.recent_attempts || []

    for (const a of recent) {
      const quizId = a.quiz_id
      const meta = quizMetaByQuizId[quizId]
      if (!meta) continue

      const { topic, difficulty } = meta
      if (!diffOrder.includes(difficulty)) continue

      const key = `${topic}::${difficulty}`
      if (!out[key]) {
        out[key] = {
          topic,
          difficulty,
          bestScore: null,
          attempts: 0,
          lastAttempt: null,
        }
      }

      const p = pct(a.total_score, a.max_score)
      if (p != null) {
        out[key].bestScore = out[key].bestScore == null ? p : Math.max(out[key].bestScore, p)
      }
      out[key].attempts += 1

      if (!out[key].lastAttempt || new Date(a.submitted_at) > new Date(out[key].lastAttempt)) {
        out[key].lastAttempt = a.submitted_at
      }
    }

    return out
  }, [dash, quizMetaByQuizId])

  const topicProgress = useMemo(() => {
    const topics = new Set(Object.keys(masteryByTopic || {}))
    const attempts = attemptsByTopicDifficulty || {}
    for (const key of Object.keys(attempts)) {
      topics.add(key.split('::')[0])
    }

    const attemptsCountByTopic = {}
    const hardAttemptedByTopic = {}
    for (const key of Object.keys(attempts)) {
      const [topic, difficulty] = key.split('::')
      const row = attempts[key]
      attemptsCountByTopic[topic] =
        (attemptsCountByTopic[topic] || 0) + (row?.attempts || 0)
      if (difficulty === 'hard') hardAttemptedByTopic[topic] = true
    }

    const out = []
    for (const topic of Array.from(topics).sort((a, b) => a.localeCompare(b))) {
      const mastery = masteryByTopic?.[topic]
      const hardDone = Boolean(hardAttemptedByTopic?.[topic])
      const completed = hardDone || (mastery != null && mastery >= 0.8)
      const inProgress =
        !completed && ((attemptsCountByTopic?.[topic] || 0) > 0 || (mastery != null && mastery >= 0.4))

      out.push({
        topic,
        status: completed ? 'Completed' : inProgress ? 'In Progress' : 'Not Started',
      })
    }

    return out
  }, [attemptsByTopicDifficulty, masteryByTopic])

  const tableRows = useMemo(() => {
    const rows = Object.values(attemptsByTopicDifficulty || {})
    rows.sort((a, b) => {
      const t = a.topic.localeCompare(b.topic)
      if (t !== 0) return t
      return diffOrder.indexOf(a.difficulty) - diffOrder.indexOf(b.difficulty)
    })
    return rows
  }, [attemptsByTopicDifficulty])

  if (loading) {
    return <p className="text-slate-500">Loading progress…</p>
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
        <p className="mt-1 text-slate-600">Completed quizzes and learning progress by topic.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Topic Progress</h2>
        {topicProgress.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No progress data yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Topic</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topicProgress.map((r) => (
                  <tr key={r.topic} className="text-slate-800">
                    <td className="py-3 pr-4">{r.topic}</td>
                    <td className="py-3 font-medium">
                      {r.status === 'Completed' ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                          Completed
                        </span>
                      ) : r.status === 'In Progress' ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">
                          In Progress
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          Not Started
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Completed quizzes</h2>

        {tableRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No quiz attempts recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Topic</th>
                  <th className="pb-3 pr-4 font-semibold">Difficulty</th>
                  <th className="pb-3 pr-4 font-semibold">Best Score</th>
                  <th className="pb-3 pr-4 font-semibold">Attempts</th>
                  <th className="pb-3 font-semibold">Last Attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((r) => (
                  <tr key={`${r.topic}-${r.difficulty}`} className="text-slate-800">
                    <td className="py-3 pr-4">{r.topic}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {r.difficulty}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {r.bestScore != null ? `${r.bestScore}%` : '—'}
                    </td>
                    <td className="py-3 pr-4">{r.attempts}</td>
                    <td className="py-3">{isoDate(r.lastAttempt)}</td>
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
