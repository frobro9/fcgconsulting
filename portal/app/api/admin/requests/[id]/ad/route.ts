import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { startModaJob, getModaJob } from '@/lib/moda'

// ── POST — Create a new ad creative (starts Moda job) ─────────────────────────
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: caller } = await admin.from('clients').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch the request to get business name
    const { data: req } = await admin
      .from('requests')
      .select('id, mode, clients(name, company)')
      .eq('id', params.id)
      .single()

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.mode !== 'firm_creates') {
      return NextResponse.json({ error: 'Ad creation only available for firm_creates requests' }, { status: 400 })
    }

    const body = await request.json()
    const { headline, body_copy, cta, platform, audience_description } = body

    if (!headline || !platform) {
      return NextResponse.json({ error: 'headline and platform are required' }, { status: 400 })
    }

    const client = req.clients as unknown as { name: string; company: string } | null
    const businessName = client?.company || client?.name || 'the business'

    // Start Moda job
    const modaJob = await startModaJob({
      headline,
      bodyCopy: body_copy,
      cta,
      platform,
      audienceDescription: audience_description,
      businessName,
    })

    // Upsert ad creative record (replace existing draft if any)
    const { data: creative, error } = await admin
      .from('ad_creatives')
      .upsert({
        request_id: params.id,
        headline,
        body_copy,
        cta,
        platform,
        audience_description,
        moda_job_id: modaJob.id,
        moda_canvas_id: null,
        moda_status: 'generating',
        image_url: null,
        status: 'draft',
        sent_at: null,
        approved_at: null,
        rejected_at: null,
        rejection_reason: null,
      }, { onConflict: 'request_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ creative, job: modaJob })
  } catch (err) {
    console.error('Ad create error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

// ── DELETE — Reset / clear the ad creative record ─────────────────────────────
export async function DELETE(
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

    await admin.from('ad_creatives').delete().eq('request_id', params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Ad DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── GET — Poll ad creative + Moda job status ───────────────────────────────────
export async function GET(
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

    const { data: creative } = await admin
      .from('ad_creatives')
      .select('*')
      .eq('request_id', params.id)
      .single()

    if (!creative) return NextResponse.json({ creative: null })

    // If Moda job is still generating, poll for status
    if (creative.moda_job_id && creative.moda_status === 'generating') {
      const job = await getModaJob(creative.moda_job_id)

      if (job.status === 'completed' && job.canvas_id) {
        // Mark as ready — store canvas URL so admin can open Moda, edit, and download
        const canvasUrl = job.canvas_url ?? `https://moda.app/canvas/${job.canvas_id}`
        await admin
          .from('ad_creatives')
          .update({ moda_status: 'ready', moda_canvas_id: job.canvas_id, image_url: canvasUrl })
          .eq('request_id', params.id)

        return NextResponse.json({ creative: { ...creative, moda_status: 'ready', image_url: canvasUrl } })
      }

      if (job.status === 'failed') {
        await admin.from('ad_creatives').update({ moda_status: 'failed' }).eq('request_id', params.id)
        return NextResponse.json({ creative: { ...creative, moda_status: 'failed' } })
      }
    }

    return NextResponse.json({ creative })
  } catch (err) {
    console.error('Ad GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
