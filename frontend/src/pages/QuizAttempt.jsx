import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { formatTopic } from '../utils/formatTopic'

export default function QuizAttempt() {
  const { quizId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignment_id') || ''
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!quizId || !assignmentId) {
      setError('Missing quiz or assignment. Open the quiz from the dashboard.')
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setError('')
      try {
        const data = await api.getQuizForAttempt(quizId, assignmentId)
        if (cancelled) return
        setQuiz(data.quiz)
        setQuestions(data.questions || [])
        const init = {}
        ;(data.questions || []).forEach((q) => {
          init[q._id] = ''
        })
        setAnswers(init)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load quiz')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [quizId, assignmentId])

  const setAnswer = (qid, key) => {
    setAnswers((prev) => ({ ...prev, [qid]: key }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const missing = questions.some((q) => !answers[q._id])
    if (missing) {
      setError('Answer every question before submitting.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        quiz_id: quizId,
        assignment_id: assignmentId,
        answers: questions.map((q) => ({
          question_id: q._id,
          selected_option: answers[q._id],
        })),
      }
      const res = await api.submitAttempt(payload)
      setResult(res)
    } catch (err) {
      setError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading quiz…</p>
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Submitted</h1>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
          <p className="text-slate-800">
            Score:{' '}
            <strong className="text-emerald-800">
              {result.attempt?.total_score}
            </strong>{' '}
            / {result.attempt?.max_score} ({result.percentage}%)
          </p>
          <p className="mt-3 text-slate-800">
            Recommended next topic:{' '}
            <strong>
              {result.recommended_next_topic
                ? formatTopic(result.recommended_next_topic)
                : '—'}
            </strong>
          </p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => navigate('/student')}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {quiz?.title || 'Quiz'}
      </h1>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {questions.map((q, idx) => (
          <fieldset
            key={q._id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <legend className="px-1 text-base font-semibold text-slate-900">
              Q{idx + 1} · {q.topic}{' '}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {q.difficulty}
              </span>
            </legend>
            {q.question_text && (
              <p className="mt-3 whitespace-pre-wrap text-slate-800">
                {q.question_text}
              </p>
            )}
            <p className="mt-2 text-sm text-slate-500">{q.subject} — pick one answer.</p>
            <div className="mt-4 space-y-3">
              {(q.options || []).map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name={`q-${q._id}`}
                    value={opt.key}
                    checked={answers[q._id] === opt.key}
                    onChange={() => setAnswer(q._id, opt.key)}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-800">
                    <strong>{opt.key}.</strong> {opt.text}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit quiz'}
        </button>
      </form>
    </div>
  )
}
