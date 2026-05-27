'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DIMENSIONS } from '@/lib/audits/types'
import { getDimensionScores, getScoreBg, getScoreColor, getScoreLabel, calculateOverallScore } from '@/lib/audits/scores'
import type { AuditCheck, WebAudit } from '@/lib/audits/types'

interface Props {
  auditId: string
  initialAudit: WebAudit
  initialChecks: AuditCheck[]
}

const CHECK_STATUS_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  fail: 'bg-red-100 text-red-700 border-red-200',
  error: 'bg-gray-100 text-gray-500 border-gray-200',
  pending: 'bg-gray-100 text-gray-400 border-gray-200',
}

const CHECK_STATUS_ICONS: Record<string, string> = {
  pass: '✓',
  warning: '⚠',
  fail: '✗',
  error: '!',
  pending: '…',
}

const CHECK_LABELS: Record<string, string> = {
  meta_tags: 'Meta Tags & Title',
  image_optimization: 'Image Optimisation',
  ssl_certificate: 'SSL / HTTPS',
  mobile_viewport: 'Mobile Viewport',
  image_alt_text: 'Image Alt Text',
  heading_structure: 'Heading Structure',
  open_graph: 'Open Graph & Social',
  canonical_url: 'Canonical URL',
}

export default function AuditResultDetail({ auditId, initialAudit, initialChecks }: Props) {
  const router = useRouter()
  const [audit, setAudit] = useState<WebAudit>(initialAudit)
  const [checks, setChecks] = useState<AuditCheck[]>(initialChecks)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>((initialAudit as any).report_url ?? null)

  const isInProgress = audit.status === 'in_progress'
  const isPending = audit.status === 'pending'
  const shouldPoll = isInProgress || isPending

  // Poll every 2s while in progress
  const fetchUpdates = useCallback(async () => {
    const res = await fetch(`/api/admin/audits/${auditId}`)
    if (!res.ok) return
    const data = await res.json()
    setAudit(data.audit)
    setChecks(data.checks)
  }, [auditId])

  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(fetchUpdates, 2000)
    return () => clearInterval(interval)
  }, [shouldPoll, fetchUpdates])

  async function handleRunNow() {
    setRunning(true)
    try {
      const res = await fetch(`/api/admin/audits/${auditId}/run-now`, { method: 'POST' })
      if (res.ok) await fetchUpdates()
    } finally {
      setRunning(false)
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true)
    try {
      const res = await fetch(`/api/admin/audits/${auditId}/report`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.reportUrl) {
        setReportUrl(data.reportUrl)
        window.open(data.reportUrl, '_blank')
      } else {
        alert(data.error ?? 'Failed to generate report')
      }
    } finally {
      setGeneratingReport(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this audit and all its results?')) return
    setDeleting(true)
    await fetch(`/api/admin/audits/${auditId}`, { method: 'DELETE' })
    router.push('/admin/audits')
  }

  const overallScore = audit.overall_score ?? calculateOverallScore(checks)
  const dimScores = getDimensionScores(checks)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {audit.business_name ?? audit.url}
            </h1>
            <a
              href={audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate block"
            >
              {audit.url}
            </a>
            <div className="mt-2 flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                audit.status === 'completed' ? 'bg-green-100 text-green-700'
                : audit.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                : audit.status === 'failed' ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {audit.status === 'in_progress' ? 'In Progress' : audit.status.charAt(0).toUpperCase() + audit.status.slice(1)}
              </span>
              {(isInProgress || isPending) && (
                <span className="text-xs text-gray-400 animate-pulse">
                  Checking… {audit.progress_pct}% complete
                </span>
              )}
              {audit.completed_at && (
                <span className="text-xs text-gray-400">
                  Completed {new Date(audit.completed_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Overall Score */}
          {overallScore > 0 && (
            <div className="text-center shrink-0">
              <div className={`text-4xl font-black ${getScoreColor(overallScore)}`}>
                {overallScore}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">out of 100</div>
              <div className={`text-xs font-medium mt-1 ${getScoreColor(overallScore)}`}>
                {getScoreLabel(overallScore)}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {(isInProgress || isPending) && (
          <div className="mt-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${audit.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(audit.status === 'pending' || audit.status === 'failed' || audit.status === 'completed') && (
            <button
              onClick={handleRunNow}
              disabled={running}
              className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {running ? 'Running…' : audit.status === 'completed' ? 'Re-Audit' : 'Audit Now'}
            </button>
          )}

          {audit.status === 'completed' && (
            <>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="text-sm px-4 py-2 bg-accent text-primary font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition"
              >
                {generatingReport ? 'Generating PDF…' : reportUrl ? 'Regenerate Report' : 'Generate PDF Report'}
              </button>

              {reportUrl && (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Detailed Report
                </a>
              )}
            </>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm px-4 py-2 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Dimension Scores */}
      {checks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(dimScores).map(([key, { score, label }]) => {
            const dimChecks = checks.filter(c => c.dimension === key)
            if (dimChecks.length === 0) return null
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</div>
                <div className="text-xs text-gray-500 mt-1 leading-tight">{label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Individual Checks */}
      {checks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Check Results</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {checks.map(check => (
              <div key={check.check_name}>
                <button
                  className="w-full text-left px-6 py-4 hover:bg-gray-50 transition"
                  onClick={() => setExpanded(expanded === check.check_name ? null : check.check_name)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border ${CHECK_STATUS_STYLES[check.status]}`}>
                        {CHECK_STATUS_ICONS[check.status]}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900">
                          {CHECK_LABELS[check.check_name] ?? check.check_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {(DIMENSIONS as Record<string, string>)[check.dimension] ?? check.dimension}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold ${getScoreColor(check.score)}`}>
                        {check.score}/100
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${CHECK_STATUS_STYLES[check.status]}`}>
                        {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expanded === check.check_name ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {expanded === check.check_name && (
                  <div className="px-6 pb-5 space-y-3 bg-gray-50 border-t border-gray-100">
                    {/* Details */}
                    {check.findings?.details?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Findings</p>
                        <ul className="space-y-1">
                          {check.findings.details.map((d, i) => (
                            <li key={i} className="text-sm text-gray-700 flex gap-2">
                              <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {check.findings?.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommendations</p>
                        <ul className="space-y-1">
                          {check.findings.recommendations.map((r, i) => (
                            <li key={i} className="text-sm text-primary flex gap-2">
                              <span className="text-accent shrink-0 mt-0.5">→</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state while waiting */}
      {checks.length === 0 && (audit.status === 'pending' || audit.status === 'in_progress') && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Audit in progress — results will appear here as each check completes…</p>
        </div>
      )}

      {checks.length === 0 && audit.status === 'failed' && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-8 text-center">
          <p className="text-red-700 text-sm font-medium">Audit failed</p>
          <p className="text-red-500 text-xs mt-1">The website may be unreachable or blocking automated requests.</p>
        </div>
      )}
    </div>
  )
}
