import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import ClientAdApproval from '@/components/ClientAdApproval'
import Link from 'next/link'

interface PageProps {
  params: { id: string }
}

const typeLabel: Record<string, string> = {
  website_content: 'Website Content',
  blog: 'Blog',
  social_media: 'Social Media',
  ad_creation: 'Ad Creation',
}

const modeLabel: Record<string, string> = {
  firm_creates: 'Firm Creates',
  client_creates: 'Client Creates',
  collaboration: 'Collaboration',
}

export default async function ClientRequestDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: request } = await supabase
    .from('requests')
    .select('id, title, description, type, mode, status, quoted_price, preferred_deadline, created_at, completed_at')
    .eq('id', params.id)
    .eq('client_id', user.id)
    .single()

  if (!request) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/requests" className="text-gray-400 hover:text-gray-600 text-sm">
          &larr; Back to Requests
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{request.title}</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {typeLabel[request.type] ?? request.type}
                  {request.mode && ` · ${modeLabel[request.mode] ?? request.mode}`}
                </p>
              </div>
              <Badge status={request.status} />
            </div>

            {request.description && (
              <p className="text-gray-700 text-sm">{request.description}</p>
            )}

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
          </div>

          {/* Ad Approval (only shown when awaiting_approval) */}
          <ClientAdApproval requestId={request.id} requestStatus={request.status} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Status</dt>
                <dd className="mt-0.5">
                  <Badge status={request.status} />
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

          {request.status === 'completed' && (
            <Link
              href={`/invoices/${request.id}`}
              className="block w-full text-center bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition"
            >
              View Invoice
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
