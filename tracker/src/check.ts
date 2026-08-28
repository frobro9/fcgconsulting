import { applyCheckToTracker, recordCheck } from './db'
import { sendPriceAlert } from './email'
import { fetchContent, parsePrice, renderTierConfigured } from './price'
import { defaultSelector } from './sites'
import type { Bindings, PriceResult, Tracker } from './types'

export type CheckOutcome = {
  trackerId: string
  label: string
  status: 'ok' | 'error'
  price: number | null
  error: string | null
  alerted: boolean
}

/**
 * Check one tracker: fetch + parse its price, record the check, update the
 * tracker, and email an alert when the price has dropped.
 *
 * Alert rules (only when a numeric price was read):
 *  - first successful read  -> store as baseline, no email
 *  - target_price set        -> alert when price <= target AND price < baseline
 *  - no target_price         -> alert when price < baseline
 * After an alert the baseline is lowered to the new price, so repeat alerts
 * only fire on a further drop.
 */
async function readPrice(env: Bindings, t: Tracker): Promise<PriceResult> {
  const selector = t.price_selector || defaultSelector(t.url)
  const parse = (body: string) => parsePrice(body, selector, t.currency)

  // 1. Plain fetch.
  let f = await fetchContent(t.url, env, 'plain')
  let r: PriceResult = f.ok ? parse(f.body) : { ok: false, error: f.error }
  if (r.ok) return r

  // 2. Render tier 1 (Cloudflare Browser Rendering by default).
  if (renderTierConfigured(env, 1)) {
    f = await fetchContent(t.url, env, 'render1')
    r = f.ok ? parse(f.body) : { ok: false, error: f.error }
    if (r.ok) return r
  }

  // 3. Render tier 2 (residential-proxy scraper — Amazon-class sites).
  if (renderTierConfigured(env, 2)) {
    f = await fetchContent(t.url, env, 'render2')
    r = f.ok ? parse(f.body) : { ok: false, error: f.error }
  }

  return r
}

export async function checkTracker(env: Bindings, t: Tracker): Promise<CheckOutcome> {
  const result = await readPrice(env, t)

  if (!result.ok) {
    await recordCheck(env.DB, {
      tracker_id: t.id,
      price: null,
      currency: null,
      status: 'error',
      error: result.error,
      notified: false,
    })
    await applyCheckToTracker(env.DB, t.id, {
      last_price: t.last_price,
      last_status: 'error',
      last_error: result.error,
    })
    return {
      trackerId: t.id,
      label: t.label,
      status: 'error',
      price: null,
      error: result.error,
      alerted: false,
    }
  }

  const price = result.price
  const currency = result.currency
  const baseline = t.baseline_price

  let shouldAlert = false
  let newBaseline: number | null = baseline

  if (baseline == null) {
    newBaseline = price
  } else if (price < baseline) {
    shouldAlert = t.target_price == null ? true : price <= t.target_price
  }

  let alerted = false
  if (shouldAlert) {
    try {
      await sendPriceAlert(env, {
        label: t.label,
        kind: t.kind,
        url: t.url,
        oldPrice: baseline as number,
        newPrice: price,
        currency,
      })
      alerted = true
      newBaseline = price
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await recordCheck(env.DB, {
        tracker_id: t.id,
        price,
        currency,
        status: 'error',
        error: `Price read OK but alert email failed: ${msg}`,
        notified: false,
      })
      await applyCheckToTracker(env.DB, t.id, {
        last_price: price,
        last_status: 'error',
        last_error: `Alert email failed: ${msg}`,
      })
      return {
        trackerId: t.id,
        label: t.label,
        status: 'error',
        price,
        error: `Alert email failed: ${msg}`,
        alerted: false,
      }
    }
  }

  await recordCheck(env.DB, {
    tracker_id: t.id,
    price,
    currency,
    status: 'ok',
    error: null,
    notified: alerted,
  })
  await applyCheckToTracker(env.DB, t.id, {
    last_price: price,
    last_status: 'ok',
    last_error: null,
    baseline_price: newBaseline,
  })

  return { trackerId: t.id, label: t.label, status: 'ok', price, error: null, alerted }
}
