import crypto from "crypto";
import { parseJson, query, withTransaction } from "@/lib/server/db";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_SECONDS,
  generateWebhookSecret,
  signWebhookPayload,
  validateWebhookUrl,
} from "@/lib/api-utils";

const BATCH_SIZE = 20;
const CONCURRENCY = 5;
const LEASE_SECONDS = 60;
const TIMEOUT_MS = 10_000;

// Local testing only: allow http:// and private hosts as webhook targets.
export const allowInsecureWebhookUrls = () => process.env.WEBHOOK_ALLOW_INSECURE_URLS === "1";

function serializeEndpoint(row, { includeSecret = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    events: parseJson(row.events_json, []),
    active: Boolean(row.active),
    failureCount: row.failure_count,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    ...(includeSecret ? { secret: decryptSecret(row.secret_encrypted) } : {}),
  };
}

export async function getWebhookEndpoint(organizationId, options) {
  const [row] = await query("SELECT * FROM webhook_endpoints WHERE organization_id = :organizationId", { organizationId });
  return serializeEndpoint(row, options);
}

/** Creates or updates the workspace endpoint. A secret is generated on create or when rotating. */
export async function saveWebhookEndpoint(organizationId, { url, events, active, rotateSecret }) {
  const normalizedUrl = validateWebhookUrl(url, { allowInsecure: allowInsecureWebhookUrls() });
  const chosen = (events?.length ? events : WEBHOOK_EVENTS).filter((event) => WEBHOOK_EVENTS.includes(event));
  const [existing] = await query("SELECT id FROM webhook_endpoints WHERE organization_id = :organizationId", { organizationId });

  if (!existing) {
    await query(
      `INSERT INTO webhook_endpoints (id, organization_id, url, secret_encrypted, events_json, active)
       VALUES (:id, :organizationId, :url, :secret, :events, :active)`,
      {
        id: crypto.randomUUID(),
        organizationId,
        url: normalizedUrl,
        secret: encryptSecret(generateWebhookSecret()),
        events: JSON.stringify(chosen),
        active: active === false ? 0 : 1,
      }
    );
  } else {
    await query(
      `UPDATE webhook_endpoints
       SET url = :url, events_json = :events, active = :active,
           secret_encrypted = IF(:rotate, :secret, secret_encrypted),
           failure_count = IF(:active = 1, 0, failure_count)
       WHERE id = :id`,
      {
        id: existing.id,
        url: normalizedUrl,
        events: JSON.stringify(chosen),
        active: active === false ? 0 : 1,
        rotate: rotateSecret ? 1 : 0,
        secret: encryptSecret(generateWebhookSecret()),
      }
    );
  }
  return getWebhookEndpoint(organizationId, { includeSecret: true });
}

export async function deleteWebhookEndpoint(organizationId) {
  await query("DELETE FROM webhook_endpoints WHERE organization_id = :organizationId", { organizationId });
}

function eventEnvelope(type, data) {
  return { id: `evt_${crypto.randomUUID().replaceAll("-", "")}`, type, created_at: new Date().toISOString(), data };
}

/**
 * Queues an event for the workspace's endpoint if it is active and subscribed.
 * Best effort: failures are logged and never break the caller.
 */
export async function enqueueEvent(organizationId, type, data) {
  if (!organizationId) return;
  try {
    const [endpoint] = await query(
      "SELECT id, events_json FROM webhook_endpoints WHERE organization_id = :organizationId AND active = 1",
      { organizationId }
    );
    if (!endpoint || !parseJson(endpoint.events_json, []).includes(type)) return;
    await query(
      `INSERT INTO webhook_deliveries (id, organization_id, endpoint_id, event_type, payload_json, next_attempt_at)
       VALUES (:id, :organizationId, :endpointId, :type, :payload, UTC_TIMESTAMP())`,
      {
        id: crypto.randomUUID(),
        organizationId,
        endpointId: endpoint.id,
        type,
        payload: JSON.stringify(eventEnvelope(type, data)),
      }
    );
  } catch (error) {
    console.error("webhook enqueue failed", error.message);
  }
}

async function postEvent(url, secret, payload) {
  const body = JSON.stringify(payload);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Piltovr-Webhooks/1.0",
        "X-Piltovr-Event": payload.type,
        "X-Piltovr-Event-Id": payload.id,
        "X-Piltovr-Signature": signWebhookPayload(secret, body),
      },
      body,
    });
    return { ok: response.status >= 200 && response.status < 300, status: response.status, error: response.ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, status: null, error: error.name === "TimeoutError" ? "Timed out after 10s" : error.message };
  }
}

async function recordAttempt(delivery, result) {
  const attempts = delivery.attempts + 1;
  const giveUp = !result.ok && attempts >= WEBHOOK_MAX_ATTEMPTS;
  const delay = WEBHOOK_RETRY_DELAYS_SECONDS[attempts - 1] || 0;
  await query(
    `UPDATE webhook_deliveries
     SET attempts = :attempts, last_status_code = :statusCode, last_error = :error,
         status = :status, delivered_at = IF(:ok, UTC_TIMESTAMP(), delivered_at),
         next_attempt_at = IF(:retry, UTC_TIMESTAMP() + INTERVAL :delay SECOND, NULL)
     WHERE id = :id`,
    {
      id: delivery.id,
      attempts,
      statusCode: result.status,
      error: result.error ? String(result.error).slice(0, 500) : null,
      status: result.ok ? "delivered" : giveUp ? "failed" : "pending",
      ok: result.ok ? 1 : 0,
      retry: !result.ok && !giveUp ? 1 : 0,
      delay,
    }
  );
  await query(
    result.ok
      ? "UPDATE webhook_endpoints SET last_success_at = UTC_TIMESTAMP(), failure_count = 0 WHERE id = :id"
      : "UPDATE webhook_endpoints SET last_failure_at = UTC_TIMESTAMP(), failure_count = failure_count + 1 WHERE id = :id",
    { id: delivery.endpoint_id }
  );
}

async function claimDeliveries() {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT d.id FROM webhook_deliveries d
       WHERE d.status = 'pending' AND d.next_attempt_at <= UTC_TIMESTAMP()
       ORDER BY d.next_attempt_at ASC LIMIT ${BATCH_SIZE}
       FOR UPDATE SKIP LOCKED`
    );
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    // Lease the rows; if this run dies they become due again (at-least-once delivery).
    await connection.query(
      `UPDATE webhook_deliveries SET next_attempt_at = UTC_TIMESTAMP() + INTERVAL ${LEASE_SECONDS} SECOND WHERE id IN (:ids)`,
      { ids }
    );
    const [claimed] = await connection.query(
      `SELECT d.id, d.endpoint_id, d.attempts, d.payload_json, e.url, e.secret_encrypted, e.active
       FROM webhook_deliveries d INNER JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.id IN (:ids)`,
      { ids }
    );
    return claimed;
  });
}

/** Delivers due events until the queue is empty or the time budget is spent. */
export async function deliverDueWebhooks({ timeBudgetMs = 15_000 } = {}) {
  const deadline = Date.now() + timeBudgetMs;
  let delivered = 0;
  while (Date.now() < deadline) {
    const batch = await claimDeliveries();
    if (!batch.length) break;
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, async () => {
      while (cursor < batch.length) {
        const delivery = batch[cursor++];
        if (!delivery.active) {
          await query("UPDATE webhook_deliveries SET status = 'failed', last_error = 'Endpoint disabled', next_attempt_at = NULL WHERE id = :id", { id: delivery.id });
          continue;
        }
        const result = await postEvent(delivery.url, decryptSecret(delivery.secret_encrypted), parseJson(delivery.payload_json, {}));
        await recordAttempt(delivery, result);
        if (result.ok) delivered += 1;
      }
    }));
  }
  return { delivered };
}

export async function hasDueDeliveries() {
  const rows = await query(
    "SELECT 1 FROM webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= UTC_TIMESTAMP() LIMIT 1"
  );
  return rows.length > 0;
}

/** Sends a `test` event immediately (not queued or retried) and reports the result. */
export async function sendTestEvent(organizationId) {
  const [endpoint] = await query("SELECT url, secret_encrypted FROM webhook_endpoints WHERE organization_id = :organizationId", { organizationId });
  if (!endpoint) return null;
  const payload = eventEnvelope("test", { message: "This is a test event from Piltovr." });
  return postEvent(endpoint.url, decryptSecret(endpoint.secret_encrypted), payload);
}

export async function listDeliveries(organizationId, limit = 50) {
  const rows = await query(
    `SELECT id, event_type, status, attempts, last_status_code, last_error, created_at, delivered_at, next_attempt_at
     FROM webhook_deliveries WHERE organization_id = :organizationId
     ORDER BY created_at DESC LIMIT ${Math.min(Math.max(Number(limit) || 50, 1), 200)}`,
    { organizationId }
  );
  return rows;
}
