// Pure helpers for webhook processing (no database access).
import crypto from "crypto";

const STATUS_RANK = { queued: 0, sending: 0, accepted: 0, sent: 1, delivered: 2, read: 3 };
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "stop all", "opt out", "optout", "opt-out"];
const OPT_IN_KEYWORDS = ["start", "unstop", "subscribe", "opt in", "optin"];

/** Verifies Meta's `X-Hub-Signature-256` header against the raw request body. */
export function verifyWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

/** True when moving from `current` to `next` is a forward step (statuses can arrive out of order). */
export function isStatusAdvance(current, next) {
  if (next === "failed") return !["delivered", "read"].includes(current);
  if (current === "failed") return false;
  return (STATUS_RANK[next] ?? -1) > (STATUS_RANK[current] ?? -1);
}

export function keywordIntent(text) {
  const normalized = String(text || "").trim().toLowerCase().replace(/[.!]+$/, "");
  if (OPT_OUT_KEYWORDS.includes(normalized)) return "opt_out";
  if (OPT_IN_KEYWORDS.includes(normalized)) return "opt_in";
  return null;
}
