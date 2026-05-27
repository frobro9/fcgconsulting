import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { discoverBusinessWebsites } from '@/lib/audits/discovery'

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

// POST /api/admin/audits/discover
// Body: { businessType: string, location: string, limit?: number }
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { businessType, location, limit = 10 } = body

  if (!businessType || !location) {
    return NextResponse.json({ error: 'businessType and location are required' }, { status: 400 })
  }

  try {
    const businesses = await discoverBusinessWebsites(businessType, location, Math.min(limit, 100))

    if (businesses.length === 0) {
      return NextResponse.json({ discovered: 0, message: 'No businesses found for this query' })
    }

    const admin = createAdminClient()

    // Upsert into audit_targets (skip duplicates by URL)
    const targets = businesses.map(b => ({
      url: b.url,
      business_name: b.business_name,
      business_type: businessType,
      location,
      status: 'pending',
    }))

    // Insert only new URLs (ignore conflicts on url)
    let inserted = 0
    for (const target of targets) {
      const { error } = await admin
        .from('audit_targets')
        .insert(target)

      if (!error) inserted++
      // If error (likely duplicate URL), skip silently
    }

    return NextResponse.json({
      discovered: businesses.length,
      queued: inserted,
      message: `Found ${businesses.length} businesses, added ${inserted} new targets to audit queue`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Discovery failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
