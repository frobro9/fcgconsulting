/**
 * Per-retailer knowledge:
 *  - `toApi` rewrites a human product-page URL to the store's JSON price
 *    endpoint (usually not bot-blocked, no scraper key needed).
 *  - `selector` is a default price selector applied when the user leaves the
 *    selector field blank (for stores with no structured price data).
 * Add a rule to support another site.
 */

type SiteRule = {
  name: string
  match: RegExp
  toApi?: (m: RegExpMatchArray) => string
  selector?: string
}

const RULES: SiteRule[] = [
  {
    name: 'Best Buy Canada',
    // …/product/<slug>/<sku>  (sku = trailing digits)
    match: /^https?:\/\/(?:www\.)?bestbuy\.ca\/.+?\/(\d{6,})(?:[/?#]|$)/i,
    toApi: (m) => `https://www.bestbuy.ca/api/offers/v1/products/${m[1]}/offers`,
  },
  {
    name: 'Amazon',
    // any amazon.<tld> product page (/dp/… or /gp/product/…)
    match: /^https?:\/\/(?:www\.)?amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product)\//i,
    selector:
      '#corePriceDisplay_desktop_feature_div .a-offscreen, ' +
      '#corePrice_feature_div .a-offscreen, ' +
      '#priceblock_ourprice, #priceblock_dealprice, #priceblock_saleprice, ' +
      '#price_inside_buybox, #tp_price_block_total_price_ww .a-offscreen, ' +
      '.a-price .a-offscreen',
  },
]

/**
 * If `url` is a recognized retailer product page with a JSON price endpoint,
 * return that endpoint; otherwise return `url` unchanged. URLs already pointing
 * at an `/api/` path are left alone.
 */
export function toApiUrl(url: string): string {
  const trimmed = url.trim()
  if (/\/api\//i.test(trimmed)) return trimmed
  for (const rule of RULES) {
    const m = rule.toApi && trimmed.match(rule.match)
    if (m) return rule.toApi!(m)
  }
  return trimmed
}

/** A built-in price selector for known stores that lack structured data. */
export function defaultSelector(url: string): string | null {
  const trimmed = url.trim()
  for (const rule of RULES) {
    if (rule.selector && rule.match.test(trimmed)) return rule.selector
  }
  return null
}
