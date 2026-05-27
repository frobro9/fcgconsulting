import type { CheckResult } from './types'

// ─── HTML Helpers ────────────────────────────────────────────────────────────

function getTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

function getMetaContent(html: string, name: string): string | null {
  const nameFirst = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
  const contentFirst = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'))
  return (nameFirst || contentFirst)?.[1] ?? null
}

function getMetaProperty(html: string, property: string): string | null {
  const propFirst = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
  const contentFirst = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'))
  return (propFirst || contentFirst)?.[1] ?? null
}

function countMatches(html: string, regex: RegExp): number {
  return (html.match(regex) || []).length
}

// ─── 1. Technical SEO — Meta Tags ────────────────────────────────────────────

export function checkMetaTags(html: string): CheckResult {
  const title = getTagContent(html, 'title')
  const description = getMetaContent(html, 'description')
  const keywords = getMetaContent(html, 'keywords')

  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  // Title checks
  if (!title) {
    issues.push('Missing <title> tag')
    recommendations.push('Add a descriptive <title> tag (50–60 characters)')
    score -= 40
  } else if (title.length < 30) {
    issues.push(`Title too short (${title.length} chars): "${title}"`)
    recommendations.push('Expand title to 50–60 characters for better click-through rates')
    score -= 20
  } else if (title.length > 65) {
    issues.push(`Title too long (${title.length} chars) — gets truncated in search results`)
    recommendations.push('Trim title to under 65 characters')
    score -= 15
  } else {
    issues.push(`Title OK (${title.length} chars): "${title.substring(0, 60)}${title.length > 60 ? '...' : ''}"`)
  }

  // Description checks
  if (!description) {
    issues.push('Missing meta description')
    recommendations.push('Add a meta description tag (120–158 characters) summarising the page')
    score -= 40
  } else if (description.length < 70) {
    issues.push(`Meta description too short (${description.length} chars)`)
    recommendations.push('Expand meta description to 120–158 characters')
    score -= 15
  } else if (description.length > 165) {
    issues.push(`Meta description too long (${description.length} chars) — will be truncated`)
    recommendations.push('Shorten meta description to under 160 characters')
    score -= 10
  } else {
    issues.push(`Meta description OK (${description.length} chars)`)
  }

  // Keywords (bonus check)
  if (!keywords) {
    recommendations.push('Consider adding a meta keywords tag (minor signal for some engines)')
  }

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: {
      title: 'Meta Tags & Title',
      details: issues,
      recommendations,
    },
  }
}

// ─── 2. Performance — Image Optimisation ────────────────────────────────────

export function checkImageOptimization(html: string): CheckResult {
  const imgTags = html.match(/<img[^>]+>/gi) || []
  const total = imgTags.length

  if (total === 0) {
    return {
      status: 'pass',
      score: 100,
      findings: {
        title: 'Image Optimisation',
        details: ['No images found on the page'],
        recommendations: [],
      },
    }
  }

  let missingLazy = 0
  let missingDimensions = 0
  let largePng = 0

  for (const tag of imgTags) {
    if (!tag.match(/loading=["']lazy["']/i)) missingLazy++
    if (!tag.match(/width=/i) || !tag.match(/height=/i)) missingDimensions++
    if (tag.match(/src=["'][^"']*\.png["']/i) && !tag.match(/src=["'][^"']*\.webp["']/i)) largePng++
  }

  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  issues.push(`Found ${total} image(s) on the page`)

  if (missingLazy > 0) {
    issues.push(`${missingLazy}/${total} images missing lazy loading`)
    recommendations.push('Add loading="lazy" to below-the-fold images to improve page load speed')
    score -= Math.min(30, Math.round((missingLazy / total) * 30))
  }

  if (missingDimensions > 0) {
    issues.push(`${missingDimensions}/${total} images missing width/height attributes`)
    recommendations.push('Add explicit width and height to all <img> tags to prevent layout shift (CLS)')
    score -= Math.min(30, Math.round((missingDimensions / total) * 30))
  }

  if (largePng > 0) {
    issues.push(`${largePng} PNG image(s) detected — consider converting to WebP`)
    recommendations.push('Convert PNG/JPG images to WebP format for 25–35% smaller file sizes')
    score -= Math.min(20, largePng * 5)
  }

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: {
      title: 'Image Optimisation',
      details: issues,
      recommendations,
    },
  }
}

// ─── 3. Security — SSL Certificate ───────────────────────────────────────────

export async function checkSSLCertificate(url: string): Promise<CheckResult> {
  const isHttps = url.startsWith('https://')
  const issues: string[] = []
  const recommendations: string[] = []

  if (!isHttps) {
    // Try to see if http redirects to https
    try {
      const httpUrl = url.replace(/^https?:\/\//, 'http://')
      const response = await fetch(httpUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
      const finalUrl = response.url

      if (finalUrl.startsWith('https://')) {
        issues.push('Site redirects HTTP → HTTPS (good), but direct URL is HTTP')
        recommendations.push('Update all internal links and canonical URL to use HTTPS')
        return {
          status: 'warning',
          score: 60,
          findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
        }
      } else {
        issues.push('Site does NOT use HTTPS — data sent in plain text')
        recommendations.push('Install an SSL certificate (free via Let\'s Encrypt) and force HTTPS redirects')
        return {
          status: 'fail',
          score: 0,
          findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
        }
      }
    } catch {
      issues.push('Could not verify SSL — site may not be reachable via HTTP')
      return {
        status: 'fail',
        score: 0,
        findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
      }
    }
  }

  // Check HTTPS headers
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    const hsts = response.headers.get('strict-transport-security')

    issues.push('Site uses HTTPS — connection is encrypted')

    if (!hsts) {
      issues.push('Missing HSTS header (Strict-Transport-Security)')
      recommendations.push('Add HSTS header to prevent SSL stripping attacks: Strict-Transport-Security: max-age=31536000; includeSubDomains')
      return {
        status: 'warning',
        score: 75,
        findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
      }
    }

    issues.push('HSTS header present — strong transport security')
    return {
      status: 'pass',
      score: 100,
      findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
    }
  } catch {
    issues.push('HTTPS in use but could not verify security headers')
    return {
      status: 'warning',
      score: 70,
      findings: { title: 'SSL / HTTPS Security', details: issues, recommendations },
    }
  }
}

// ─── 4. Mobile — Viewport ────────────────────────────────────────────────────

export function checkMobileViewport(html: string): CheckResult {
  const viewport = getMetaContent(html, 'viewport')
  const issues: string[] = []
  const recommendations: string[] = []

  if (!viewport) {
    return {
      status: 'fail',
      score: 0,
      findings: {
        title: 'Mobile Viewport',
        details: ['Missing <meta name="viewport"> tag — page will not scale on mobile devices'],
        recommendations: ['Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>'],
      },
    }
  }

  let score = 100
  issues.push(`Viewport tag found: ${viewport}`)

  if (!viewport.includes('width=device-width')) {
    issues.push('Viewport does not include "width=device-width"')
    recommendations.push('Set viewport to: width=device-width, initial-scale=1')
    score -= 40
  }

  if (!viewport.includes('initial-scale=1')) {
    issues.push('Viewport does not set "initial-scale=1"')
    recommendations.push('Ensure initial-scale=1 is set to prevent zoom issues on load')
    score -= 20
  }

  if (viewport.includes('user-scalable=no') || viewport.includes('maximum-scale=1')) {
    issues.push('Viewport disables user zoom — accessibility concern')
    recommendations.push('Remove user-scalable=no / maximum-scale=1 to allow pinch-to-zoom for accessibility')
    score -= 20
  }

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: { title: 'Mobile Viewport', details: issues, recommendations },
  }
}

// ─── 5. Accessibility — Image Alt Text ───────────────────────────────────────

export function checkImageAltText(html: string): CheckResult {
  const imgTags = html.match(/<img[^>]+>/gi) || []
  const total = imgTags.length

  if (total === 0) {
    return {
      status: 'pass',
      score: 100,
      findings: {
        title: 'Image Alt Text (Accessibility)',
        details: ['No images found on the page'],
        recommendations: [],
      },
    }
  }

  let missingAlt = 0
  let emptyAlt = 0

  for (const tag of imgTags) {
    const altMatch = tag.match(/alt=["']([^"']*)["']/i)
    if (!altMatch) {
      missingAlt++
    } else if (altMatch[1].trim() === '') {
      emptyAlt++
    }
  }

  const issues: string[] = []
  const recommendations: string[] = []
  const withAlt = total - missingAlt - emptyAlt
  const score = Math.round((withAlt / total) * 100)

  issues.push(`${withAlt}/${total} images have descriptive alt text`)

  if (missingAlt > 0) {
    issues.push(`${missingAlt} image(s) are missing the alt attribute entirely`)
    recommendations.push('Add alt attributes to all images — required for screen readers and WCAG 2.1 compliance')
  }

  if (emptyAlt > 0) {
    issues.push(`${emptyAlt} image(s) have empty alt="" (acceptable only for purely decorative images)`)
    recommendations.push('Replace empty alt text with descriptive alternatives for meaningful images')
  }

  const status = score >= 90 ? 'pass' : score >= 60 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: { title: 'Image Alt Text (Accessibility)', details: issues, recommendations },
  }
}

// ─── 6. UX & Design — Heading Structure ──────────────────────────────────────

export function checkHeadingStructure(html: string): CheckResult {
  const h1Tags = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []
  const h2Tags = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || []
  const h3Tags = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/gi) || []

  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  // H1 checks
  if (h1Tags.length === 0) {
    issues.push('No <h1> tag found — every page should have exactly one H1')
    recommendations.push('Add a single <h1> tag with the main keyword/topic of the page')
    score -= 40
  } else if (h1Tags.length > 1) {
    issues.push(`Multiple <h1> tags found (${h1Tags.length}) — search engines expect only one`)
    recommendations.push('Consolidate to a single <h1> that describes the page\'s primary topic')
    score -= 25
  } else {
    const h1Text = (h1Tags[0] ?? '').replace(/<[^>]+>/g, '').trim()
    issues.push(`H1: "${h1Text.substring(0, 80)}${h1Text.length > 80 ? '...' : ''}"`)
  }

  // H2/H3 checks
  if (h2Tags.length === 0 && h3Tags.length > 0) {
    issues.push('H3 tags used without H2 — broken heading hierarchy')
    recommendations.push('Use headings in order: H1 → H2 → H3. Do not skip levels.')
    score -= 20
  } else if (h2Tags.length > 0) {
    issues.push(`${h2Tags.length} H2 heading(s) and ${h3Tags.length} H3 heading(s) found`)
  } else {
    issues.push('No subheadings (H2/H3) found — consider adding sections for readability')
    recommendations.push('Break content into sections using H2/H3 headings for better UX and SEO')
    score -= 15
  }

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: { title: 'Heading Structure (UX)', details: issues, recommendations },
  }
}

// ─── 7. Digital Footprint — Open Graph ───────────────────────────────────────

export function checkOpenGraph(html: string): CheckResult {
  const ogTitle = getMetaProperty(html, 'og:title')
  const ogDescription = getMetaProperty(html, 'og:description')
  const ogImage = getMetaProperty(html, 'og:image')
  const ogUrl = getMetaProperty(html, 'og:url')
  const twitterCard = getMetaContent(html, 'twitter:card')

  const issues: string[] = []
  const recommendations: string[] = []
  let score = 0
  const maxScore = 100

  if (ogTitle) {
    issues.push(`OG Title: "${ogTitle.substring(0, 60)}"`)
    score += 25
  } else {
    issues.push('Missing og:title — links shared on social media will show no title')
    recommendations.push('Add <meta property="og:title" content="Your Page Title">')
  }

  if (ogDescription) {
    issues.push(`OG Description present (${ogDescription.length} chars)`)
    score += 25
  } else {
    issues.push('Missing og:description — social shares will have no description')
    recommendations.push('Add <meta property="og:description" content="Brief page summary">')
  }

  if (ogImage) {
    issues.push('OG Image present — links will show a preview image when shared')
    score += 30
  } else {
    issues.push('Missing og:image — social posts will appear as plain text links')
    recommendations.push('Add <meta property="og:image" content="https://yoursite.com/social-image.jpg"> (1200×630px recommended)')
  }

  if (ogUrl) {
    issues.push('OG URL present')
    score += 10
  } else {
    recommendations.push('Add <meta property="og:url" content="https://yoursite.com/page">')
  }

  if (twitterCard) {
    issues.push(`Twitter Card type: ${twitterCard}`)
    score += 10
  } else {
    recommendations.push('Add Twitter Card meta tags for better Twitter/X sharing appearance')
  }

  score = Math.min(maxScore, score)
  const status = score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail'

  return {
    status,
    score,
    findings: { title: 'Open Graph & Social Sharing', details: issues, recommendations },
  }
}

// ─── 8. Backlinks & Canonicalisation ─────────────────────────────────────────

export function checkCanonicalUrl(html: string): CheckResult {
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
  const robots = getMetaContent(html, 'robots')
  const noindex = robots?.includes('noindex')

  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  if (!canonicalMatch) {
    issues.push('No canonical URL tag found')
    recommendations.push('Add <link rel="canonical" href="https://yoursite.com/page"> to prevent duplicate content penalties')
    score -= 40
  } else {
    issues.push(`Canonical URL: ${canonicalMatch[1]}`)
  }

  if (noindex) {
    issues.push('Page has robots "noindex" — will NOT appear in search engines')
    recommendations.push('Remove "noindex" from robots meta tag unless you intentionally want to block this page from search')
    score -= 50
  } else if (robots) {
    issues.push(`Robots directive: ${robots}`)
  } else {
    issues.push('No robots meta tag — defaults to indexing (normal)')
  }

  const status = score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail'

  return {
    status,
    score: Math.max(0, score),
    findings: { title: 'Canonical URL & Crawlability', details: issues, recommendations },
  }
}

// ─── 9. Technical SEO — Robots.txt ───────────────────────────────────────────

export async function checkRobotsTxt(url: string): Promise<CheckResult> {
  const base = new URL(url.startsWith('http') ? url : `https://${url}`)
  const robotsUrl = `${base.protocol}//${base.hostname}/robots.txt`

  try {
    const res = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CapitalConsultingAudit/1.0)' },
    })

    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    if (!res.ok) {
      issues.push('robots.txt file not found')
      recommendations.push('Create a robots.txt file at your domain root to guide search engine crawlers')
      score = 25
    } else {
      const text = await res.text()
      issues.push('robots.txt file exists')

      // Check if blocking all crawlers
      if (/disallow:\s*\//i.test(text) && /user-agent:\s*\*/i.test(text)) {
        issues.push('WARNING: robots.txt appears to block all crawlers (Disallow: /)')
        recommendations.push('Review your robots.txt — "Disallow: /" prevents all search engines from indexing your site')
        score = 15
      }

      // Sitemap reference
      if (/sitemap:/i.test(text)) {
        issues.push('Sitemap URL referenced in robots.txt')
      } else {
        recommendations.push('Add a Sitemap: line in robots.txt pointing to your XML sitemap')
        score -= 20
      }
    }

    return {
      status: score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail',
      score: Math.max(0, score),
      findings: { title: res.ok ? 'robots.txt found' : 'robots.txt missing', details: issues, recommendations },
    }
  } catch {
    return {
      status: 'warning',
      score: 50,
      findings: {
        title: 'Could not check robots.txt',
        details: ['Request timed out or connection was refused'],
        recommendations: ['Ensure robots.txt is publicly accessible at the root of your domain'],
      },
    }
  }
}

// ─── 10. Technical SEO — XML Sitemap ─────────────────────────────────────────

export async function checkSitemapXml(url: string): Promise<CheckResult> {
  const base = new URL(url.startsWith('http') ? url : `https://${url}`)
  const sitemapUrl = `${base.protocol}//${base.hostname}/sitemap.xml`

  try {
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CapitalConsultingAudit/1.0)' },
    })

    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    if (!res.ok) {
      issues.push('sitemap.xml not found')
      recommendations.push('Create an XML sitemap listing all important pages on your site')
      recommendations.push('Submit your sitemap to Google Search Console to accelerate indexing')
      score = 20
    } else {
      const text = await res.text()
      const urlCount = (text.match(/<url>/gi) || []).length
      issues.push(`sitemap.xml found — ${urlCount} URL${urlCount !== 1 ? 's' : ''} listed`)

      if (urlCount === 0) {
        recommendations.push('Sitemap exists but is empty — add your important page URLs')
        score = 50
      } else if (urlCount < 3) {
        recommendations.push('Consider adding more pages to your sitemap for better crawl coverage')
        score -= 10
      }
    }

    return {
      status: score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail',
      score: Math.max(0, score),
      findings: { title: res.ok ? 'XML sitemap found' : 'XML sitemap missing', details: issues, recommendations },
    }
  } catch {
    return {
      status: 'warning',
      score: 50,
      findings: {
        title: 'Could not check sitemap.xml',
        details: ['Request timed out or connection was refused'],
        recommendations: ['Ensure sitemap.xml is publicly accessible at the root of your domain'],
      },
    }
  }
}

// ─── 11. Security — HTTP Security Headers ────────────────────────────────────

export async function checkSecurityHeaders(url: string): Promise<CheckResult> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(normalizedUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    const h = res.headers
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    const headerChecks = [
      {
        header: 'x-frame-options',
        deduction: 20,
        rec: 'Add X-Frame-Options: SAMEORIGIN to prevent clickjacking attacks',
      },
      {
        header: 'x-content-type-options',
        deduction: 15,
        rec: 'Add X-Content-Type-Options: nosniff to prevent MIME-type sniffing',
      },
      {
        header: 'strict-transport-security',
        deduction: 20,
        rec: 'Add Strict-Transport-Security header to enforce HTTPS connections',
      },
      {
        header: 'referrer-policy',
        deduction: 10,
        rec: 'Add Referrer-Policy header to control how referrer info is shared',
      },
      {
        header: 'permissions-policy',
        deduction: 10,
        rec: 'Add Permissions-Policy to restrict access to browser APIs (camera, mic, etc.)',
      },
    ]

    for (const check of headerChecks) {
      if (h.get(check.header)) {
        issues.push(`✓ ${check.header}`)
      } else {
        issues.push(`✗ ${check.header} missing`)
        recommendations.push(check.rec)
        score -= check.deduction
      }
    }

    const passed = headerChecks.filter(c => h.get(c.header)).length
    return {
      status: score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail',
      score: Math.max(0, score),
      findings: {
        title: `Security headers: ${passed}/${headerChecks.length} present`,
        details: issues,
        recommendations,
      },
    }
  } catch {
    return {
      status: 'warning',
      score: 50,
      findings: {
        title: 'Could not check security headers',
        details: ['Request timed out or was blocked'],
        recommendations: ['Review your server or CDN configuration to add security headers'],
      },
    }
  }
}

// ─── 12. UX/Design — Contact Information ─────────────────────────────────────

export function checkContactInfo(html: string): CheckResult {
  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  const hasPhone   = /(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}|tel:/i.test(html)
  const hasEmail   = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}|mailto:/i.test(html)
  const hasAddress = /(street|avenue|ave|blvd|road|rd|suite|ste|floor|st\.|dr\.|drive|\d{3,5}\s+\w)/i.test(html)
  const hasContact = /href=["'][^"']*contact[^"']*["']|<a[^>]*>contact/i.test(html)

  if (hasPhone) {
    issues.push('✓ Phone number found')
  } else {
    issues.push('✗ No phone number detected')
    recommendations.push('Add a visible phone number — customers expect to call local businesses directly')
    score -= 30
  }

  if (hasEmail) {
    issues.push('✓ Email address or mailto link found')
  } else {
    issues.push('✗ No email address detected')
    recommendations.push('Add a contact email or mailto link so customers can reach you easily')
    score -= 20
  }

  if (hasAddress) {
    issues.push('✓ Physical address found')
  } else {
    issues.push('✗ No physical address detected')
    recommendations.push('Add your business address — essential for local SEO and customer trust')
    score -= 25
  }

  if (hasContact) {
    issues.push('✓ Contact page link found')
  } else {
    issues.push('✗ No contact page link found')
    recommendations.push('Add a clearly labelled "Contact" link in your navigation menu')
    score -= 10
  }

  return {
    status: score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail',
    score: Math.max(0, score),
    findings: {
      title: `Contact info: ${score >= 80 ? 'Good' : score >= 50 ? 'Partial' : 'Missing'}`,
      details: issues,
      recommendations,
    },
  }
}

// ─── 13. Digital Footprint — Schema / Structured Data ────────────────────────

export function checkSchemaMarkup(html: string): CheckResult {
  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const hasMicrodata = /itemtype=["']https?:\/\/schema\.org/i.test(html)

  if (jsonLdBlocks.length > 0) {
    issues.push(`✓ ${jsonLdBlocks.length} JSON-LD structured data block(s) found`)

    // Identify schema types
    const types: string[] = []
    for (const block of jsonLdBlocks) {
      const match = block.match(/"@type"\s*:\s*"([^"]+)"/)
      if (match) types.push(match[1])
    }
    if (types.length > 0) {
      issues.push(`Schema types detected: ${types.join(', ')}`)
    }
  } else if (hasMicrodata) {
    issues.push('✓ Microdata schema markup found (schema.org)')
    score -= 10 // JSON-LD is preferred by Google
    recommendations.push('Consider migrating from Microdata to JSON-LD — Google recommends JSON-LD')
  } else {
    issues.push('✗ No structured data (schema markup) found')
    recommendations.push('Add JSON-LD structured data to help Google understand your business')
    recommendations.push('For local businesses, use LocalBusiness schema with name, address, phone, and hours')
    recommendations.push('Test your schema at: https://search.google.com/test/rich-results')
    score = 20
  }

  return {
    status: score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail',
    score: Math.max(0, score),
    findings: {
      title: jsonLdBlocks.length > 0 || hasMicrodata ? 'Structured data found' : 'No structured data found',
      details: issues,
      recommendations,
    },
  }
}

// ─── 14. Backlinks — Social Media Presence ───────────────────────────────────

export function checkSocialLinks(html: string): CheckResult {
  const issues: string[] = []
  const recommendations: string[] = []

  const platforms = [
    { name: 'Facebook',   pattern: /facebook\.com\//i },
    { name: 'Instagram',  pattern: /instagram\.com\//i },
    { name: 'LinkedIn',   pattern: /linkedin\.com\//i },
    { name: 'Twitter/X',  pattern: /twitter\.com\/|x\.com\//i },
    { name: 'YouTube',    pattern: /youtube\.com\//i },
    { name: 'TikTok',     pattern: /tiktok\.com\//i },
  ]

  const found  = platforms.filter(p => p.pattern.test(html)).map(p => p.name)
  const missing = platforms.filter(p => !p.pattern.test(html)).map(p => p.name)

  if (found.length > 0) {
    issues.push(`✓ Social profiles linked: ${found.join(', ')}`)
  } else {
    issues.push('✗ No social media profile links found on page')
  }

  let score: number
  if (found.length === 0) {
    score = 25
    recommendations.push('Add links to your social media profiles — builds trust and engagement')
    recommendations.push('Facebook and Instagram are most important for local businesses')
  } else if (found.length === 1) {
    score = 55
    recommendations.push(`Consider linking additional profiles (${missing.slice(0, 3).join(', ')})`)
  } else if (found.length === 2) {
    score = 75
    recommendations.push(`Good start — consider adding ${missing[0]} for wider reach`)
  } else {
    score = 100
    issues.push('Strong social media presence on the page')
  }

  return {
    status: score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail',
    score,
    findings: {
      title: found.length > 0 ? `${found.length} social profile(s) linked` : 'No social links found',
      details: issues,
      recommendations,
    },
  }
}
