import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import MaterialAccessButtons from '../components/MaterialAccessButtons'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('easy')
  const [department, setDepartment] = useState('')
  const [type, setType] = useState('link')
  const [url, setUrl] = useState('')
  const [inputMode, setInputMode] = useState('upload')
  const [file, setFile] = useState(null)

  const loadMaterials = useCallback(async () => {
    setError('')
    try {
      const res = await api.getMaterials()
      setMaterials(res.materials || [])
    } catch (e) {
      setError(e.message || 'Failed to load materials')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const deptRes = await api.getDepartments().catch(() => ({ departments: [] }))
        if (!cancelled) setDepartments(deptRes.departments || [])
        await loadMaterials()
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadMaterials])

  const handleTypeChange = (next) => {
    setType(next)
    setFile(null)
    setUrl('')
    if (next === 'pdf') {
      setInputMode('upload')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      if (type === 'pdf' && inputMode === 'upload') {
        if (!file) {
          setError('Choose a PDF file to upload.')
          setSaving(false)
          return
        }
        const fd = new FormData()
        fd.append('title', title.trim())
        fd.append('topic', topic.trim())
        fd.append('difficulty', difficulty)
        fd.append('department', department.trim())
        fd.append('type', 'pdf')
        fd.append('file', file)
        await api.createMaterial(fd)
      } else if (type === 'pdf' && inputMode === 'link') {
        const u = url.trim()
        if (!u) {
          setError('Paste a PDF link.')
          setSaving(false)
          return
        }
        await api.createMaterial({
          title: title.trim(),
          topic: topic.trim(),
          difficulty,
          department: department.trim(),
          type: 'pdf',
          url: u,
        })
      } else {
        const u = url.trim()
        if (!u) {
          setError('URL is required.')
          setSaving(false)
          return
        }
        await api.createMaterial({
          title: title.trim(),
          topic: topic.trim(),
          difficulty,
          department: department.trim(),
          type,
          url: u,
        })
      }
      setSuccess('Material added.')
      setTitle('')
      setTopic('')
      setDepartment('')
      setUrl('')
      setFile(null)
      setDifficulty('easy')
      setType('link')
      setInputMode('upload')
      await loadMaterials()
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Study materials</h1>
        <p className="mt-1 text-slate-600">
          Add resources by topic and difficulty. For PDFs you can upload a file or share a link.
          Students in the selected department (or all, if empty) can discover them.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Add material</h2>
        {success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            placeholder="e.g. Loops"
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={inputClass}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={inputClass}
            >
              <option value="pdf">PDF</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
            </select>
          </div>
        </div>

        {type === 'pdf' && (
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">PDF source</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="pdfSource"
                checked={inputMode === 'upload'}
                onChange={() => {
                  setInputMode('upload')
                  setUrl('')
                }}
              />
              Upload file
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="pdfSource"
                checked={inputMode === 'link'}
                onChange={() => {
                  setInputMode('link')
                  setFile(null)
                }}
              />
              Use link
            </label>
            {inputMode === 'upload' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">PDF file</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className={`${inputClass} py-2`}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">PDF link</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required={inputMode === 'link'}
                  placeholder="Paste PDF link (Google Drive, etc.)"
                  className={inputClass}
                />
              </div>
            )}
          </fieldset>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Department (optional — leave empty for all departments)
          </label>
          <input
            list="material-department-suggestions"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Match student profile, e.g. CSE"
            className={inputClass}
            autoComplete="off"
          />
          <datalist id="material-department-suggestions">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        {type !== 'pdf' && (
          <div>
            <label className="block text-sm font-medium text-slate-700">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://…"
              className={inputClass}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Add material'}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your materials</h2>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No materials yet. Add one above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {materials.map((m) => (
              <li key={m._id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Topic: {m.topic || '—'} · Difficulty: {m.difficulty || '—'} · Type:{' '}
                    {m.type || m.resource_type || '—'}
                    {m.department ? ` · Dept: ${m.department}` : ' · All departments'}
                  </p>
                </div>
                <div className="shrink-0">
                  <MaterialAccessButtons material={m} primary={false} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
