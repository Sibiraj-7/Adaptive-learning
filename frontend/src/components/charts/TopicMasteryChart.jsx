import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatTopic } from '../../utils/formatTopic'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export function flattenMasteryEntries(masteryBySubject) {
  if (!masteryBySubject || typeof masteryBySubject !== 'object') return []
  const byLabel = new Map()
  for (const [subject, doc] of Object.entries(masteryBySubject)) {
    const tm = doc?.topic_mastery
    if (!tm || typeof tm !== 'object') continue
    for (const [key, val] of Object.entries(tm)) {
      if (typeof val !== 'number') continue
      const label = key.includes('::')
        ? formatTopic(key)
        : `${key} (${subject || 'General'})`
      const prev = byLabel.get(label)
      if (prev == null || val > prev) byLabel.set(label, val)
    }
  }
  return Array.from(byLabel.entries()).map(([label, value]) => ({
    label,
    value,
  }))
}

export default function TopicMasteryChart({ masteryBySubject }) {
  const entries = flattenMasteryEntries(masteryBySubject)

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Topic mastery</h3>
        <p className="mt-2 text-sm text-slate-500">
          Complete a quiz to see mastery estimates.
        </p>
      </div>
    )
  }

  const sorted = [...entries].sort((a, b) => a.value - b.value)
  const labels = sorted.map((e) =>
    e.label.length > 32 ? `${e.label.slice(0, 30)}…` : e.label,
  )
  const values = sorted.map((e) => Math.round(e.value * 100))

  const data = {
    labels,
    datasets: [
      {
        label: 'Mastery %',
        data: values,
        backgroundColor: 'rgba(99, 102, 241, 0.65)',
        borderColor: 'rgb(79, 70, 229)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Your topic mastery',
        font: { size: 14, weight: '600' },
        color: '#0f172a',
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.x}% mastery`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { callback: (v) => `${v}%` },
        grid: { color: 'rgba(148, 163, 184, 0.25)' },
      },
      y: {
        grid: { display: false },
      },
    },
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Topic mastery</h3>
      <div className="h-72 sm:h-96">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
