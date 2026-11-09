// Pure helpers for the public developer API (no DB access, unit-testable).
import crypto from "node:crypto";
import net from "node:net";

export const API_KEY_PREFIX = "pk_live_";

export const WEBHOOK_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.received",
  "contact.opted_out",
  "contact.opted_in",
];

// Delay before each retry after a failed delivery attempt (attempt 1 failed → 1 min, …).
export const WEBHOOK_RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 21600];
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_SECONDS.length + 1;

export function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

/** First characters shown in the dashboard so keys can be told apart. */
export function apiKeyPrefix(key) {
  return String(key).slice(0, API_KEY_PREFIX.length + 4);
}

export function looksLikeApiKey(value) {
  return typeof value === "string" && value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 40;
}

export function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

/** `X-Piltovr-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>` */
export function signWebhookPayload(secret, body, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/** Reference verifier (the same logic receivers should implement). */
export function verifyWebhookPayload(secret, body, header, { toleranceSeconds = 300, now = Date.now() } = {}) {
  const parts = Object.fromEntries(
    String(header || "").split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    })
  );
  const timestamp = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isPrivateAddress(host) {
  const version = net.isIP(host);
  if (version === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (version === 6) {
    const value = host.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe80") || value.startsWith("::ffff:");
  }
  return false;
}

/**
 * Webhook URLs must be public HTTPS endpoints. `allowInsecure` permits http
 * and private hosts for local testing only.
 * Returns the normalized URL or throws an Error with a user-facing message.
 */
export function validateWebhookUrl(value, { allowInsecure = false } = {}) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid URL, e.g. https://example.com/whatsapp/events.");
  }
  if (url.username || url.password) throw new Error("The URL can't contain credentials.");
  if (!allowInsecure) {
    if (url.protocol !== "https:") throw new Error("The webhook URL must use https://.");
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || isPrivateAddress(host)) {
      throw new Error("The webhook URL must be publicly reachable.");
    }
  } else if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("The webhook URL must use http:// or https://.");
  }
  if (url.href.length > 2048) throw new Error("The URL is too long.");
  return url.href;
}

function toValueList(input) {
  if (input == null) return [];
  return (Array.isArray(input) ? input : [input]).map((value) => (value == null ? "" : String(value)));
}

/**
 * Maps API variables to template slot keys (see templateVariableSlots).
 *   variables: ["Asha", "Mon"]                                 → body {{1}}, {{2}}
 *   variables: { header: ["Hi"], body: [...], buttons: [...] } → per component
 * Authentication templates take the code as body[0] (or `code`).
 * Returns `{ values }` keyed by slot, or `{ error }` describing the mismatch.
 */
export function mapApiVariables(slots, variables, sanitize = (value) => String(value).trim()) {
  const input = Array.isArray(variables) ? { body: variables } : (variables || {});
  const header = toValueList(input.header);
  const body = input.code != null && input.body == null ? toValueList(input.code) : toValueList(input.body);
  const buttons = toValueList(input.buttons);

  const headerSlots = slots.filter((slot) => slot.key.startsWith("header:"));
  const bodySlots = slots.filter((slot) => slot.key.startsWith("body:"));
  const buttonSlots = slots.filter((slot) => slot.key.startsWith("button:"));

  const describe = (name, expected, got) =>
    `This template needs ${expected} ${name} variable${expected === 1 ? "" : "s"}, but ${got} ${got === 1 ? "was" : "were"} given.`;
  if (header.length !== headerSlots.length) return { error: describe("header", headerSlots.length, header.length) };
  if (body.length !== bodySlots.length) return { error: describe("body", bodySlots.length, body.length) };
  if (buttons.length !== buttonSlots.length) return { error: describe("button", buttonSlots.length, buttons.length) };

  const values = {};
  const assign = (list, slotList) => slotList.forEach((slot, index) => { values[slot.key] = sanitize(list[index]); });
  assign(header, headerSlots);
  // Body slots are {{1}}..{{n}} in order, so position i fills {{i+1}}.
  assign(body, [...bodySlots].sort((a, b) => Number(a.key.split(":")[1]) - Number(b.key.split(":")[1])));
  assign(buttons, buttonSlots);

  const empty = slots.find((slot) => !values[slot.key]);
  if (empty) return { error: `${empty.label} is empty.` };
  return { values };
}

/** Describes a template's variables for API consumers. */
export function describeApiVariables(slots) {
  const pick = (prefix) => slots.filter((slot) => slot.key.startsWith(prefix)).map((slot) => ({ label: slot.label, example: slot.example || "" }));
  return { header: pick("header:"), body: pick("body:"), buttons: pick("button:") };
}
