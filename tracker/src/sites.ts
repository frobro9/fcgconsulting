/**
 * Known-retailer URL rewrites: turn a human product-page URL into the store's
 * own JSON price endpoint, which is usually not bot-blocked and needs no
 * scraper key. Add a rule here to support another site.
 */

type SiteRule = {
  name: string
  /** Matches a product-page URL; capture groups feed `toApi`. */
  match: RegExp
  toApi: (m: RegExpMatchArray) => string
}

const RULES: SiteRule[] = [
  {
    name: 'Best Buy Canada',
    // …/product/<slug>/<sku>  (sku = trailing digits)
    match: /^https?:\/\/(?:www\.)?bestbuy\.ca\/.+?\/(\d{6,})(?:[/?#]|$)/i,
    toApi: (m) => `https://www.bestbuy.ca/api/offers/v1/products/${m[1]}/offers`,
  },
]

/**
 * If `url` is a recognized retailer product page, return its JSON price API
 * URL; otherwise return `url` unchanged. URLs already pointing at an `/api/`
 * path are left alone.
 */
export function toApiUrl(url: string): string {
  const trimmed = url.trim()
  if (/\/api\//i.test(trimmed)) return trimmed
  for (const rule of RULES) {
    const m = trimmed.match(rule.match)
    if (m) return rule.toApi(m)
  }
  return trimmed
}
