import crypto from "crypto";
import { requireSession } from "@/lib/server/auth";
import { parseJson, query, safeInt, withTransaction } from "@/lib/server/db";
import { normalizeEmail, normalizePhone } from "@/lib/server/contacts";
import { contactSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";

export async function GET(request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const page = safeInt(url.searchParams.get("page"), { min: 1, fallback: 1 });
    const pageSize = safeInt(url.searchParams.get("pageSize"), { min: 1, max: 200, fallback: 50 });
    const search = (url.searchParams.get("q") || "").trim();
    const listId = url.searchParams.get("listId");
    const status = url.searchParams.get("status");

    const conditions = ["c.organization_id = :organizationId"];
    const params = { organizationId: session.organization_id };
    if (search) {
      conditions.push(`(c.first_name LIKE :search OR c.last_name LIKE :search OR c.phone LIKE :search
        OR c.email LIKE :search OR c.company LIKE :search OR CONCAT(c.first_name, ' ', c.last_name) LIKE :search)`);
      params.search = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    }
    if (listId) {
      conditions.push("EXISTS (SELECT 1 FROM contact_list_members m WHERE m.contact_id = c.id AND m.contact_list_id = :listId)");
      params.listId = listId;
    }
    if (status === "opted_in") conditions.push("c.opt_in = 1");
    if (status === "opted_out") conditions.push("c.opt_in = 0");
    const where = conditions.join(" AND ");

    const contacts = await query(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.company, c.opt_in, c.source,
              c.attributes_json AS attributes, c.opted_out_at, c.last_inbound_at, c.created_at,
              (SELECT JSON_ARRAYAGG(m.contact_list_id) FROM contact_list_members m WHERE m.contact_id = c.id) AS list_ids
       FROM contacts c
       WHERE ${where}
       ORDER BY c.created_at DESC, c.id
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM contacts c WHERE ${where}`, params);

    return jsonOk({
      contacts: contacts.map((contact) => ({
        ...contact,
        attributes: parseJson(contact.attributes, {}),
        list_ids: parseJson(contact.list_ids, []) || [],
      })),
      total: Number(total),
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    const payload = contactSchema.parse(await request.json());
    const phone = normalizePhone(payload.phone);
    if (!phone) throw httpError(422, "Enter the phone number with its country code, e.g. +919876543210.");

    const [existing] = await query(
      "SELECT id FROM contacts WHERE organization_id = :organizationId AND phone = :phone",
      { organizationId: session.organization_id, phone }
    );
    if (existing) throw httpError(409, "A contact with this phone number already exists.");

    const id = crypto.randomUUID();
    await withTransaction(async (db) => {
      await db.query(
        `INSERT INTO contacts
           (id, organization_id, first_name, last_name, email, phone, company, opt_in, source, attributes_json)
         VALUES
           (:id, :organizationId, :firstName, :lastName, :email, :phone, :company, :optIn, :source, :attributes)`,
        {
          id,
          organizationId: session.organization_id,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: normalizeEmail(payload.email),
          phone,
          company: payload.company,
          optIn: payload.optIn ? 1 : 0,
          source: payload.source,
          attributes: payload.attributes ? JSON.stringify(payload.attributes) : null,
        }
      );
      if (payload.listIds.length) {
        await db.query(
          `INSERT IGNORE INTO contact_list_members (id, contact_list_id, contact_id)
           SELECT UUID(), cl.id, :id FROM contact_lists cl
           WHERE cl.organization_id = :organizationId AND cl.id IN (:listIds)`,
          { id, organizationId: session.organization_id, listIds: payload.listIds }
        );
      }
    });

    return jsonOk({ ok: true, id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
