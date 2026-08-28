import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Tracker, TrackerCheck } from './types'

type Html = HtmlEscapedString | Promise<HtmlEscapedString>

function layout(title: string, body: Html | Html[], opts: { signedIn?: boolean } = {}): Html {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>${title} · Camify</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header class="topbar">
          <a class="brand" href="/trackers">Camify</a>
          ${opts.signedIn !== false
            ? html`<form method="post" action="/logout"><button class="link">Sign out</button></form>`
            : ''}
        </header>
        <main>${body}</main>
      </body>
    </html>`
}

export function loginPage(error?: string): Html {
  return layout(
    'Sign in',
    html`<div class="card narrow">
      <h1>Sign in</h1>
      ${error ? html`<p class="error">${error}</p>` : ''}
      <form method="post" action="/login" class="stack">
        <label>Username<input name="username" autocomplete="username" required autofocus /></label>
        <label>Password
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button class="primary" type="submit">Sign in</button>
      </form>
    </div>`,
    { signedIn: false },
  )
}

const money = (n: number | null | undefined, ccy: string | null | undefined) =>
  n == null ? '—' : `${ccy || ''} ${n.toFixed(2)}`.trim()

const when = (iso: string | null) => {
  if (!iso) return 'never'
  const d = new Date(iso.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-CA')
}

const statusBadge = (s: string): Html =>
  html`<span class="badge badge-${s}">${s}</span>`

type FormValues = {
  kind?: Tracker['kind']
  label?: string
  url?: string
  price_selector?: string | null
  currency?: string
  target_price?: number | null
  interval_hours?: number
  active?: number
}

/** Shared form fields for both the "new" and "edit" forms. */
function trackerFormFields(
  action: string,
  submitLabel: string,
  v: FormValues,
  showActive: boolean,
): Html {
  const kind = v.kind ?? 'item'
  return html`<form method="post" action="${action}" class="stack">
    <label>Kind
      <select name="kind">
        <option value="item" ${kind === 'item' ? 'selected' : ''}>Item / product page</option>
        <option value="flight" ${kind === 'flight' ? 'selected' : ''}>Flight (Kiwi.com)</option>
      </select>
    </label>
    <label>Label
      <input name="label" required value="${v.label ?? ''}" placeholder="e.g. YOW→LIS Mar 2027" />
    </label>
    <label>URL
      <input name="url" type="url" required value="${v.url ?? ''}" placeholder="https://…" />
    </label>
    <label>Price selector <span class="muted">(blank = auto-detect)</span>
      <input name="price_selector" value="${v.price_selector ?? ''}" placeholder=".price  ·  or a JSON path: 0.salePrice" />
    </label>
    <p class="hint">
      HTML page: a CSS selector (right-click the price → Inspect → Copy → Copy selector), or blank
      to read JSON-LD. JSON API URL: a field path like <code>0.salePrice</code> or
      <code>data.price</code>, or blank to auto-detect. Retail sites often block plain requests —
      a store's own product/offers API URL usually works without a scraper key.
    </p>
    <div class="two">
      <label>Currency<input name="currency" value="${v.currency ?? 'CAD'}" maxlength="3" /></label>
      <label>Target price <span class="muted">(optional)</span>
        <input name="target_price" type="number" step="0.01" min="0" value="${v.target_price ?? ''}" />
      </label>
    </div>
    <label>Check every (hours)
      <input name="interval_hours" type="number" min="1" max="168" value="${v.interval_hours ?? 6}" />
    </label>
    ${showActive
      ? html`<label class="checkbox">
          <input type="checkbox" name="active" value="1" ${v.active ? 'checked' : ''} /> Active
        </label>`
      : ''}
    <button class="primary" type="submit">${submitLabel}</button>
  </form>`
}

export function newTrackerPage(error?: string, values?: FormValues): Html {
  return layout(
    'Add tracker',
    html`<div class="card">
      <p><a href="/trackers">&larr; Back</a></p>
      <h1>Add tracker</h1>
      ${error ? html`<p class="error">${error}</p>` : ''}
      ${trackerFormFields('/trackers', 'Create tracker', values ?? {}, false)}
    </div>`,
  )
}

export function listPage(trackers: Tracker[]): Html {
  const rows = trackers.map(
    (t) => html`<tr>
      <td><a href="/trackers/${t.id}">${t.label}</a></td>
      <td>${t.kind}</td>
      <td>${money(t.last_price, t.currency)}</td>
      <td>${t.target_price == null ? '—' : money(t.target_price, t.currency)}</td>
      <td>${statusBadge(t.active ? t.last_status : 'paused')}</td>
      <td class="muted">${when(t.last_checked_at)}</td>
    </tr>`,
  )

  return layout(
    'Trackers',
    html`<div class="row-between">
        <h1>Trackers</h1>
        <a class="button primary" href="/trackers/new">Add tracker</a>
      </div>
      ${trackers.length === 0
        ? html`<p class="muted">Nothing tracked yet.</p>`
        : html`<table class="grid">
            <thead>
              <tr><th>Label</th><th>Kind</th><th>Last price</th><th>Target</th><th>Status</th><th>Checked</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>`}`,
  )
}

export function detailPage(
  t: Tracker,
  checks: TrackerCheck[],
  opts: { error?: string; notice?: string } = {},
): Html {
  const checkRows = checks.map(
    (c) => html`<tr>
      <td class="muted">${when(c.checked_at)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${money(c.price, c.currency)}</td>
      <td>${c.notified ? '✔ emailed' : ''}</td>
      <td class="muted small">${c.error ?? ''}</td>
    </tr>`,
  )

  return layout(
    t.label,
    html`<p><a href="/trackers">&larr; All trackers</a></p>
      <div class="row-between">
        <h1>${t.label}</h1>
        <form method="post" action="/trackers/${t.id}/check">
          <button class="button">Check now</button>
        </form>
      </div>
      ${opts.error ? html`<p class="error">${opts.error}</p>` : ''}
      ${opts.notice ? html`<p class="notice">${opts.notice}</p>` : ''}

      <table class="kv">
        <tr><th>Kind</th><td>${t.kind}</td></tr>
        <tr><th>URL</th><td><a href="${t.url}" target="_blank" rel="noreferrer noopener">${t.url}</a></td></tr>
        <tr><th>Last price</th><td>${money(t.last_price, t.currency)}</td></tr>
        <tr><th>Baseline</th><td>${money(t.baseline_price, t.currency)}</td></tr>
        <tr><th>Target</th><td>${t.target_price == null ? '—' : money(t.target_price, t.currency)}</td></tr>
        <tr><th>Status</th><td>${statusBadge(t.active ? t.last_status : 'paused')} ${
          t.last_error ? html`<span class="muted small">${t.last_error}</span>` : ''
        }</td></tr>
        <tr><th>Last checked</th><td class="muted">${when(t.last_checked_at)}</td></tr>
      </table>

      <h2>Edit</h2>
      ${trackerFormFields(
        `/trackers/${t.id}`,
        'Save changes',
        {
          kind: t.kind,
          label: t.label,
          url: t.url,
          price_selector: t.price_selector ?? '',
          currency: t.currency,
          target_price: t.target_price,
          interval_hours: t.interval_hours,
          active: t.active,
        },
        true,
      )}

      <h2>Recent checks</h2>
      ${checks.length === 0
        ? html`<p class="muted">No checks yet.</p>`
        : html`<table class="grid">
            <thead><tr><th>When</th><th>Status</th><th>Price</th><th></th><th>Note</th></tr></thead>
            <tbody>
              ${checkRows}
            </tbody>
          </table>`}

      <h2 class="danger-h">Danger zone</h2>
      <form method="post" action="/trackers/${t.id}/delete"
            onsubmit="return confirm('Delete this tracker and its history?')">
        <button class="danger">Delete tracker</button>
      </form>`,
  )
}
