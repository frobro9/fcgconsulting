export type CheckStatus = 'pass' | 'fail' | 'warning' | 'error'
export type AuditStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
export type TargetStatus = 'pending' | 'auditing' | 'completed' | 'failed' | 'skipped'

export interface CheckFindings {
  title: string
  details: string[]
  recommendations: string[]
}

export interface CheckResult {
  status: CheckStatus
  score: number        // 0-100
  findings: CheckFindings
}

export interface AuditCheck {
  id: string
  audit_id: string
  check_name: string
  dimension: string
  status: CheckStatus | 'pending'
  score: number
  findings: CheckFindings
  completed_at: string | null
}

export interface WebAudit {
  id: string
  target_id: string | null
  url: string
  business_name: string | null
  status: AuditStatus
  overall_score: number | null
  progress_pct: number
  created_at: string
  completed_at: string | null
  audit_checks?: AuditCheck[]
}

export interface AuditTarget {
  id: string
  url: string
  business_name: string | null
  business_type: string | null
  location: string | null
  status: TargetStatus
  discovered_at: string
  audited_at: string | null
  audit_id: string | null
}

// The 8 audit dimensions
export const DIMENSIONS = {
  technical_seo: 'Technical SEO',
  performance: 'Performance',
  security: 'Security',
  mobile: 'Mobile',
  accessibility: 'Accessibility',
  ux_design: 'UX & Design',
  digital_footprint: 'Digital Footprint',
  backlinks: 'Backlinks & Canonicalization',
} as const

export type DimensionKey = keyof typeof DIMENSIONS

// Check definitions: check_name → dimension (16 total)
export const CHECK_DIMENSIONS: Record<string, DimensionKey> = {
  // Technical SEO (3)
  meta_tags:          'technical_seo',
  robots_txt:         'technical_seo',
  sitemap_xml:        'technical_seo',
  // Performance (2 — PSI real score + static fallback)
  page_speed:         'performance',
  image_optimization: 'performance',
  // Security (2)
  ssl_certificate:    'security',
  security_headers:   'security',
  // Mobile (1)
  mobile_viewport:    'mobile',
  // Accessibility (2 — PSI real score + static)
  psi_accessibility:  'accessibility',
  image_alt_text:     'accessibility',
  // UX & Design (2)
  heading_structure:  'ux_design',
  contact_info:       'ux_design',
  // Digital Footprint (2)
  open_graph:         'digital_footprint',
  schema_markup:      'digital_footprint',
  // Backlinks (2)
  canonical_url:      'backlinks',
  social_links:       'backlinks',
}

export const TOTAL_CHECKS = Object.keys(CHECK_DIMENSIONS).length // 16

export const BUSINESS_TYPES = [
  'Restaurant',
  'Retail Store',
  'Law Firm',
  'Medical Practice',
  'Dental Office',
  'Real Estate Agency',
  'Accounting Firm',
  'Auto Dealer',
  'Hotel / Hospitality',
  'Gym / Fitness',
  'Beauty Salon / Spa',
  'Construction / Contractor',
  'Plumbing / HVAC',
  'Marketing Agency',
  'Financial Advisor',
  'Insurance Agency',
  'Other',
]
