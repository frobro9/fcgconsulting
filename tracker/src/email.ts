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
  const html = buildHtml(a, money, drop, pct)

  // Prefer Resend when a key is set (no MX / DNS changes needed). Otherwise use
  // the Cloudflare Email Routing send_email binding.
  if (env.RESEND_API_KEY) {
    await sendViaResend(env, { subject, text, html })
    return
  }
  await sendViaBinding(env, { subject, text, html })
}

async function sendViaResend(
  env: Bindings,
  m: { subject: string; text: string; html: string },
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Must be onboarding@resend.dev or an address on a domain verified in
      // Resend. ALERT_FROM works once fcgconsulting.ca is verified there.
      from: `FCG Price Tracker <${env.ALERT_FROM || 'onboarding@resend.dev'}>`,
      to: [env.ALERT_TO],
      subject: m.subject,
      text: m.text,
      html: m.html,
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`)
  }
}

async function sendViaBinding(
  env: Bindings,
  m: { subject: string; text: string; html: string },
): Promise<void> {
  const msg = createMimeMessage()
  msg.setSender({ addr: env.ALERT_FROM, name: 'FCG Price Tracker' })
  msg.setRecipient(env.ALERT_TO)
  msg.setSubject(m.subject)
  msg.addMessage({ contentType: 'text/plain', data: m.text })
  msg.addMessage({ contentType: 'text/html', data: m.html })
  await env.EMAIL.send(new EmailMessage(env.ALERT_FROM, env.ALERT_TO, msg.asRaw()))
}

function buildHtml(
  a: AlertInput,
  money: (n: number) => string,
  drop: number,
  pct: number,
): string {
  return `
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
