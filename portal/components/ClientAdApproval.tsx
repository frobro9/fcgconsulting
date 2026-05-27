'use client'

import { useState, useEffect } from 'react'

interface AdCreative {
  id: string
  headline: string
  body_copy: string | null
  cta: string | null
  platform: string
  image_url: string
  status: string
  rejection_reason: string | null
  sent_at: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  google: 'Google Display',
  twitter: 'Twitter / X',
}

interface Props {
  requestId: string
  requestStatus: string
}

export default function ClientAdApproval({ requestId, requestStatus }: Props) {
  const [creative, setCreative] = useState<AdCreative | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Show ad when awaiting approval or already approved/rejected
    if (!['awaiting_approval', 'approved', 'rejected'].includes(requestStatus)) {
      setLoading(false)
      return
    }
    fetch(`/api/requests/${requestId}/ad`)
      .then(r => r.json())
      .then(data => {
        setCreative(data.creative ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [requestId, requestStatus])

  const handleRespond = async () => {
    if (!action) return
    if (action === 'reject' && !reason.trim()) {
      setError('Please tell us what changes you need.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/requests/${requestId}/ad/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!['awaiting_approval', 'approved', 'rejected'].includes(requestStatus)) return null
  if (!creative) return null

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col items-center gap-3 py-4">
          {action === 'approve' ? (
            <>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">Ad Approved!</h3>
              <p className="text-sm text-gray-500 text-center">
                Your ad has been approved. Capital Consulting will proceed with publishing.
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">Changes Requested</h3>
              <p className="text-sm text-gray-500 text-center">
                Your feedback has been sent. We'll revise the ad and send it back for your review.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const isApproved = creative?.status === 'approved'

  return (
    <div className={`bg-white rounded-xl border p-6 space-y-6 ${isApproved ? 'border-green-200' : 'border-amber-200'}`}>
      <div className="flex items-center gap-2">
        {isApproved ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="text-base font-semibold text-gray-800">Your Approved Ad</h2>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-base font-semibold text-gray-800">Your Ad is Ready for Review</h2>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Action Required
            </span>
          </>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Capital Consulting has created an ad for your approval. Please review and let us know if you'd like to proceed or request changes.
      </p>

      {/* Ad image */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <img src={creative.image_url} alt={creative.headline} className="w-full object-cover" />
      </div>

      {/* Ad details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Platform</span>
          <span className="capitalize text-gray-600">{PLATFORM_LABELS[creative.platform] ?? creative.platform}</span>
        </div>
        <div className="border-t border-gray-200 pt-2">
          <p className="font-medium text-gray-700 mb-0.5">Headline</p>
          <p className="text-gray-800">{creative.headline}</p>
        </div>
        {creative.body_copy && (
          <div className="border-t border-gray-200 pt-2">
            <p className="font-medium text-gray-700 mb-0.5">Body</p>
            <p className="text-gray-600">{creative.body_copy}</p>
          </div>
        )}
        {creative.cta && (
          <div className="border-t border-gray-200 pt-2">
            <p className="font-medium text-gray-700 mb-0.5">Call to Action</p>
            <p className="text-gray-600">{creative.cta}</p>
          </div>
        )}
      </div>

      {/* Response buttons (hide if already approved) */}
      {!action && !isApproved && (
        <div className="flex gap-3">
          <button
            onClick={() => setAction('approve')}
            className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approve Ad
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Request Changes
          </button>
        </div>
      )}

      {/* Approved confirmation message */}
      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          You approved this ad. Capital Consulting will proceed with the next steps.
        </div>
      )}

      {/* Confirm approve */}
      {action === 'approve' && !isApproved && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            By approving, you confirm this ad is ready to publish. Capital Consulting will proceed with the next steps.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setAction(null)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Go Back
            </button>
            <button
              onClick={handleRespond}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {submitting ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      )}

      {/* Request changes */}
      {action === 'reject' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What changes do you need? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Please change the headline to..., use a different colour scheme..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setAction(null)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Go Back
            </button>
            <button
              onClick={handleRespond}
              disabled={submitting || !reason.trim()}
              className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}
