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

export default function TopicDifficultyChart({ rows = [] }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Topic difficulty</h3>
        <p className="mt-2 text-sm text-slate-500">No topic accuracy data yet.</p>
      </div>
    )
  }

  const labels = rows.map((r) => {
    const subject = r.subject || ''
    const topic = r.topic || ''
    const difficulty = r.difficulty || ''

    const raw = subject && topic ? `${subject}::${topic}` : topic || ''
    const formatted = formatTopic(raw)
    if (!difficulty) return formatted.length > 36 ? `${formatted.slice(0, 34)}…` : formatted
    const withDiff = `${formatted} (${difficulty})`
    return withDiff.length > 36 ? `${withDiff.slice(0, 34)}…` : withDiff
  })
  const dataPct = rows.map((r) =>
    Math.round((Number(r.avg_accuracy) || 0) * 100),
  )

  const data = {
    labels,
    datasets: [
      {
        label: 'Accuracy %',
        data: dataPct,
        backgroundColor: 'rgba(79, 70, 229, 0.65)',
        borderColor: 'rgb(67, 56, 202)',
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
        text: 'Topic accuracy (lowest first in list order)',
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
        Topic difficulty (accuracy)
      </h3>
      <div className="h-72 sm:h-80">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
