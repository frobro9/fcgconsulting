'use client'

import { useEffect, useState } from 'react'

interface QueueStats {
  pending: number
  auditing: number
  completed: number
  failed: number
}

interface Props {
  refreshKey?: number
  onRunBatch?: () => void
  runningBatch?: boolean
}

export default function AuditQueueStats({ refreshKey, onRunBatch, runningBatch }: Props) {
  const [stats, setStats] = useState<QueueStats | null>(null)

  async function fetchStats() {
    const res = await fetch('/api/admin/audits/queue')
    if (res.ok) setStats(await res.json())
  }

  useEffect(() => { fetchStats() }, [refreshKey])

  if (!stats) return null

  const total = stats.pending + stats.auditing + stats.completed + stats.failed

  if (total === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Audit Queue</h3>
        {onRunBatch && stats.pending > 0 && (
          <button
            onClick={onRunBatch}
            disabled={runningBatch}
            className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {runningBatch ? 'Running…' : `Run Next Batch (${Math.min(stats.pending, 100)})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-gray-600 bg-gray-50' },
          { label: 'Auditing', value: stats.auditing, color: 'text-blue-600 bg-blue-50' },
          { label: 'Completed', value: stats.completed, color: 'text-green-600 bg-green-50' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600 bg-red-50' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg px-3 py-2 text-center ${color}`}>
            <div className="text-lg font-bold">{value}</div>
            <div className="text-xs">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
