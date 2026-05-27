'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const PLATFORMS = [
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'google',    label: 'Google Display' },
  { value: 'twitter',   label: 'Twitter / X' },
]

interface AdCreative {
  id: string
  headline: string
  body_copy: string | null
  cta: string | null
  platform: string
  audience_description: string | null
  moda_job_id: string | null
  moda_canvas_id: string | null
  moda_status: 'generating' | 'processing' | 'ready' | 'failed'
  image_url: string | null
  status: 'draft' | 'sent_for_approval' | 'approved' | 'rejected' | 'revision_requested'
  rejection_reason: string | null
  sent_at: string | null
}

interface Props {
  requestId: string
  mode: string
}

export default function AdminAdCreator({ requestId, mode }: Props) {
  const [creative, setCreative] = useState<AdCreative | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [headline, setHeadline] = useState('')
  const [bodyCopy, setBodyCopy] = useState('')
  const [cta, setCta] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [audience, setAudience] = useState('')

  const fetchCreative = useCallback(async () => {
    const res = await fetch(`/api/admin/requests/${requestId}/ad`, { cache: 'no-store' })
    const data = await res.json()
    if (data.creative) {
      setCreative(data.creative)
      setHeadline(data.creative.headline || '')
      setBodyCopy(data.creative.body_copy || '')
      setCta(data.creative.cta || '')
      setPlatform(data.creative.platform || 'instagram')
      setAudience(data.creative.audience_description || '')
      // Track if the image_url is a real uploaded image (not a Moda canvas URL)
      if (data.creative.image_url && !data.creative.image_url.includes('moda.app/canvas')) {
        setUploadedImageUrl(data.creative.image_url)
      }
    }
    setLoading(false)
    return data.creative
  }, [requestId])

  useEffect(() => {
    fetchCreative()
  }, [fetchCreative])

  // Poll while Moda is generating
  useEffect(() => {
    if (!creative || creative.moda_status !== 'generating' || !creative.moda_job_id) return
    const interval = setInterval(async () => {
      const updated = await fetchCreative()
      if (updated?.moda_status !== 'generating') clearInterval(interval)
    }, 4000)
    return () => clearInterval(interval)
  }, [creative?.moda_status, creative?.moda_job_id, fetchCreative])

  // Poll while waiting for client to approve or reject
  useEffect(() => {
    if (!creative || creative.status !== 'sent_for_approval') return
    const interval = setInterval(async () => {
      const updated = await fetchCreative()
      if (updated?.status !== 'sent_for_approval') clearInterval(interval)
    }, 5000)
    return () => clearInterval(interval)
  }, [creative?.status, fetchCreative])

  const handleGenerate = async () => {
    if (!headline || !platform) return
    setGenerating(true)
    setError('')
    setUploadedImageUrl(null)
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, body_copy: bodyCopy, cta, platform, audience_description: audience }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start generation')
      setCreative(data.creative)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch(`/api/admin/requests/${requestId}/ad/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setUploadedImageUrl(data.image_url)
      await fetchCreative()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/ad/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to publish')
      await fetchCreative()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPublishing(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset the ad creative? This cannot be undone.')) return
    await fetch(`/api/admin/requests/${requestId}/ad`, { method: 'DELETE' })
    setCreative(null)
    setUploadedImageUrl(null)
    setHeadline('')
    setBodyCopy('')
    setCta('')
    setPlatform('instagram')
    setAudience('')
  }

  if (mode !== 'firm_creates') return null
  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-gray-400 text-sm">Loading ad workspace...</p>
    </div>
  )

  const isGenerating = creative?.moda_status === 'generating' && !!creative?.moda_job_id
  const modaReady = creative?.moda_status === 'ready'
  // canvasUrl is the Moda link for admin to open and edit
  const canvasUrl = modaReady && creative?.image_url?.includes('moda.app/canvas')
    ? creative.image_url
    : creative?.moda_canvas_id ? `https://moda.app/canvas/${creative.moda_canvas_id}` : null
  const hasUploadedImage = !!uploadedImageUrl
  const isSent = creative?.status === 'sent_for_approval'
  const isApproved = creative?.status === 'approved'
  const isRejected = creative?.status === 'rejected'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Ad Creative</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Powered by Moda</span>
          {creative && !isSent && !isApproved && (
            <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-600 transition">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Rejection feedback from client */}
      {isRejected && creative?.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Client requested changes:</p>
          <p className="text-sm text-red-600">{creative.rejection_reason}</p>
        </div>
      )}

      {/* Approved badge */}
      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-700">Client approved this ad</p>
        </div>
      )}

      {/* Ad Brief Form — hidden once sent/approved */}
      {!isSent && !isApproved && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Headline <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="e.g. Transform Your Business in 30 Days"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Body Copy</label>
              <textarea
                value={bodyCopy}
                onChange={e => setBodyCopy(e.target.value)}
                rows={2}
                placeholder="e.g. Expert marketing strategies tailored for your industry..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action</label>
              <input
                type="text"
                value={cta}
                onChange={e => setCta(e.target.value)}
                placeholder="e.g. Book a Free Call"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="e.g. Small business owners in Ottawa, 35-55"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || isGenerating || !headline}
            className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generating with Moda...
              </>
            ) : creative?.moda_status === 'ready' ? (
              'Regenerate Ad'
            ) : (
              'Generate Ad with Moda'
            )}
          </button>
        </div>
      )}

      {/* Generating spinner */}
      {isGenerating && (
        <div className="border border-dashed border-gray-300 rounded-xl h-48 flex flex-col items-center justify-center gap-3 bg-gray-50">
          <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm text-gray-500">Moda is generating your ad...</p>
          <p className="text-xs text-gray-400">This usually takes 1–5 minutes</p>
        </div>
      )}

      {/* Failed state */}
      {creative?.moda_status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          Ad generation failed. Please try again.
        </div>
      )}

      {/* Moda ready — admin opens, edits, downloads, then uploads final image */}
      {modaReady && !isSent && !isApproved && (
        <div className="space-y-4">
          {/* Step 1: Open in Moda */}
          {canvasUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-800">Step 1 — Review & Edit in Moda</p>
              <p className="text-xs text-blue-600">Open the generated ad, make any edits, then download it as an image.</p>
              <a
                href={canvasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 underline"
              >
                Open Ad in Moda →
              </a>
            </div>
          )}

          {/* Step 2: Upload final image */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Step 2 — Upload Final Image</p>
            <p className="text-xs text-gray-500">After downloading from Moda, upload the image here to send to the client.</p>

            {hasUploadedImage ? (
              <div className="space-y-3">
                <img
                  src={uploadedImageUrl!}
                  alt={creative?.headline}
                  className="w-full rounded-lg border border-gray-200 object-cover"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Replace image
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-300 hover:border-primary rounded-lg py-6 flex flex-col items-center gap-2 transition disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <span className="text-sm text-gray-500">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm text-gray-500">Click to upload image</span>
                    <span className="text-xs text-gray-400">PNG, JPG, WebP</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      )}

      {/* Sent state — show uploaded image + info */}
      {(isSent || isApproved) && (
        <div className="space-y-4">
          {uploadedImageUrl && (
            <img
              src={uploadedImageUrl}
              alt={creative?.headline}
              className="w-full rounded-xl border border-gray-200 object-cover"
            />
          )}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <p><span className="font-medium text-gray-700">Headline:</span> {creative?.headline}</p>
            {creative?.body_copy && <p><span className="font-medium text-gray-700">Body:</span> {creative.body_copy}</p>}
            {creative?.cta && <p><span className="font-medium text-gray-700">CTA:</span> {creative.cta}</p>}
            <p><span className="font-medium text-gray-700">Platform:</span> <span className="capitalize">{creative?.platform}</span></p>
          </div>
          {isSent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sent to client for approval on {creative?.sent_at ? new Date(creative.sent_at).toLocaleDateString('en-CA') : '—'}
            </div>
          )}
        </div>
      )}

      {/* Send to client — only when image is uploaded */}
      {modaReady && hasUploadedImage && !isSent && !isApproved && (
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          {publishing ? 'Sending...' : 'Send to Client for Approval'}
        </button>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}
