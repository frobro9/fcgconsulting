import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { WebAudit, AuditCheck } from './types'
import { DIMENSIONS } from './types'
import { getDimensionScores } from './scores'

// ─── Styles ──────────────────────────────────────────────────────────────────

const NAVY = '#1e3a5f'
const GOLD = '#c9a84c'
const LIGHT_GRAY = '#f8f9fa'
const MID_GRAY = '#6b7280'
const PASS_GREEN = '#16a34a'
const WARN_YELLOW = '#d97706'
const FAIL_RED = '#dc2626'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#ffffff', paddingBottom: 60 },

  // Cover page
  cover: { backgroundColor: NAVY, minHeight: '100%', padding: 60, flexDirection: 'column', justifyContent: 'space-between' },
  coverLogo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverLogoBox: { width: 40, height: 40, backgroundColor: GOLD, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  coverLogoText: { color: NAVY, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  coverBrand: { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold', marginLeft: 10 },
  coverMain: { flex: 1, justifyContent: 'center', paddingVertical: 60 },
  coverTitle: { color: GOLD, fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 },
  coverBusinessName: { color: '#ffffff', fontSize: 32, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  coverUrl: { color: '#93c5fd', fontSize: 13, marginBottom: 40 },
  coverScoreBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 24, maxWidth: 300 },
  coverScoreNum: { fontSize: 56, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  coverScoreLabel: { color: '#ffffff', fontSize: 13, marginTop: 4 },
  coverScoreSub: { color: '#93c5fd', fontSize: 11, marginTop: 2 },
  coverFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  coverDate: { color: '#93c5fd', fontSize: 11 },
  coverConfidential: { color: '#93c5fd', fontSize: 10 },

  // Inner pages
  header: { backgroundColor: NAVY, paddingHorizontal: 40, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerUrl: { color: '#93c5fd', fontSize: 9 },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  footerText: { color: MID_GRAY, fontSize: 9 },

  // Section titles
  sectionTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6 },
  sectionSubtitle: { fontSize: 11, color: MID_GRAY, marginBottom: 20, lineHeight: 1.5 },
  divider: { height: 2, backgroundColor: GOLD, width: 40, marginBottom: 20 },

  // Executive summary
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 16, alignItems: 'center' },
  summaryCardScore: { fontSize: 28, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  summaryCardLabel: { fontSize: 9, color: MID_GRAY, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Dimension score table
  dimRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dimLabel: { flex: 1, fontSize: 11, color: '#111827' },
  dimBarWrap: { width: 120, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginRight: 12 },
  dimBar: { height: 6, borderRadius: 3 },
  dimScore: { width: 40, fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  dimStatus: { width: 50, fontSize: 9, textAlign: 'right' },

  // Check detail card
  checkCard: { marginBottom: 16, borderRadius: 8, overflow: 'hidden' },
  checkHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  checkStatusDot: { width: 10, height: 10, borderRadius: 5 },
  checkTitle: { flex: 1, fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
  checkScore: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  checkBody: { paddingHorizontal: 14, paddingBottom: 14 },

  // What this means box
  explainBox: { backgroundColor: '#eff6ff', borderRadius: 6, padding: 12, marginBottom: 10 },
  explainTitle: { fontSize: 9, color: NAVY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  explainText: { fontSize: 10, color: '#1e40af', lineHeight: 1.5 },

  // Findings
  findingsTitle: { fontSize: 9, color: MID_GRAY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  findingItem: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  findingBullet: { fontSize: 10, color: MID_GRAY, marginTop: 1 },
  findingText: { flex: 1, fontSize: 10, color: '#374151', lineHeight: 1.4 },

  // Recommendations
  recTitle: { fontSize: 9, color: NAVY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: 10 },
  recItem: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  recArrow: { fontSize: 10, color: GOLD },
  recText: { flex: 1, fontSize: 10, color: NAVY, lineHeight: 1.4 },

  // CTA page
  ctaPage: { backgroundColor: NAVY, minHeight: '100%', padding: 60 },
  ctaTitle: { color: GOLD, fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 },
  ctaHeadline: { color: '#ffffff', fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, lineHeight: 1.3 },
  ctaBody: { color: '#bfdbfe', fontSize: 12, lineHeight: 1.7, marginBottom: 32 },
  ctaService: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  ctaDot: { width: 6, height: 6, backgroundColor: GOLD, borderRadius: 3, marginTop: 4 },
  ctaServiceText: { flex: 1, color: '#ffffff', fontSize: 11, lineHeight: 1.5 },
  ctaContact: { marginTop: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 24 },
  ctaContactTitle: { color: GOLD, fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  ctaContactText: { color: '#bfdbfe', fontSize: 11, lineHeight: 1.6 },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return PASS_GREEN
  if (score >= 60) return WARN_YELLOW
  return FAIL_RED
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Needs Work'
  return 'Poor'
}

function statusColor(status: string) {
  if (status === 'pass') return PASS_GREEN
  if (status === 'warning') return WARN_YELLOW
  return FAIL_RED
}

function statusLabel(status: string) {
  if (status === 'pass') return 'PASS'
  if (status === 'warning') return 'WARNING'
  if (status === 'fail') return 'FAIL'
  return status.toUpperCase()
}

// Dimension explanations — what it means for a business owner
const DIMENSION_EXPLANATIONS: Record<string, string> = {
  technical_seo: 'Technical SEO determines how easily Google can find, read, and rank your website. Poor SEO means your business is invisible to potential customers searching online — even if your site looks great.',
  performance: 'Website performance affects how quickly your pages load. Studies show 53% of visitors abandon a site that takes more than 3 seconds to load, directly costing you customers and revenue.',
  security: 'A secure website (HTTPS) protects your visitors\' data and is a confirmed Google ranking factor. Sites without SSL are flagged as "Not Secure" by browsers, destroying visitor trust instantly.',
  mobile: 'Over 60% of all web traffic comes from mobile devices. A site that doesn\'t work properly on phones and tablets is turning away the majority of your potential customers.',
  accessibility: 'Web accessibility ensures all visitors — including those with disabilities — can use your site. It also directly improves SEO and protects against legal liability under accessibility laws.',
  ux_design: 'Clear content structure (headings, navigation, calls-to-action) guides visitors toward becoming customers. Poor UX means visitors leave without contacting you or making a purchase.',
  digital_footprint: 'Your digital footprint determines how your business appears when shared on social media. Proper Open Graph tags ensure your links look professional and compelling on Facebook, LinkedIn, and other platforms.',
  backlinks: 'Canonical URLs and proper crawlability signals tell Google which version of your content is authoritative. Without this, Google may penalise your site for "duplicate content" and rank it lower.',
}

// How Capital Consulting can help for each dimension
const DIMENSION_HOW_WE_HELP: Record<string, string[]> = {
  technical_seo: [
    'Full on-page SEO audit and optimisation of title tags, meta descriptions, and heading structure',
    'Keyword research and content strategy aligned with what your customers are actually searching for',
    'Monthly SEO reporting to track your rankings and organic traffic growth',
  ],
  performance: [
    'Image compression and conversion to modern formats (WebP) for 25-35% faster load times',
    'Implementation of lazy loading, browser caching, and CDN delivery',
    'Core Web Vitals optimisation to meet Google\'s performance benchmarks',
  ],
  security: [
    'SSL certificate installation and configuration with automatic renewal',
    'HSTS and security header implementation to protect against common attacks',
    'Ongoing security monitoring and vulnerability patching',
  ],
  mobile: [
    'Mobile-first redesign to ensure perfect experience across all screen sizes',
    'Touch target optimisation and mobile navigation improvements',
    'Testing across 20+ device and browser combinations',
  ],
  accessibility: [
    'WCAG 2.1 AA compliance audit and remediation',
    'Alt text optimisation for all images — improving both accessibility and SEO',
    'Keyboard navigation and screen reader compatibility improvements',
  ],
  ux_design: [
    'Content restructuring with clear H1/H2/H3 heading hierarchy',
    'Strategic call-to-action placement to increase conversions',
    'User journey mapping to guide visitors from landing to contact/purchase',
  ],
  digital_footprint: [
    'Full Open Graph and Twitter Card implementation for professional social sharing',
    'Google My Business optimisation and review management strategy',
    'Social media presence audit and improvement recommendations',
  ],
  backlinks: [
    'Canonical URL strategy to eliminate duplicate content issues',
    'Robots.txt and sitemap.xml creation and submission to Google Search Console',
    'Link building strategy to increase your site\'s domain authority',
  ],
}

const CHECK_LABELS: Record<string, string> = {
  meta_tags: 'Meta Tags & Page Title',
  image_optimization: 'Image Optimisation',
  ssl_certificate: 'SSL / HTTPS Security',
  mobile_viewport: 'Mobile Viewport',
  image_alt_text: 'Image Alt Text',
  heading_structure: 'Heading Structure',
  open_graph: 'Open Graph & Social Sharing',
  canonical_url: 'Canonical URL & Crawlability',
}

// ─── Components ───────────────────────────────────────────────────────────────

function PageHeader({ url }: { url: string }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.headerBrand}>Capital Consulting — Web Audit Report</Text>
      <Text style={s.headerUrl}>{url}</Text>
    </View>
  )
}

function PageFooter({ pageNum }: { pageNum?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Confidential — prepared by Capital Consulting</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function CheckDetail({ check }: { check: AuditCheck }) {
  const bg = check.status === 'pass' ? '#f0fdf4' : check.status === 'warning' ? '#fffbeb' : '#fef2f2'
  const borderColor = check.status === 'pass' ? '#bbf7d0' : check.status === 'warning' ? '#fde68a' : '#fecaca'
  const dimension = check.dimension
  const explanation = DIMENSION_EXPLANATIONS[dimension] ?? ''
  const howWeHelp = DIMENSION_HOW_WE_HELP[dimension] ?? []

  return (
    <View style={[s.checkCard, { backgroundColor: bg, borderWidth: 1, borderColor }]} wrap={false}>
      <View style={s.checkHeader}>
        <View style={[s.checkStatusDot, { backgroundColor: statusColor(check.status) }]} />
        <Text style={s.checkTitle}>{CHECK_LABELS[check.check_name] ?? check.check_name}</Text>
        <Text style={[s.checkScore, { color: scoreColor(check.score) }]}>{check.score}/100</Text>
        <Text style={[{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginLeft: 8, color: statusColor(check.status) }]}>
          {statusLabel(check.status)}
        </Text>
      </View>

      <View style={s.checkBody}>
        {/* What this means */}
        {explanation ? (
          <View style={s.explainBox}>
            <Text style={s.explainTitle}>What this means for your business</Text>
            <Text style={s.explainText}>{explanation}</Text>
          </View>
        ) : null}

        {/* Findings */}
        {check.findings?.details?.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.findingsTitle}>What we found</Text>
            {check.findings.details.map((d, i) => (
              <View key={i} style={s.findingItem}>
                <Text style={s.findingBullet}>•</Text>
                <Text style={s.findingText}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {check.findings?.recommendations?.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.recTitle}>Recommended fixes</Text>
            {check.findings.recommendations.map((r, i) => (
              <View key={i} style={s.recItem}>
                <Text style={s.recArrow}>→</Text>
                <Text style={s.recText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* How we can help */}
        {check.status !== 'pass' && howWeHelp.length > 0 && (
          <View style={{ backgroundColor: 'rgba(30,58,95,0.06)', borderRadius: 6, padding: 10, marginTop: 6 }}>
            <Text style={[s.recTitle, { marginTop: 0, color: NAVY }]}>How Capital Consulting can help</Text>
            {howWeHelp.map((h, i) => (
              <View key={i} style={s.recItem}>
                <Text style={[s.recArrow, { color: NAVY }]}>✓</Text>
                <Text style={[s.recText, { color: '#374151' }]}>{h}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Main PDF Document ────────────────────────────────────────────────────────

interface AuditReportProps {
  audit: WebAudit
  checks: AuditCheck[]
}

export function AuditReportDocument({ audit, checks }: AuditReportProps) {
  const score = audit.overall_score ?? 0
  const dimScores = getDimensionScores(checks)
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const businessName = audit.business_name ?? audit.url
  const url = audit.url

  // Group checks by dimension
  const checksByDim: Record<string, AuditCheck[]> = {}
  for (const check of checks) {
    if (!checksByDim[check.dimension]) checksByDim[check.dimension] = []
    checksByDim[check.dimension].push(check)
  }

  const passCount = checks.filter(c => c.status === 'pass').length
  const failCount = checks.filter(c => c.status === 'fail').length
  const warnCount = checks.filter(c => c.status === 'warning').length

  return (
    <Document title={`Web Audit — ${businessName}`} author="Capital Consulting">

      {/* ── Cover Page ── */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          {/* Logo */}
          <View style={s.coverLogo}>
            <View style={s.coverLogoBox}>
              <Text style={s.coverLogoText}>CC</Text>
            </View>
            <Text style={s.coverBrand}>Capital Consulting</Text>
          </View>

          {/* Main */}
          <View style={s.coverMain}>
            <Text style={s.coverTitle}>Website Audit Report</Text>
            <Text style={s.coverBusinessName}>{businessName}</Text>
            <Text style={s.coverUrl}>{url}</Text>

            <View style={s.coverScoreBox}>
              <Text style={[s.coverScoreNum, { color: scoreColor(score) }]}>{score}</Text>
              <View>
                <Text style={s.coverScoreLabel}>Overall Score</Text>
                <Text style={[s.coverScoreLabel, { color: scoreColor(score), fontFamily: 'Helvetica-Bold' }]}>
                  {scoreLabel(score)}
                </Text>
                <Text style={s.coverScoreSub}>out of 100</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 20, marginTop: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, backgroundColor: PASS_GREEN, borderRadius: 4 }} />
                <Text style={{ color: '#ffffff', fontSize: 11 }}>{passCount} Passed</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, backgroundColor: WARN_YELLOW, borderRadius: 4 }} />
                <Text style={{ color: '#ffffff', fontSize: 11 }}>{warnCount} Warnings</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, backgroundColor: FAIL_RED, borderRadius: 4 }} />
                <Text style={{ color: '#ffffff', fontSize: 11 }}>{failCount} Failed</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={s.coverFooter}>
            <Text style={s.coverDate}>Prepared on {date}</Text>
            <Text style={s.coverConfidential}>Confidential</Text>
          </View>
        </View>
      </Page>

      {/* ── Executive Summary ── */}
      <Page size="A4" style={s.page}>
        <PageHeader url={url} />
        <View style={s.body}>
          <Text style={s.sectionTitle}>Executive Summary</Text>
          <View style={s.divider} />
          <Text style={s.sectionSubtitle}>
            This report analyses {businessName}{"'"}s website across 8 critical dimensions that determine online visibility,
            user experience, and business performance. Each area is scored from 0–100, with specific findings and
            actionable recommendations to help you improve.
          </Text>

          {/* Score Cards */}
          <View style={s.summaryGrid}>
            {[
              { label: 'Overall Score', value: score, color: scoreColor(score) },
              { label: 'Checks Passed', value: passCount, color: PASS_GREEN },
              { label: 'Warnings', value: warnCount, color: WARN_YELLOW },
              { label: 'Issues Found', value: failCount, color: FAIL_RED },
            ].map(({ label, value, color }) => (
              <View key={label} style={s.summaryCard}>
                <Text style={[s.summaryCardScore, { color }]}>{value}</Text>
                <Text style={s.summaryCardLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Dimension Score Table */}
          <Text style={[s.findingsTitle, { marginBottom: 10 }]}>Score by Category</Text>
          {Object.entries(dimScores).map(([key, { score: dimScore, label }]) => {
            const dimChecks = checks.filter(c => c.dimension === key)
            if (dimChecks.length === 0) return null
            return (
              <View key={key} style={s.dimRow}>
                <Text style={s.dimLabel}>{label}</Text>
                <View style={s.dimBarWrap}>
                  <View style={[s.dimBar, { width: `${dimScore}%`, backgroundColor: scoreColor(dimScore) }]} />
                </View>
                <Text style={[s.dimScore, { color: scoreColor(dimScore) }]}>{dimScore}</Text>
                <Text style={[s.dimStatus, { color: scoreColor(dimScore) }]}>{scoreLabel(dimScore)}</Text>
              </View>
            )
          })}

          {/* Overall assessment */}
          <View style={{ marginTop: 24, backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 16 }}>
            <Text style={[s.findingsTitle, { marginBottom: 6 }]}>Overall Assessment</Text>
            <Text style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
              {score >= 80
                ? `${businessName}'s website performs well across most categories. Focus on the highlighted warnings to maintain a competitive edge and reach the top tier of online visibility.`
                : score >= 60
                ? `${businessName}'s website has a solid foundation but several areas need attention. Addressing the issues identified in this report will significantly improve search rankings, visitor experience, and conversions.`
                : `${businessName}'s website has significant opportunities for improvement. The issues identified in this report are likely costing you customers and revenue every day. Capital Consulting can help you address these systematically and efficiently.`
              }
            </Text>
          </View>
        </View>
        <PageFooter />
      </Page>

      {/* ── Detailed Check Pages ── */}
      {Object.entries(DIMENSIONS).map(([dimKey, dimLabel]) => {
        const dimChecks = checksByDim[dimKey]
        if (!dimChecks || dimChecks.length === 0) return null

        return (
          <Page key={dimKey} size="A4" style={s.page}>
            <PageHeader url={url} />
            <View style={s.body}>
              <Text style={s.sectionTitle}>{dimLabel}</Text>
              <View style={s.divider} />
              {dimChecks.map(check => (
                <CheckDetail key={check.check_name} check={check} />
              ))}
            </View>
            <PageFooter />
          </Page>
        )
      })}

      {/* ── Call to Action ── */}
      <Page size="A4" style={s.page}>
        <View style={s.ctaPage}>
          <Text style={s.ctaTitle}>Next Steps</Text>
          <Text style={s.ctaHeadline}>
            Ready to fix these issues and grow your online presence?
          </Text>
          <Text style={s.ctaBody}>
            Capital Consulting specialises in helping businesses like yours transform their online presence. We don{"'"}t
            just identify problems — we fix them. Our team of digital marketing and web development experts will work
            with you to implement every recommendation in this report, and then some.
          </Text>

          <Text style={[s.findingsTitle, { color: GOLD, marginBottom: 12 }]}>What we offer</Text>
          {[
            'SEO Strategy & Implementation — climb Google rankings and drive more organic traffic',
            'Website Performance Optimisation — faster sites that convert more visitors into customers',
            'Security Hardening — protect your business and your customers online',
            'Mobile Experience Redesign — capture the 60%+ of visitors browsing on mobile',
            'Content Strategy & Copywriting — messaging that resonates with your target audience',
            'Ongoing Monthly Reporting — track your progress with clear, actionable metrics',
          ].map((service, i) => (
            <View key={i} style={s.ctaService}>
              <View style={s.ctaDot} />
              <Text style={s.ctaServiceText}>{service}</Text>
            </View>
          ))}

          <View style={s.ctaContact}>
            <Text style={s.ctaContactTitle}>Get in touch</Text>
            <Text style={s.ctaContactText}>
              {'Contact us today for a free consultation. We\'ll walk you through this report,\nanswer your questions, and put together a custom plan to help your business grow online.'}
            </Text>
            <Text style={[s.ctaContactText, { marginTop: 16, color: GOLD, fontFamily: 'Helvetica-Bold' }]}>
              capitalconsulting.com
            </Text>
          </View>
        </View>
      </Page>

    </Document>
  )
}
