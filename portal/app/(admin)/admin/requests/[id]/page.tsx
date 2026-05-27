import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import AdminRequestActions from '@/components/AdminRequestActions'
import AdminAdCreator from '@/components/AdminAdCreator'
import Badge from '@/components/ui/Badge'

interface PageProps {
  params: { id: string }
}

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify admin role
  const { data: caller } = await adminSupabase
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!caller || caller.role !== 'admin') redirect('/dashboard')

  const { data: request } = await adminSupabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      type,
      mode,
      status,
      quoted_price,
      preferred_deadline,
      created_at,
      completed_at,
      clients (
        id,
        name,
        email,
        company
      )
    `)
    .eq('id', params.id)
    .single()

  if (!request) {
    notFound()
  }

  const { data: socialDetails } = await adminSupabase
    .from('social_media_details')
    .select('platforms, scheduled_date')
    .eq('request_id', params.id)
    .single()

  const { data: attachments } = await adminSupabase
    .from('request_attachments')
    .select('id, file_name, file_url, uploaded_by, uploaded_at')
    .eq('request_id', params.id)
    .order('uploaded_at', { ascending: false })

  const client = (request.clients as unknown) as {
    id: string
    name: string
    email: string
    company: string
  } | null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
          &larr; Back to Queue
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{request.title}</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {request.type.replace(/_/g, ' ')} &bull; {request.mode.replace(/_/g, ' ')}
                </p>
              </div>
              <Badge status={request.status} />
            </div>

            <div className="prose text-gray-700 text-sm">
              <p>{request.description}</p>
            </div>

            {request.preferred_deadline && (
              <div className="mt-4 text-sm text-gray-600">
                <span className="font-medium">Preferred deadline:</span>{' '}
                {new Date(request.preferred_deadline).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            )}

            {socialDetails && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Platforms:</p>
                <div className="flex flex-wrap gap-2">
                  {socialDetails.platforms.map((p: string) => (
                    <span
                      key={p}
                      className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                {socialDetails.scheduled_date && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Scheduled:</span>{' '}
                    {new Date(socialDetails.scheduled_date).toLocaleDateString('en-CA')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admin Actions */}
          <AdminRequestActions
            requestId={request.id}
            currentStatus={request.status}
            currentQuotedPrice={request.quoted_price}
          />

          {/* Ad Creative (firm_creates mode only) */}
          <AdminAdCreator requestId={request.id} mode={request.mode} />

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Attachments</h2>
            {attachments && attachments.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {attachments.map((att) => (
                  <li key={att.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{att.file_name}</p>
                      <p className="text-xs text-gray-400">
                        Uploaded by {att.uploaded_by} &bull;{' '}
                        {new Date(att.uploaded_at).toLocaleDateString('en-CA')}
                      </p>
                    </div>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No attachments yet.</p>
            )}
          </div>
        </div>

        {/* Client Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Client Info</h2>
            {client ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Name</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{client.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Company</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{client.company}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Email</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{client.email}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-gray-500 text-sm">No client info available.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Request Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Submitted</dt>
                <dd className="font-medium text-gray-800 mt-0.5">
                  {new Date(request.created_at).toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              {request.quoted_price && (
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Quoted Price</dt>
                  <dd className="font-semibold text-gray-800 mt-0.5">
                    ${Number(request.quoted_price).toFixed(2)}
                  </dd>
                </div>
              )}
              {request.completed_at && (
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Completed</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">
                    {new Date(request.completed_at).toLocaleDateString('en-CA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
