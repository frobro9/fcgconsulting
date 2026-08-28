export type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  EMAIL: SendEmail

  // vars
  ALERT_FROM: string
  ALERT_TO: string
  SCRAPER_API_PROVIDER?: string
  SCRAPER_ACCOUNT_ID?: string
  SCRAPER2_PROVIDER?: string

  // secrets
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  SESSION_SECRET: string
  CRON_TOKEN?: string
  SCRAPER_API_KEY?: string
  SCRAPER2_KEY?: string
  RESEND_API_KEY?: string
}

export type TrackerKind = 'flight' | 'item'
export type CheckStatus = 'ok' | 'error'

export type Tracker = {
  id: string
  kind: TrackerKind
  label: string
  url: string
  price_selector: string | null
  currency: string
  target_price: number | null
  baseline_price: number | null
  last_price: number | null
  last_checked_at: string | null
  last_status: 'pending' | 'ok' | 'error'
  last_error: string | null
  active: number
  interval_hours: number
  created_at: string
}

export type TrackerCheck = {
  id: string
  tracker_id: string
  price: number | null
  currency: string | null
  status: CheckStatus
  error: string | null
  notified: number
  checked_at: string
}

export type PriceResult =
  | { ok: true; price: number; currency: string }
  | { ok: false; error: string }
