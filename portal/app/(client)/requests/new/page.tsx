import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RequestForm from '@/components/RequestForm'

export default async function NewRequestPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Request</h1>
        <p className="text-gray-500 text-sm mt-1">Submit a new request to Capital Consulting</p>
      </div>
      <RequestForm />
    </div>
  )
}
