import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const COST_PER_REQUEST = 100

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: adminClient } = await supabase
      .from('clients')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminClient?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, quoted_price } = body
    const admin = createAdminClient()

    // Get the request
    const { data: req, error: reqError } = await admin
      .from('requests')
      .select('id, client_id, title, status')
      .eq('id', params.id)
      .single()

    if (reqError || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Build update payload — only include fields that exist in the table
    const updatePayload: Record<string, unknown> = { status }
    if (quoted_price !== undefined && quoted_price !== '') {
      updatePayload.quoted_price = Number(quoted_price)
    }
    if (status === 'completed' && req.status !== 'completed') {
      updatePayload.completed_at = new Date().toISOString()
    }

    // Update request
    const { error: updateError } = await admin
      .from('requests')
      .update(updatePayload)
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    // If completing, deduct the quoted price (or fallback) from retainer
    if (status === 'completed' && req.status !== 'completed') {
      const deductAmount =
        quoted_price !== undefined && quoted_price !== ''
          ? Number(quoted_price)
          : COST_PER_REQUEST

      const { data: retainer } = await admin
        .from('retainer_accounts')
        .select('id, balance')
        .eq('client_id', req.client_id)
        .single()

      if (retainer) {
        const newBalance = Math.max(0, Number(retainer.balance) - deductAmount)

        await admin
          .from('retainer_accounts')
          .update({ balance: newBalance })
          .eq('id', retainer.id)

        await admin.from('retainer_transactions').insert({
          client_id: req.client_id,
          amount: deductAmount,
          type: 'debit',
          description: `Request completed: ${req.title}`,
          related_request_id: params.id,
        })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Admin request update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
