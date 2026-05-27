import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const TOPUP_AMOUNT = 500

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: account, error: fetchError } = await adminClient
      .from('retainer_accounts')
      .select('id, balance')
      .eq('client_id', user.id)
      .single()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Retainer account not found' }, { status: 404 })
    }

    const newBalance = Number(account.balance) + TOPUP_AMOUNT

    const { error: updateError } = await adminClient
      .from('retainer_accounts')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', account.id)

    if (updateError) {
      console.error('Balance update error:', updateError)
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }

    await adminClient.from('retainer_transactions').insert({
      client_id: user.id,
      amount: TOPUP_AMOUNT,
      type: 'credit',
      description: `Retainer top-up of $${TOPUP_AMOUNT}`,
    })

    return NextResponse.json({ balance: newBalance }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
