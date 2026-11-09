import crypto from "crypto";
import { requireSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { contactFromMappedRow } from "@/lib/server/contacts";
import { contactImportSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

const CHUNK_SIZE = 500;

export const maxDuration = 120;

export async function POST(request) {
  try {
    const session = await requireSession();
    const payload = contactImportSchema.parse(await request.json());
    const mapsOptIn = Object.values(payload.mapping).includes("Opt In");

    if (!Object.values(payload.mapping).includes("Phone")) {
      throw httpError(422, "Map one column to Phone.");
    }
    if (!mapsOptIn && !payload.consentConfirmed) {
      throw httpError(422, "Map an Opt In column, or confirm that every contact in this file has agreed to receive WhatsApp messages.");
    }

    // Deduplicate by phone within the file; the last row wins.
    const byPhone = new Map();
    for (const row of payload.rows) {
      const contact = contactFromMappedRow(row, payload.mapping, {
        defaultCountryCode: payload.defaultCountryCode,
        defaultOptIn: true,
      });
      if (contact) byPhone.set(contact.phone, contact);
    }
    const contacts = [...byPhone.values()];
    const invalid = payload.rows.length - payload.rows.filter((row) =>
      contactFromMappedRow(row, payload.mapping, { defaultCountryCode: payload.defaultCountryCode })
    ).length;

    const result = await withTransaction(async (db) => {
      await db.query(
        `INSERT INTO contact_lists (id, organization_id, name) VALUES (:id, :organizationId, :name)
         ON DUPLICATE KEY UPDATE name = name`,
        { id: crypto.randomUUID(), organizationId: session.organization_id, name: payload.listName }
      );
      const [[list]] = await db.query(
        "SELECT id FROM contact_lists WHERE organization_id = :organizationId AND name = :name",
        { organizationId: session.organization_id, name: payload.listName }
      );

      const [[{ countBefore }]] = await db.query(
        "SELECT COUNT(*) AS countBefore FROM contacts WHERE organization_id = :organizationId",
        { organizationId: session.organization_id }
      );

      for (let offset = 0; offset < contacts.length; offset += CHUNK_SIZE) {
        const chunk = contacts.slice(offset, offset + CHUNK_SIZE);
        const rows = chunk.map((contact) => [
          crypto.randomUUID(),
          session.organization_id,
          contact.firstName,
          contact.lastName,
          contact.email,
          contact.phone,
          contact.company,
          contact.optIn ? 1 : 0,
          payload.source,
          contact.attributes ? JSON.stringify(contact.attributes) : null,
          contact.optIn ? null : new Date(),
          contact.optIn ? null : "import",
        ]);

        // Existing values are kept when the file leaves a field blank, and a
        // contact who opted out (replied STOP or was opted out by staff) is never re-opted-in by an import.
        await db.query(
          `INSERT INTO contacts
             (id, organization_id, first_name, last_name, email, phone, company, opt_in, source,
              attributes_json, opted_out_at, opt_out_reason)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             first_name = IF(VALUES(first_name) = '', first_name, VALUES(first_name)),
             last_name = IF(VALUES(last_name) = '', last_name, VALUES(last_name)),
             email = COALESCE(VALUES(email), email),
             company = IF(VALUES(company) = '', company, VALUES(company)),
             attributes_json = IF(VALUES(attributes_json) IS NULL, attributes_json,
               JSON_MERGE_PATCH(COALESCE(attributes_json, JSON_OBJECT()), VALUES(attributes_json))),
             opt_in = IF(opted_out_at IS NOT NULL AND opt_out_reason IN ('keyword', 'manual'), 0, VALUES(opt_in)),
             opted_out_at = IF(opt_in = 1, NULL, COALESCE(opted_out_at, VALUES(opted_out_at))),
             opt_out_reason = IF(opt_in = 1, NULL, COALESCE(opt_out_reason, VALUES(opt_out_reason)))`,
          [rows]
        );

        await db.query(
          `INSERT IGNORE INTO contact_list_members (id, contact_list_id, contact_id)
           SELECT UUID(), ?, c.id FROM contacts c
           WHERE c.organization_id = ? AND c.phone IN (?)`,
          [list.id, session.organization_id, chunk.map((contact) => contact.phone)]
        );
      }

      const [[{ countAfter }]] = await db.query(
        "SELECT COUNT(*) AS countAfter FROM contacts WHERE organization_id = :organizationId",
        { organizationId: session.organization_id }
      );

      const created = Number(countAfter) - Number(countBefore);
      return {
        imported: contacts.length,
        created,
        updated: contacts.length - created,
        skipped: invalid,
        duplicatesInFile: payload.rows.length - invalid - contacts.length,
        listId: list.id,
      };
    });

    await audit(session, "contacts.import", { ...result, source: payload.source, list: payload.listName });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
