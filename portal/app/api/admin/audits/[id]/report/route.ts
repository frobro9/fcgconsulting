import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { AuditReportDocument } from '@/lib/audits/pdf'

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

// POST /api/admin/audits/[id]/report
// Generates a PDF report, uploads to Supabase Storage, saves URL to web_audits.report_url
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch audit + checks
  const [auditRes, checksRes] = await Promise.all([
    admin.from('web_audits').select('*').eq('id', params.id).single(),
    admin.from('audit_checks').select('*').eq('audit_id', params.id).order('completed_at', { ascending: true }),
  ])

  if (!auditRes.data) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  if (auditRes.data.status !== 'completed') {
    return NextResponse.json({ error: 'Audit must be completed before generating a report' }, { status: 400 })
  }

  const audit = auditRes.data
  const checks = checksRes.data ?? []

  // Generate PDF buffer
  let pdfBuffer: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(AuditReportDocument, { audit: audit as any, checks: checks as any })
    pdfBuffer = await renderToBuffer(element as any)
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  // Upload to Supabase Storage
  const fileName = `${params.id}-${Date.now()}.pdf`
  const { error: uploadError } = await admin.storage
    .from('audit-reports')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to upload report' }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = admin.storage
    .from('audit-reports')
    .getPublicUrl(fileName)

  // Save report URL back to audit record
  await admin
    .from('web_audits')
    .update({ report_url: publicUrl })
    .eq('id', params.id)

  return NextResponse.json({ reportUrl: publicUrl })
}
