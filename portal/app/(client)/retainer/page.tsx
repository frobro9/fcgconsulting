import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RetainerBalance from '@/components/RetainerBalance'
import TopUpButton from '@/components/RetainerTopUpButton'

export default async function RetainerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: retainerAccount } = await supabase
    .from('retainer_accounts')
    .select('balance')
    .eq('client_id', user.id)
    .single()

  const { data: transactions } = await supabase
    .from('retainer_transactions')
    .select('id, amount, type, description, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  const balance = retainerAccount?.balance ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Retainer Account</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your retainer balance and view transaction history</p>
      </div>

      <RetainerBalance balance={balance} />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Add Funds</h2>
        </div>
        <p className="text-gray-500 text-sm mb-4">
          Top up your retainer account with $500 increments.
        </p>
        <TopUpButton />
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h2>
        {transactions && transactions.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{tx.description}</td>
                    <td
                      className={`px-6 py-4 text-right font-semibold ${
                        tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}$
                      {Math.abs(tx.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No transactions yet.
          </div>
        )}
      </div>
    </div>
  )
}
