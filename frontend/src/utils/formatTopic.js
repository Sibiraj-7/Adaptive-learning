export function formatTopic(key) {
  if (key == null || key === '') return '—'
  const s = String(key)
  const parts = s.split('::')
  if (parts.length === 2) {
    return `${parts[1].trim()} (${parts[0].trim()})`
  }
  const i = s.indexOf(':')
  if (i > 0 && !s.includes('::')) {
    const left = s.slice(0, i).trim()
    const right = s.slice(i + 1).trim()
    if (left && right) return `${right} (${left})`
  }
  return s
}
