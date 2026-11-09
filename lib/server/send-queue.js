import crypto from "crypto";
import { parseJson, query, withTransaction } from "@/lib/server/db";
import { resolveWhatsAppConnection, sendMetaTemplateMessage } from "@/lib/server/whatsapp";
import {
  buildSendComponents,
  resolveVariables,
  sanitizeParameter,
  templateVariableSlots,
} from "@/lib/message-payload";
import { emitMessageEvent } from "@/lib/server/api-messages";

const BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE || 60);
const CONCURRENCY = Number(process.env.SEND_CONCURRENCY || 10);
const MAX_ATTEMPTS = 4;
const LOCK_SECONDS = 120;

export const ACTIVE_JOB_STATUSES = ["scheduled", "queued", "running"];


/** SQL fragment + params selecting the eligible audience for a campaign. */
export function audienceFilter(audience, organizationId) {
  const params = { organizationId };
  let sql = "FROM contacts c WHERE c.organization_id = :organizationId";

  if (audience.type === "lists") {
    sql += ` AND c.id IN (
      SELECT clm.contact_id FROM contact_list_members clm
      INNER JOIN contact_lists cl ON cl.id = clm.contact_list_id
      WHERE cl.organization_id = :organizationId AND cl.id IN (:listIds))`;
    params.listIds = audience.listIds;
  } else if (audience.type === "contacts") {
    sql += " AND c.id IN (:contactIds)";
    params.contactIds = audience.contactIds;
  }

  return { sql, params };
}

export async function estimateAudience(audience, organizationId) {
  const { sql, params } = audienceFilter(audience, organizationId);
  const [row] = await query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(c.opt_in = 1), 0) AS eligible ${sql}`,
    params
  );
  const total = Number(row?.total || 0);
  const eligible = Number(row?.eligible || 0);
  return { total, eligible, excluded: total - eligible };
}

/**
 * Creates a send job and enqueues one recipient row per opted-in contact.
 * Returns `{ jobId, recipients, excluded }`.
 */
export async function createCampaign({ session, template, audience, variables, headerMedia, scheduledAt, name }) {
  const jobId = crypto.randomUUID();
  const sendAt = scheduledAt ? new Date(scheduledAt) : new Date();
  const scheduled = scheduledAt && sendAt.getTime() > Date.now() + 30_000;
  const { sql, params } = audienceFilter(audience, session.organization_id);

  return withTransaction(async (connection) => {
    await connection.query(
      `INSERT INTO send_jobs
         (id, organization_id, template_id, name, status, total_recipients, variables_json,
          audience_json, header_media_json, scheduled_at, created_by)
       VALUES
         (:id, :organizationId, :templateId, :name, :status, 0, :variables,
          :audience, :headerMedia, :scheduledAt, :createdBy)`,
      {
        id: jobId,
        organizationId: session.organization_id,
        templateId: template.id,
        name: name || null,
        status: scheduled ? "scheduled" : "queued",
        variables: JSON.stringify(variables || {}),
        audience: JSON.stringify(audience),
        headerMedia: headerMedia ? JSON.stringify(headerMedia) : null,
        scheduledAt: sendAt,
        createdBy: session.user_id,
      }
    );

    const [inserted] = await connection.query(
      `INSERT IGNORE INTO send_job_recipients
         (id, send_job_id, contact_id, phone, status, next_attempt_at)
       SELECT UUID(), :jobId, c.id, c.phone, 'queued', :sendAt
       ${sql} AND c.opt_in = 1`,
      { ...params, jobId, sendAt }
    );

    const recipients = inserted.affectedRows;
    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total ${sql}`, params);

    await connection.query(
      `UPDATE send_jobs SET total_recipients = :recipients, status = :status WHERE id = :jobId`,
      {
        recipients,
        status: recipients === 0 ? "completed" : scheduled ? "scheduled" : "queued",
        jobId,
      }
    );

    return { jobId, recipients, excluded: Number(total) - recipients, scheduled: Boolean(scheduled) };
  });
}

export async function cancelCampaign(jobId, organizationId) {
  return withTransaction(async (connection) => {
    const [[job]] = await connection.query(
      "SELECT id, status FROM send_jobs WHERE id = :jobId AND organization_id = :organizationId FOR UPDATE",
      { jobId, organizationId }
    );
    if (!job) return null;
    if (!ACTIVE_JOB_STATUSES.includes(job.status)) return job.status;

    await connection.query(
      `UPDATE send_job_recipients SET status = 'cancelled', next_attempt_at = NULL
       WHERE send_job_id = :jobId AND status = 'queued'`,
      { jobId }
    );
    await connection.query(
      "UPDATE send_jobs SET status = 'cancelled', completed_at = UTC_TIMESTAMP() WHERE id = :jobId",
      { jobId }
    );
    return "cancelled";
  });
}

/** Recipients stuck in `sending` (crashed worker) are failed rather than resent, to avoid duplicates. */
async function failStaleLocks() {
  const staleApi = await query(
    `SELECT r.id FROM send_job_recipients r INNER JOIN send_jobs j ON j.id = r.send_job_id
     WHERE r.status = 'sending' AND r.locked_until < UTC_TIMESTAMP() AND j.source = 'api'`
  );
  await query(
    `UPDATE send_job_recipients
     SET status = 'failed', failed_at = UTC_TIMESTAMP(), error_code = 'interrupted',
         error_message = 'Sending was interrupted. Not retried automatically to avoid duplicate messages.'
     WHERE status = 'sending' AND locked_until < UTC_TIMESTAMP()`
  );
  for (const row of staleApi) await emitMessageEvent(row.id, "message.failed");
}

async function claimBatch() {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT id FROM send_job_recipients
       WHERE status = 'queued' AND next_attempt_at <= UTC_TIMESTAMP()
       ORDER BY next_attempt_at ASC
       LIMIT ${BATCH_SIZE}
       FOR UPDATE SKIP LOCKED`
    );
    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    await connection.query(
      `UPDATE send_job_recipients
       SET status = 'sending', attempts = attempts + 1,
           locked_until = UTC_TIMESTAMP() + INTERVAL ${LOCK_SECONDS} SECOND
       WHERE id IN (:ids)`,
      { ids }
    );

    const [claimed] = await connection.query(
      `SELECT r.id, r.send_job_id, r.contact_id, r.attempts, r.values_json AS recipient_values,
              j.source AS job_source,
              c.phone, c.first_name, c.last_name, c.email, c.company, c.opt_in, c.attributes_json,
              j.organization_id, j.status AS job_status, j.variables_json, j.header_media_json,
              t.id AS template_id, t.name AS template_name, t.language, t.status AS template_status,
              t.components_json
       FROM send_job_recipients r
       INNER JOIN contacts c ON c.id = r.contact_id
       INNER JOIN send_jobs j ON j.id = r.send_job_id
       INNER JOIN templates t ON t.id = j.template_id
       WHERE r.id IN (:ids)`,
      { ids }
    );

    const jobIds = [...new Set(claimed.map((row) => row.send_job_id))];
    if (jobIds.length) {
      await connection.query(
        `UPDATE send_jobs SET status = 'running', started_at = COALESCE(started_at, UTC_TIMESTAMP())
         WHERE id IN (:jobIds) AND status IN ('queued', 'scheduled')`,
        { jobIds }
      );
    }

    return claimed;
  });
}

async function markRecipient(id, fields) {
  await query(
    `UPDATE send_job_recipients
     SET status = :status, error_code = :errorCode, error_message = :errorMessage,
         meta_message_id = COALESCE(:messageId, meta_message_id),
         variables_json = COALESCE(:variables, variables_json),
         next_attempt_at = :nextAttemptAt, locked_until = NULL,
         sent_at = IF(:status = 'sent', UTC_TIMESTAMP(), sent_at),
         failed_at = IF(:status IN ('failed', 'skipped'), UTC_TIMESTAMP(), failed_at)
     WHERE id = :id`,
    {
      id,
      status: fields.status,
      errorCode: fields.errorCode ?? null,
      errorMessage: fields.errorMessage ? String(fields.errorMessage).slice(0, 2000) : null,
      messageId: fields.messageId ?? null,
      variables: fields.variables ? JSON.stringify(fields.variables) : null,
      nextAttemptAt: fields.nextAttemptAt ?? null,
    }
  );
}

/** Values supplied per message (API sends) win over campaign variable rules. */
function recipientValues(row, slots) {
  const explicit = parseJson(row.recipient_values, null);
  if (!explicit) return resolveVariables(slots, parseJson(row.variables_json, {}), row);
  const values = {};
  const missing = [];
  for (const slot of slots) {
    values[slot.key] = sanitizeParameter(explicit[slot.key]);
    if (!values[slot.key]) missing.push(slot.label);
  }
  return { values, missing };
}

async function processRecipient(row, connectionCache) {
  const isApi = row.job_source === "api";
  const finish = async (fields) => {
    await markRecipient(row.id, fields);
    if (isApi && ["failed", "skipped"].includes(fields.status)) await emitMessageEvent(row.id, "message.failed");
  };

  if (row.job_status === "cancelled") {
    return markRecipient(row.id, { status: "cancelled" });
  }
  if (!row.opt_in) {
    return finish({ status: "skipped", errorCode: "opted_out", errorMessage: "Contact opted out before sending." });
  }
  if (row.template_status !== "APPROVED") {
    return finish({
      status: "failed",
      errorCode: "template_not_approved",
      errorMessage: `Template status is ${row.template_status}.`,
    });
  }

  const components = parseJson(row.components_json, []);
  const slots = templateVariableSlots(components);
  const { values, missing } = recipientValues(row, slots);
  if (missing.length) {
    return finish({
      status: "skipped",
      errorCode: "missing_variables",
      errorMessage: `No value for ${missing.join(", ")}.`,
    });
  }

  try {
    if (!connectionCache.has(row.organization_id)) {
      connectionCache.set(row.organization_id, resolveWhatsAppConnection(row.organization_id));
    }
    const connection = await connectionCache.get(row.organization_id);
    const sendComponents = buildSendComponents(components, values, parseJson(row.header_media_json, null));
    const response = await sendMetaTemplateMessage({
      phoneNumberId: connection.phoneNumberId,
      token: connection.accessToken,
      to: row.phone,
      templateName: row.template_name,
      language: row.language,
      components: sendComponents,
    });

    const messageId = response.messages?.[0]?.id || null;
    const waId = response.contacts?.[0]?.wa_id || null;
    await markRecipient(row.id, { status: "sent", messageId, variables: values });
    if (isApi) await emitMessageEvent(row.id, "message.sent");
    await query(
      `INSERT INTO message_logs
         (id, organization_id, contact_id, send_job_id, meta_message_id, wa_id, direction, status,
          message_type, payload_json, status_updated_at)
       VALUES
         (:id, :organizationId, :contactId, :jobId, :messageId, :waId, 'outbound', 'sent',
          'template', :payload, UTC_TIMESTAMP())`,
      {
        id: crypto.randomUUID(),
        organizationId: row.organization_id,
        contactId: row.contact_id,
        jobId: row.send_job_id,
        messageId,
        waId,
        payload: JSON.stringify({ template: row.template_name, components: sendComponents, response }),
      }
    );
    if (waId) {
      await query("UPDATE contacts SET wa_id = :waId WHERE id = :id AND (wa_id IS NULL OR wa_id <> :waId)", {
        waId,
        id: row.contact_id,
      });
    }
  } catch (error) {
    const retry = error.retryable && row.attempts < MAX_ATTEMPTS;
    const delaySeconds = 30 * 2 ** (row.attempts - 1);
    const fields = {
      status: retry ? "queued" : "failed",
      errorCode: error.metaCode != null ? String(error.metaCode) : "error",
      errorMessage: error.message,
      nextAttemptAt: retry ? new Date(Date.now() + delaySeconds * 1000) : null,
    };
    if (retry) await markRecipient(row.id, fields);
    else await finish(fields);
  }
}

/** Recomputes sent/failed counts and final status from recipient rows. */
export async function finalizeJobs(jobIds) {
  if (!jobIds.length) return;
  await query(
    `UPDATE send_jobs j
     LEFT JOIN (
       SELECT send_job_id,
              SUM(status IN ('queued', 'sending')) AS pending,
              SUM(status IN ('sent', 'delivered', 'read')) AS sent,
              SUM(status IN ('failed', 'skipped')) AS failed
       FROM send_job_recipients
       WHERE send_job_id IN (:jobIds)
       GROUP BY send_job_id
     ) s ON s.send_job_id = j.id
     SET j.sent_count = COALESCE(s.sent, 0),
         j.failed_count = COALESCE(s.failed, 0),
         j.status = CASE
           WHEN j.status = 'cancelled' THEN 'cancelled'
           WHEN COALESCE(s.pending, 0) > 0 THEN j.status
           WHEN COALESCE(s.failed, 0) > 0 AND COALESCE(s.sent, 0) = 0 THEN 'failed'
           WHEN COALESCE(s.failed, 0) > 0 THEN 'completed_with_errors'
           ELSE 'completed' END,
         j.completed_at = IF(COALESCE(s.pending, 0) = 0 AND j.completed_at IS NULL, UTC_TIMESTAMP(), j.completed_at)
     WHERE j.id IN (:jobIds)`,
    { jobIds }
  );
}

async function runPool(items, worker, size) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * Drains due recipients in batches. Safe to call concurrently from multiple
 * processes: rows are claimed with `FOR UPDATE SKIP LOCKED`.
 */
export async function processSendQueue({ maxBatches = 20, timeBudgetMs = Infinity } = {}) {
  const deadline = Date.now() + timeBudgetMs;
  await failStaleLocks();
  const connectionCache = new Map();
  let processed = 0;

  // On serverless the function is killed at its max duration, and anything
  // still "sending" would later be marked failed. Stop claiming new batches
  // early so every claimed recipient finishes cleanly.
  // Always take at least one batch so a chain of short runs makes progress.
  for (let batch = 0; batch < maxBatches && (batch === 0 || Date.now() < deadline); batch += 1) {
    const rows = await claimBatch();
    if (!rows.length) break;
    await runPool(rows, (row) => processRecipient(row, connectionCache), CONCURRENCY);
    await finalizeJobs([...new Set(rows.map((row) => row.send_job_id))]);
    processed += rows.length;
  }

  // Jobs whose recipients were all handled elsewhere (e.g. cancelled or stale-failed).
  const stale = await query(
    `SELECT j.id FROM send_jobs j
     WHERE j.status IN ('queued', 'running', 'scheduled')
       AND NOT EXISTS (
         SELECT 1 FROM send_job_recipients r
         WHERE r.send_job_id = j.id AND r.status IN ('queued', 'sending'))
     LIMIT 100`
  );
  await finalizeJobs(stale.map((row) => row.id));

  return { processed };
}

export async function hasDueWork() {
  const rows = await query(
    `SELECT 1 FROM send_job_recipients
     WHERE (status = 'queued' AND next_attempt_at <= UTC_TIMESTAMP())
        OR (status = 'sending' AND locked_until < UTC_TIMESTAMP())
     LIMIT 1`
  );
  return rows.length > 0;
}

let draining = null;

/** Starts draining in the background unless this process is already doing so. */
export function kickSendQueue(options = {}) {
  if (!draining) {
    draining = processSendQueue(options)
      .catch((error) => console.error("send queue failed", error))
      .finally(() => {
        draining = null;
      });
  }
  return draining;
}
