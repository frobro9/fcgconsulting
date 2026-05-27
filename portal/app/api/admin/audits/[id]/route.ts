import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: caller } = await supabase
    .from('clients')
    .select('role')
    .eq('id', user.id)
    .single()

  return caller?.role === 'admin' ? user : null
}

// GET /api/admin/audits/[id] — audit detail with checks
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [auditRes, checksRes] = await Promise.all([
    admin.from('web_audits').select('*').eq('id', params.id).single(),
    admin
      .from('audit_checks')
      .select('*')
      .eq('audit_id', params.id)
      .order('completed_at', { ascending: true }),
  ])

  if (auditRes.error || !auditRes.data) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  return NextResponse.json({
    audit: auditRes.data,
    checks: checksRes.data ?? [],
  })
}

// DELETE /api/admin/audits/[id] — delete an audit and its checks
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { error } = await admin.from('web_audits').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
