'use client'

import Link from 'next/link'
import { getScoreBg, getScoreLabel } from '@/lib/audits/scores'

interface Audit {
  id: string
  url: string
  business_name: string | null
  status: string
  overall_score: number | null
  progress_pct: number
  created_at: string
  completed_at: string | null
  report_url?: string | null
}

interface Props {
  audits: Audit[]
  onDelete?: (id: string) => void
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

export default function AuditTable({ audits, onDelete }: Props) {
  if (audits.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No audits yet. Use the discovery form above to find websites to audit.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Website</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Progress</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {audits.map(audit => (
            <tr key={audit.id} className="hover:bg-gray-50 transition">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 truncate max-w-xs">
                  {audit.business_name ?? new URL(audit.url.startsWith('http') ? audit.url : `https://${audit.url}`).hostname}
                </div>
                <div className="text-xs text-gray-400 truncate max-w-xs">{audit.url}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={audit.status} />
              </td>
              <td className="px-4 py-3">
                {audit.status === 'in_progress'
                  ? <ProgressBar pct={audit.progress_pct} />
                  : audit.status === 'completed'
                  ? <ProgressBar pct={100} />
                  : <span className="text-xs text-gray-400">—</span>
                }
              </td>
              <td className="px-4 py-3">
                {audit.overall_score !== null ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBg(audit.overall_score)}`}>
                    {audit.overall_score}/100 · {getScoreLabel(audit.overall_score)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {new Date(audit.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/audits/${audit.id}`}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    View
                  </Link>
                  {audit.report_url && (
                    <a
                      href={audit.report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 font-medium hover:underline flex items-center gap-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      Report
                    </a>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(audit.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
