import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { runAudit } from '@/lib/audits/runner'

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

// POST /api/admin/audits/[id]/run-now
// Immediately runs all audit checks for the given audit ID, streaming results to DB.
// Also accepts { url, businessName } body to CREATE a new audit on-the-fly.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  let auditId = params.id

  // If id is 'new', create a fresh audit record from body
  if (params.id === 'new') {
    const body = await request.json().catch(() => ({}))
    const { url, businessName } = body

    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

    const { data: audit, error } = await admin
      .from('web_audits')
      .insert({ url, business_name: businessName ?? null, status: 'pending' })
      .select('id')
      .single()

    if (error || !audit) return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    auditId = audit.id
  } else {
    // Verify existing audit
    const { data: audit } = await admin
      .from('web_audits')
      .select('id, url, status')
      .eq('id', params.id)
      .single()

    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

    // Reset if previously failed or completed (allow re-run)
    if (audit.status === 'failed' || audit.status === 'completed') {
      await admin.from('audit_checks').delete().eq('audit_id', auditId)
      await admin.from('web_audits').update({ status: 'pending', progress_pct: 0, overall_score: null }).eq('id', auditId)
    }
  }

  // Fetch the URL from the record
  const { data: auditRecord } = await admin
    .from('web_audits')
    .select('url')
    .eq('id', auditId)
    .single()

  if (!auditRecord) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  // Run synchronously — checks stream to DB as each one completes
  try {
    await runAudit(auditId, auditRecord.url)
  } catch (err) {
    await admin.from('web_audits').update({ status: 'failed' }).eq('id', auditId)
    return NextResponse.json({ error: 'Audit run failed' }, { status: 500 })
  }

  return NextResponse.json({ auditId, success: true })
}
