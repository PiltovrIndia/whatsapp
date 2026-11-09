import { requireSession } from "@/lib/server/auth";
import { parseJson, query } from "@/lib/server/db";
import { normalizeEmail, normalizePhone } from "@/lib/server/contacts";
import { contactUpdateSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

async function loadContact(organizationId, id) {
  const [contact] = await query(
    `SELECT id, first_name, last_name, email, phone, company, opt_in, source, attributes_json AS attributes,
            opted_out_at, opt_out_reason, last_inbound_at, created_at, updated_at
     FROM contacts WHERE id = :id AND organization_id = :organizationId`,
    { id, organizationId }
  );
  if (!contact) throw httpError(404, "Contact not found.");
  return { ...contact, attributes: parseJson(contact.attributes, {}) };
}

export async function GET(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const contact = await loadContact(session.organization_id, id);
    const messages = await query(
      `SELECT id, direction, status, message_type, body_text, error_message, created_at
       FROM message_logs WHERE contact_id = :id ORDER BY created_at DESC LIMIT 50`,
      { id }
    );
    return jsonOk({ contact, messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const current = await loadContact(session.organization_id, id);
    const payload = contactUpdateSchema.parse(await request.json());

    const phone = payload.phone !== undefined ? normalizePhone(payload.phone) : current.phone;
    if (!phone) throw httpError(422, "Enter the phone number with its country code.");

    const optIn = payload.optIn !== undefined ? payload.optIn : Boolean(current.opt_in);
    const optChanged = optIn !== Boolean(current.opt_in);

    await query(
      `UPDATE contacts SET
         first_name = :firstName, last_name = :lastName, email = :email, phone = :phone,
         company = :company, opt_in = :optIn, attributes_json = :attributes,
         opted_out_at = IF(:optIn = 1, NULL, COALESCE(opted_out_at, UTC_TIMESTAMP())),
         opt_out_reason = IF(:optIn = 1, NULL, COALESCE(opt_out_reason, 'manual'))
       WHERE id = :id AND organization_id = :organizationId`,
      {
        id,
        organizationId: session.organization_id,
        firstName: payload.firstName ?? current.first_name,
        lastName: payload.lastName ?? current.last_name,
        email: payload.email !== undefined ? normalizeEmail(payload.email) : current.email,
        phone,
        company: payload.company ?? current.company,
        optIn: optIn ? 1 : 0,
        attributes: JSON.stringify(payload.attributes ?? current.attributes ?? {}),
      }
    );
    if (optChanged) await audit(session, optIn ? "contact.opt_in" : "contact.opt_out", { contactId: id, via: "manual" });

    return jsonOk({ ok: true, contact: await loadContact(session.organization_id, id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await loadContact(session.organization_id, id);
    await query("DELETE FROM contacts WHERE id = :id AND organization_id = :organizationId", {
      id,
      organizationId: session.organization_id,
    });
    await audit(session, "contact.delete", { contactId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
