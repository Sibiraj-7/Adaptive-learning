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

export default function TopicMasteryDistributionChart({ rows = [] }) {
  const limited = (rows || []).slice(0, 20)

  if (!limited.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Topic mastery distribution
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          No topic mastery distribution data yet.
        </p>
      </div>
    )
  }

  const labels = limited.map((r) => {
    const subject = r.subject || ''
    const topic = r.topic || ''
    const difficulty = r.difficulty || ''
    const rawKey = subject && topic ? `${subject}::${topic}` : topic
    const formatted = formatTopic(rawKey)
    const diffLabel = difficulty ? ` (${difficulty})` : ''
    const full = `${formatted}${diffLabel}`
    return full.length > 44 ? `${full.slice(0, 41)}…` : full
  })

  const dataPct = limited.map((r) =>
    Math.round((Number(r.accuracy) || 0) * 100),
  )

  const data = {
    labels,
    datasets: [
      {
        label: 'Accuracy %',
        data: dataPct,
        backgroundColor: 'rgba(99, 102, 241, 0.55)',
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
        text: 'Topic mastery accuracy across difficulty',
        font: { size: 14, weight: '600' },
        color: '#0f172a',
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.x}% accuracy`,
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
      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        Topic Mastery Distribution
      </h3>
      <div className="h-72 sm:h-80">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}

