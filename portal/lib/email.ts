import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const ADMIN_EMAIL = 'info@capitalconsulting.ca'

// Until a custom domain is verified in Resend, all outbound email must use
// onboarding@resend.dev as `from` and can only be delivered to the account
// owner's email (ADMIN_EMAIL). Set RESEND_FROM_DOMAIN in env once verified
// (e.g. "portal@capitalconsulting.ca") to send to real client addresses.
const FROM_ADDRESS = process.env.RESEND_FROM_DOMAIN
  ? `Capital Consulting Portal <portal@${process.env.RESEND_FROM_DOMAIN}>`
  : 'Capital Consulting Portal <onboarding@resend.dev>'

const DOMAIN_VERIFIED = !!process.env.RESEND_FROM_DOMAIN

interface EmailPayload {
  to: string
  subject: string
  clientName: string
  clientCompany: string
  body: string
}

export async function sendEmail(payload: EmailPayload) {
  // Without a verified domain, Resend only allows sending to the account owner
  const recipient = DOMAIN_VERIFIED ? payload.to : ADMIN_EMAIL

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient,
      subject: payload.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
          <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Capital Consulting Portal</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
            <p style="color: #333; font-size: 15px; margin-top: 0;">
              <strong>Client:</strong> ${payload.clientName} &nbsp;|&nbsp;
              <strong>Company:</strong> ${payload.clientCompany}
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;" />
            <div style="color: #444; font-size: 15px; line-height: 1.6;">
              ${payload.body}
            </div>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0 16px;" />
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated notification from the Capital Consulting Client Portal.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error }
    }

    console.log('Email sent:', data)
    return { success: true, data }
  } catch (err) {
    console.error('Email send failed:', err)
    return { success: false, error: err }
  }
}
