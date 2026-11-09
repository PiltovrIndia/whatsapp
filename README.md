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

## Platform-managed WhatsApp connection

The customer workflow can use one server-managed WhatsApp connection so new
workspaces begin with contact import instead of Embedded Signup. Configure all
three required values in `.env.local`:

```bash
PLATFORM_WHATSAPP_ACCESS_TOKEN=your-long-lived-system-user-token
PLATFORM_WHATSAPP_WABA_ID=your-waba-id
PLATFORM_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
PLATFORM_WHATSAPP_DISPLAY_PHONE_NUMBER=optional-display-number
```

These values are server-only. When configured, they take precedence over legacy
organization-specific connection rows. Leaving all three unset preserves the
legacy database-backed behavior; setting only some of them returns a safe
service-unavailable response until the configuration is completed.

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

## Tests

```bash
npm test
```
