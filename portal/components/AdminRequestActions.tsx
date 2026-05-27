'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

interface AdminRequestActionsProps {
  requestId: string
  currentStatus: string
  currentQuotedPrice: number | null
}

export default function AdminRequestActions({
  requestId,
  currentStatus,
  currentQuotedPrice,
}: AdminRequestActionsProps) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [quotedPrice, setQuotedPrice] = useState(
    currentQuotedPrice != null ? String(currentQuotedPrice) : ''
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const res = await fetch(`/api/admin/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, quoted_price: quotedPrice }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Failed to save changes.' })
    } else {
      const completedMsg =
        status === 'completed' && currentStatus !== 'completed'
          ? ' $100 has been deducted from the client\'s retainer.'
          : ''
      setMessage({ type: 'success', text: `Changes saved successfully.${completedMsg}` })
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-800">Admin Actions</h2>

      {status === 'completed' && currentStatus !== 'completed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          ⚠️ Marking as <strong>Completed</strong> will deduct <strong>$100</strong> from the client&apos;s retainer.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quoted Price ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={quotedPrice}
            onChange={(e) => setQuotedPrice(e.target.value)}
            placeholder="e.g. 250.00"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition bg-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary hover:bg-blue-900 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
