This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Database setup (MySQL 8.0+)

Create the database and a dedicated application user in MySQL:

```sql
CREATE DATABASE whatsapp_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'whatsapp_app'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON whatsapp_platform.* TO 'whatsapp_app'@'localhost';
```

Copy `.env.example` to `.env.local`, update the `DB_*` values, and apply the initial schema:

```bash
npm run db:migrate
```

The initial migration targets MySQL 8.0 or newer and uses InnoDB, native JSON columns, enforced check constraints, UTC session time, and `utf8mb4_0900_ai_ci` collation.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Meta Embedded Signup requires an HTTPS origin. For onboarding development, run:

```bash
npm run dev:https
```

Add the resulting HTTPS origin to the allowed domains and OAuth redirect settings for your Meta app and Embedded Signup configuration. A publicly trusted HTTPS development URL is preferable to a self-signed localhost certificate for end-to-end Meta testing.

## WhatsApp numbers: own number first, shared number as fallback

Each workspace sends from **its own WhatsApp number** once an owner or admin
connects one with Meta's Embedded Signup (Settings → WhatsApp). Until then it
sends from the **shared platform number**, if one is configured:

```bash
PLATFORM_WHATSAPP_ACCESS_TOKEN=your-long-lived-system-user-token
PLATFORM_WHATSAPP_WABA_ID=your-waba-id
PLATFORM_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
PLATFORM_WHATSAPP_DISPLAY_PHONE_NUMBER=optional-display-number
```

Setting only some of these returns a safe service-unavailable response until
the configuration is complete. On the shared number, template names get a
per-workspace `eng_<hash>_` prefix so workspaces can't see each other's.

### Embedded Signup

Needs `NEXT_PUBLIC_META_APP_ID` (same as `META_APP_ID`), `META_APP_SECRET`
and `NEXT_PUBLIC_META_CONFIG_ID`, the ID of a Facebook Login for Business
configuration of type "WhatsApp Embedded Signup" with a System-user token,
WhatsApp accounts as assets, and the `whatsapp_business_management` and
`whatsapp_business_messaging` permissions. Add each site origin (e.g.
`https://www.txtit.in`) to the allowed JavaScript SDK domains.

Two ways to connect:

- **New number** (`cloud`): the customer verifies a number that isn't on
  WhatsApp yet. We register it for Cloud API with a random 6-digit PIN, stored
  encrypted.
- **WhatsApp Business app number** (`coexistence`): the customer keeps using
  the app on their phone. The number is already registered, so we don't call
  `/register`. Throughput is capped at about 20 messages per second and the
  app must be opened at least every 14 days.

When the popup finishes, `POST /api/whatsapp/onboarding/exchange` exchanges
the code for a business-integration token, checks with `debug_token` that the
token really grants the reported WABA, rejects the shared number or a number
another workspace owns, subscribes our app to the WABA's webhooks, registers
the number (cloud only), saves the connection and syncs its templates.
`DELETE /api/whatsapp/connection` (owner only) unsubscribes and removes the
connection; the number stays the customer's and the workspace falls back to
the shared number.

**Templates belong to a WABA.** A workspace only sees and sends the templates
of the account it currently sends from. Queued messages whose template is on
another account fail with `template_wrong_account`.

**Billing.** Meta bills each customer's WABA directly, so they must add a
payment method in Meta. Settings shows Meta's `health_status` problems, such
as a missing payment method.

## How messaging works

1. **Contacts**: import CSV/Excel (or add manually) under *Contacts*. Only
   opted-in contacts receive campaigns. Customers who reply `STOP` are opted out
   automatically, and a later import never re-opts them in.
2. **Templates**: build a template under *Templates → New template*. It is
   submitted to Meta for review; approvals arrive through the webhook (or the
   *Sync* button) and usually take a few minutes.
3. **Campaigns**: pick an approved template, an audience and per-contact
   variables (contact fields or imported custom attributes), then send now or
   schedule. Messages are queued in MySQL and sent by a background worker with
   retries for rate limits and transient errors. Delivery and read receipts
   update each campaign live.

## Production checklist

```bash
npm run db:migrate     # applies pending migrations (tracked in schema_migrations)
npm run check:config   # verifies secrets, DB schema, Meta token, phone number and webhooks
npm run build && npm start
```

In the Meta app dashboard, configure the WhatsApp webhook:

- Callback URL: `https://<your-domain>/api/whatsapp/webhook`
- Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
- Fields: `messages`, `message_template_status_update`, `template_category_update`

Then run `npm run check:config -- --subscribe` once to subscribe the app to
your WhatsApp Business Account.

Use a **System User** access token with `whatsapp_business_messaging` and
`whatsapp_business_management` permissions for `PLATFORM_WHATSAPP_ACCESS_TOKEN`,
so it never expires.

### Deploying on Vercel (works on the Hobby plan)

Sending doesn't depend on a frequent cron:

- **Creating a campaign** starts sending straight away, inside that request.
- **Large campaigns** are sent as a chain of short (about 45 second) runs.
  Each run calls `/api/cron/send-queue` again until the queue is empty.
- **Retries and scheduled campaigns** are picked up whenever the app gets
  activity: incoming webhooks, or someone viewing the campaign pages.
- **A once-a-day Vercel cron** (`vercel.json`) is a safety net, since Hobby
  rejects crons that run more than once a day.

For retries and scheduled sends to go out on time, add a free external
scheduler such as [cron-job.org](https://cron-job.org). Have it call
`GET https://<your-domain>/api/cron/send-queue` every minute with the header
`Authorization: Bearer <CRON_SECRET>`. The endpoint answers immediately, so
short scheduler timeouts are fine.

Environment variables (**Project → Settings → Environment Variables**): add
everything from `.env.local`, plus `DB_POOL_SIZE=3`. `CRON_SECRET` is
required, because chained runs authenticate with it. The background worker
switches itself off on Vercel. Chained runs call the production domain
(`VERCEL_PROJECT_PRODUCTION_URL`); set `APP_URL` if you use a custom domain
behind Deployment Protection.

The MySQL server must accept connections from Vercel. Vercel has no fixed
outbound IPs, so use a strong password and TLS rather than relying on an IP
allowlist.

## Developer API

Workspaces can send their approved templates from their own systems.

- **Keys and webhooks:** owners and admins create API keys and a webhook
  endpoint under **Settings → API** (`/settings/api`).
- **Reference:** the full reference is public at `/developers`.

| Endpoint | What it does |
|---|---|
| `GET /api/v1/templates` | Approved templates, their variables, and an example request |
| `POST /api/v1/messages` | Queue one message (`to`) or up to 1,000 (`messages`); supports `Idempotency-Key` |
| `GET /api/v1/messages/{id}` | Status of one message |
| `GET /api/v1/messages?reference=…` / `?batch_id=…` | Look up by your own reference or by batch |

- **Same send path as campaigns:** an API request becomes a send job with
  `source = 'api'` and goes through the same queue as campaigns. That means
  the same retries and opt-out checks, and the same handling of Meta's
  delivery receipts.
- **Webhook events:** `message.sent`, `message.delivered`, `message.read`,
  `message.failed`, `message.received`, `contact.opted_out` and
  `contact.opted_in`.
- **Signing and retries:** events are signed with
  `X-Piltovr-Signature: t=…,v1=HMAC_SHA256(secret, "t.body")`. Failed
  deliveries are retried after 1 min, 5 min, 30 min, 2 h and 6 h.
- **Limits:** 600 requests per minute per key (`API_RATE_LIMIT_PER_MINUTE`).
- **Local testing only:** set `WEBHOOK_ALLOW_INSECURE_URLS=1` to allow
  `http://` and private webhook URLs. Never set it in production.

## Tests

```bash
npm test
```
