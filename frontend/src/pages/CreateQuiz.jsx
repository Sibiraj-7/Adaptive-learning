import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
const buttonClass =
  'rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60'
const secondaryButtonClass =
  'rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60'

function makeBlankQuestion(idx = 1) {
  return {
    client_id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    idx,
    question_text: '',
    options: { A: '', B: '', C: '', D: '' },
    correct_answer: 'A',
  }
}

export default function CreateQuiz({ onDone, heading = 'Create quiz' }) {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('easy')

  const [questions, setQuestions] = useState(() => [makeBlankQuestion(1)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const quizQuestionsCount = useMemo(() => questions.length, [questions])

  const finish = async () => {
    if (onDone) await onDone()
    else navigate('/teacher/quizzes')
  }

  const updateQuestion = (clientId, patch) => {
    setQuestions((prev) =>
      prev.map((q) => (q.client_id === clientId ? { ...q, ...patch } : q)),
    )
  }

  const updateOption = (clientId, key, value) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.client_id === clientId
          ? { ...q, options: { ...q.options, [key]: value } }
          : q,
      ),
    )
  }

  const deleteQuestion = (clientId) => {
    setQuestions((prev) => {
      const next = prev.filter((q) => q.client_id !== clientId)
      if (next.length === 0) return [makeBlankQuestion(1)]
      return next.map((q, idx) => ({ ...q, idx: idx + 1 }))
    })
  }

  const addQuestion = () => {
    setQuestions((prev) => {
      const nextIdx = prev.length + 1
      return [...prev, makeBlankQuestion(nextIdx)]
    })
  }

  const validate = () => {
    const tTitle = title.trim()
    const tSubject = subject.trim()
    const tTopic = topic.trim()
    const tDifficulty = (difficulty || '').toString().trim().toLowerCase()

    if (!tTitle) return 'Quiz title is required.'
    if (!tSubject) return 'Subject is required.'
    if (!tTopic) return 'Topic is required.'
    if (!['easy', 'medium', 'hard'].includes(tDifficulty))
      return 'Difficulty must be easy, medium, or hard.'

    if (!questions.length) return 'Add at least one question.'

    for (const q of questions) {
      const qt = (q.question_text || '').trim()
      if (!qt) return `Question ${q.idx}: question text is required.`

      const optionKeys = ['A', 'B', 'C', 'D']
      const cleanedOptions = optionKeys
        .map((k) => ({ key: k, text: (q.options?.[k] || '').trim() }))
        .filter((o) => o.text.length > 0)

      if (cleanedOptions.length < 2) {
        return `Question ${q.idx}: provide at least two non-empty options (A-D).`
      }

      const correct = (q.correct_answer || '').toString().trim().toUpperCase()
      if (!optionKeys.includes(correct)) {
        return `Question ${q.idx}: correct answer must be selected (A-D).`
      }

      const correctText = (q.options?.[correct] || '').trim()
      if (!correctText) {
        return `Question ${q.idx}: the correct answer option text cannot be empty.`
      }
    }

    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)
    try {
      const createdQuestionIds = []

      // Save questions first, then create quiz referencing their ids.
      for (const q of questions) {
        const optionKeys = ['A', 'B', 'C', 'D']
        const cleanedOptions = optionKeys
          .map((k) => ({ key: k, text: (q.options?.[k] || '').trim() }))
          .filter((o) => o.text.length > 0)

        const payload = {
          question_text: (q.question_text || '').trim(),
          options: cleanedOptions.map((o) => ({ key: o.key, text: o.text })),
          correct_answer: (q.correct_answer || '').toString().trim().toUpperCase(),
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty: (difficulty || '').toString().trim().toLowerCase(),
        }

        const res = await api.createQuestion(payload)
        const qid = res?._id
        if (!qid) {
          throw new Error('Could not create question (missing id).')
        }
        createdQuestionIds.push(qid)
      }

      await api.createQuiz({
        title: title.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        difficulty: (difficulty || '').toString().trim().toLowerCase(),
        question_ids: createdQuestionIds.map((id) => String(id)),
      })

      await finish()
    } catch (err) {
      setError(err.message || 'Could not create quiz')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-slate-600">
          Build your quiz and create its questions inline.
        </p>
      </div>

      <form
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Quiz Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Arrays Basics"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              required
              className={inputClass}
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="e.g. Data Structures"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Topic
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              placeholder="e.g. Arrays"
              className={inputClass}
            />
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Questions ({quizQuestionsCount})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Each question has four options (A-D) and one correct answer.
              </p>
            </div>

            <button
              type="button"
              onClick={addQuestion}
              className={secondaryButtonClass}
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.client_id} className={cardClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">
                    Question {idx + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.client_id)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Question Text
                    </label>
                    <input
                      value={q.question_text}
                      onChange={(e) =>
                        updateQuestion(q.client_id, {
                          question_text: e.target.value,
                        })
                      }
                      required
                      placeholder="Type the question…"
                      className={inputClass}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {['A', 'B', 'C', 'D'].map((k) => (
                      <div key={k}>
                        <label className="block text-sm font-medium text-slate-700">
                          Option {k}
                        </label>
                        <input
                          value={q.options?.[k] || ''}
                          onChange={(e) => updateOption(q.client_id, k, e.target.value)}
                          placeholder={`Text for option ${k}`}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Correct Answer
                      </label>
                      <select
                        value={q.correct_answer}
                        onChange={(e) =>
                          updateQuestion(q.client_id, {
                            correct_answer: e.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <div className="text-sm text-slate-500">
                        Selected: <span className="font-semibold text-slate-700">{q.correct_answer}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? 'Creating…' : 'Create quiz'}
        </button>
      </form>
    </div>
  )
}
