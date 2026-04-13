import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50">
      <main>
        <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
            Final year project
          </p>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Adaptive Learning Path Recommendation Engine
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            This platform analyzes student quiz performance and recommends the next topic for personalized learning.
          </p>

          <div className="mt-10">
            <Link
              to="/login"
              className="inline-flex rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700"
            >
              Login
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Features
            </h2>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                'Personalized learning recommendations',
                'Quiz-based knowledge tracking',
                'Topic mastery analysis',
                'Teacher analytics dashboard',
              ].map((text) => (
                <li
                  key={text}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm"
                >
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    ✓
                  </span>
                  <span className="text-left font-medium text-slate-800">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-200 py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              How it works
            </h2>

            <ol className="mx-auto mt-10 max-w-2xl space-y-6">
              {[
                'Student takes quiz',
                'System analyzes results',
                'Knowledge tracing calculates mastery',
                'Recommends next topic',
              ].map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="pt-1.5 text-lg text-slate-700">{step}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-slate-100 py-8 text-center text-sm text-slate-500">
          Adaptive Learning Path Recommendation Engine — personalized education
        </footer>
      </main>
    </div>
  )
}