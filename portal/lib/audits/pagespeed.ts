import type { CheckResult } from './types'

export interface PSIResults {
  performance: CheckResult
  accessibility: CheckResult
}

/**
 * Calls the Google PageSpeed Insights API (Lighthouse) for real performance
 * and accessibility scores. Requires GOOGLE_PSI_API_KEY in env.
 * Falls back to null if unavailable so static checks can cover those dimensions.
 */
export async function fetchPageSpeedInsights(url: string): Promise<PSIResults | null> {
  const apiKey = process.env.GOOGLE_PSI_API_KEY || process.env.GOOGLE_CSE_API_KEY
  if (!apiKey) return null

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const endpoint =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(normalizedUrl)}` +
    `&strategy=mobile` +
    `&category=performance` +
    `&category=accessibility` +
    `&key=${apiKey}`

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(40000) })
    if (!res.ok) {
      console.warn('PSI API returned', res.status)
      return null
    }

    const data = await res.json()
    const categories = data.lighthouseResult?.categories
    const audits = data.lighthouseResult?.audits

    if (!categories) return null

    const perfScore = Math.round((categories.performance?.score ?? 0) * 100)
    const a11yScore = Math.round((categories.accessibility?.score ?? 0) * 100)

    // Core Web Vitals
    const lcp  = audits?.['largest-contentful-paint']?.displayValue  ?? 'N/A'
    const cls  = audits?.['cumulative-layout-shift']?.displayValue    ?? 'N/A'
    const tbt  = audits?.['total-blocking-time']?.displayValue        ?? 'N/A'
    const fcp  = audits?.['first-contentful-paint']?.displayValue     ?? 'N/A'
    const si   = audits?.['speed-index']?.displayValue                ?? 'N/A'
    const tti  = audits?.['interactive']?.displayValue                ?? 'N/A'

    // Top Lighthouse opportunities
    const opportunityKeys = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'efficiently-encode-images',
      'uses-text-compression',
      'uses-responsive-images',
    ]
    const perfRecs: string[] = []
    for (const key of opportunityKeys) {
      const audit = audits?.[key]
      if (audit && audit.score !== null && audit.score < 0.9 && audit.title) {
        perfRecs.push(audit.title)
      }
    }
    if (perfRecs.length === 0) {
      perfRecs.push('Performance is good — maintain current optimizations')
    }

    // Failed accessibility audits
    const a11yAuditKeys = [
      'color-contrast',
      'image-alt',
      'label',
      'link-name',
      'button-name',
      'aria-required-attr',
      'aria-valid-attr',
      'document-title',
      'html-has-lang',
    ]
    const a11yDetails: string[] = []
    for (const key of a11yAuditKeys) {
      const audit = audits?.[key]
      if (!audit || audit.score === null) continue
      const icon = audit.score >= 1 ? '✓' : '✗'
      a11yDetails.push(`${icon} ${audit.title}`)
    }
    if (a11yDetails.length === 0) a11yDetails.push('Accessibility audit completed')

    const a11yRecs: string[] = a11yScore < 80
      ? [
          'Ensure sufficient color contrast between text and background (4.5:1 ratio)',
          'Add descriptive alt text to all images',
          'Associate form labels with their inputs using for/id attributes',
          'Ensure all interactive elements have accessible names',
          'Add lang attribute to the <html> element',
        ]
      : ['Accessibility is good — maintain WCAG compliance']

    return {
      performance: {
        status: perfScore >= 80 ? 'pass' : perfScore >= 50 ? 'warning' : 'fail',
        score: perfScore,
        findings: {
          title: `Google Lighthouse Performance: ${perfScore}/100 (mobile)`,
          details: [
            `First Contentful Paint (FCP): ${fcp}`,
            `Speed Index: ${si}`,
            `Largest Contentful Paint (LCP): ${lcp}`,
            `Total Blocking Time (TBT): ${tbt}`,
            `Cumulative Layout Shift (CLS): ${cls}`,
            `Time to Interactive (TTI): ${tti}`,
          ],
          recommendations: perfRecs,
        },
      },
      accessibility: {
        status: a11yScore >= 80 ? 'pass' : a11yScore >= 50 ? 'warning' : 'fail',
        score: a11yScore,
        findings: {
          title: `Google Lighthouse Accessibility: ${a11yScore}/100`,
          details: a11yDetails,
          recommendations: a11yRecs,
        },
      },
    }
  } catch (err) {
    console.warn('PSI fetch error:', err)
    return null
  }
}
