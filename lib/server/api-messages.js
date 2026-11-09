import crypto from "crypto";
import { parseJson, query, withTransaction } from "@/lib/server/db";
import { httpError } from "@/lib/server/http";
import { normalizePhone } from "@/lib/server/contacts";
import { displayTemplateName, managedTemplateName } from "@/lib/server/whatsapp-config";
import { enqueueEvent } from "@/lib/server/outbound-webhooks";
import { headerMediaFormat, sanitizeParameter, templateVariableSlots, unsupportedSendFeatures } from "@/lib/message-payload";
import { mapApiVariables } from "@/lib/api-utils";

export const MAX_MESSAGES_PER_REQUEST = 1000;

const MESSAGE_SELECT = `
  SELECT r.id, r.send_job_id, r.phone, r.client_reference, r.status, r.meta_message_id,
         r.error_code, r.error_message, r.created_at, r.sent_at, r.delivered_at, r.read_at, r.failed_at,
         j.organization_id, j.source, t.name AS template_name, t.language
  FROM send_job_recipients r
  INNER JOIN send_jobs j ON j.id = r.send_job_id
  INNER JOIN templates t ON t.id = j.template_id`;

/** Public representation of one message (a send_job_recipients row). */
export function serializeApiMessage(row) {
  return {
    id: row.id,
    batch_id: row.send_job_id,
    to: row.phone,
    reference: row.client_reference || null,
    template: displayTemplateName(row.organization_id, row.template_name),
    language: row.language,
    status: row.status,
    wamid: row.meta_message_id || null,
    error: row.error_code || row.error_message ? { code: row.error_code || "error", message: row.error_message || null } : null,
    created_at: row.created_at,
    sent_at: row.sent_at || null,
    delivered_at: row.delivered_at || null,
    read_at: row.read_at || null,
    failed_at: row.failed_at || null,
  };
}

export async function getApiMessage(organizationId, id) {
  const [row] = await query(`${MESSAGE_SELECT} WHERE r.id = :id AND j.organization_id = :organizationId`, { id, organizationId });
  return row ? serializeApiMessage(row) : null;
}

export async function listApiMessages(organizationId, { reference, batchId, limit = 50 }) {
  const filters = ["j.organization_id = :organizationId", "j.source = 'api'"];
  if (reference) filters.push("r.client_reference = :reference");
  if (batchId) filters.push("r.send_job_id = :batchId");
  const rows = await query(
    `${MESSAGE_SELECT} WHERE ${filters.join(" AND ")} ORDER BY r.created_at DESC, r.id LIMIT ${Math.min(Math.max(Number(limit) || 50, 1), 1000)}`,
    { organizationId, reference, batchId }
  );
  return rows.map(serializeApiMessage);
}

/** Emits a `message.*` webhook for a recipient if it belongs to an API send. */
export async function emitMessageEvent(recipientId, type) {
  try {
    const [row] = await query(`${MESSAGE_SELECT} WHERE r.id = :id`, { id: recipientId });
    if (row?.source === "api") await enqueueEvent(row.organization_id, type, serializeApiMessage(row));
  } catch (error) {
    console.error("message event failed", error.message);
  }
}

/** Finds an approved template by its display name (and language when there are several). */
export async function findApiTemplate(organizationId, name, language) {
  const rows = await query(
    `SELECT * FROM templates
     WHERE organization_id = :organizationId AND name IN (:names) AND status <> 'DELETED'
       ${language ? "AND language = :language" : ""}`,
    { organizationId, names: [managedTemplateName(organizationId, name), name], language }
  );
  if (!rows.length) {
    throw httpError(404, `No template named "${name}"${language ? ` in ${language}` : ""}. List templates with GET /api/v1/templates.`, { code: "template_not_found" });
  }
  if (rows.length > 1) {
    throw httpError(422, `Template "${name}" exists in several languages (${rows.map((row) => row.language).join(", ")}). Pass "language".`, { code: "language_required" });
  }
  const template = rows[0];
  if (template.status !== "APPROVED") {
    throw httpError(409, `Template "${name}" is ${template.status.toLowerCase()}. Only approved templates can be sent.`, { code: "template_not_approved" });
  }
  return template;
}

function rejected(item, code, message) {
  return { id: null, to: item.to ?? null, reference: item.reference ?? null, status: "rejected", error: { code, message } };
}

async function replay(organizationId, jobId) {
  const messages = await listApiMessages(organizationId, { batchId: jobId, limit: MAX_MESSAGES_PER_REQUEST });
  return { batch_id: jobId, replayed: true, messages: messages.reverse() };
}

/**
 * Validates and queues API messages as one send job (source = 'api').
 * Invalid items are rejected individually; the rest are queued.
 */
export async function enqueueApiMessages({ apiSession, template, items, headerMedia, idempotencyKey }) {
  const organizationId = apiSession.organization_id;

  if (idempotencyKey) {
    const [existing] = await query(
      "SELECT id FROM send_jobs WHERE organization_id = :organizationId AND idempotency_key = :key",
      { organizationId, key: idempotencyKey }
    );
    if (existing) return replay(organizationId, existing.id);
  }

  const components = parseJson(template.components_json, []);
  const unsupported = unsupportedSendFeatures(components);
  if (unsupported.length) throw httpError(422, unsupported[0], { code: "template_unsupported" });
  const mediaFormat = headerMediaFormat(components);
  if (mediaFormat && !headerMedia) {
    throw httpError(422, `This template has a ${mediaFormat.toLowerCase()} header. Pass header_media: { "link": "https://…" } or { "id": "…" }.`, { code: "header_media_required" });
  }
  const slots = templateVariableSlots(components);

  const results = [];
  const accepted = [];
  const seen = new Set();
  for (const item of items) {
    const phone = normalizePhone(item.to);
    if (!phone || !String(item.to).trim().match(/^(\+|00)/)) {
      results.push(rejected(item, "invalid_phone", "Use international format with country code, e.g. +919876543210."));
      continue;
    }
    if (seen.has(phone)) {
      results.push(rejected(item, "duplicate_recipient", "This number appears more than once in the request."));
      continue;
    }
    const mapped = mapApiVariables(slots, item.variables, sanitizeParameter);
    if (mapped.error) {
      results.push(rejected(item, "invalid_variables", mapped.error));
      continue;
    }
    seen.add(phone);
    const entry = { id: crypto.randomUUID(), phone, values: mapped.values, item, index: results.length };
    accepted.push(entry);
    results.push(null); // filled in below
  }

  if (accepted.length) {
    // Numbers sent via the API become contacts (consent is asserted by the caller),
    // but an opted-out contact is never re-subscribed.
    await query(
      "INSERT INTO contacts (id, organization_id, phone, opt_in, source) VALUES ? ON DUPLICATE KEY UPDATE phone = phone",
      [accepted.map((entry) => [crypto.randomUUID(), organizationId, entry.phone, 1, "api"])]
    );
    const contacts = await query(
      "SELECT id, phone, opt_in FROM contacts WHERE organization_id = :organizationId AND phone IN (:phones)",
      { organizationId, phones: accepted.map((entry) => entry.phone) }
    );
    const byPhone = new Map(contacts.map((contact) => [contact.phone, contact]));
    for (const entry of [...accepted]) {
      const contact = byPhone.get(entry.phone);
      if (!contact || !contact.opt_in) {
        results[entry.index] = rejected(entry.item, "opted_out", "This contact has opted out of messages (replied STOP or was opted out).");
        accepted.splice(accepted.indexOf(entry), 1);
      } else {
        entry.contactId = contact.id;
      }
    }
  }

  if (!accepted.length) {
    const filled = results.filter(Boolean);
    throw httpError(422, "No messages could be queued. See the per-message errors.", { code: "no_valid_messages", results: filled });
  }

  const jobId = crypto.randomUUID();
  try {
    await withTransaction(async (connection) => {
      await connection.query(
        `INSERT INTO send_jobs
           (id, organization_id, template_id, name, status, total_recipients, variables_json, audience_json,
            header_media_json, scheduled_at, created_by, source, api_key_id, idempotency_key)
         VALUES
           (:id, :organizationId, :templateId, :name, 'queued', :total, '{}', '{"type":"api"}',
            :headerMedia, UTC_TIMESTAMP(), :createdBy, 'api', :apiKeyId, :idempotencyKey)`,
        {
          id: jobId,
          organizationId,
          templateId: template.id,
          name: `API · ${displayTemplateName(organizationId, template.name)}`.slice(0, 160),
          total: accepted.length,
          headerMedia: mediaFormat && headerMedia ? JSON.stringify(headerMedia) : null,
          createdBy: apiSession.user_id || null,
          apiKeyId: apiSession.api_key_id,
          idempotencyKey: idempotencyKey || null,
        }
      );
      await connection.query(
        `INSERT INTO send_job_recipients
           (id, send_job_id, contact_id, phone, status, next_attempt_at, values_json, client_reference)
         VALUES ?`,
        [accepted.map((entry) => [
          entry.id, jobId, entry.contactId, entry.phone, "queued", new Date(),
          JSON.stringify(entry.values), entry.item.reference ? String(entry.item.reference).slice(0, 255) : null,
        ])]
      );
    });
  } catch (error) {
    // Two concurrent requests with the same Idempotency-Key: return the winner's batch.
    if (error.code === "ER_DUP_ENTRY" && idempotencyKey) {
      const [existing] = await query(
        "SELECT id FROM send_jobs WHERE organization_id = :organizationId AND idempotency_key = :key",
        { organizationId, key: idempotencyKey }
      );
      if (existing) return replay(organizationId, existing.id);
    }
    throw error;
  }

  for (const entry of accepted) {
    results[entry.index] = { id: entry.id, to: entry.phone, reference: entry.item.reference ?? null, status: "queued", error: null };
  }
  return { batch_id: jobId, replayed: false, messages: results };
}
