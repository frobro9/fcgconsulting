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

// GET /api/admin/audits/queue — queue stats
export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [pending, auditing, completed, failed] = await Promise.all([
    admin.from('audit_targets').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('audit_targets').select('id', { count: 'exact', head: true }).eq('status', 'auditing'),
    admin.from('audit_targets').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    admin.from('audit_targets').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ])

  return NextResponse.json({
    pending: pending.count ?? 0,
    auditing: auditing.count ?? 0,
    completed: completed.count ?? 0,
    failed: failed.count ?? 0,
  })
}
