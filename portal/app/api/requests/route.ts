import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail, ADMIN_EMAIL } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      mode,
      title,
      description,
      preferred_deadline,
      platforms,
      scheduled_date,
    } = body

    // Validate required fields
    if (!type || !mode || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Insert request
    const { data: newRequest, error: requestError } = await supabase
      .from('requests')
      .insert({
        client_id: user.id,
        type,
        mode,
        title,
        description,
        preferred_deadline: preferred_deadline || null,
      })
      .select()
      .single()

    if (requestError || !newRequest) {
      console.error('Request insert error:', requestError)
      return NextResponse.json(
        { error: 'Failed to create request' },
        { status: 500 }
      )
    }

    // Insert social media details if applicable
    if (type === 'social_media' && platforms && platforms.length > 0) {
      const { error: socialError } = await supabase
        .from('social_media_details')
        .insert({
          request_id: newRequest.id,
          platforms,
          scheduled_date: scheduled_date || null,
        })

      if (socialError) {
        console.error('Social media details insert error:', socialError)
      }
    }

    // Fetch client info for email
    const { data: client } = await supabase
      .from('clients')
      .select('name, company')
      .eq('id', user.id)
      .single()

    // Send notification email to admin
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `New Request: ${title}`,
      clientName: client?.name ?? 'Unknown',
      clientCompany: client?.company ?? 'Unknown',
      body: `A new ${type.replace(/_/g, ' ')} request has been submitted.\n\nTitle: ${title}\nMode: ${mode}\nDescription: ${description}`,
    })

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
