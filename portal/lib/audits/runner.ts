import { createAdminClient } from '@/lib/supabase-admin'
import {
  checkMetaTags,
  checkImageOptimization,
  checkSSLCertificate,
  checkMobileViewport,
  checkImageAltText,
  checkHeadingStructure,
  checkOpenGraph,
  checkCanonicalUrl,
  checkRobotsTxt,
  checkSitemapXml,
  checkSecurityHeaders,
  checkContactInfo,
  checkSchemaMarkup,
  checkSocialLinks,
} from './checks'
import { fetchPageSpeedInsights } from './pagespeed'
import { calculateOverallScore } from './scores'
import { CHECK_DIMENSIONS, TOTAL_CHECKS } from './types'
import type { CheckResult } from './types'

interface CheckDef {
  name: string
  run: (html: string, url: string) => Promise<CheckResult> | CheckResult
}

// Static checks — run sequentially against fetched HTML / URL
const STATIC_PIPELINE: CheckDef[] = [
  { name: 'ssl_certificate',   run: (_, url) => checkSSLCertificate(url) },
  { name: 'meta_tags',         run: (html)   => checkMetaTags(html) },
  { name: 'mobile_viewport',   run: (html)   => checkMobileViewport(html) },
  { name: 'heading_structure', run: (html)   => checkHeadingStructure(html) },
  { name: 'image_alt_text',    run: (html)   => checkImageAltText(html) },
  { name: 'image_optimization',run: (html)   => checkImageOptimization(html) },
  { name: 'open_graph',        run: (html)   => checkOpenGraph(html) },
  { name: 'canonical_url',     run: (html)   => checkCanonicalUrl(html) },
  { name: 'robots_txt',        run: (_, url) => checkRobotsTxt(url) },
  { name: 'sitemap_xml',       run: (_, url) => checkSitemapXml(url) },
  { name: 'security_headers',  run: (_, url) => checkSecurityHeaders(url) },
  { name: 'contact_info',      run: (html)   => checkContactInfo(html) },
  { name: 'schema_markup',     run: (html)   => checkSchemaMarkup(html) },
  { name: 'social_links',      run: (html)   => checkSocialLinks(html) },
]

export async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CapitalConsultingAudit/1.0; +https://capitalconsulting.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

/**
 * Run all 16 audit checks for a URL.
 * PSI (Google Lighthouse) runs in parallel with static checks.
 * Each result is saved to DB immediately. progress_pct updates after every check.
 */
export async function runAudit(auditId: string, url: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('web_audits')
    .update({ status: 'in_progress', progress_pct: 0 })
    .eq('id', auditId)

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  // Kick off PSI immediately in background (takes 15-30s)
  const psiPromise = fetchPageSpeedInsights(normalizedUrl)

  // Fetch HTML once for all static checks
  const html = await fetchPageHtml(normalizedUrl)

  if (!html) {
    await supabase
      .from('web_audits')
      .update({ status: 'failed', progress_pct: 0 })
      .eq('id', auditId)
    return
  }

  async function saveCheck(name: string, result: CheckResult, completedSoFar: number) {
    const dimension = CHECK_DIMENSIONS[name]
    await supabase.from('audit_checks').upsert(
      {
        audit_id:     auditId,
        check_name:   name,
        dimension,
        status:       result.status,
        score:        result.score,
        findings:     result.findings,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'audit_id,check_name' }
    )
    const progressPct = Math.round((completedSoFar / TOTAL_CHECKS) * 100)
    await supabase.from('web_audits').update({ progress_pct: progressPct }).eq('id', auditId)
  }

  async function saveError(name: string, err: unknown, completedSoFar: number) {
    const dimension = CHECK_DIMENSIONS[name]
    await supabase.from('audit_checks').upsert(
      {
        audit_id:     auditId,
        check_name:   name,
        dimension,
        status:       'error',
        score:        0,
        findings: {
          title: name,
          details: [`Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
          recommendations: ['Retry the audit or check if the URL is accessible'],
        },
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'audit_id,check_name' }
    )
    const progressPct = Math.round((completedSoFar / TOTAL_CHECKS) * 100)
    await supabase.from('web_audits').update({ progress_pct: progressPct }).eq('id', auditId)
  }

  // Run static checks sequentially
  let completed = 0
  for (const checkDef of STATIC_PIPELINE) {
    try {
      const result = await checkDef.run(html, normalizedUrl)
      completed++
      await saveCheck(checkDef.name, result, completed)
    } catch (err) {
      completed++
      await saveError(checkDef.name, err, completed)
    }
  }

  // Await PSI and save its two checks
  try {
    const psi = await psiPromise

    if (psi) {
      completed++
      await saveCheck('page_speed', psi.performance, completed)
      completed++
      await saveCheck('psi_accessibility', psi.accessibility, completed)
    } else {
      // PSI unavailable — save graceful warning so progress reaches 100%
      const psiUnavailable: CheckResult = {
        status: 'warning',
        score: 50,
        findings: {
          title: 'Google PageSpeed Insights unavailable',
          details: ['Could not reach the PageSpeed Insights API for this audit'],
          recommendations: [
            'Set GOOGLE_PSI_API_KEY in your environment variables',
            'Enable the PageSpeed Insights API in Google Cloud Console (free)',
          ],
        },
      }
      completed++
      await saveCheck('page_speed', psiUnavailable, completed)
      completed++
      await saveCheck('psi_accessibility', psiUnavailable, completed)
    }
  } catch (err) {
    completed++
    await saveError('page_speed', err, completed)
    completed++
    await saveError('psi_accessibility', err, completed)
  }

  // Calculate final score and mark complete
  const { data: allChecks } = await supabase
    .from('audit_checks')
    .select('*')
    .eq('audit_id', auditId)

  const overallScore = allChecks ? calculateOverallScore(allChecks as any) : 0

  await supabase
    .from('web_audits')
    .update({
      status:        'completed',
      overall_score: overallScore,
      progress_pct:  100,
      completed_at:  new Date().toISOString(),
    })
    .eq('id', auditId)
}
