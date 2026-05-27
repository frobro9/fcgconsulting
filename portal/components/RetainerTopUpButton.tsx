'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TopUpButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleTopUp() {
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/retainer/topup', { method: 'POST' })
    const data = await res.json()

    if (res.ok) {
      setMessage({ type: 'success', text: `$500 added. New balance: $${Number(data.balance).toFixed(2)}` })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: data.error ?? 'Failed to add funds.' })
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleTopUp}
        disabled={loading}
        className="bg-primary hover:bg-blue-900 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : 'Add $500'}
      </button>
      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
