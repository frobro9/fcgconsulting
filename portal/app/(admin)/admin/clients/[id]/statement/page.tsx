import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import PrintButton from '@/components/PrintButton'

interface PageProps {
  params: { id: string }
}

const TYPE_LABELS: Record<string, string> = {
  website_content: 'Website Content',
  blog: 'Blog Post',
  social_media: 'Social Media',
}

export default async function ClientStatementPage({ params }: PageProps) {
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

  const [{ data: client }, { data: requests }, { data: transactions }] = await Promise.all([
    adminSupabase
      .from('clients')
      .select('id, name, email, company, created_at')
      .eq('id', params.id)
      .single(),
    adminSupabase
      .from('requests')
      .select('id, title, type, mode, status, quoted_price, completed_at')
      .eq('client_id', params.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true }),
    adminSupabase
      .from('retainer_transactions')
      .select('id, amount, type, description, created_at')
      .eq('client_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  if (!client) notFound()

  const totalPaid = (requests ?? []).reduce((sum, r) => sum + Number(r.quoted_price ?? 0), 0)
  const totalFunded = (transactions ?? [])
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const statementDate = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .statement-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto">
        {/* Controls */}
        <div className="no-print flex items-center justify-between mb-6">
          <a
            href={`/admin/clients/${params.id}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Client
          </a>
          <PrintButton />
        </div>

        {/* Statement card */}
        <div className="statement-card bg-white rounded-xl border border-gray-200 shadow-sm p-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-xl font-bold text-primary">Capital Consulting</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 tracking-wide">STATEMENT</p>
              <p className="text-gray-400 text-sm mt-1">As of {statementDate}</p>
            </div>
          </div>

          {/* Prepared for */}
          <div className="mb-10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Prepared For
            </p>
            <p className="text-lg font-bold text-gray-800">{client.company}</p>
            <p className="text-gray-600">{client.name}</p>
            <p className="text-gray-400 text-sm">{client.email}</p>
            <p className="text-gray-400 text-xs mt-1">
              Client since{' '}
              {new Date(client.created_at).toLocaleDateString('en-CA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Completed services */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Completed Services
            </p>
            {!requests || requests.length === 0 ? (
              <p className="text-gray-400 text-sm">No completed services yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Service</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">
                      Payment Date
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-700 font-medium">{req.title}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {TYPE_LABELS[req.type] ?? req.type}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {req.completed_at
                          ? new Date(req.completed_at).toLocaleDateString('en-CA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {req.quoted_price != null
                          ? `$${Number(req.quoted_price).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-10">
            <div className="w-56 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Total Funded</span>
                <span>${totalFunded.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 text-base border-t border-gray-200 pt-2">
                <span>Total Paid</span>
                <span>${totalPaid.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transaction log */}
          {transactions && transactions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Transaction History
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">
                      Description
                    </th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {new Date(tx.created_at).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{tx.description}</td>
                      <td
                        className={`px-4 py-2 text-right font-semibold text-xs ${
                          tx.type === 'credit' ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {tx.type === 'credit' ? '+' : '-'}$
                        {Math.abs(Number(tx.amount)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400 space-y-1">
            <p>This statement was generated by Capital Consulting.</p>
            <p>For questions, please contact your account manager.</p>
          </div>
        </div>
      </div>
    </>
  )
}
