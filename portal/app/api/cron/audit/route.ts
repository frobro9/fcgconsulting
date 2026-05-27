import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { runAudit } from '@/lib/audits/runner'

const DAILY_BATCH_SIZE = 100

// POST /api/cron/audit
// Called by Vercel Cron Jobs daily at 2AM.
// Vercel sends the CRON_SECRET in Authorization header for security.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Verify this is called by Vercel cron (or internally)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: targets, error } = await admin
    .from('audit_targets')
    .select('id, url, business_name')
    .eq('status', 'pending')
    .order('discovered_at', { ascending: true })
    .limit(DAILY_BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: 'No pending targets', processed: 0 })
  }

  let processed = 0
  let failed = 0

  for (const target of targets) {
    await admin.from('audit_targets').update({ status: 'auditing' }).eq('id', target.id)

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

  console.log(`[Cron Audit] processed=${processed} failed=${failed} total=${targets.length}`)
  return NextResponse.json({ processed, failed, total: targets.length })
}
