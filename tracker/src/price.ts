import { parse, type HTMLElement } from 'node-html-parser'
import type { Bindings, PriceResult } from './types'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Fetch the page HTML. If SCRAPER_API_KEY is set, route through a JS-rendering
 * scraping API (default provider: ScrapingBee); otherwise a plain fetch with a
 * realistic browser User-Agent.
 */
export async function fetchHtml(
  url: string,
  env: Bindings,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  try {
    if (env.SCRAPER_API_KEY) {
      const provider = env.SCRAPER_API_PROVIDER || 'scrapingbee'
      const endpoint = buildScraperUrl(provider, url, env.SCRAPER_API_KEY)
      if (!endpoint) return { ok: false, error: `Unknown SCRAPER_API_PROVIDER "${provider}"` }
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(45_000) })
      if (!res.ok) {
        return { ok: false, error: `Scraper API responded ${res.status}` }
      }
      return { ok: true, html: await res.text() }
    }

    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'User-Agent': DESKTOP_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `Site responded ${res.status}${
          res.status === 403 || res.status === 429
            ? ' (bot-blocked — set SCRAPER_API_KEY to use a rendering scraper)'
            : ''
        }`,
      }
    }
    return { ok: true, html: await res.text() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Fetch failed: ${msg}` }
  }
}

function buildScraperUrl(provider: string, target: string, key: string): string | null {
  const u = encodeURIComponent(target)
  switch (provider) {
    case 'scrapingbee':
      return `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${u}&render_js=true`
    case 'scraperapi':
      return `https://api.scraperapi.com/?api_key=${key}&url=${u}&render=true`
    case 'scrapingant':
      return `https://api.scrapingant.com/v2/general?url=${u}&x-api-key=${key}&browser=true`
    default:
      return null
  }
}

/**
 * Extract a price from HTML. Uses the CSS selector when provided; otherwise
 * falls back to JSON-LD Product/Offer data embedded in the page.
 */
export function parsePrice(
  htmlText: string,
  selector: string | null,
  fallbackCurrency: string,
): PriceResult {
  let root: HTMLElement
  try {
    root = parse(htmlText)
  } catch {
    return { ok: false, error: 'Could not parse page HTML' }
  }

  if (selector) {
    const el = root.querySelector(selector)
    if (!el) return { ok: false, error: `Selector "${selector}" matched nothing on the page` }
    const text = el.getAttribute('content') || el.text || ''
    const parsed = normalisePrice(text)
    if (parsed == null) {
      return { ok: false, error: `No number found in "${text.trim().slice(0, 80)}"` }
    }
    return { ok: true, price: parsed, currency: detectCurrency(text) || fallbackCurrency }
  }

  const ld = priceFromJsonLd(root)
  if (ld) return { ok: true, price: ld.price, currency: ld.currency || fallbackCurrency }

  return {
    ok: false,
    error: 'No price selector set and no JSON-LD offer found — add a CSS selector for the price',
  }
}

function priceFromJsonLd(root: HTMLElement): { price: number; currency: string | null } | null {
  const blocks = root.querySelectorAll('script[type="application/ld+json"]')
  for (const block of blocks) {
    let data: unknown
    try {
      data = JSON.parse(block.text)
    } catch {
      continue
    }
    const hit = searchOffer(data)
    if (hit) return hit
  }
  return null
}

function searchOffer(node: unknown, depth = 0): { price: number; currency: string | null } | null {
  if (depth > 6 || node == null) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = searchOffer(item, depth + 1)
      if (hit) return hit
    }
    return null
  }
  if (typeof node !== 'object') return null
  const obj = node as Record<string, unknown>

  const rawPrice =
    obj.price ??
    obj.lowPrice ??
    (obj.priceSpecification as Record<string, unknown> | undefined)?.price
  if (rawPrice != null) {
    const price = normalisePrice(String(rawPrice))
    if (price != null) {
      const currency =
        asString(obj.priceCurrency) ??
        asString((obj.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency) ??
        null
      return { price, currency }
    }
  }

  for (const key of ['offers', 'aggregateOffer', 'aggregateOffers', '@graph', 'itemListElement']) {
    if (key in obj) {
      const hit = searchOffer(obj[key], depth + 1)
      if (hit) return hit
    }
  }
  return null
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Turn "£1,299.00", "1.299,00 €", "USD 1299" into 1299.0. */
export function normalisePrice(input: string): number | null {
  const match = input.replace(/\s/g, '').match(/-?\d[\d.,]*\d|\d/)
  if (!match) return null
  let s = match[0]

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // The right-most separator is the decimal separator.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    // "1,23" -> decimal; "1,234" or "1,234,567" -> thousands
    s = parts[parts.length - 1].length === 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length > 2) s = s.replace(/\./g, '') // 1.234.567 -> thousands
  }

  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function detectCurrency(text: string): string | null {
  if (/\bUSD\b|\bUS\$|\$US/i.test(text)) return 'USD'
  if (/\bCAD\b|\bC\$|\$CAD|\bCA\$/i.test(text)) return 'CAD'
  if (/\bEUR\b|€/i.test(text)) return 'EUR'
  if (/\bGBP\b|£/i.test(text)) return 'GBP'
  if (/\bAUD\b|\bA\$/i.test(text)) return 'AUD'
  if (/\$/.test(text)) return null // ambiguous — let the tracker's currency win
  return null
}
