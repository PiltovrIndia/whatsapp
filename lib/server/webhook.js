import crypto from "crypto";
import { isStatusAdvance, keywordIntent } from "@/lib/server/webhook-utils";
export { verifyWebhookSignature } from "@/lib/server/webhook-utils";
import { query } from "@/lib/server/db";
import { platformWhatsAppConfig } from "@/lib/server/whatsapp-config";
import { audit } from "@/lib/server/audit";
import { finalizeJobs } from "@/lib/server/send-queue";

function inboundText(message) {
  switch (message.type) {
    case "text": return message.text?.body || "";
    case "button": return message.button?.text || message.button?.payload || "";
    case "interactive":
      return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
    case "image":
    case "video":
    case "document":
      return message[message.type]?.caption || `[${message.type}]`;
    default: return `[${message.type || "message"}]`;
  }
}

async function organizationForPhoneNumber(phoneNumberId) {
  if (!phoneNumberId) return null;
  const [row] = await query(
    "SELECT organization_id FROM whatsapp_phone_numbers WHERE phone_number_id = :phoneNumberId LIMIT 1",
    { phoneNumberId }
  );
  return row?.organization_id || null;
}

/**
 * On the shared platform number, an inbound message belongs to the workspace
 * that most recently messaged that WhatsApp user; otherwise to the workspace
 * that most recently updated a matching contact.
 */
async function organizationForPlatformSender(waId) {
  const [recent] = await query(
    `SELECT organization_id FROM message_logs
     WHERE wa_id = :waId AND direction = 'outbound'
     ORDER BY created_at DESC LIMIT 1`,
    { waId }
  );
  if (recent) return recent.organization_id;

  const [contact] = await query(
    `SELECT organization_id FROM contacts
     WHERE wa_id = :waId OR phone = :phone
     ORDER BY updated_at DESC LIMIT 1`,
    { waId, phone: `+${waId}` }
  );
  return contact?.organization_id || null;
}

async function handleStatus(status) {
  const next = status.status;
  const error = status.errors?.[0];
  const errorMessage = error ? error.error_data?.details || error.message || error.title : null;

  const [log] = await query(
    "SELECT id, status, organization_id FROM message_logs WHERE meta_message_id = :id AND direction = 'outbound' LIMIT 1",
    { id: status.id }
  );
  if (log && isStatusAdvance(log.status, next)) {
    await query(
      `UPDATE message_logs
       SET status = :status, status_payload_json = :payload, status_updated_at = UTC_TIMESTAMP(),
           error_code = :errorCode, error_message = :errorMessage
       WHERE id = :id`,
      {
        id: log.id,
        status: next,
        payload: JSON.stringify(status),
        errorCode: error?.code != null ? String(error.code) : null,
        errorMessage,
      }
    );
  }

  const [recipient] = await query(
    "SELECT id, status, send_job_id FROM send_job_recipients WHERE meta_message_id = :id LIMIT 1",
    { id: status.id }
  );
  if (recipient && isStatusAdvance(recipient.status, next)) {
    await query(
      `UPDATE send_job_recipients
       SET status = :status,
           delivered_at = IF(:status IN ('delivered', 'read'), COALESCE(delivered_at, UTC_TIMESTAMP()), delivered_at),
           read_at = IF(:status = 'read', UTC_TIMESTAMP(), read_at),
           failed_at = IF(:status = 'failed', UTC_TIMESTAMP(), failed_at),
           error_code = IF(:status = 'failed', :errorCode, error_code),
           error_message = IF(:status = 'failed', :errorMessage, error_message)
       WHERE id = :id`,
      {
        id: recipient.id,
        status: next,
        errorCode: error?.code != null ? String(error.code) : null,
        errorMessage,
      }
    );
    // Meta can accept a send and report it failed later (e.g. billing or
    // policy errors), so the campaign totals and final status must follow.
    if (next === "failed") await finalizeJobs([recipient.send_job_id]);
  }

  return log?.organization_id || null;
}

async function handleInboundMessage(message, organizationId, contactProfile) {
  const [existing] = await query(
    "SELECT id FROM message_logs WHERE meta_message_id = :id AND direction = 'inbound' LIMIT 1",
    { id: message.id }
  );
  if (existing) return;

  const waId = message.from;
  const [contact] = await query(
    `SELECT id, opt_in FROM contacts
     WHERE organization_id = :organizationId AND (wa_id = :waId OR phone = :phone)
     LIMIT 1`,
    { organizationId, waId, phone: `+${waId}` }
  );
  const text = inboundText(message);

  await query(
    `INSERT INTO message_logs
       (id, organization_id, contact_id, meta_message_id, wa_id, direction, status, message_type, body_text, payload_json)
     VALUES
       (:id, :organizationId, :contactId, :messageId, :waId, 'inbound', 'received', :type, :text, :payload)`,
    {
      id: crypto.randomUUID(),
      organizationId,
      contactId: contact?.id || null,
      messageId: message.id || null,
      waId,
      type: message.type || null,
      text,
      payload: JSON.stringify({ message, profile: contactProfile || null }),
    }
  );

  if (!contact) return;

  await query(
    "UPDATE contacts SET last_inbound_at = UTC_TIMESTAMP(), wa_id = COALESCE(wa_id, :waId) WHERE id = :id",
    { id: contact.id, waId }
  );

  const intent = keywordIntent(text);
  if (intent === "opt_out" && contact.opt_in) {
    await query(
      `UPDATE contacts SET opt_in = 0, opted_out_at = UTC_TIMESTAMP(), opt_out_reason = 'keyword'
       WHERE id = :id`,
      { id: contact.id }
    );
    await query(
      `UPDATE send_job_recipients SET status = 'skipped', error_code = 'opted_out',
         error_message = 'Contact replied STOP.', failed_at = UTC_TIMESTAMP()
       WHERE contact_id = :id AND status = 'queued'`,
      { id: contact.id }
    );
    await audit({ organization_id: organizationId }, "contact.opt_out", { contactId: contact.id, via: "keyword" });
  } else if (intent === "opt_in" && !contact.opt_in) {
    await query(
      "UPDATE contacts SET opt_in = 1, opted_out_at = NULL, opt_out_reason = NULL WHERE id = :id",
      { id: contact.id }
    );
    await audit({ organization_id: organizationId }, "contact.opt_in", { contactId: contact.id, via: "keyword" });
  }
}

async function handleTemplateEvent(field, value) {
  const templateId = value.message_template_id ? String(value.message_template_id) : null;
  if (!templateId) return;

  if (field === "message_template_status_update") {
    const reason = value.reason && value.reason !== "NONE" ? value.reason : null;
    await query(
      `UPDATE templates SET status = :status, rejected_reason = :reason, last_synced_at = UTC_TIMESTAMP()
       WHERE meta_template_id = :templateId`,
      { status: value.event, reason, templateId }
    );
  } else if (field === "template_category_update" && value.new_category) {
    await query(
      "UPDATE templates SET category = :category WHERE meta_template_id = :templateId",
      { category: value.new_category, templateId }
    );
  }
}

export async function processWebhookPayload(payload) {
  const platform = (() => {
    try {
      return platformWhatsAppConfig();
    } catch {
      return null;
    }
  })();

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id || null;
      const isPlatformNumber = Boolean(platform && phoneNumberId === platform.phoneNumberId);
      let organizationId = isPlatformNumber ? null : await organizationForPhoneNumber(phoneNumberId);

      for (const status of value.statuses || []) {
        const owner = await handleStatus(status);
        organizationId = organizationId || owner;
      }

      for (const message of value.messages || []) {
        const owner = isPlatformNumber
          ? await organizationForPlatformSender(message.from)
          : organizationId;
        organizationId = organizationId || owner;
        if (owner) {
          const profile = value.contacts?.find((contact) => contact.wa_id === message.from)?.profile;
          await handleInboundMessage(message, owner, profile);
        }
      }

      if (["message_template_status_update", "template_category_update"].includes(change.field)) {
        await handleTemplateEvent(change.field, value);
      }

      const eventType = value.statuses?.length
        ? "message_status"
        : value.messages?.length
          ? "inbound_message"
          : change.field || "unknown";

      await query(
        `INSERT INTO webhook_events (id, organization_id, waba_id, phone_number_id, event_type, payload_json)
         VALUES (:id, :organizationId, :wabaId, :phoneNumberId, :eventType, :payload)`,
        {
          id: crypto.randomUUID(),
          organizationId,
          wabaId: entry.id || null,
          phoneNumberId,
          eventType,
          payload: JSON.stringify({ field: change.field, value }),
        }
      );
    }
  }
}
