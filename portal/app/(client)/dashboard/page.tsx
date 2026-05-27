import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('name, company, role')
    .eq('id', user.id)
    .single()

  if (client?.role === 'admin') redirect('/admin')

  const { data: retainer } = await supabase
    .from('retainer_accounts')
    .select('balance')
    .eq('client_id', user.id)
    .single()

  const { data: requests } = await supabase
    .from('requests')
    .select('id, title, type, status, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const balance = retainer?.balance ?? 0

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    quoted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    awaiting_approval: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{client?.name ? `, ${client.name}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{client?.company}</p>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Retainer Balance</p>
          <p className={`text-3xl font-bold mt-1 ${balance < 100 ? 'text-red-600' : 'text-gray-900'}`}>
            ${Number(balance).toFixed(2)}
          </p>
          {balance < 100 && (
            <p className="text-xs text-red-500 mt-1">Low balance — top up soon</p>
          )}
          <Link href="/retainer" className="text-sm text-blue-600 hover:underline mt-3 block">
            Manage Retainer →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Total Requests</p>
          <p className="text-3xl font-bold mt-1 text-gray-900">{requests?.length ?? 0}</p>
          <Link href="/requests" className="text-sm text-blue-600 hover:underline mt-3 block">
            View All →
          </Link>
        </div>

        <div className="bg-blue-600 rounded-xl p-6 flex flex-col justify-between">
          <p className="text-sm text-blue-100">Ready to submit?</p>
          <Link
            href="/requests/new"
            className="mt-4 bg-white text-blue-600 rounded-lg px-4 py-2 text-sm font-medium text-center hover:bg-blue-50 transition"
          >
            + New Request
          </Link>
        </div>
      </div>

      {/* Recent Requests */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Requests</h2>
        {requests && requests.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">{req.title}</td>
                    <td className="px-6 py-4 text-gray-500 capitalize">{req.type.replace('_', ' ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[req.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(req.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No requests yet.{' '}
            <Link href="/requests/new" className="text-blue-600 hover:underline">
              Submit your first one →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
