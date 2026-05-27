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

// POST /api/admin/audits/run
// Picks up to 100 pending targets from the queue and audits them sequentially.
// Intended for the daily cron job or manual "Run Batch" triggers.
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const batchSize = Math.min(body?.batchSize ?? 100, 100)

  const admin = createAdminClient()

  // Pick pending targets
  const { data: targets, error } = await admin
    .from('audit_targets')
    .select('id, url, business_name')
    .eq('status', 'pending')
    .order('discovered_at', { ascending: true })
    .limit(batchSize)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: 'No pending targets in queue', processed: 0 })
  }

  let processed = 0
  let failed = 0

  for (const target of targets) {
    // Mark as auditing
    await admin
      .from('audit_targets')
      .update({ status: 'auditing' })
      .eq('id', target.id)

    // Create audit record
    const { data: audit } = await admin
      .from('web_audits')
      .insert({
        target_id: target.id,
        url: target.url,
        business_name: target.business_name,
        status: 'pending',
      })
      .select('id')
      .single()

    if (!audit) {
      await admin.from('audit_targets').update({ status: 'failed' }).eq('id', target.id)
      failed++
      continue
    }

    // Link audit back to target
    await admin.from('audit_targets').update({ audit_id: audit.id }).eq('id', target.id)

    try {
      await runAudit(audit.id, target.url)
      await admin
        .from('audit_targets')
        .update({ status: 'completed', audited_at: new Date().toISOString() })
        .eq('id', target.id)
      processed++
    } catch {
      await admin.from('audit_targets').update({ status: 'failed' }).eq('id', target.id)
      await admin.from('web_audits').update({ status: 'failed' }).eq('id', audit.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: targets.length })
}
