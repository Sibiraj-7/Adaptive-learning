import { Link } from 'react-router-dom'

/**
 * @param {'teacher' | 'student'} variant
 * @param {Array} items - teacher: quizzes from API; student: assignments list { assignment, quiz }
 */
export default function QuizList({ variant, items, emptyMessage }) {
  if (!items?.length) {
    return (
      <p className="text-sm text-slate-500">{emptyMessage || 'Nothing to show.'}</p>
    )
  }

  if (variant === 'teacher') {
    return (
      <ul className="divide-y divide-slate-100">
        {items.map((q) => (
          <li key={q._id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
            <div>
              <p className="font-semibold text-slate-900">{q.title}</p>
              <p className="text-sm text-slate-500">
                Questions: {(q.question_ids || []).length}
              </p>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((row) => {
        const a = row.assignment
        const q = row.quiz
        const quizId = q?._id
        const assignId = a?._id
        return (
          <li
            key={assignId}
            className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
          >
            <div>
              <p className="font-semibold text-slate-900">{q?.title || 'Quiz'}</p>
            </div>
            {quizId && assignId && (
              <Link
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                to={`/student/quiz/${quizId}?assignment_id=${assignId}`}
              >
                Start
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
