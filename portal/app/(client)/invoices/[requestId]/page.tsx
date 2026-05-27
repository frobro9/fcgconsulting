import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import PrintButton from '@/components/PrintButton'

interface PageProps {
  params: { requestId: string }
}

const SERVICE_LABELS: Record<string, string> = {
  website_content: 'Website Content',
  blog: 'Blog Post',
  social_media: 'Social Media',
}

export default async function InvoicePage({ params }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch the request — RLS ensures client can only see their own
  const { data: request } = await supabase
    .from('requests')
    .select('id, title, type, mode, status, quoted_price, completed_at, created_at')
    .eq('id', params.requestId)
    .eq('client_id', user.id)
    .eq('status', 'completed')
    .single()

  if (!request) notFound()

  // Fetch client / business info
  const { data: client } = await supabase
    .from('clients')
    .select('name, email, company')
    .eq('id', user.id)
    .single()

  // Fetch the debit transaction linked to this request
  const { data: transaction } = await supabase
    .from('retainer_transactions')
    .select('amount, created_at')
    .eq('related_request_id', request.id)
    .eq('type', 'debit')
    .maybeSingle()

  const invoiceNumber = `INV-${request.id.slice(0, 8).toUpperCase()}`
  const paymentDate = transaction?.created_at ?? request.completed_at
  const amount = Number(request.quoted_price ?? transaction?.amount ?? 0)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto">
        {/* Controls — hidden when printing */}
        <div className="no-print flex items-center justify-between mb-6">
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Requests
          </a>
          <PrintButton />
        </div>

        {/* Invoice card */}
        <div className="invoice-card bg-white rounded-xl border border-gray-200 shadow-sm p-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-xl font-bold text-primary">Capital Consulting</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 tracking-wide">INVOICE</p>
              <p className="text-gray-400 text-sm mt-1">{invoiceNumber}</p>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Bill To
            </p>
            <p className="text-lg font-bold text-gray-800">{client?.company}</p>
            <p className="text-gray-600">{client?.name}</p>
            <p className="text-gray-400 text-sm">{client?.email}</p>
          </div>

          {/* Invoice meta */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Payment Date
              </p>
              <p className="text-gray-800 font-medium">
                {paymentDate
                  ? new Date(paymentDate).toLocaleDateString('en-CA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Service Type
              </p>
              <p className="text-gray-800 font-medium">
                {SERVICE_LABELS[request.type] ?? request.type}
              </p>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-5 text-gray-700">
                  <p className="font-medium text-gray-800">{request.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {SERVICE_LABELS[request.type]} &bull; {request.mode.replace(/_/g, ' ')}
                  </p>
                </td>
                <td className="px-4 py-5 text-right font-semibold text-gray-800">
                  ${amount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-end border-t border-gray-200 pt-4">
            <div className="w-52 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 text-base border-t border-gray-200 pt-2">
                <span>Total Paid</span>
                <span>${amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400 space-y-1">
            <p>Thank you for your business.</p>
            <p>Paid via retainer account &bull; Capital Consulting</p>
          </div>
        </div>
      </div>
    </>
  )
}
