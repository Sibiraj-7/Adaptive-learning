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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function QuizPerformanceChart({ quizSummaries = [] }) {
  const rows = quizSummaries.filter(
    (s) => s.average_percent != null && s.quiz?.title,
  )

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Quiz performance</h3>
        <p className="mt-2 text-sm text-slate-500">
          No quiz summary data yet (attempts will appear here).
        </p>
      </div>
    )
  }

  const labels = rows.map((s) => {
    const t = s.quiz?.title || 'Quiz'
    return t.length > 28 ? `${t.slice(0, 26)}…` : t
  })
  const values = rows.map((s) => Number(s.average_percent))

  const data = {
    labels,
    datasets: [
      {
        label: 'Average score %',
        data: values,
        backgroundColor: 'rgba(16, 185, 129, 0.65)',
        borderColor: 'rgb(5, 150, 105)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Average score by quiz',
        font: { size: 14, weight: '600' },
        color: '#0f172a',
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y}% average`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { callback: (v) => `${v}%` },
        grid: { color: 'rgba(148, 163, 184, 0.25)' },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        Quiz performance
      </h3>
      <div className="h-64 sm:h-72">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
