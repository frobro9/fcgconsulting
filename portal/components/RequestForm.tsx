'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type RequestType = 'website_content' | 'blog' | 'social_media'
type RequestMode = 'self_serve' | 'firm_creates'

const ACCEPTED_FILE_TYPES = 'image/*,.pdf,.doc,.docx,.txt,.csv,.mp4,.mov,.avi'

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'X/Twitter']

const TYPE_OPTIONS: { value: RequestType; label: string; description: string }[] = [
  {
    value: 'website_content',
    label: 'Website Content',
    description: 'Pages, landing pages, copy updates',
  },
  {
    value: 'blog',
    label: 'Blog Post',
    description: 'Articles, thought leadership, SEO content',
  },
  {
    value: 'social_media',
    label: 'Social Media',
    description: 'Posts, captions, platform-specific content',
  },
]

const MODE_OPTIONS: { value: RequestMode; label: string; description: string }[] = [
  {
    value: 'self_serve',
    label: 'Self Serve',
    description: "I'll provide the content — just need review/formatting",
  },
  {
    value: 'firm_creates',
    label: 'Firm Creates',
    description: 'Capital Consulting will write the content for me',
  },
]

export default function RequestForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [type, setType] = useState<RequestType | null>(null)
  const [mode, setMode] = useState<RequestMode | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [scheduledDate, setScheduledDate] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...selected.filter((f) => !existing.has(f.name + f.size))]
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadFiles(requestId: string) {
    if (files.length === 0) return
    const supabase = createClient()
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${requestId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('request-attachments')
        .upload(path, file)
      if (uploadError) continue
      const { data: urlData } = supabase.storage
        .from('request-attachments')
        .getPublicUrl(path)
      await supabase.from('request_attachments').insert({
        request_id: requestId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        uploaded_by: 'client',
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !mode) return

    setLoading(true)
    setError(null)

    const body: Record<string, unknown> = {
      type,
      mode,
      title,
      description,
      preferred_deadline: deadline || undefined,
    }

    if (type === 'social_media') {
      body.platforms = platforms
      body.scheduled_date = scheduledDate || undefined
    }

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to submit request.')
      setLoading(false)
      return
    }

    if (files.length > 0) {
      await uploadFiles(data.request.id)
    }

    router.push('/requests')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, ...(type === 'social_media' ? [4] : [])].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s}
            </div>
            {s < (type === 'social_media' ? 4 : 3) && (
              <div
                className={`h-0.5 w-8 ${step > s ? 'bg-primary' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Choose content type</h2>
          <div className="grid gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setType(opt.value)
                  setStep(2)
                }}
                className={`text-left p-4 border-2 rounded-xl transition ${
                  type === opt.value
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-gray-800">{opt.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mode */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Choose delivery mode</h2>
          <div className="grid gap-3">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value)
                  setStep(3)
                }}
                className={`text-left p-4 border-2 rounded-xl transition ${
                  mode === opt.value
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-gray-800">{opt.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <form
          onSubmit={type === 'social_media' ? (e) => { e.preventDefault(); setStep(4) } : handleSubmit}
          className="space-y-5"
        >
          <h2 className="text-lg font-semibold text-gray-800">Request details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title for your request"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what you need in detail..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Ad file upload — only shown when client chose Self Serve */}
          {mode === 'self_serve' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your ad files <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Attach your self-created ads or content — images, videos, documents, etc.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-5 text-sm text-gray-500 hover:border-primary hover:text-primary transition text-center"
              >
                Click to add files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                className="hidden"
              />
              {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {files.map((file, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="ml-3 text-gray-400 hover:text-red-500 transition text-lg leading-none flex-shrink-0"
                        aria-label="Remove file"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {type === 'social_media'
                ? 'Next: Platform Details'
                : loading
                ? 'Submitting...'
                : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {/* Step 4: Social media platforms */}
      {step === 4 && type === 'social_media' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-800">Social media platforms</h2>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Select platforms <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((p) => (
                <label
                  key={p}
                  className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                    platforms.includes(p)
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled post date (optional)
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || platforms.length === 0}
              className="flex-1 bg-primary hover:bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
