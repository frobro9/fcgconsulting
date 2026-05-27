'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Badge from '@/components/ui/Badge'

interface Request {
  id: string
  title: string
  type: string
  status: string
  created_at: string
  quoted_price?: number | null
  completed_at?: string | null
}

interface RequestListProps {
  requests: Request[]
}

const typeLabel: Record<string, string> = {
  website_content: 'Website Content',
  blog: 'Blog',
  social_media: 'Social Media',
}

export default function RequestList({ requests }: RequestListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return

    setDeletingId(id)
    setError(null)

    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to delete request.')
    } else {
      router.refresh()
    }

    setDeletingId(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-600 text-sm">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-6 py-3 font-medium text-gray-600">Title</th>
            <th className="text-left px-6 py-3 font-medium text-gray-600">Type</th>
            <th className="text-left px-6 py-3 font-medium text-gray-600">Date</th>
            <th className="text-left px-6 py-3 font-medium text-gray-600">Status</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4 font-medium text-gray-800">
                <Link href={`/requests/${req.id}`} className="hover:text-primary hover:underline">
                  {req.title}
                </Link>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {typeLabel[req.type] ?? req.type}
              </td>
              <td className="px-6 py-4 text-gray-500">
                {new Date(req.created_at).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="px-6 py-4">
                <Badge status={req.status} />
              </td>
              <td className="px-6 py-4 text-right space-x-3">
                {req.status === 'awaiting_approval' && (
                  <Link
                    href={`/requests/${req.id}`}
                    className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-amber-600 transition"
                  >
                    Review Ad →
                  </Link>
                )}
                {req.status === 'completed' && (
                  <Link
                    href={`/invoices/${req.id}`}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Invoice
                  </Link>
                )}
                {req.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(req.id)}
                    disabled={deletingId === req.id}
                    className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {deletingId === req.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
