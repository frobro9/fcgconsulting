import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the request to verify ownership and status
    const { data: existing, error: fetchError } = await adminSupabase
      .from('requests')
      .select('id, client_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Must be the owner
    if (existing.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Can only delete if still pending
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be deleted.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await adminSupabase
      .from('requests')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
