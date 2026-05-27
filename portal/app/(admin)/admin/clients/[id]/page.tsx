import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'

interface PageProps {
  params: { id: string }
}

const TYPE_LABELS: Record<string, string> = {
  website_content: 'Website Content',
  blog: 'Blog Post',
  social_media: 'Social Media',
}

export default async function AdminClientDetailPage({ params }: PageProps) {
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

  // Fetch client, requests, retainer, and transactions in parallel
  const [
    { data: client },
    { data: requests },
    { data: retainer },
    { data: transactions },
  ] = await Promise.all([
    adminSupabase
      .from('clients')
      .select('id, name, email, company, created_at')
      .eq('id', params.id)
      .single(),
    adminSupabase
      .from('requests')
      .select('id, title, type, mode, status, quoted_price, created_at, completed_at')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('retainer_accounts')
      .select('balance')
      .eq('client_id', params.id)
      .single(),
    adminSupabase
      .from('retainer_transactions')
      .select('id, amount, type, description, created_at')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  const balance = Number(retainer?.balance ?? 0)
  const totalRequests = requests?.length ?? 0
  const completedRequests = requests?.filter((r) => r.status === 'completed').length ?? 0
  const totalPaid = (transactions ?? [])
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalCredits = (transactions ?? [])
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link href="/admin/clients" className="text-sm text-gray-400 hover:text-gray-600">
          &larr; Back to Clients
        </Link>
        <Link
          href={`/admin/clients/${params.id}/statement`}
          className="bg-primary hover:bg-blue-900 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          Download Statement
        </Link>
      </div>

      {/* Client header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {client.company.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">{client.company}</h1>
            <p className="text-gray-600 mt-0.5">{client.name}</p>
            <p className="text-gray-400 text-sm">{client.email}</p>
            <p className="text-gray-400 text-xs mt-1">
              Member since{' '}
              {new Date(client.created_at).toLocaleDateString('en-CA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Retainer Balance',
            value: `$${balance.toFixed(2)}`,
            color: balance <= 0 ? 'text-red-500' : 'text-green-600',
          },
          { label: 'Total Requests', value: totalRequests, color: 'text-primary' },
          { label: 'Completed', value: completedRequests, color: 'text-primary' },
          { label: 'Total Paid', value: `$${totalPaid.toFixed(2)}`, color: 'text-primary' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Requests</h2>
          {!requests || requests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              No requests yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                        {req.title}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {TYPE_LABELS[req.type] ?? req.type}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(req.created_at).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {req.quoted_price != null ? `$${Number(req.quoted_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={req.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/requests/${req.id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Retainer summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Retainer Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Current Balance</dt>
                <dd className={`font-semibold ${balance <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ${balance.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Funded</dt>
                <dd className="font-medium text-gray-800">${totalCredits.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Spent</dt>
                <dd className="font-medium text-gray-800">${totalPaid.toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Transactions</h2>
            {!transactions || transactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <li key={tx.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-600 truncate">{tx.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold flex-shrink-0 ${
                        tx.type === 'credit' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}${Math.abs(Number(tx.amount)).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
