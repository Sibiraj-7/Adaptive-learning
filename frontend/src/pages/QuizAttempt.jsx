import { useEffect, useRef, useState } from 'react'
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
  const [quizStarted, setQuizStarted] = useState(false)

  const hasSubmittedRef = useRef(false)

  const autoSubmitReasonRef = useRef(null)

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
        ;(data.questions || []).forEach((q) => { init[q._id] = '' })
        setAnswers(init)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load quiz')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [quizId, assignmentId])

  const submitQuiz = async (answersSnapshot, isAuto = false, reason = '') => {
    if (hasSubmittedRef.current) return
    hasSubmittedRef.current = true

    setSubmitting(true)
    setError('')

    try {
      const payload = {
        quiz_id: quizId,
        assignment_id: assignmentId,
        answers: questions.map((q) => ({
          question_id: q._id,
          selected_option: answersSnapshot[q._id] || '',
        })),
      }
      const res = await api.submitAttempt(payload)
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}) }
      setResult(res)
    } catch (err) {
      hasSubmittedRef.current = false
      setError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (hasSubmittedRef.current) return

    const missing = questions.some((q) => !answers[q._id])
    if (missing) {
      setError('Answer every question before submitting.')
      return
    }
    submitQuiz(answers, false)
  }

  useEffect(() => {
    if (!quizStarted) return

    const handleVisibilityChange = () => {
      if (!document.hidden) return
      if (hasSubmittedRef.current) return
      if (autoSubmitReasonRef.current) return

      autoSubmitReasonRef.current = 'tab-switch'
      alert('⚠️ Tab switching detected — quiz will be auto-submitted.')
      submitQuiz(answers, true, 'tab-switch')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [quizStarted, answers])

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
    } catch (err) {
      console.warn('Fullscreen denied:', err)
    }
  }

  useEffect(() => {
    if (!quizStarted) return

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return
      if (hasSubmittedRef.current) return
      if (autoSubmitReasonRef.current) return

      autoSubmitReasonRef.current = 'fullscreen-exit'
      alert('⚠️ You exited fullscreen — quiz will be auto-submitted.')
      submitQuiz(answers, true, 'fullscreen-exit')
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [quizStarted, answers])

  useEffect(() => {
    if (!quizStarted) return

    const block = (e) => e.preventDefault()

    document.addEventListener('copy', block)
    document.addEventListener('paste', block)
    document.addEventListener('cut', block)
    document.addEventListener('contextmenu', block)

    return () => {
      document.removeEventListener('copy', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('contextmenu', block)
    }
  }, [quizStarted])

  useEffect(() => {
    if (!quizStarted) return

    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && ['c', 'v', 'x', 'u', 'a'].includes(e.key.toLowerCase())) ||
        (e.metaKey && ['c', 'v', 'x', 'u', 'a'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [quizStarted])

  const handleReattempt = async () => {
    if (submitting) return
    setError('')
    setLoading(true)
    setResult(null)
    setSubmitting(false)
    hasSubmittedRef.current = false     // reset submission guard
    autoSubmitReasonRef.current = null  // reset reason guard
    setQuizStarted(false)

    try {
      const data = await api.getQuizForAttempt(quizId, assignmentId)
      setQuiz(data.quiz)
      const nextQuestions = data.questions || []
      setQuestions(nextQuestions)
      const init = {}
      nextQuestions.forEach((q) => { init[q._id] = '' })
      setAnswers(init)
    } catch (e) {
      setError(e.message || 'Could not reload quiz for reattempt')
    } finally {
      setLoading(false)
    }
  }

  const handleStartQuiz = async () => {
    await enterFullscreen()   // safe here — inside a click handler
    setQuizStarted(true)
  }

  const setAnswer = (qid, key) => {
    setAnswers((prev) => ({ ...prev, [qid]: key }))
  }

  if (loading) {
    return <p className="text-slate-500">Loading quiz…</p>
  }

  if (result) {
    const pct = Number(result?.percentage)
    const canReattempt = Number.isFinite(pct) && pct < 70

    return (
      <div className="mx-auto max-w-lg space-y-6 select-none">
        <h1 className="text-2xl font-bold text-slate-900">
          {canReattempt ? 'Submitted' : 'Completed'}
        </h1>

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

          {!canReattempt && (
            <button
              type="button"
              disabled
              className="mt-4 rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm cursor-not-allowed"
            >
              Completed
            </button>
          )}

          {canReattempt && (
            <button
              onClick={handleReattempt}
              className="mt-4 rounded-lg bg-yellow-500 px-4 py-2 text-slate-900 font-semibold hover:bg-yellow-600"
            >
              Reattempt Quiz
            </button>
          )}

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

  if (!quizStarted) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {quiz?.title || 'Quiz'}
        </h1>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <p className="text-slate-600 text-sm">
            Before you begin, please note:
          </p>

          <ul className="text-left text-sm text-slate-700 space-y-2">
            <li>🖥️ The quiz will open in <strong>fullscreen mode</strong></li>
            <li>🚫 Tab switching will <strong>auto-submit</strong> your quiz</li>
            <li>🚫 Exiting fullscreen will <strong>auto-submit</strong> your quiz</li>
            <li>🚫 Copy, paste and right-click are <strong>disabled</strong></li>
            <li>🚫 Text selection is <strong>disabled</strong></li>
          </ul>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            onClick={handleStartQuiz}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition"
          >
            Start Quiz
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 select-none">
      <h1 className="text-2xl font-bold text-slate-900">
        {quiz?.title || 'Quiz'}
      </h1>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form
        className="space-y-6"
        onSubmit={handleSubmit}
        onMouseDown={(e) => { if (e.detail > 1) e.preventDefault() }}
      >
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

            <div className="mt-4 space-y-3">
              {(q.options || []).map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition"
                >
                  <input
                    type="radio"
                    name={`q-${q._id}`}
                    value={opt.key}
                    checked={answers[q._id] === opt.key}
                    onChange={() => setAnswer(q._id, opt.key)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-800">
                    <strong className="mr-1">{opt.key}.</strong>
                    {opt.text}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Quiz'}
        </button>
      </form>
    </div>
  )
}