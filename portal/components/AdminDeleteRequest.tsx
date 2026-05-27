'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  requestId: string
  requestTitle: string
}

export default function AdminDeleteRequest({ requestId, requestTitle }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/delete`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-red-50 rounded-xl border border-red-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-red-900">Danger Zone</h2>
        <p className="text-sm text-red-700 mt-1">
          Permanently delete this request and all associated data (ad creatives, attachments, etc.)
        </p>
      </div>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
        >
          Delete Request
        </button>
      ) : (
        <div className="space-y-3 bg-white p-4 rounded-lg border border-red-300">
          <p className="text-sm font-medium text-gray-800">
            Are you sure you want to delete <strong>{requestTitle}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      )}
    </div>
  )
}
