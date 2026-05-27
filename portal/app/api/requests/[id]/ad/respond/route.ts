import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// POST — Client approves or rejects the ad
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify ownership
    const { data: req } = await admin
      .from('requests')
      .select('id, client_id, status, quoted_price, title')
      .eq('id', params.id)
      .single()

    if (!req || req.client_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (req.status !== 'awaiting_approval') {
      return NextResponse.json({ error: 'Request is not awaiting approval' }, { status: 400 })
    }

    const { action, reason } = await request.json()
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === 'approve') {
      // Mark ad as approved and move request to 'approved' — admin will manually complete
      await admin.from('ad_creatives').update({ status: 'approved', approved_at: now }).eq('request_id', params.id)
      await admin.from('requests').update({ status: 'approved' }).eq('id', params.id)
    } else {
      // Rejection — send back for revision
      await admin.from('ad_creatives').update({
        status: 'rejected',
        rejection_reason: reason ?? null,
        rejected_at: now,
      }).eq('request_id', params.id)

      // Move request back to in_progress so admin can revise
      await admin.from('requests').update({ status: 'in_progress' }).eq('id', params.id)
    }

    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error('Ad respond error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
