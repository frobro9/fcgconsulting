'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AuditDiscoveryForm from '@/components/audits/AuditDiscoveryForm'
import AuditQueueStats from '@/components/audits/AuditQueueStats'
import AuditTable from '@/components/audits/AuditTable'

interface Audit {
  id: string
  url: string
  business_name: string | null
  status: string
  overall_score: number | null
  progress_pct: number
  created_at: string
  completed_at: string | null
}

export default function AuditsPage() {
  const router = useRouter()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [queueRefreshKey, setQueueRefreshKey] = useState(0)
  const [runningBatch, setRunningBatch] = useState(false)
  const [showNewAuditForm, setShowNewAuditForm] = useState(false)
  const [singleUrl, setSingleUrl] = useState('')
  const [singleName, setSingleName] = useState('')
  const [auditingUrl, setAuditingUrl] = useState(false)

  const fetchAudits = useCallback(async () => {
    const res = await fetch('/api/admin/audits')
    if (res.ok) {
      const data = await res.json()
      setAudits(data.audits)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAudits() }, [fetchAudits])

  // Poll while any audit is in-progress
  const hasActive = audits.some(a => a.status === 'in_progress' || a.status === 'pending')
  useEffect(() => {
    if (!hasActive) return
    const interval = setInterval(fetchAudits, 3000)
    return () => clearInterval(interval)
  }, [hasActive, fetchAudits])

  function handleDiscovered() {
    setQueueRefreshKey(k => k + 1)
    fetchAudits()
  }

  async function handleRunBatch() {
    setRunningBatch(true)
    await fetch('/api/admin/audits/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 100 }),
    })
    setRunningBatch(false)
    setQueueRefreshKey(k => k + 1)
    fetchAudits()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this audit?')) return
    await fetch(`/api/admin/audits/${id}`, { method: 'DELETE' })
    fetchAudits()
  }

  async function handleAuditNow(e: React.FormEvent) {
    e.preventDefault()
    if (!singleUrl.trim()) return
    setAuditingUrl(true)

    // Create audit + run now
    const res = await fetch('/api/admin/audits/new/run-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: singleUrl.trim(), businessName: singleName.trim() || undefined }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/admin/audits/${data.auditId}`)
    } else {
      setAuditingUrl(false)
      alert('Failed to start audit. Please check the URL and try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Web Audits</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyse business websites for SEO, performance, security, and more.
          </p>
        </div>
        <button
          onClick={() => setShowNewAuditForm(v => !v)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          + Audit a URL
        </button>
      </div>

      {/* Audit Single URL Form */}
      {showNewAuditForm && (
        <form onSubmit={handleAuditNow} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Audit a Single URL Now</h2>
          <div className="flex gap-3">
            <input
              type="url"
              value={singleUrl}
              onChange={e => setSingleUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="text"
              value={singleName}
              onChange={e => setSingleName(e.target.value)}
              placeholder="Business name (optional)"
              className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={auditingUrl || !singleUrl.trim()}
              className="px-5 py-2 bg-accent text-primary font-semibold rounded-lg text-sm hover:bg-accent/90 disabled:opacity-50 transition"
            >
              {auditingUrl ? 'Starting…' : 'Audit Now'}
            </button>
          </div>
        </form>
      )}

      {/* Discovery Form */}
      <AuditDiscoveryForm onDiscovered={handleDiscovered} />

      {/* Queue Stats */}
      <AuditQueueStats
        refreshKey={queueRefreshKey}
        onRunBatch={handleRunBatch}
        runningBatch={runningBatch}
      />

      {/* Audits Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Audits
            {audits.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({audits.length})</span>
            )}
          </h2>
          {audits.length > 0 && (
            <button
              onClick={fetchAudits}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading audits…</div>
        ) : (
          <AuditTable audits={audits} onDelete={handleDelete} />
        )}
      </div>
    </div>
  )
}
