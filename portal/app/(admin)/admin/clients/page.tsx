import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminClientsPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caller } = await adminSupabase
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()
  if (caller?.role !== 'admin') redirect('/dashboard')

  // Fetch all client accounts
  const { data: clients } = await adminSupabase
    .from('clients')
    .select('id, name, email, company, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  // Fetch retainer balances, request summaries, and total paid in parallel
  const [{ data: retainerAccounts }, { data: requests }, { data: transactions }] =
    await Promise.all([
      adminSupabase.from('retainer_accounts').select('client_id, balance'),
      adminSupabase.from('requests').select('client_id, status'),
      adminSupabase
        .from('retainer_transactions')
        .select('client_id, amount, type')
        .eq('type', 'debit'),
    ])

  // Build lookup maps
  const balanceMap = Object.fromEntries(
    (retainerAccounts ?? []).map((a) => [a.client_id, Number(a.balance)])
  )
  const requestMap = (requests ?? []).reduce(
    (acc, r) => {
      if (!acc[r.client_id]) acc[r.client_id] = { total: 0, completed: 0 }
      acc[r.client_id].total++
      if (r.status === 'completed') acc[r.client_id].completed++
      return acc
    },
    {} as Record<string, { total: number; completed: number }>
  )
  const paidMap = (transactions ?? []).reduce(
    (acc, t) => {
      acc[t.client_id] = (acc[t.client_id] ?? 0) + Number(t.amount)
      return acc
    },
    {} as Record<string, number>
  )

  // Summary stats across all clients
  const totalClients = clients?.length ?? 0
  const totalRevenue = Object.values(paidMap).reduce((a, b) => a + b, 0)
  const totalRequests = Object.values(requestMap).reduce((a, b) => a + b.total, 0)
  const totalCompleted = Object.values(requestMap).reduce((a, b) => a + b.completed, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Clients</h1>
        <p className="text-gray-500 text-sm mt-1">All client accounts and account summaries</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: totalClients },
          { label: 'Total Requests', value: totalRequests },
          { label: 'Completed', value: totalCompleted },
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}` },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Client table */}
      {!clients || clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No clients yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Balance</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Requests</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Total Paid</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Member Since</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => {
                const balance = balanceMap[client.id] ?? 0
                const reqs = requestMap[client.id] ?? { total: 0, completed: 0 }
                const paid = paidMap[client.id] ?? 0
                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{client.company}</td>
                    <td className="px-6 py-4 text-gray-600">{client.name}</td>
                    <td className="px-6 py-4 text-gray-500">{client.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-semibold ${
                          balance <= 0 ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        ${balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {reqs.total}
                      {reqs.completed > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({reqs.completed} done)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      ${paid.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(client.created_at).toLocaleDateString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-primary font-medium hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
