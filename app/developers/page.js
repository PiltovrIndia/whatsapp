import Link from "next/link";

export const metadata = {
  title: "API reference",
  description: "Send approved WhatsApp templates from your own systems and receive delivery webhooks.",
};

function Code({ children }) {
  return <pre className="overflow-x-auto rounded-md bg-[#111] p-4 text-xs leading-relaxed text-[#e8e8e8]"><code>{children}</code></pre>;
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3 border-t border-[#ececec] pt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const ERRORS = [
  ["401", "unauthorized", "Missing, malformed or revoked API key."],
  ["404", "template_not_found", "No template with that name (and language) in this workspace."],
  ["409", "template_not_approved", "The template exists but isn't approved by Meta."],
  ["422", "invalid_request", "The body failed validation; the message says which field."],
  ["422", "language_required", "The template exists in several languages; pass `language`."],
  ["422", "header_media_required", "The template has an image/video/document header; pass `header_media`."],
  ["422", "no_valid_messages", "Every message was rejected; see `messages[].error`."],
  ["429", "rate_limited", "More than 600 requests per minute for this key."],
  ["503", "not_connected", "WhatsApp isn't connected for this workspace."],
];

const REJECTIONS = [
  ["invalid_phone", "Not a valid number in international format (+ and country code)."],
  ["invalid_variables", "Wrong number of variables, or an empty one."],
  ["duplicate_recipient", "The same number appears twice in one request."],
  ["opted_out", "The contact replied STOP or was opted out; we never message them."],
];

const STATUSES = [
  ["queued", "Accepted by us, waiting to be sent."],
  ["sending", "Being sent to WhatsApp right now."],
  ["sent", "Accepted by WhatsApp."],
  ["delivered", "Delivered to the phone."],
  ["read", "Opened by the customer (if read receipts are on)."],
  ["failed", "WhatsApp couldn't deliver it; see `error`."],
  ["skipped", "Not sent (e.g. the contact opted out before sending)."],
];

export default function DevelopersPage() {
  const host = process.env.APP_URL?.replace(/\/+$/, "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  const base = host || "https://your-domain";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-relaxed text-[#222]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#888]">Developers</p>
      <h1 className="mt-1 text-3xl font-semibold">API reference</h1>
      <p className="mt-3 text-[#555]">
        Send your workspace&apos;s approved WhatsApp templates from your own systems (ERP, CRM, booking or billing software) and get delivery updates back by webhook. Create keys and webhooks in <Link href="/settings/api" className="underline">Settings → API</Link>.
      </p>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#555]">
        {[["auth", "Authentication"], ["send", "Send messages"], ["variables", "Variables"], ["status", "Message status"], ["templates", "Templates"], ["errors", "Errors"], ["webhooks", "Webhooks"], ["limits", "Limits"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="underline-offset-2 hover:underline">{label}</a>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        <Section id="auth" title="Authentication">
          <p>Every request needs an API key in the <code>Authorization</code> header. Keys start with <code>pk_live_</code> and can send messages for the whole workspace, so keep them on your server and never in a browser or mobile app.</p>
          <Code>{`Authorization: Bearer pk_live_…`}</Code>
          <p>Base URL: <code>{base}/api/v1</code>. All bodies are JSON.</p>
        </Section>

        <Section id="send" title="Send messages">
          <p><code>POST /api/v1/messages</code> queues one message (<code>to</code>) or up to 1,000 (<code>messages</code>) with the same template. Only templates approved by Meta can be sent.</p>
          <Code>{`curl -X POST ${base}/api/v1/messages \\
  -H "Authorization: Bearer pk_live_…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: timetable-2026-11-10-class7" \\
  -d '{
    "template": "time_table_update",
    "language": "en_US",
    "to": "+919876543210",
    "variables": { "body": ["Asha"] },
    "reference": "student-1042"
  }'`}</Code>
          <p>Batch: the same template to many people, each with their own values.</p>
          <Code>{`{
  "template": "time_table_update",
  "messages": [
    { "to": "+919876543210", "variables": { "body": ["Asha"] }, "reference": "student-1042" },
    { "to": "+919812345678", "variables": { "body": ["Ravi"] }, "reference": "student-1043" }
  ]
}`}</Code>
          <p>Response <code>202 Accepted</code>. Each message gets an <code>id</code>, or is rejected on its own without blocking the others:</p>
          <Code>{`{
  "batch_id": "5f0c…",
  "replayed": false,
  "messages": [
    { "id": "9b1e…", "to": "+919876543210", "reference": "student-1042", "status": "queued", "error": null },
    { "id": null, "to": "98123", "reference": "student-1043", "status": "rejected",
      "error": { "code": "invalid_phone", "message": "Use international format with country code, e.g. +919876543210." } }
  ]
}`}</Code>
          <ul className="list-disc space-y-1 pl-5 text-[#444]">
            <li><strong>Idempotency-Key</strong> (optional, up to 128 characters): retrying with the same key returns the original batch (<code>200</code>, <code>replayed: true</code>) instead of sending again. Use one per logical send.</li>
            <li><strong>reference</strong> (optional): your own ID, echoed in responses and webhooks, and searchable with <code>GET /api/v1/messages?reference=…</code>.</li>
            <li><strong>language</strong>: required only when a template exists in several languages.</li>
            <li><strong>header_media</strong>: for templates with an image, video or document header, e.g. <code>{`{ "link": "https://…/report.pdf", "filename": "report.pdf" }`}</code>.</li>
            <li>Numbers you message become contacts in the workspace. Only message people who agreed to hear from you. Anyone who replies STOP is opted out and won&apos;t receive messages until they reply START.</li>
          </ul>
          <h3 className="pt-2 font-semibold">Per-message rejections</h3>
          <table className="w-full text-left text-sm">
            <tbody>{REJECTIONS.map(([code, text]) => <tr key={code} className="border-b border-[#f0f0f0]"><td className="py-1.5 pr-4 align-top"><code>{code}</code></td><td className="py-1.5 text-[#555]">{text}</td></tr>)}</tbody>
          </table>
        </Section>

        <Section id="variables" title="Variables">
          <p>Pass values in order. <code>body[0]</code> fills <code>{"{{1}}"}</code>, <code>body[1]</code> fills <code>{"{{2}}"}</code>, and so on. The count must match the template exactly.</p>
          <Code>{`"variables": ["Asha", "Monday"]                    // shorthand for body
"variables": {
  "header": ["Class 7B"],        // header {{1}}, if the header has one
  "body": ["Asha", "Monday"],     // body {{1}}, {{2}}
  "buttons": ["1042"]             // URL button suffix / coupon code, in button order
}
"variables": { "code": "482913" }                  // authentication (OTP) templates`}</Code>
          <p><code>GET /api/v1/templates</code> lists exactly which variables each template needs, with an example request.</p>
        </Section>

        <Section id="status" title="Message status">
          <p><code>GET /api/v1/messages/{"{id}"}</code> returns the latest status, or use <code>GET /api/v1/messages?batch_id=…</code> or <code>?reference=…</code>. For real-time updates, use <a href="#webhooks" className="underline">webhooks</a> instead of polling.</p>
          <Code>{`{
  "id": "9b1e…", "batch_id": "5f0c…", "to": "+919876543210", "reference": "student-1042",
  "template": "time_table_update", "language": "en_US",
  "status": "delivered", "wamid": "wamid.HBgM…", "error": null,
  "created_at": "…", "sent_at": "…", "delivered_at": "…", "read_at": null, "failed_at": null
}`}</Code>
          <table className="w-full text-left text-sm">
            <tbody>{STATUSES.map(([code, text]) => <tr key={code} className="border-b border-[#f0f0f0]"><td className="py-1.5 pr-4 align-top"><code>{code}</code></td><td className="py-1.5 text-[#555]">{text}</td></tr>)}</tbody>
          </table>
          <p className="text-sm text-[#555]">Temporary WhatsApp errors (rate limits, outages) are retried automatically up to 4 times. A <code>failed</code> message includes WhatsApp&apos;s error code and explanation, e.g. <code>131026</code> (not on WhatsApp) or <code>131042</code> (billing problem on the WhatsApp Business account).</p>
        </Section>

        <Section id="templates" title="Templates">
          <p><code>GET /api/v1/templates</code> returns approved templates with their variables and a ready-to-use <code>example_request</code>. Create and submit templates in the dashboard; Meta usually approves utility templates within minutes.</p>
        </Section>

        <Section id="errors" title="Errors">
          <p>Errors use standard HTTP status codes and this body:</p>
          <Code>{`{ "error": { "code": "template_not_approved", "message": "Template \\"promo\\" is pending. Only approved templates can be sent." } }`}</Code>
          <table className="w-full text-left text-sm">
            <tbody>{ERRORS.map(([status, code, text]) => <tr key={code} className="border-b border-[#f0f0f0]"><td className="py-1.5 pr-3 align-top">{status}</td><td className="py-1.5 pr-4 align-top"><code>{code}</code></td><td className="py-1.5 text-[#555]">{text}</td></tr>)}</tbody>
          </table>
        </Section>

        <Section id="webhooks" title="Webhooks">
          <p>Add an HTTPS endpoint in Settings → API to receive events as they happen. Respond with any <code>2xx</code> within 10 seconds. Anything else is retried after 1 min, 5 min, 30 min, 2 h and 6 h, then dropped. Events can arrive more than once or out of order, so de-duplicate on <code>id</code> and use the latest status.</p>
          <ul className="list-disc space-y-1 pl-5 text-[#444]">
            <li><code>message.sent</code>, <code>message.delivered</code>, <code>message.read</code>, <code>message.failed</code>: for messages sent through the API. <code>data</code> is the same object as <code>GET /api/v1/messages/{"{id}"}</code>.</li>
            <li><code>message.received</code>: a customer messaged your number (<code>from</code>, <code>text</code>, <code>type</code>, <code>name</code>, <code>context_wamid</code> when replying to one of your messages).</li>
            <li><code>contact.opted_out</code> / <code>contact.opted_in</code>: the customer replied STOP / START.</li>
          </ul>
          <Code>{`POST /your/endpoint
X-Piltovr-Event: message.delivered
X-Piltovr-Event-Id: evt_3f2a…
X-Piltovr-Signature: t=1794225600,v1=5d41402abc4b2a76b9719d911017c592…

{ "id": "evt_3f2a…", "type": "message.delivered", "created_at": "…", "data": { "id": "9b1e…", "status": "delivered", "reference": "student-1042", … } }`}</Code>
          <p>Verify every request: compute HMAC-SHA256 of <code>{"`${t}.${rawBody}`"}</code> with your signing secret and compare it to <code>v1</code>. Reject timestamps older than 5 minutes.</p>
          <Code>{`import crypto from "node:crypto";

export function verifyPiltovrSignature(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  return expected.length === parts.v1?.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`}</Code>
        </Section>

        <Section id="limits" title="Limits">
          <ul className="list-disc space-y-1 pl-5 text-[#444]">
            <li>600 requests per minute per API key, and up to 1,000 messages per request.</li>
            <li>WhatsApp limits how many different customers a number can message in 24 hours (its messaging tier). Messages beyond that fail with a WhatsApp error.</li>
            <li>Free-form (non-template) messages aren&apos;t available through the API yet.</li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
