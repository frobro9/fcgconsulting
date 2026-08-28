# Camify

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

The tracker fetches the URL and parses the response:

- **JSON response** (a store's product/offers API — e.g.
  `https://www.bestbuy.ca/api/offers/v1/products/<sku>/offers`): the selector is a field path
  (`0.salePrice`, `data.price`) or a bare key to deep-search; blank auto-detects common fields
  (`salePrice`, `currentPrice`, `price`, `regularPrice`, …).
- **HTML response**: the selector is a CSS selector; blank falls back to the page's JSON-LD
  `Product` / `Offer` data, then to embedded framework state (`__NEXT_DATA__` and other
  `<script type="application/json">` blobs — e.g. Walmart).

### Fetching

1. **Plain fetch** with a browser User-Agent (free, fast) — works for most sites via the parsing
   above.
2. **Best Buy Canada** product links are rewritten to their price API automatically
   (`src/sites.ts` — add a rule there for another store).
3. **Rendering-scraper fallback:** if the plain fetch is blocked (403/429) or yields no price and
   `SCRAPER_API_KEY` is set, the check retries once through a headless-browser scraping API with a
   premium proxy. `SCRAPER_API_PROVIDER` = `scrapingbee` (default), `scraperapi`, or `scrapingant`.

So: for hard sites (Amazon, airlines, anything behind Cloudflare/Akamai/PerimeterX, or pure
client-rendered prices), set **one** `SCRAPER_API_KEY` secret and everything falls back to it
automatically; cheap sites still use the free plain fetch. Without a key, a blocked/unparseable
fetch shows an `error` status with an explanation rather than a wrong price.

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
