import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import MaterialAccessButtons from '../components/MaterialAccessButtons'

export default function StudentMaterials() {
  const [recommended, setRecommended] = useState([])
  const [allMaterials, setAllMaterials] = useState([])
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const res = await api.getRecommendedMaterials()
        if (!cancelled) setRecommended(res.materials || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load recommendations')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoadingAll(true)
    setError('')
    try {
      const params = {}
      if (filterTopic.trim()) params.topic = filterTopic.trim()
      if (filterDifficulty) params.difficulty = filterDifficulty
      const res = await api.getMaterials(params)
      setAllMaterials(res.materials || [])
    } catch (e) {
      setError(e.message || 'Failed to load materials')
    } finally {
      setLoadingAll(false)
    }
  }, [filterTopic, filterDifficulty])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Materials</h1>
        <p className="mt-1 text-slate-600">Recommended for you and the full library</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">📚 Recommended materials</h2>
        <p className="mt-1 text-sm text-slate-600">
          Based on your weaker topics and suggested difficulty level.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : recommended.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No recommendations yet. Complete quizzes to build mastery, or browse all materials
            below.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recommended.map((m) => (
              <li
                key={m._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="text-sm text-slate-600">
                    Topic: {m.topic || '—'} · Difficulty: {m.difficulty || '—'}
                  </p>
                </div>
                <MaterialAccessButtons material={m} primary />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">📂 All materials</h2>
        <p className="mt-1 text-sm text-slate-600">Filter by topic and difficulty.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Topic</label>
            <input
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              placeholder="Exact topic name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Difficulty</label>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className={inputClass}
            >
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {loadingAll ? (
          <p className="mt-6 text-sm text-slate-500">Loading materials…</p>
        ) : allMaterials.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No materials match your filters.</p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100">
            {allMaterials.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="text-sm text-slate-600">
                    Topic: {m.topic || '—'} · Difficulty: {m.difficulty || '—'} · Type:{' '}
                    {m.type || m.resource_type || '—'}
                  </p>
                </div>
                <MaterialAccessButtons material={m} primary={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
