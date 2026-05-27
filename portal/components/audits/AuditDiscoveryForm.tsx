'use client'

import { useState } from 'react'
import { BUSINESS_TYPES } from '@/lib/audits/types'

interface Props {
  onDiscovered: (count: number) => void
}

export default function AuditDiscoveryForm({ onDiscovered }: Props) {
  const [location, setLocation] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault()
    if (!location.trim() || !businessType) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/audits/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType, location: location.trim(), limit }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Discovery failed' })
        return
      }

      setMessage({ type: 'success', text: data.message })
      onDiscovered(data.queued ?? 0)
    } catch {
      setMessage({ type: 'error', text: 'Network error — please try again' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleDiscover} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Discover Businesses to Audit</h2>
        <p className="text-sm text-gray-500 mt-1">
          Search for local businesses by type and location. Found websites are added to the audit queue.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
          <select
            value={businessType}
            onChange={e => setBusinessType(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select type…</option>
            {BUSINESS_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Miami, FL"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {message && (
        <div className={`text-sm px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !location.trim() || !businessType}
          className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Searching…' : 'Discover & Queue'}
        </button>
        <p className="text-xs text-gray-400">Uses Google Custom Search API</p>
      </div>
    </form>
  )
}
