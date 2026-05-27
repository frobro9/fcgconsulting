import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import AdminQueueActions from '@/components/AdminQueueActions'

const STATUS_ORDER = [
  'pending',
  'quoted',
  'in_progress',
  'awaiting_approval',
  'approved',
  'completed',
  'rejected',
]

export default async function AdminPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify admin role
  const { data: caller } = await adminSupabase
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!caller || caller.role !== 'admin') redirect('/dashboard')

  // Fetch ALL requests (bypasses RLS via service role)
  const { data: requests } = await adminSupabase
    .from('requests')
    .select(`
      id,
      title,
      type,
      mode,
      status,
      created_at,
      preferred_deadline,
      clients (
        name,
        company
      ),
      social_media_details (
        scheduled_date
      )
    `)
    .order('created_at', { ascending: false })

  // Group by status
  const grouped: Record<string, typeof requests> = {}
  for (const status of STATUS_ORDER) {
    const group = (requests ?? []).filter((r) => r.status === status)
    if (group.length > 0) {
      grouped[status] = group
    }
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pending',
    quoted: 'Quoted',
    in_progress: 'In Progress',
    awaiting_approval: 'Awaiting Approval',
    approved: 'Approved',
    completed: 'Completed',
    rejected: 'Rejected',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Admin Queue</h1>
        <p className="text-gray-500 text-sm mt-1">All client requests, grouped by status</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No requests found.
        </div>
      )}

      {STATUS_ORDER.filter((s) => grouped[s]).map((status) => (
        <div key={status}>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            {statusLabel[status]}
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {grouped[status]!.length}
            </span>
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Client</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Mode</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Submitted</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Posting Date</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grouped[status]!.map((req) => {
                  const clientData = req.clients as unknown as { name: string; company: string } | null
                  const socialData = req.social_media_details as unknown as { scheduled_date: string | null } | null
                  const postingDate = socialData?.scheduled_date ?? req.preferred_deadline ?? null
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-800">{req.title}</td>
                      <td className="px-6 py-4 text-gray-600">
                        <div>{clientData?.name}</div>
                        <div className="text-xs text-gray-400">{clientData?.company}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {req.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {req.mode.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(req.created_at).toLocaleDateString('en-CA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {postingDate
                          ? new Date(postingDate).toLocaleDateString('en-CA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={req.status} />
                      </td>
                      <td className="px-6 py-4">
                        <AdminQueueActions requestId={req.id} requestTitle={req.title} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
