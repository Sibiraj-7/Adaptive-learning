import { api } from '../services/api'

export default function MaterialAccessButtons({
  material,
  primary = true,
}) {
  const hasFile = Boolean(material?.file_path)
  const hasUrl = Boolean(material?.url && String(material.url).trim())

  const download = async () => {
    try {
      const base = (material?.title || 'material').replace(/[^\w\s.-]/g, '').trim() || 'material'
      await api.downloadMaterialFile(material._id, `${base}.pdf`)
    } catch (e) {
      alert(e.message || 'Download failed')
    }
  }

  const btnPrimary =
    'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
  const btnSecondary =
    'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'

  if (!hasFile && !hasUrl) {
    return <span className="text-sm text-slate-400">—</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasFile && (
        <button
          type="button"
          onClick={download}
          className={primary ? btnPrimary : btnSecondary}
        >
          Download
        </button>
      )}
      {hasUrl && (
        <a
          href={material.url}
          target="_blank"
          rel="noreferrer"
          className={primary ? btnSecondary : btnPrimary}
        >
          Open link
        </a>
      )}
    </div>
  )
}
