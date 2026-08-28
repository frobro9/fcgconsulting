import { Hono } from 'hono'
import { endSession, hasValidSession, requireAuth, startSession, validCredentials } from './auth'
import { checkTracker } from './check'
import {
  createTracker,
  deleteTracker,
  dueTrackers,
  getRecentChecks,
  getTracker,
  listTrackers,
  updateTracker,
  type NewTracker,
  type TrackerUpdate,
} from './db'
import { toApiUrl } from './sites'
import type { Bindings } from './types'
import { detailPage, listPage, loginPage, newTrackerPage } from './views'

const app = new Hono<{ Bindings: Bindings }>()

/* ----------------------------------- auth ---------------------------------- */

app.get('/', (c) => c.redirect('/trackers'))

app.get('/login', async (c) => {
  if (await hasValidSession(c)) return c.redirect('/trackers')
  return c.html(loginPage())
})

app.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const username = String(body.username ?? '')
  const password = String(body.password ?? '')
  if (!validCredentials(c.env, username, password)) {
    return c.html(loginPage('Incorrect username or password.'), 401)
  }
  await startSession(c, username)
  return c.redirect('/trackers')
})

app.post('/logout', (c) => {
  endSession(c)
  return c.redirect('/login')
})

/* --------------------------------- trackers -------------------------------- */

app.use('/trackers', requireAuth)
app.use('/trackers/*', requireAuth)

app.get('/trackers', async (c) => c.html(listPage(await listTrackers(c.env.DB))))

app.get('/trackers/new', (c) => c.html(newTrackerPage()))

app.post('/trackers', async (c) => {
  const form = await c.req.parseBody()
  const parsed = parseTrackerForm(form)
  if ('error' in parsed) {
    return c.html(newTrackerPage(parsed.error, parsed.values), 400)
  }
  const id = await createTracker(c.env.DB, parsed.value as NewTracker)
  return c.redirect(`/trackers/${id}`)
})

app.get('/trackers/:id', async (c) => {
  const t = await getTracker(c.env.DB, c.req.param('id'))
  if (!t) return c.notFound()
  const checks = await getRecentChecks(c.env.DB, t.id, 30)
  const url = new URL(c.req.url)
  return c.html(
    detailPage(t, checks, {
      error: url.searchParams.get('error') ?? undefined,
      notice: url.searchParams.get('notice') ?? undefined,
    }),
  )
})

app.post('/trackers/:id', async (c) => {
  const id = c.req.param('id')
  const t = await getTracker(c.env.DB, id)
  if (!t) return c.notFound()
  const form = await c.req.parseBody()
  const parsed = parseTrackerForm(form, true)
  if ('error' in parsed) {
    const checks = await getRecentChecks(c.env.DB, id, 30)
    return c.html(detailPage(t, checks, { error: parsed.error }), 400)
  }
  await updateTracker(c.env.DB, id, parsed.value as TrackerUpdate)
  return c.redirect(`/trackers/${id}`)
})

app.post('/trackers/:id/delete', async (c) => {
  await deleteTracker(c.env.DB, c.req.param('id'))
  return c.redirect('/trackers')
})

app.post('/trackers/:id/check', async (c) => {
  const t = await getTracker(c.env.DB, c.req.param('id'))
  if (!t) return c.notFound()
  const outcome = await checkTracker(c.env, t)
  const q =
    outcome.status === 'ok'
      ? `notice=${encodeURIComponent(
          `Checked: ${outcome.price ?? '—'} ${t.currency}${outcome.alerted ? ' — alert emailed' : ''}`,
        )}`
      : `error=${encodeURIComponent(outcome.error ?? 'Check failed')}`
  return c.redirect(`/trackers/${t.id}?${q}`)
})

/* ----------------------------------- cron --------------------------------- */

app.post('/cron/run', async (c) => {
  const token = c.env.CRON_TOKEN
  if (token && c.req.header('authorization') !== `Bearer ${token}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const summary = await runDueChecks(c.env)
  return c.json(summary)
})

async function runDueChecks(env: Bindings) {
  const due = await dueTrackers(env.DB, 50)
  let ok = 0
  let failed = 0
  let alerted = 0
  for (const t of due) {
    try {
      const r = await checkTracker(env, t)
      if (r.status === 'ok') ok++
      else failed++
      if (r.alerted) alerted++
    } catch (err) {
      failed++
      console.error(`checkTracker ${t.id} threw:`, err)
    }
  }
  const summary = { due: due.length, ok, failed, alerted }
  console.log('[cron] price checks', JSON.stringify(summary))
  return summary
}

/* --------------------------------- helpers -------------------------------- */

function str(body: Record<string, unknown>, key: string): string {
  const v = body[key]
  return typeof v === 'string' ? v.trim() : ''
}

function numOrNull(raw: string): number | null {
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseTrackerForm(
  body: Record<string, unknown>,
  withActive = false,
):
  | { value: NewTracker | TrackerUpdate }
  | { error: string; values: FormEcho } {
  const kindRaw = str(body, 'kind')
  const kind: 'flight' | 'item' = kindRaw === 'flight' ? 'flight' : 'item'
  const label = str(body, 'label')
  // Rewrite recognized retailer product pages to their JSON price API.
  const url = toApiUrl(str(body, 'url'))
  const selectorRaw = str(body, 'price_selector')
  const currency = (str(body, 'currency') || 'CAD').toUpperCase().slice(0, 3)
  const target_price = numOrNull(str(body, 'target_price'))
  const intervalRaw = Number(str(body, 'interval_hours'))
  const interval_hours =
    Number.isFinite(intervalRaw) && intervalRaw >= 1
      ? Math.min(Math.floor(intervalRaw), 168)
      : 6
  const active = body['active'] ? 1 : 0

  const echo: FormEcho = {
    kind,
    label,
    url,
    price_selector: selectorRaw,
    currency,
    target_price,
    interval_hours,
    ...(withActive ? { active } : {}),
  }

  if (!label) return { error: 'Label is required.', values: echo }
  if (!/^https?:\/\/.+/i.test(url)) return { error: 'Enter a valid http(s) URL.', values: echo }

  const base = {
    kind,
    label,
    url,
    price_selector: selectorRaw || null,
    currency,
    target_price,
    interval_hours,
  }
  return { value: withActive ? { ...base, active } : base }
}

type FormEcho = {
  kind: 'flight' | 'item'
  label: string
  url: string
  price_selector: string
  currency: string
  target_price: number | null
  interval_hours: number
  active?: number
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runDueChecks(env))
  },
}
