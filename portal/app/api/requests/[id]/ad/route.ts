import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// GET — Client views their ad creative
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify the request belongs to this client
    const { data: req } = await admin
      .from('requests')
      .select('id, client_id')
      .eq('id', params.id)
      .single()

    if (!req || req.client_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: creative } = await admin
      .from('ad_creatives')
      .select('id, headline, body_copy, cta, platform, image_url, status, rejection_reason, sent_at')
      .eq('request_id', params.id)
      .in('status', ['sent_for_approval', 'approved', 'rejected']) // Show when awaiting approval or already responded
      .single()

    return NextResponse.json({ creative: creative ?? null })
  } catch (err) {
    console.error('Client ad GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
