import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'
import type { Bindings } from './types'

type AlertInput = {
  label: string
  kind: 'flight' | 'item'
  url: string
  oldPrice: number
  newPrice: number
  currency: string
}

export async function sendPriceAlert(env: Bindings, a: AlertInput): Promise<void> {
  const drop = a.oldPrice - a.newPrice
  const pct = a.oldPrice > 0 ? Math.round((drop / a.oldPrice) * 100) : 0
  const money = (n: number) => `${a.currency} ${n.toFixed(2)}`
  const subject = `Price drop: ${a.label} — now ${money(a.newPrice)}`

  const text =
    `${a.label} (${a.kind}) dropped from ${money(a.oldPrice)} to ${money(a.newPrice)}` +
    ` — down ${money(drop)} (${pct}%).\n\n${a.url}\n`

  const htmlBody = `
    <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="margin:0 0 4px">Price drop</h2>
      <p style="color:#555;margin:0 0 16px">${escapeHtml(a.label)} &middot; ${a.kind}</p>
      <p style="font-size:18px;margin:0 0 4px">
        <span style="text-decoration:line-through;color:#999">${money(a.oldPrice)}</span>
        &nbsp;&rarr;&nbsp;
        <strong style="color:#137333">${money(a.newPrice)}</strong>
      </p>
      <p style="color:#137333;margin:0 0 20px">Down ${money(drop)} (${pct}%)</p>
      <p><a href="${escapeHtml(a.url)}"
            style="background:#1e3a5f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">
        View it
      </a></p>
      <p style="color:#999;font-size:12px;margin-top:24px">Automated alert from the FCG price tracker.</p>
    </div>`

  const msg = createMimeMessage()
  msg.setSender({ addr: env.ALERT_FROM, name: 'FCG Price Tracker' })
  msg.setRecipient(env.ALERT_TO)
  msg.setSubject(subject)
  msg.addMessage({ contentType: 'text/plain', data: text })
  msg.addMessage({ contentType: 'text/html', data: htmlBody })

  const email = new EmailMessage(env.ALERT_FROM, env.ALERT_TO, msg.asRaw())
  await env.EMAIL.send(email)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
