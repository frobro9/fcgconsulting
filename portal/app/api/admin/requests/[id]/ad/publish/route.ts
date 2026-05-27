import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'

// POST — Publish ad to client for approval
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: caller } = await admin.from('clients').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Verify ad is ready to publish
    const { data: creative } = await admin
      .from('ad_creatives')
      .select('*')
      .eq('request_id', params.id)
      .single()

    if (!creative) return NextResponse.json({ error: 'No ad creative found' }, { status: 404 })
    if (!creative.image_url) return NextResponse.json({ error: 'Ad image not ready yet' }, { status: 400 })

    // Get request and client info
    const { data: req } = await admin
      .from('requests')
      .select('id, title, clients(name, email, company)')
      .eq('id', params.id)
      .single()

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const client = req.clients as unknown as { name: string; email: string; company: string } | null

    // Mark ad as sent for approval
    await admin
      .from('ad_creatives')
      .update({ status: 'sent_for_approval', sent_at: new Date().toISOString() })
      .eq('request_id', params.id)

    // Move request to awaiting_approval
    await admin
      .from('requests')
      .update({ status: 'awaiting_approval' })
      .eq('id', params.id)

    // Send email to client
    if (client?.email) {
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.capitalconsulting.ca'
      const reviewUrl = `${portalUrl}/requests/${params.id}`

      await sendEmail({
        to: client.email,
        subject: `Your Ad is Ready for Review — ${req.title}`,
        clientName: client.name,
        clientCompany: client.company,
        body: `
          <p>Hi ${client.name},</p>
          <p>Your ad for <strong>${req.title}</strong> is ready for review!</p>
          <p>Please log in to your portal to view the ad and let us know if you'd like to approve it or request any changes:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${reviewUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Review Ad
            </a>
          </p>
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br/>Capital Consulting Team</p>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Ad publish error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
