import { useEffect, useState } from 'react'

const DEFAULT_OPTIONS = [
  { key: 'A', text: '' },
  { key: 'B', text: '' },
  { key: 'C', text: '' },
  { key: 'D', text: '' },
]

function optionsFromQuestion(q) {
  if (!q?.options?.length) {
    return DEFAULT_OPTIONS.map((o) => ({ ...o }))
  }
  const byKey = Object.fromEntries(
    q.options.map((o) => [String(o.key).trim(), o.text ?? '']),
  )
  return DEFAULT_OPTIONS.map((o) => ({
    key: o.key,
    text: byKey[o.key] ?? '',
  }))
}

export default function QuestionForm({
  mode = 'create',
  question = null,
  onSubmit,
  submitting,
  error,
  onCancel,
}) {
  const [questionText, setQuestionText] = useState('')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [options, setOptions] = useState(() =>
    DEFAULT_OPTIONS.map((o) => ({ ...o })),
  )

  useEffect(() => {
    if (mode === 'edit' && question) {
      setQuestionText(question.question_text ?? '')
      setSubject(question.subject ?? '')
      setTopic(question.topic ?? '')
      setDifficulty(question.difficulty ?? 'medium')
      setCorrectAnswer(String(question.correct_answer ?? '').toUpperCase())
      setOptions(optionsFromQuestion(question))
    } else if (mode === 'create') {
      setQuestionText('')
      setSubject('')
      setTopic('')
      setDifficulty('medium')
      setCorrectAnswer('')
      setOptions(DEFAULT_OPTIONS.map((o) => ({ ...o })))
    }
  }, [mode, question])

  const updateOption = (index, value) => {
    const next = [...options]
    next[index] = { ...next[index], text: value }
    setOptions(next)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      question_text: questionText.trim(),
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      correct_answer: correctAnswer.trim().toUpperCase(),
      options: options.map((o) => ({
        key: o.key.trim(),
        text: o.text.trim(),
      })),
    })
  }

  const isEdit = mode === 'edit'
  const submitLabel = submitting
    ? 'Saving…'
    : isEdit
      ? 'Update Question'
      : 'Save Question'

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Question Text
        </label>
        <textarea
          rows={4}
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          placeholder="Enter the full question"
          className={`${inputClass} min-h-[120px] resize-y`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="e.g. Computer Science"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          placeholder="e.g. Arrays"
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
          className={inputClass}
        >
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </select>
      </div>
      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Options</legend>
        <div className="mt-3 space-y-3">
          {options.map((opt, i) => (
            <div key={opt.key} className="flex items-center gap-2">
              <span className="w-6 text-center font-semibold text-slate-600">
                {opt.key}
              </span>
              <input
                className={inputClass}
                value={opt.text}
                onChange={(e) => updateOption(i, e.target.value)}
                required
                placeholder={`Option ${opt.key}`}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Correct Answer
        </label>
        <input
          value={correctAnswer}
          onChange={(e) => setCorrectAnswer(e.target.value)}
          required
          placeholder="A, B, C, or D"
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
