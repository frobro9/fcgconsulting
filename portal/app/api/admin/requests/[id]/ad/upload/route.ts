import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

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

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Upload to Supabase storage
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `ads/${params.id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('ad-images')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      // Bucket may not exist yet — try to create it then retry
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await admin.storage.createBucket('ad-images', { public: true })
        const { error: retryError } = await admin.storage
          .from('ad-images')
          .upload(path, buffer, { contentType: file.type, upsert: true })
        if (retryError) throw retryError
      } else {
        throw uploadError
      }
    }

    // Get public URL
    const { data: { publicUrl } } = admin.storage.from('ad-images').getPublicUrl(path)

    // Save to ad_creatives
    await admin
      .from('ad_creatives')
      .update({ image_url: publicUrl })
      .eq('request_id', params.id)

    return NextResponse.json({ image_url: publicUrl })
  } catch (err) {
    console.error('Ad upload error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 })
  }
}
