# FCG Price Tracker

A standalone Cloudflare Worker that watches flight itineraries (Kiwi.com) and product pages,
re-checks their price every few hours, and emails when the price drops.

- **Runtime:** Cloudflare Worker + [Hono]
- **Data:** Cloudflare D1
- **Schedule:** Cloudflare Cron Trigger (`0 */6 * * *`)
- **Email:** Resend (`RESEND_API_KEY`). Cloudflare's `send_email` binding is a fallback but is
  unused here — `fcgconsulting.ca` runs Microsoft 365 mail, so enabling Cloudflare Email Routing
  would replace its MX and break inboxes.
- **Auth:** single admin login, HMAC-signed session cookie

## How price reading works

1. If a **CSS selector** is set on the tracker, the price is read from that element
   (`content` attribute or text).
2. If the selector is blank, the Worker looks for a JSON-LD `Product` / `Offer` block and reads
   `offers.price`.
3. By default it does a plain `fetch` with a browser User-Agent. Many sites (Kiwi.com, Amazon,
   most airlines) block that or render prices with JavaScript. Set the `SCRAPER_API_KEY` secret to
   route requests through a JS-rendering scraping API instead — `SCRAPER_API_PROVIDER` selects
   `scrapingbee` (default), `scraperapi`, or `scrapingant`.

Without a scraper key, JS-heavy pages show an `error` status with an explanatory message rather
than a wrong price.

## Alert rule

- First successful read stores a **baseline**, no email.
- With a **target price**: email when `price <= target` **and** `price < baseline`.
- Without a target: email when `price < baseline`.
- After an alert the baseline drops to the new price, so you only get re-alerted on a further drop.

## One-time setup

```bash
cd tracker
npm install

# 1. Create the database, then paste the printed database_id into wrangler.jsonc
npx wrangler d1 create fcg-tracker

# 2. Create the tables (remote = production D1)
npx wrangler d1 execute fcg-tracker --remote --file=schema.sql
npx wrangler d1 execute fcg-tracker --local  --file=schema.sql   # for `wrangler dev`

# 3. Email via Resend: set the RESEND_API_KEY secret (step 4).
#    vars.ALERT_TO   -> where alerts land (camfrohar@fcgconsulting.ca)
#    vars.ALERT_FROM -> onboarding@resend.dev until fcgconsulting.ca is a
#                       verified sending domain in Resend, then alerts@fcgconsulting.ca

# 4. Secrets
npx wrangler secret put ADMIN_USERNAME     # e.g. admin
npx wrangler secret put ADMIN_PASSWORD     # e.g. admin  (change later — see below)
npx wrangler secret put SESSION_SECRET     # long random string
npx wrangler secret put CRON_TOKEN         # random string; guards POST /cron/run
npx wrangler secret put RESEND_API_KEY     # enables the Resend alert path
npx wrangler secret put SCRAPER_API_KEY    # optional

# 5. Deploy
npx wrangler deploy
```

### Custom domain

The marketing site links "Client Portal" to `https://portal.fcgconsulting.ca`. After the first
deploy, `portal.fcgconsulting.ca` is bound automatically by the `routes` block in `wrangler.jsonc`
(the `fcgconsulting.ca` zone is on this account). Until DNS/cert propagate, the Worker is also
reachable at its `*.workers.dev` URL.

## Local dev

```bash
npx wrangler dev --remote
```

Create `tracker/.dev.vars` (gitignored) with the same keys as the secrets above so login and
email work locally:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
SESSION_SECRET=dev-secret-change-me
CRON_TOKEN=dev-cron-token
```

## Changing the login later

Edit the secret and redeploy — or use the dashboard (Workers & Pages > fcg-tracker > Settings >
Variables and Secrets):

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler deploy
```

## Manual check run

```bash
curl -X POST -H "Authorization: Bearer $CRON_TOKEN" https://<your-worker-url>/cron/run
```

## Notes

- `admin` / `admin` on a public URL is weak. Anyone with the URL who guesses it can see your
  trackers and trigger check emails to your address. Set a real password after first login.
- Kiwi.com itinerary pages are bot-protected and JS-rendered; a `SCRAPER_API_KEY` is effectively
  required for `flight` trackers to return a price.

[Hono]: https://hono.dev
