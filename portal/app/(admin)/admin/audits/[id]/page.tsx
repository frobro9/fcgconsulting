import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import AuditResultDetail from '@/components/audits/AuditResultDetail'

export default async function AuditDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: caller } = await supabase
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const [auditRes, checksRes] = await Promise.all([
    admin.from('web_audits').select('*').eq('id', params.id).single(),
    admin
      .from('audit_checks')
      .select('*')
      .eq('audit_id', params.id)
      .order('completed_at', { ascending: true }),
  ])

  if (!auditRes.data) redirect('/admin/audits')

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <Link
        href="/admin/audits"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"
      >
        ← Back to Audits
      </Link>

      <AuditResultDetail
        auditId={params.id}
        initialAudit={auditRes.data as any}
        initialChecks={(checksRes.data ?? []) as any}
      />
    </div>
  )
}
