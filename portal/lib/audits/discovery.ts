export interface DiscoveredBusiness {
  url: string
  business_name: string
  snippet?: string
}

/**
 * Search Google Custom Search API for businesses matching a type and location.
 * Returns a list of discovered business websites.
 *
 * Requires env vars:
 *   GOOGLE_CSE_API_KEY   — Google Custom Search API key
 *   GOOGLE_CSE_ID        — Custom Search Engine ID
 */
export async function discoverBusinessWebsites(
  businessType: string,
  location: string,
  limit = 10
): Promise<DiscoveredBusiness[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cseId = process.env.GOOGLE_CSE_ID

  if (!apiKey || !cseId) {
    throw new Error(
      'Google Custom Search is not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID environment variables.'
    )
  }

  const query = `${businessType} in ${location}`
  const results: DiscoveredBusiness[] = []
  const seenDomains = new Set<string>()

  // Google CSE returns max 10 per page; paginate if needed
  const pages = Math.ceil(Math.min(limit, 100) / 10)

  for (let page = 0; page < pages && results.length < limit; page++) {
    const start = page * 10 + 1
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&start=${start}&num=10`

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Google API error: ${resp.status}`)
      }

      const data = await resp.json()
      const items: any[] = data.items ?? []

      for (const item of items) {
        if (results.length >= limit) break

        const siteUrl: string = item.link ?? ''
        const domain = extractDomain(siteUrl)

        // Skip if we already have this domain
        if (!domain || seenDomains.has(domain)) continue
        seenDomains.add(domain)

        // Skip irrelevant aggregators / directories
        if (isAggregatorDomain(domain)) continue

        results.push({
          url: normalizeUrl(siteUrl),
          business_name: item.title ?? domain,
          snippet: item.snippet,
        })
      }
    } catch (err) {
      // Stop pagination on API error
      throw err
    }
  }

  return results
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Return just the origin (no path) to audit the homepage
    return u.origin
  } catch {
    return url
  }
}

// Common aggregator/directory domains to skip
const AGGREGATOR_DOMAINS = [
  'yelp.com', 'tripadvisor.com', 'yellowpages.com', 'bbb.org',
  'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
  'google.com', 'maps.google.com', 'nextdoor.com', 'angi.com',
  'thumbtack.com', 'houzz.com', 'zomato.com', 'doordash.com',
  'ubereats.com', 'grubhub.com', 'opentable.com', 'foursquare.com',
  'mapquest.com', 'whitepages.com', 'manta.com', 'citysearch.com',
  'superpages.com', 'merchantcircle.com',
]

function isAggregatorDomain(domain: string): boolean {
  return AGGREGATOR_DOMAINS.some(agg => domain === agg || domain.endsWith(`.${agg}`))
}
