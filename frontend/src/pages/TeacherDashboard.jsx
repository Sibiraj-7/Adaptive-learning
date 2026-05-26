import { useEffect, useState } from 'react'
import { api } from '../services/api'
import QuizList from '../components/QuizList'
import TopicDifficultyChart from '../components/charts/TopicDifficultyChart'
import QuizPerformanceChart from '../components/charts/QuizPerformanceChart'
import TopicMasteryDistributionChart from '../components/charts/TopicMasteryDistributionChart'
import { formatTopic } from '../utils/formatTopic'

const stateMeta = {
  beginner:   { color: 'text-rose-700',    bg: 'bg-rose-50',    label: 'Beginner' },
  struggling: { color: 'text-orange-700',  bg: 'bg-orange-50',  label: 'Struggling' },
  improving:  { color: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Improving' },
  consistent: { color: 'text-blue-700',    bg: 'bg-blue-50',    label: 'Consistent' },
  advanced:   { color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Advanced' },
}

const trendMeta = {
  '↑↑': { color: 'text-emerald-600', label: 'Big improvement' },
  '↑':  { color: 'text-emerald-600', label: 'Improving' },
  '→':  { color: 'text-blue-600',    label: 'Consistent' },
  '↓':  { color: 'text-amber-600',   label: 'Declining' },
  '↓↓': { color: 'text-rose-600',    label: 'Needs attention' },
  '—':  { color: 'text-slate-400',   label: 'Not enough data' },
}

export default function TeacherDashboard() {
  const [data, setData]             = useState(null)
  const [quizzes, setQuizzes]       = useState([])
  const [studentProgress, setStudentProgress] = useState([])
  const [search, setSearch]           = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setLoading(true)
      try {
        const [dash, qz, sp] = await Promise.all([
          api.getTeacherDashboard(),
          api.getQuizzes().catch(() => ({ quizzes: [] })),
          api.getStudentProgress().catch(() => ({ students: [] })),
        ])
        if (!cancelled) {
          setData(dash)
          setQuizzes(qz.quizzes || [])
          setStudentProgress(sp.students || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="text-slate-500">Loading dashboard…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Teacher dashboard
        </h1>
        <p className="mt-1 text-slate-600">Performance overview and class analytics</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Average score</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            {data?.average_score_percent != null ? `${data.average_score_percent}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total attempts</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data?.total_attempts ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Your quizzes</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{quizzes.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <TopicDifficultyChart rows={data?.most_difficult_topics || []} />
        <TopicMasteryDistributionChart rows={data?.topic_mastery_distribution || []} />
        <QuizPerformanceChart quizSummaries={data?.quiz_summaries || []} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Student Learning Rate</h2>
        <p className="mt-1 text-sm text-slate-500">
          AI-classified mastery state and learning trend per student.
        </p>

        <div className="mt-4 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or department..."
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {studentProgress.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No student attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Student</th>
                  <th className="pb-3 pr-4 font-semibold">Department</th>
                  <th className="pb-3 pr-4 font-semibold">Mastery State</th>
                  <th className="pb-3 pr-4 font-semibold">Avg Mastery</th>
                  <th className="pb-3 pr-4 font-semibold">Trend</th>
                  <th className="pb-3 pr-4 font-semibold">Best Topic</th>
                  <th className="pb-3 font-semibold">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentProgress
                  .filter((s) =>
                    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
                    s.department.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((s) => {
                  const sm = stateMeta[s.mastery_state] || stateMeta.beginner
                  const tm = trendMeta[s.trend] || trendMeta['—']
                  return (
                    <tr key={s.student_id} className="text-slate-800 hover:bg-slate-50 transition">
                      <td className="py-3 pr-4 font-medium">{s.full_name}</td>
                      <td className="py-3 pr-4 text-slate-500">{s.department}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sm.bg} ${sm.color}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.avg_mastery >= 90 ? 'bg-emerald-500' :
                                s.avg_mastery >= 75 ? 'bg-blue-500' :
                                s.avg_mastery >= 60 ? 'bg-amber-400' :
                                s.avg_mastery >= 40 ? 'bg-orange-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${s.avg_mastery}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{s.avg_mastery}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-base font-bold ${tm.color}`} title={tm.label}>
                          {s.trend}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{s.best_topic}</td>
                      <td className="py-3 text-slate-600">{s.total_attempts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Class Insights</h2>
        {data?.class_insights ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Students attempted</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.class_insights.students_attempted ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Topics completed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.class_insights.topics_completed ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Average mastery</p>
              <p className="mt-2 text-2xl font-bold text-indigo-600">
                {data.class_insights.average_mastery != null
                  ? `${Math.round(data.class_insights.average_mastery * 100)}%`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Most difficult topic</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {data.class_insights.most_difficult_topic
                  ? formatTopic(data.class_insights.most_difficult_topic)
                  : '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No class insights yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quiz summaries</h2>
        {(data?.quiz_summaries || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No attempts yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pr-4 font-semibold">Quiz</th>
                  <th className="pb-3 pr-4 font-semibold">Attempts</th>
                  <th className="pb-3 font-semibold">Avg %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.quiz_summaries || []).map((s, idx) => (
                  <tr key={`${s.quiz?.title ?? 'quiz'}-${idx}`} className="text-slate-800">
                    <td className="py-3 pr-4">{s.quiz?.title || '—'}</td>
                    <td className="py-3 pr-4">{s.attempt_count}</td>
                    <td className="py-3">{s.average_percent != null ? `${s.average_percent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your quizzes</h2>
        <div className="mt-4">
          <QuizList
            variant="teacher"
            items={quizzes}
            emptyMessage="Create questions and a quiz to see them here."
          />
        </div>
      </div>
    </div>
  )
}